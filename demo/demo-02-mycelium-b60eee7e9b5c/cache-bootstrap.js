const CACHE_VERSION = "9ecb01f9d9306338a75cb65d2f6d52a3510bfca7fb5ff8a617fd5ccba799f0a1";
                                    

class CachePreparationError extends Error {
  kind        ;
  constructor(kind        , message        ) {
    super(message);
    this.kind = kind;
  }
}

async function prepareCache()                {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const loading = (window               ).emergent_loading;
  loading.setPhase('检查本地资源', '正在准备游戏');
  let timeout                    ;
  let preparing_worker                           ;
  let resolve_ready             = () => undefined;
  let reject_ready                         = () => undefined;
  let reject_operation                         = () => undefined;
  const ready = new Promise      ((resolve, reject) => {
    resolve_ready = resolve;
    reject_ready = reject;
  });
  // Installation may start before register() resolves. Attach first and retain errors.
  ready.catch(() => undefined);
  const failed = new Promise       ((_, reject) => { reject_operation = reject; });
  failed.catch(() => undefined);
  const failPreparation = (error       ) => {
    reject_ready(error);
    reject_operation(error);
  };
  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      preparing_worker?.postMessage({ type: 'cancel_cache_preparation' });
      failPreparation(new CachePreparationError('network', '游戏下载暂时没有响应，请重试。'));
    }, 45000);
  };
  const onProgress = (event                                                       ) => {
    const snapshot = event.data;
    if (snapshot?.type !== 'cache_progress' || snapshot.cache_id !== CACHE_VERSION) return;
    if (event.source && 'scriptURL' in event.source) preparing_worker = event.source                 ;
    resetTimeout();
    loading.reportCache(snapshot);
    if (snapshot.phase === 'ready') resolve_ready();
    if (snapshot.phase === 'failed') {
      console.warn('Game cache preparation failed:', snapshot.error);
      const kind = snapshot.error_kind ?? 'network';
      const message = kind === 'integrity' ? '游戏资源校验失败，请重新加载。'
        : kind === 'storage' ? '本地缓存暂时不可用。' : '游戏下载中断，请检查网络后重试。';
      failPreparation(new CachePreparationError(kind, message));
    }
  };
  navigator.serviceWorker.addEventListener('message', onProgress);
  resetTimeout();
  try {
    // Firefox's update job can wait for an installing worker. A stalled
    // download must also interrupt that wait, rather than only the ready wait.
    const registration = await Promise.race([
      navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' }), failed
    ]);
    await Promise.race([registration.update(), failed]);
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) throw new CachePreparationError('network', '无法准备游戏资源，请重试。');
    preparing_worker = worker;
    worker.postMessage({ type: 'prepare_cache' });
    const onState = () => {
      if (worker.state === 'redundant') {
        // The worker posts its classified failure before becoming redundant.
        // Leave a brief turn for that message instead of masking storage errors.
        window.setTimeout(() => failPreparation(new CachePreparationError('network', '游戏资源准备失败，请重试。')), 500);
      }
    };
    worker.addEventListener('statechange', onState);
    onState();
    try {
      await ready;
      if (worker.state !== 'activated') {
        await new Promise      ((resolve, reject) => {
          const activation_timeout = window.setTimeout(() => {
            worker.removeEventListener('statechange', check);
            reject(new CachePreparationError('storage', '无法启用本地游戏缓存。'));
          }, 10000);
          const check = () => {
            if (worker.state === 'activated' || worker.state === 'redundant') {
              clearTimeout(activation_timeout);
              worker.removeEventListener('statechange', check);
              if (worker.state === 'activated') resolve();
              else reject(new CachePreparationError('network', '游戏资源准备失败，请重试。'));
            }
          };
          worker.addEventListener('statechange', check);
          check();
        });
      }
    } finally {
      worker.removeEventListener('statechange', onState);
    }
    if (navigator.serviceWorker.controller !== registration.active) {
      await new Promise      ((resolve, reject) => {
        const controller_timeout = window.setTimeout(() => {
          navigator.serviceWorker.removeEventListener('controllerchange', check);
          reject(new CachePreparationError('storage', '无法使用本地游戏缓存。'));
        }, 5000);
        const check = () => {
          if (navigator.serviceWorker.controller === registration.active) {
            clearTimeout(controller_timeout);
            navigator.serviceWorker.removeEventListener('controllerchange', check);
            resolve();
          }
        };
        navigator.serviceWorker.addEventListener('controllerchange', check);
        registration.active?.postMessage({ type: 'claim_clients' });
        check();
      });
    }
  } catch (error) {
    if (error instanceof CachePreparationError) throw error;
    const error_name = error !== null && typeof error === 'object' && 'name' in error ? String(error.name) : '';
    if (['SecurityError', 'NotSupportedError'].includes(error_name)) {
      throw new CachePreparationError('storage', '浏览器无法使用本地缓存。');
    }
    // A rejected registration/update job can arrive just before its worker's
    // classified failure message. Keep listening briefly before choosing a
    // network error; only an explicit storage failure may bypass the cache.
    let failure_timeout                    ;
    try {
      await Promise.race([failed, new Promise       ((_, reject) => {
        failure_timeout = window.setTimeout(() => reject(new CachePreparationError('network', '无法准备游戏资源，请检查网络后重试。')), 750);
      })]);
    } finally {
      clearTimeout(failure_timeout);
    }
  } finally {
    clearTimeout(timeout);
    navigator.serviceWorker.removeEventListener('message', onProgress);
  }
}

const bootstrap_page = window               ;
bootstrap_page.emergent_cache_ready = prepareCache()
  .catch(error => {
    if (error instanceof CachePreparationError && error.kind !== 'storage') throw error;
    console.warn('Persistent game cache unavailable; using HTTP cache.', error);
    bootstrap_page.emergent_loading.cache_prepared = false;
    bootstrap_page.emergent_loading.setPhase('正在加载游戏', '正在准备游戏资源');
  })
  .then(() => new Promise      ((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './godot.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('无法下载游戏引擎，请重试。'));
    document.head.appendChild(script);
  }));
