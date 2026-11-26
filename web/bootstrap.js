(() => {
  'use strict';
  if (window.KOREA_CATALOG_READY) return;

  const diagnostic = new URLSearchParams(location.search).get('qa-candidates') === '1';
  const requiredText = ['id', 'name', 'region', 'location', 'category', 'categoryLabel', 'kind', 'provider', 'sourceUrl', 'searchAliases'];
  function publicUrl(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }
  function validate(rows, expectedCount) {
    if (!Array.isArray(rows) || !rows.length || (expectedCount && rows.length !== expectedCount)) {
      throw new Error('The camera collection could not be loaded.');
    }
    const ids = new Set();
    for (const camera of rows) {
      if (!camera || requiredText.some(field => typeof camera[field] !== 'string' || !camera[field])
        || ids.has(camera.id) || !['hls', 'iframe', 'youtube'].includes(camera.kind)
        || !Number.isFinite(camera.lat) || Math.abs(camera.lat) > 90
        || !Number.isFinite(camera.lng) || Math.abs(camera.lng) > 180
        || !publicUrl(camera.sourceUrl)
        || (camera.kind === 'hls' && !publicUrl(camera.streamUrl))
        || (camera.kind === 'iframe' && !publicUrl(camera.embedUrl))
        || (camera.kind === 'youtube' && (typeof camera.videoId !== 'string' || !camera.videoId))
        || (camera.proxy !== undefined && typeof camera.proxy !== 'boolean')
        || (camera.sessionLimitSeconds !== undefined && (!Number.isFinite(camera.sessionLimitSeconds) || camera.sessionLimitSeconds <= 0))) {
        throw new Error('The camera collection contains an invalid entry.');
      }
      ids.add(camera.id);
    }
    return rows;
  }

  async function loadPublicCatalog() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(new URL('/catalog.json', document.baseURI), {
        signal: controller.signal,
        credentials: 'same-origin',
        headers: {Accept: 'application/json'},
      });
      if (!response.ok) throw new Error('The camera collection is unavailable.');
      const rows = validate(await response.json(), 400);
      window.KOREA_DISPLAY_CAMERAS = rows;
      return rows;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadDiagnosticCatalog() {
    await window.KOREA_LOAD_SCRIPT('cameras.js');
    await window.KOREA_LOAD_SCRIPT('catalog-en.js');
    return validate(window.KOREA_DISPLAY_CAMERAS);
  }

  const ready = diagnostic ? loadDiagnosticCatalog() : loadPublicCatalog();
  window.KOREA_CATALOG_READY = ready;
  // Defer scripts may still be downloading when a request fails. The app owns
  // the visible failure state; retain the rejection for its awaited promise.
  ready.catch(() => {});
})();
