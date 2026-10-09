                         
                         
                   
                                                         
                           
                      
                       
                       
                          
                      
                 
 

                       
                          
                       
                                                 
                                             
                                                     
                             
                 
 

;                            
                                
                                      
  

(() => {
  const overlay = document.getElementById('status') ;
  const title = document.getElementById('status-title') ;
  const detail = document.getElementById('status-detail') ;
  const percentage = document.getElementById('status-percent') ;
  const progress = document.getElementById('status-progress')                       ;
  const notice = document.getElementById('status-notice') ;
  const retry = document.getElementById('status-retry')                     ;
  let finished = false;
  let failed = false;
  const megabytes = (bytes        ) => `${(bytes / 1000000).toFixed(1)} MB`;
  const setProgress = (current        , total        ) => {
    if (total <= 0) {
      progress.removeAttribute('value');
      percentage.textContent = '…';
      return;
    }
    const value = Math.min(100, Math.max(0, current / total * 100));
    progress.value = value;
    percentage.textContent = `${Math.floor(value)}%`;
  };
  const view              = {
    cache_prepared: false,
    cached_only: false,
    setPhase(message, description = '') {
      if (finished || failed) return;
      title.textContent = message;
      detail.textContent = description;
      setProgress(0, 0);
    },
    reportCache(snapshot) {
      if (finished || failed || snapshot.phase === 'failed') return;
      if (snapshot.phase === 'checking') {
        view.setPhase('检查本地资源', '正在准备游戏');
        return;
      }
      if (snapshot.phase === 'ready') {
        view.cache_prepared = true;
        view.cached_only = snapshot.total_bytes === 0;
        title.textContent = view.cached_only ? '使用本地缓存' : '下载完成';
        detail.textContent = '正在准备启动游戏';
        setProgress(1, 1);
        return;
      }
      title.textContent = '正在下载游戏';
      detail.textContent = `游戏资源 ${megabytes(snapshot.downloaded_bytes)} / ${megabytes(snapshot.total_bytes)}`
        + (snapshot.cached_bytes > 0 ? ` · 本地已有 ${megabytes(snapshot.cached_bytes)}` : '');
      setProgress(snapshot.downloaded_bytes, snapshot.total_bytes);
      // Reading the final chunk still needs verification and storage.
      if (progress.value >= 100) {
        progress.value = 99;
        percentage.textContent = '99%';
        title.textContent = '正在校验游戏资源';
      }
    },
    reportEngine(current, total) {
      if (finished || failed || view.cache_prepared) return;
      if (current > 0 && total > 0 && current < total) {
        title.textContent = '正在下载游戏';
        detail.textContent = `引擎资源 ${megabytes(current)} / ${megabytes(total)}`;
        setProgress(current, total);
      } else if (current > 0 && total > 0 && current >= total) {
        view.setPhase('正在启动游戏', '资源已就绪，请稍候');
      }
    },
    fail(error) {
      if (finished || failed) return;
      failed = true;
      title.textContent = '游戏加载失败';
      detail.textContent = '请检查网络连接，然后重试。';
      progress.hidden = true;
      percentage.hidden = true;
      notice.textContent = error instanceof Error ? error.message : String(error);
      notice.hidden = false;
      retry.hidden = false;
    },
    finish() {
      if (failed || finished) return;
      finished = true;
      overlay.remove();
    }
  };
  retry.addEventListener('click', () => location.reload());
  (window               ).emergent_loading = view;
})();
