'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL} = require('node:url');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'web');
const read = name => fs.readFileSync(path.join(web, name), 'utf8');
const loaderCode = read('resource-loader.js');
const bootstrapCode = read('bootstrap.js');
const cameraCode = read('cameras.js');
const englishCode = read('catalog-en.js');
const helper = import(pathToFileURL(path.join(root, 'server/public-catalog.mjs')).href);
const clone = value => JSON.parse(JSON.stringify(value));

function canonical(search = '') {
  const context = vm.createContext({window: {}, location: {search}, URLSearchParams});
  vm.runInContext(cameraCode, context);
  const raw = JSON.stringify(context.window.KOREA_CAMERAS);
  vm.runInContext(englishCode, context);
  assert.equal(JSON.stringify(context.window.KOREA_CAMERAS), raw);
  return context.window;
}

function scheduler() {
  let id = 0;
  const timers = new Map();
  return {
    timers,
    setTimeout(fn) { const key = ++id; timers.set(key, fn); return key; },
    clearTimeout(key) { timers.delete(key); },
    expire() { for (const [key, fn] of [...timers]) { timers.delete(key); fn(); } },
  };
}

function resourceHarness(baseURI = 'https://koreanow.test/') {
  const clock = scheduler();
  const nodes = [];
  let throwOnAppend = false;
  const document = {
    baseURI,
    createElement(tag) {
      assert.equal(tag, 'script');
      return {remove() { const index = nodes.indexOf(this); if (index !== -1) nodes.splice(index, 1); }};
    },
    head: {appendChild(node) { if (throwOnAppend) throw new Error('append failed'); nodes.push(node); }},
  };
  const context = vm.createContext({window: {}, document, location: {origin: 'https://koreanow.test'}, URL,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout});
  vm.runInContext(loaderCode, context);
  return {load: context.window.KOREA_LOAD_SCRIPT, nodes, clock, failAppend(value) { throwOnAppend = value; }};
}

function bootstrapHarness({search = '', fetchImpl, loadScript, pathname = '/'} = {}) {
  const clock = scheduler();
  const requests = [];
  const context = vm.createContext({window: {KOREA_LOAD_SCRIPT: loadScript},
    location: {search, origin: 'https://koreanow.test'}, document: {baseURI: 'https://koreanow.test' + pathname},
    URL, URLSearchParams, AbortController,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    fetch: (...args) => { requests.push(args); return fetchImpl(...args); },
  });
  vm.runInContext(bootstrapCode, context);
  return {context, window: context.window, ready: context.window.KOREA_CATALOG_READY, requests, clock};
}

test('compiled catalog preserves all 400 selected IDs, playback fields and search aliases', async () => {
  const {createPublicCatalog, PUBLIC_CAMERA_FIELDS} = await helper;
  const originalBytes = [read('cameras.js'), read('catalog-en.js')];
  const source = canonical();
  const rows = createPublicCatalog(web);
  assert.equal(rows.length, 400);
  assert.deepEqual(rows.map(camera => camera.id), clone(source.KOREA_CAMERAS.map(camera => camera.id)));
  assert.equal(new Set(rows.map(camera => camera.id)).size, 400);
  const playbackFields = ['id', 'kind', 'sourceUrl', 'streamUrl', 'embedUrl', 'videoId', 'lat', 'lng',
    'providerType', 'proxy', 'videoMode', 'sessionLimitSeconds', 'sessionLimitReason'];
  const usedFields = new Set([...read('app.js').matchAll(/\b(?:camera|c|state\.selected)\.([A-Za-z_$][\w$]*)/g)].map(match => match[1]));
  for (let index = 0; index < rows.length; index++) {
    const raw = source.KOREA_CAMERAS[index], display = source.KOREA_DISPLAY_CAMERAS[index], compact = rows[index];
    for (const field of playbackFields) assert.deepEqual(compact[field], raw[field], compact.id + '.' + field);
    for (const field of usedFields) {
      if (Object.hasOwn(display, field)) assert.deepEqual(compact[field], clone(display[field]), compact.id + ' omits a field used by the app: ' + field);
    }
    assert.equal(compact.searchAliases, display.searchAliases);
    assert.ok(compact.searchAliases.includes(raw.name));
    assert.equal(compact.name, display.name);
    assert.equal(compact.region, display.region);
    assert.equal(compact.provider, display.provider);
    assert.ok(Object.keys(compact).every(field => PUBLIC_CAMERA_FIELDS.includes(field)));
    for (const field of ['checkedAt', 'sourceVerification', 'regionEvidence', 'sessionLimitEvidence', 'candidateOnly']) {
      assert.equal(Object.hasOwn(compact, field), false, 'Audit-only data should not inflate the runtime payload: ' + field);
    }
  }
  assert.deepEqual([read('cameras.js'), read('catalog-en.js')], originalBytes);
  assert.equal(fs.existsSync(path.join(web, 'catalog.json')), false, 'Generation must not write to canonical web source');
});

test('resource loading coalesces concurrent requests and keeps fulfilled resources cached', async () => {
  const {load, nodes, clock} = resourceHarness('https://koreanow.test/regions/seoul/');
  const first = load('vendor/hls.min.js');
  const second = load('./vendor/hls.min.js#same-resource');
  assert.equal(first, second);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].src, 'https://koreanow.test/vendor/hls.min.js');
  assert.equal(clock.timers.size, 1);
  nodes[0].onload();
  await first;
  assert.equal(clock.timers.size, 0);
  assert.equal(load('/vendor/hls.min.js'), first);
  assert.equal(nodes.length, 1);
});

test('script error removes the failed tag and permits a fresh successful retry', async () => {
  const {load, nodes, clock} = resourceHarness();
  const failed = load('vendor/hls.min.js');
  const rejected = assert.rejects(failed, /Could not load/);
  const staleLoad = nodes[0].onload;
  nodes[0].onerror();
  await rejected;
  assert.equal(nodes.length, 0);
  assert.equal(clock.timers.size, 0);
  const retry = load('vendor/hls.min.js');
  assert.notEqual(retry, failed);
  staleLoad();
  assert.equal(nodes.length, 1);
  nodes[0].onload();
  await retry;
});

test('script timeout and append exceptions both clean up and allow retry', async () => {
  const harness = resourceHarness();
  const timedOut = harness.load('map-geography.js');
  const rejected = assert.rejects(timedOut, /timed out/);
  harness.clock.expire();
  await rejected;
  assert.equal(harness.nodes.length, 0);
  assert.equal(harness.clock.timers.size, 0);
  harness.failAppend(true);
  await assert.rejects(harness.load('map-geography.js'), /append failed/);
  assert.equal(harness.clock.timers.size, 0);
  harness.failAppend(false);
  const retry = harness.load('map-geography.js');
  harness.nodes[0].onload();
  await retry;
});

test('script loader rejects foreign, credential-bearing and non-script URLs before touching the DOM', async () => {
  const {load, nodes, clock} = resourceHarness();
  for (const source of ['https://other.test/asset.js', 'data:text/javascript,alert(1)', 'https://user:password@koreanow.test/asset.js', 'styles.css']) {
    await assert.rejects(load(source));
  }
  assert.equal(nodes.length, 0);
  assert.equal(clock.timers.size, 0);
});

test('normal bootstrap fetches compact JSON once and publishes it before readiness resolves', async () => {
  const rows = (await helper).createPublicCatalog(web);
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const harness = bootstrapHarness({pathname: '/regions/seoul/', fetchImpl: () => response, loadScript: () => { throw new Error('Normal startup must not load diagnostic scripts'); }});
  assert.equal(harness.window.KOREA_DISPLAY_CAMERAS, undefined);
  assert.equal(harness.requests.length, 1);
  assert.equal(String(harness.requests[0][0]), 'https://koreanow.test/catalog.json');
  finish({ok: true, json: async () => rows});
  const result = await harness.ready;
  assert.equal(result, rows);
  assert.equal(harness.window.KOREA_DISPLAY_CAMERAS, rows);
  assert.equal(harness.window.KOREA_CAMERAS, undefined);
  assert.equal(harness.clock.timers.size, 0);
  vm.runInContext(bootstrapCode, harness.context);
  assert.equal(harness.requests.length, 1);
});

test('diagnostic bootstrap loads original source before localization and retains all diagnostic cameras', async () => {
  const calls = [], releases = [];
  let harness, signalSecondScript;
  const secondScriptStarted = new Promise(resolve => { signalSecondScript = resolve; });
  harness = bootstrapHarness({search: '?qa-candidates=1', fetchImpl: () => { throw new Error('Diagnostic mode must not request the normal JSON'); },
    loadScript: source => {
      calls.push(source);
      if (source === 'catalog-en.js') signalSecondScript();
      return new Promise(resolve => releases.push(() => {
        vm.runInContext(source === 'cameras.js' ? cameraCode : englishCode, harness.context);
        resolve();
      }));
    }});
  assert.deepEqual(calls, ['cameras.js']);
  releases.shift()();
  await secondScriptStarted;
  assert.deepEqual(calls, ['cameras.js', 'catalog-en.js']);
  assert.equal(harness.window.KOREA_DISPLAY_CAMERAS, undefined);
  releases.shift()();
  const rows = await harness.ready;
  assert.equal(rows.length, 1522);
  assert.equal(rows, harness.window.KOREA_DISPLAY_CAMERAS);
  assert.equal(harness.window.KOREA_CAMERAS.length, 1522);
  assert.equal(harness.requests.length, 0);
});

test('diagnostic failure rejects readiness without starting the dependent script', async () => {
  const calls = [];
  const harness = bootstrapHarness({search: '?qa-candidates=1', loadScript: source => { calls.push(source); return Promise.reject(new Error('script unavailable')); }});
  await assert.rejects(harness.ready, /script unavailable/);
  assert.deepEqual(calls, ['cameras.js']);
  assert.equal(harness.window.KOREA_DISPLAY_CAMERAS, undefined);
});

test('missing, malformed and incomplete catalog payloads reject instead of presenting an empty collection', async () => {
  const rows = (await helper).createPublicCatalog(web);
  const cases = [
    {ok: false, json: async () => rows},
    {ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); }},
    {ok: true, json: async () => ({cameras: rows})},
    {ok: true, json: async () => []},
    {ok: true, json: async () => rows.slice(1)},
  ];
  for (const mutate of [
    copy => { copy[1].id = copy[0].id; },
    copy => { copy[0].lat = null; },
    copy => { copy[0].lng = 500; },
    copy => { delete copy[0].sourceUrl; },
    copy => { copy[0].sourceUrl = 'javascript:alert(1)'; },
    copy => { delete copy[0].embedUrl; },
    copy => { delete copy.find(camera => camera.kind === 'hls').streamUrl; },
    copy => { copy[0].searchAliases = ''; },
  ]) {
    const copy = clone(rows); mutate(copy); cases.push({ok: true, json: async () => copy});
  }
  for (const response of cases) {
    const harness = bootstrapHarness({fetchImpl: async () => response});
    await assert.rejects(harness.ready);
    assert.equal(harness.window.KOREA_DISPLAY_CAMERAS, undefined);
    assert.equal(harness.clock.timers.size, 0);
  }
});

test('catalog fetch timeout aborts the request and preserves a rejected readiness signal for the app error state', async () => {
  const harness = bootstrapHarness({fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Catalog request aborted')));
  })});
  const rejected = assert.rejects(harness.ready, /aborted/);
  harness.clock.expire();
  await rejected;
  assert.equal(harness.requests[0][1].signal.aborted, true);
  assert.equal(harness.window.KOREA_DISPLAY_CAMERAS, undefined);
  assert.equal(harness.clock.timers.size, 0);
});

test('initial deferred scripts load bootstrap before the app and omit diagnostic or on-demand payloads', () => {
  const scripts = [...read('index.html').matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)].map(match => ({path: match[1], tag: match[0]}));
  const names = scripts.map(script => script.path.replace(/^\//, ''));
  assert.ok(scripts.every(script => script.path.startsWith('/')), 'Nested regional pages need root-absolute scripts');
  assert.ok(names.indexOf('resource-loader.js') < names.indexOf('bootstrap.js'));
  assert.ok(names.indexOf('bootstrap.js') < names.indexOf('app.js'));
  assert.ok(names.includes('map-view.js'));
  assert.ok(names.indexOf('vendor/leaflet.js') < names.indexOf('map-view.js'));
  assert.ok(names.indexOf('map-basemap.js') < names.indexOf('map-view.js'));
  assert.ok(names.indexOf('map-view.js') < names.indexOf('app.js'));
  assert.ok(scripts.every(script => /\bdefer\b/.test(script.tag)));
  for (const source of ['cameras.js', 'catalog-en.js', 'map-geography.js', 'vendor/hls.min.js']) assert.equal(names.includes(source), false, source);
});

test('map startup fetches are discoverable in the head with matching anonymous CORS credentials', () => {
  const html = read('index.html');
  const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)"[^>]*>/g)];
  assert.deepEqual(preloads.map(match => match[1]), [
    '/catalog.json', '/map-style-dark.json', 'https://tiles.openfreemap.org/planet',
  ]);
  for (const preload of preloads) {
    assert.match(preload[0], /as="fetch"/);
    assert.match(preload[0], /crossorigin="anonymous"/);
    assert.ok(preload.index < html.indexOf('<link rel="stylesheet"'));
  }
  const preconnects = [...html.matchAll(/<link rel="preconnect"[^>]*>/g)];
  assert.equal(preconnects.length, 1);
  assert.match(preconnects[0][0], /href="https:\/\/tiles\.openfreemap\.org"/);
  assert.match(preconnects[0][0], /crossorigin="anonymous"/);
});
