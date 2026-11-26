'use strict';

// Startup ordering and interaction checks against the generated HTML and real
// application code. Renderer events and the clock are simulated; these tests
// do not measure browser painting, GPU performance or network latency.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {createHarness, englishCameraSource, flushMicrotasks} = require('./helpers/player-harness.cjs');
let assets;

test.before(async () => {
  const {createSeoAssets} = await import('../server/seo-pages.mjs');
  assets = createSeoAssets(path.join(__dirname, '..', 'web'));
});

const plain = value => JSON.parse(JSON.stringify(value));
const rows = harness => harness.get('camera-list').children;
function make(region = 'all', options = {}) {
  const pathname = assets.seo.regionPath(region);
  return createHarness({cameraSource: englishCameraSource, withSeo: true,
    withMap: true, deferCatalog: true, htmlSource: assets.pages.get(pathname),
    initialUrl: 'https://koreanow.site' + pathname, ...options});
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function installRenderer(context) {
  const events = new Map(), mounts = [];
  let removals = 0;
  const renderer = {
    on(name, listener) { events.set(name, listener); return this; },
    emit(name) {
      assert.ok(events.has(name), 'Expected registered renderer event ' + name);
      events.get(name)();
    },
  };
  context.maplibregl = {};
  context.L.maplibreGL = options => ({
    addTo(map) {
      mounts.push({map, options, bounds: plain(map.bounds?.points), fitOptions: plain(map.fitOptions)});
      return this;
    },
    getMaplibreMap() { return renderer; },
    getAttribution() { return ''; },
    onRemove() {},
    remove() { removals++; },
  });
  return {renderer, mounts, removals: () => removals};
}

test('regional map and controls start before any catalog exists, with the final bounds already set', async () => {
  for (const region of ['Seoul', 'Daejeon']) {
    let rendering;
    const h = make(region, {beforeApp({context}) {
      delete context.KOREA_DISPLAY_CAMERAS;
      delete context.KOREA_CAMERAS;
      rendering = installRenderer(context);
    }});
    const map = h.mapFixture.maps[0];
    assert.equal(h.mapFixture.maps.length, 1);
    assert.equal(h.context.KOREA_MAP_VIEW.map, map);
    assert.equal(h.context.KOREA_MAP_VIEW.hasInitialBounds, true);
    assert.equal(rendering.mounts.length, 1);
    assert.deepEqual(rendering.mounts[0].bounds, JSON.parse(h.get('map').dataset.bounds), region);
    assert.equal(rendering.mounts[0].fitOptions.animate, false);
    assert.equal(rendering.mounts[0].fitOptions.maxZoom, 12);
    assert.equal(h.mapFixture.operations.fitBounds, 1);
    assert.equal(h.mapFixture.groups.length, 0, 'Camera markers wait for the catalog; the basemap does not');
    assert.equal(h.get('video-total').textContent, '400');
    assert.equal(rows(h).length, region === 'Seoul' ? 8 : 1);

    const initialZoom = map.getZoom();
    h.fire('zoom-in'); assert.equal(map.getZoom(), initialZoom + 1);
    h.fire('zoom-out'); assert.equal(map.getZoom(), initialZoom);
    h.fire('fit-map'); assert.equal(h.mapFixture.operations.fitBounds, 2);
    await h.advance(5000);
    rendering.renderer.emit('load');
    assert.equal(h.get('map').dataset.basemap, 'detailed');
    assert.equal(h.get('map').dataset.mapReadyAt, '5000');
    assert.equal(h.get('map').dataset.camerasReadyAt, undefined);
    assert.equal(h.mapFixture.groups.length, 0);
  }
});

test('catalog resolution adopts the existing map and preserves an early pan and zoom', async () => {
  let rendering, cameras;
  const h = make('all', {beforeApp({context}) {
    cameras = context.KOREA_DISPLAY_CAMERAS;
    delete context.KOREA_DISPLAY_CAMERAS;
    delete context.KOREA_CAMERAS;
    rendering = installRenderer(context);
  }});
  const map = h.mapFixture.maps[0];
  map.flyTo([37.15, 127.25], 9);
  h.fire('zoom-in');
  const center = plain(map.getCenter()), zoom = map.getZoom();
  h.mapFixture.resetOperations();
  h.catalog.resolve(cameras);
  await flushMicrotasks();

  assert.equal(h.consoleErrors.length, 0);
  assert.equal(h.mapFixture.maps.length, 1);
  assert.equal(h.context.KOREA_MAP_VIEW.map, map);
  assert.equal(rendering.mounts.length, 1);
  assert.deepEqual(plain(map.getCenter()), center);
  assert.equal(map.getZoom(), zoom);
  assert.equal(h.mapFixture.operations.fitBounds, 0);
  assert.equal(h.mapFixture.operations.flyTo, 0);
  assert.equal(rows(h).length, 400);
  assert.equal(h.get('video-total').textContent, '400');
  assert.equal(h.mapFixture.groups.length, 1);
  const markers = h.mapFixture.groups[0].getLayers();
  assert.ok(markers.length > 0);
  assert.equal(markers.reduce((count, marker) => {
    const cluster = marker.getElement().querySelector('.cluster-marker');
    return count + (cluster ? Number(cluster.textContent) : 1);
  }, 0), 400, 'The adopted marker layer represents every selected camera exactly once');

  for (const id of ['zoom-in', 'zoom-out', 'fit-map']) {
    assert.equal(h.get(id).listeners.get('click').length, 1, id + ' has one control handler');
  }
  h.fire('zoom-in'); assert.equal(map.getZoom(), zoom + 1);
  h.fire('zoom-out'); assert.equal(map.getZoom(), zoom);
  h.fire('fit-map');
  assert.equal(h.mapFixture.operations.fitBounds, 1);
  assert.equal(map.bounds.points.length, 400, 'Fit now uses the live camera filter');
});

test('compact startup reveals the map immediately and preserves an early sidebar choice after hydration', async () => {
  const h = make('all', {beforeApp({context}) {
    context.matchMedia = query => ({matches: query === '(max-width: 760px)', addEventListener() {}});
  }});
  const collapsed = () => h.document.body.classList.contains('list-collapsed');
  const toggle = h.get('list-toggle'), map = h.mapFixture.maps[0];
  assert.equal(h.get('map').dataset.camerasReadyAt, undefined);
  assert.equal(collapsed(), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(plain(map.fitOptions.paddingTopLeft), [35, 140]);
  assert.deepEqual(plain(map.fitOptions.paddingBottomRight), [35, 70]);

  h.fire('list-toggle');
  assert.equal(collapsed(), false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(rows(h).length, 400);
  const originalLink = rows(h)[0].querySelector('a');
  assert.ok(originalLink.href.startsWith('https://'));
  h.catalog.resolve(); await flushMicrotasks();
  assert.equal(h.consoleErrors.length, 0);
  assert.equal(collapsed(), false, 'Hydration must preserve the visitor\'s chosen open sidebar');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.listeners.get('click').length, 1);
  assert.equal(rows(h)[0].querySelector('a'), originalLink);
  h.fire('list-toggle');
  assert.equal(collapsed(), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test('restored search and source filters refit to their visible cameras when the catalog resolves', async () => {
  for (const restored of [{id: 'search', value: 'Seoul'}, {id: 'media-kind', value: 'iframe'}]) {
    const h = make('all', {beforeApp({document}) { document.getElementById(restored.id).value = restored.value; }});
    const map = h.mapFixture.maps[0];
    assert.equal(h.mapFixture.operations.fitBounds, 1);
    h.catalog.resolve(); await flushMicrotasks();
    assert.equal(h.consoleErrors.length, 0);
    assert.equal(h.mapFixture.operations.fitBounds, 2);
    assert.ok(rows(h).length > 0 && rows(h).length < 400);
    const byId = new Map(Array.from(h.context.KOREA_DISPLAY_CAMERAS, camera => [camera.id, camera]));
    const expected = rows(h).map(row => byId.get(row.dataset.camera)).map(camera => [camera.lat, camera.lng]);
    assert.deepEqual(plain(map.bounds.points), expected);
    assert.equal(h.get('video-total').textContent, '400');
  }
});

test('the diagnostic collection refits beyond the prerendered public selection', async () => {
  const h = make('all', {initialUrl: 'https://koreanow.site/?qa-candidates=1'});
  assert.equal(rows(h).length, 400);
  h.catalog.resolve(); await flushMicrotasks();
  assert.equal(h.consoleErrors.length, 0);
  assert.equal(h.context.KOREA_DISPLAY_CAMERAS.length, 1522);
  assert.equal(rows(h).length, 1522);
  assert.equal(h.mapFixture.maps.length, 1);
  assert.equal(h.mapFixture.operations.fitBounds, 2);
  assert.equal(h.mapFixture.maps[0].bounds.points.length, 1522);
});

test('catalog failure keeps source links and map controls usable through renderer readiness and fallback', async () => {
  let rendering;
  const h = make('all', {beforeApp({context}) {
    rendering = installRenderer(context);
    context.KOREA_CANVAS_BASEMAP = {async addTo() { throw new Error('Map source unavailable'); }};
  }});
  h.catalog.reject(new Error('Catalog unavailable'));
  await flushMicrotasks();
  const notice = h.get('map-notice'), retry = notice.querySelector('button');
  assert.equal(notice.dataset.catalogError, 'true');
  assert.equal(notice.hidden, false);
  assert.equal(retry.textContent, 'Reload cameras');
  assert.equal(rows(h).length, 400);
  assert.equal(h.get('camera-list').hidden, false);
  assert.ok(rows(h)[0].querySelector('a').href.startsWith('https://'));
  const zoom = h.mapFixture.maps[0].getZoom();
  h.fire('zoom-in'); assert.equal(h.mapFixture.maps[0].getZoom(), zoom + 1);

  rendering.renderer.emit('load');
  assert.equal(h.get('map').dataset.basemap, 'detailed');
  assert.equal(notice.hidden, false);
  assert.equal(notice.querySelector('button'), retry);
  rendering.renderer.emit('webglcontextlost');
  await flushMicrotasks();
  assert.equal(h.get('map').dataset.basemap, 'overview');
  h.libraryRequests.find(request => request.name === '/map-geography.js').resolve();
  await flushMicrotasks();
  assert.equal(notice.hidden, false);
  assert.equal(notice.querySelector('button'), retry);
  assert.equal(retry.textContent, 'Reload cameras');
  h.fire('fit-map');
  h.dispatch(retry);
  assert.equal(h.reloadCount(), 1);
});

test('context recovery preserves the first confirmed detailed-map timestamp and initializes Canvas once', async () => {
  let rendering, canvasStarts = 0;
  const ready = deferred(), marks = [], measures = [];
  const h = make('all', {beforeApp({context}) {
    rendering = installRenderer(context);
    context.performance.mark = name => marks.push(name);
    context.performance.measure = (...args) => measures.push(args);
    context.KOREA_CANVAS_BASEMAP = {async addTo() {
      canvasStarts++;
      return {layer: {remove() {}}, ready: ready.promise};
    }};
  }});
  await h.advance(125);
  rendering.renderer.emit('load');
  assert.equal(h.get('map').dataset.mapReadyAt, '125');
  rendering.renderer.emit('webglcontextlost');
  rendering.renderer.emit('webglcontextlost');
  await flushMicrotasks();
  assert.equal(canvasStarts, 1);
  assert.equal(rendering.removals(), 1);
  assert.equal(h.get('map').dataset.basemap, 'loading');
  await h.advance(250);
  ready.resolve(); await flushMicrotasks();
  rendering.renderer.emit('load');
  assert.equal(h.get('map').dataset.basemap, 'detailed-canvas');
  assert.equal(h.get('map').dataset.mapReadyAt, '125');
  assert.deepEqual(marks, ['koreanow:map-start', 'koreanow:map-ready']);
  assert.equal(measures.length, 1);
});

test('the initial same-size observer notification does no work and real resize bursts coalesce', () => {
  const h = make();
  h.mapFixture.resetOperations();
  h.resize(1200, 800); h.resize(0, 0);
  assert.equal(h.pendingFrames(), 0);
  assert.equal(h.mapFixture.operations.invalidations, 0);
  h.resize(1100, 800); h.resize(1000, 760); h.resize(1000, 760);
  assert.equal(h.pendingFrames(), 1);
  assert.equal(h.mapFixture.operations.invalidations, 0);
  h.flushAnimationFrames();
  assert.equal(h.mapFixture.operations.invalidations, 1);
  h.resize(1000, 760); h.flushAnimationFrames();
  assert.equal(h.mapFixture.operations.invalidations, 1);
});
