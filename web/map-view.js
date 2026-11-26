(() => {
  'use strict';
  // The map has its own startup path. Camera fetching, validation and list
  // hydration must never keep the detailed basemap from starting.
  if (window.KOREA_MAP_VIEW) return;
  const $ = id => document.getElementById(id);
  const container = $('map');
  if (!container) return;
  if (!window.L) {
    $('map-notice').hidden = false;
    return;
  }
  const compactViewport = matchMedia('(max-width: 760px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const requestFrame = window.requestAnimationFrame?.bind(window) || (callback => setTimeout(callback, 16));
  function setListCollapsed(collapsed) {
    document.body.classList.toggle('list-collapsed', collapsed);
    $('list-toggle').setAttribute('aria-expanded', String(!collapsed));
    $('list-toggle').setAttribute('aria-label', collapsed ? 'Show camera list' : 'Hide camera list');
  }
  // The compact sidebar must not cover the early map while cameras download.
  // Its static source links remain available through the same toggle.
  setListCollapsed(compactViewport.matches);
  $('list-toggle').addEventListener('click', () => {
    setListCollapsed(!document.body.classList.contains('list-collapsed'));
  });
  compactViewport.addEventListener?.('change', () => setListCollapsed(compactViewport.matches));
  let initialBounds = null;
  try {
    const bounds = JSON.parse(container.dataset.bounds || 'null');
    if (Array.isArray(bounds) && bounds.length === 2 && bounds.every(point =>
      Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) &&
      Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180) &&
      bounds[0][0] <= bounds[1][0] && bounds[0][1] <= bounds[1][1]) initialBounds = bounds;
  } catch {}

  container.dataset.mapStartedAt = String(Math.round(window.performance.now()));
  container.dataset.presentation = 'loading';
  window.performance.mark?.('koreanow:map-start');
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    minZoom: 5,
    maxZoom: 20,
    zoomSnap: .25,
    zoomDelta: 1,
    wheelPxPerZoomLevel: 100,
    maxBounds: [[30.5, 120], [41.7, 137]],
    maxBoundsViscosity: .7,
    scrollWheelZoom: true,
    // Tile load completion must not precede a separate opacity animation.
    fadeAnimation: false,
  });
  map.attributionControl.setPrefix(false);

  function fitBounds(bounds, animate = true) {
    const collapsed = document.body.classList.contains('list-collapsed');
    map.fitBounds(L.latLngBounds(bounds), {
      paddingTopLeft: compactViewport.matches ? [35, 140] : [collapsed ? 60 : 332, 96],
      paddingBottomRight: compactViewport.matches ? [35, 70] : [70, 70],
      maxZoom: 12,
      animate: animate && !reducedMotion,
    });
  }
  // Set the final camera BEFORE a renderer starts requesting viewport tiles.
  // Server-rendered regional bounds also cover one-camera collections.
  if (initialBounds) fitBounds(initialBounds, false);
  else map.setView([35.7, 128.3], 6.7);

  let fitHandler = () => initialBounds ? fitBounds(initialBounds) : map.setView([35.7, 128.3], 6.7);
  let presentationReady = false;
  let presentationVersion = 0;
  let startupSettled = false;
  let resolveReady, rejectReady;
  const mapReady = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // The camera application may still be waiting for its own catalog promise.
  // Preserve this rejection for its consumer without an unhandled rejection.
  mapReady.catch(() => {});

  function beginPresentation() {
    presentationReady = false;
    presentationVersion++;
    container.dataset.presentation = 'loading';
    container.dataset.basemap = 'loading';
  }

  function presentBasemap(renderer) {
    const version = presentationVersion;
    // Renderer callbacks run before the browser presents the frame. Yield a
    // paint opportunity before camera projection/DOM work and marker display.
    requestFrame(() => requestFrame(() => {
      if (version !== presentationVersion || presentationReady) return;
      presentationReady = true;
      container.dataset.presentation = 'ready';
      if (renderer !== 'overview' && !container.dataset.mapReadyAt) {
        container.dataset.mapReadyAt = String(Math.round(window.performance.now()));
        window.performance.mark?.('koreanow:map-ready');
        window.performance.measure?.('koreanow:map-startup', 'koreanow:map-start', 'koreanow:map-ready');
      }
      if (!startupSettled) {
        startupSettled = true;
        resolveReady({renderer});
      }
      // A later WebGL context loss can recover through Canvas. Consumers need
      // the current filter/selection, not a captured initial marker collection.
      map.fire('basemapready', {renderer});
    }));
  }

  function failPresentation(error) {
    presentationReady = false;
    presentationVersion++;
    container.dataset.presentation = 'loading';
    if (!startupSettled) {
      startupSettled = true;
      rejectReady(error);
    }
  }

  window.KOREA_MAP_VIEW = {
    map,
    ready: mapReady,
    get isReady() { return presentationReady; },
    hasInitialBounds: Boolean(initialBounds),
    fitBounds,
    setListCollapsed,
    setFitHandler(handler) { fitHandler = handler; },
  };
  $('zoom-in').addEventListener('click', () => map.zoomIn());
  $('zoom-out').addEventListener('click', () => map.zoomOut());
  $('fit-map').addEventListener('click', () => fitHandler());
  L.control.scale({
    position: 'bottomleft', imperial: false, maxWidth: 90, updateWhenIdle: true,
  }).addTo(map);

  const initialSize = map.getSize();
  let previousWidth = initialSize.x;
  let previousHeight = initialSize.y;
  let resizeFrame = null;
  if (window.ResizeObserver) new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    if (!width || !height || (width === previousWidth && height === previousHeight)) return;
    previousWidth = width;
    previousHeight = height;
    if (resizeFrame !== null) return;
    resizeFrame = requestFrame(() => {
      resizeFrame = null;
      map.invalidateSize({ pan: false, debounceMoveend: true });
    });
  }).observe(container);

  initBasemap();
  function initBasemap() {
    const attribution = '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>';
    let vector = null;
    let canvas = null;
    let geography = null;
    let ready = false;
    let startupTimer = null;
    let canvasStarted = false;

    const showOverview = async () => {
      $('map').dataset.basemap = 'overview';
      if (!$('map-notice').dataset.catalogError) {
        $('map-notice').textContent = 'Map details unavailable. Cameras still work.';
        $('map-notice').hidden = false;
      }
      if (!window.KOREA_GEOGRAPHY && window.KOREA_LOAD_SCRIPT) {
        try {
          await window.KOREA_LOAD_SCRIPT('/map-geography.js');
        } catch (error) {
          console.warn('Overview map unavailable:', error.message);
        }
      }
      if (ready) return;
      if (!geography && window.KOREA_GEOGRAPHY && typeof L.geoJSON === 'function') {
        try {
          geography = L.geoJSON(window.KOREA_GEOGRAPHY, {
            interactive: false,
            smoothFactor: .8,
            style: feature => ({
              color: feature.id === 'KOR' ? '#58646c' : '#29383e',
              weight: feature.id === 'KOR' ? 1 : .7,
              fillColor: feature.id === 'KOR' ? '#172127' : '#11191f',
              fillOpacity: 1,
              opacity: 1,
            }),
          }).addTo(map);
          map.attributionControl.addAttribution(attribution);
        } catch (error) {
          console.warn('Overview map unavailable:', error.message);
          failPresentation(error);
          return;
        }
      }
      if (geography) presentBasemap('overview');
      else failPresentation(new Error('No map renderer could draw the initial view.'));
    };
    const showDetailed = renderer => {
      ready = true;
      clearTimeout(startupTimer);
      if (geography) {
        map.removeLayer(geography);
        geography = null;
        map.attributionControl.removeAttribution(attribution);
      }
      $('map').dataset.basemap = renderer === 'canvas' ? 'detailed-canvas' : 'detailed';
      if (!$('map-notice').dataset.catalogError) $('map-notice').hidden = true;
      presentBasemap(renderer);
    };
    const removeVector = () => {
      if (!vector) return;
      const previous = vector;
      const remove = previous.onRemove;
      vector = null;
      const sourceAttribution = previous.getAttribution();
      if (sourceAttribution) map.attributionControl.removeAttribution(sourceAttribution);
      previous.onRemove = function(leafletMap) {
        try {
          if (this.getMaplibreMap()) remove.call(this, leafletMap);
          else this.getContainer()?.remove();
        } catch {
          this.getContainer()?.remove();
        }
      };
      map.removeLayer(previous);
    };
    const startCanvas = async () => {
      if (canvasStarted) return;
      canvasStarted = true;
      ready = false;
      clearTimeout(startupTimer);
      beginPresentation();
      removeVector();
      try {
        const fallback = await window.KOREA_CANVAS_BASEMAP.addTo(map);
        canvas = fallback.layer;
        await fallback.ready;
        showDetailed('canvas');
      } catch (error) {
        console.warn('Map details unavailable:', error.message);
        if (canvas) {
          map.removeLayer(canvas);
          canvas = null;
        }
        showOverview();
      }
    };

    beginPresentation();
    if (!window.maplibregl || typeof L.maplibreGL !== 'function') {
      startCanvas();
      return;
    }
    try {
      vector = L.maplibreGL({
        style: '/map-style-dark.json', interactive: false, padding: .1, updateInterval: 16,
      });
      vector.addTo(map);
      const renderer = vector.getMaplibreMap();
      renderer.on('load', () => {
        if (canvasStarted) return;
        // MapLibre also counts errored source/tile requests as complete. Its
        // first render must contain geography, not just the background color.
        try {
          if (renderer.queryRenderedFeatures().length) {
            showDetailed('webgl');
            return;
          }
        } catch {}
        startCanvas();
      });
      // Individual source or glyph requests can recover; the deadline below
      // switches renderer only if the initial detailed map never becomes ready.
      renderer.on('error', () => {});
      renderer.on('webglcontextlost', startCanvas);
      startupTimer = setTimeout(() => { if (!ready) startCanvas(); }, 20000);
    } catch {
      console.warn('WebGL unavailable; using the Canvas map.');
      startCanvas();
    }
  }
})();
