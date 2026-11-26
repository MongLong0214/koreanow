(() => {
  'use strict';
  if (window.KOREA_LOAD_SCRIPT) return;

  const scripts = new Map();
  const timeoutMs = 12000;

  window.KOREA_LOAD_SCRIPT = function loadScript(path) {
    let url;
    try {
      url = new URL(path, location.origin + '/');
      if (url.origin !== location.origin || !url.pathname.endsWith('.js') || url.username || url.password) {
        throw new Error('Only local JavaScript resources can be loaded.');
      }
      url.hash = '';
    } catch (error) {
      return Promise.reject(error);
    }
    const key = url.href;
    if (scripts.has(key)) return scripts.get(key);

    let resolve, reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    scripts.set(key, promise);
    const script = document.createElement('script');
    script.src = key;
    script.async = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    let settled = false;
    let timer;
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        if (scripts.get(key) === promise) scripts.delete(key);
        reject(error);
      } else {
        resolve();
      }
    }
    script.onload = () => finish();
    script.onerror = () => finish(new Error('Could not load ' + url.pathname));
    timer = setTimeout(() => finish(new Error('Loading timed out: ' + url.pathname)), timeoutMs);
    try {
      document.head.appendChild(script);
    } catch (error) {
      finish(error);
    }
    return promise;
  };
})();
