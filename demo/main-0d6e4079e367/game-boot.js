                       
                                                                                                       
                                                              
  

(async () => {
  const game_page = window               ;
  const loading = game_page.emergent_loading;
  performance.mark('emergent:boot');
  try {
    await game_page.emergent_cache_ready;
    const missing = Engine.getMissingFeatures({ threads: false });
    if (missing.length) throw new Error(`浏览器缺少游戏所需功能：${missing.join('、')}`);
    let sizes                         = {};
    try {
      const response = await fetch('twodog.sizes.json');
      if (response.ok) sizes = await response.json();
    } catch { /* The engine can still start with indeterminate progress. */ }
    if (loading.cache_prepared) loading.setPhase('正在启动游戏', loading.cached_only ? '使用本地缓存，正在准备画面。' : '下载完成，正在准备画面。');
    else loading.setPhase('正在加载游戏', '正在准备游戏资源');
    const engine = new Engine({
      args: [],
      canvasResizePolicy: 2,
      ensureCrossOriginIsolationHeaders: false,
      executable: 'godot',
      experimentalVK: false,
      focusCanvas: true,
      gdextensionLibs: [],
      fileSizes: sizes,
      precompressedSuffix: '',
      onProgress: (current        , total        ) => loading.reportEngine(current, total)
    });
    await engine.startGame({});
    performance.mark('emergent:first-frame');
    const duration = performance.measure('emergent:startup', 'emergent:boot', 'emergent:first-frame').duration;
    console.log(`Emergent: first frame ${Math.round(duration)} ms after boot`);
    loading.finish();
  } catch (error) {
    console.error(error);
    loading.fail(error);
  }
})();
