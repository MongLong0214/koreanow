'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDom } = require('./instrumented-dom.cjs');
const { createLeafletStub } = require('./leaflet-stub.cjs');

const sourceDirectory = path.join(__dirname, '..', '..', 'web');
const appSource = fs.readFileSync(path.join(sourceDirectory, 'app.js'), 'utf8');
const productionCameraSource = fs.readFileSync(path.join(sourceDirectory, 'cameras.js'), 'utf8');
const englishCameraSource = productionCameraSource + '\n' + fs.readFileSync(path.join(sourceDirectory, 'catalog-en.js'), 'utf8');
const fixtureSource = 'window.KOREA_CAMERAS = '+fs.readFileSync(path.join(__dirname, '..', 'fixtures/player-catalog.json'), 'utf8')+';';
const html = fs.readFileSync(path.join(sourceDirectory, 'index.html'), 'utf8');

async function flushMicrotasks() {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
}

function createHarness({ apiReady = false, storage = new Map(), denyStorageWrites = false,
  hlsSupported = true, nativeHls = '', cameraSource = fixtureSource, appCode = appSource,
  htmlSource = html, withMap = false, mapZoom = 12, lazyHls = false,
  withSeo = false, deferCatalog = false, initialUrl = 'https://example.test/',
  useRegionMenu = true, beforeApp = () => {} } = {}) {
  let now = 0;
  let nextTimer = 1;
  const timers = new Map();
  const scripts = [];
  const scriptRequests = [];
  const players = [];
  const hlsPlayers = [];
  const videos = [];
  const windowListeners = new Map();
  const dom = createDom(htmlSource);
  const document = dom.document;
  const frames = new Map(), resizeObservers = [], libraryRequests = [];
  const consoleErrors = [];
  let reloads = 0, historyIndex = 0;
  const historyEntries = [{url: new URL(initialUrl).href, state: null}];
  let nextFrame = 1;
  document.onScriptAppend = child => { scripts.push(child); scriptRequests.push(child.src); };
  document.onNodeRemoved = child => { const index = scripts.indexOf(child); if (index !== -1) scripts.splice(index, 1); };
  document.onElementCreated = element => {
    if (element.tagName !== 'VIDEO') return;
    Object.assign(element, {
      paused: true, readyState: 0, currentTime: 0, videoWidth: 0, videoHeight: 0,
      buffered: {length: 0, start() { throw new RangeError('Empty TimeRanges'); }, end() { throw new RangeError('Empty TimeRanges'); }},
      playCalls: 0, pauseCalls: 0, loadCalls: 0,
      canPlayType() { return nativeHls; },
      play() { this.playCalls++; return Promise.resolve(); },
      pause() { this.pauseCalls++; this.paused = true; },
      load() { this.loadCalls++; this.readyState = 0; }
    });
    videos.push(element);
  };
  const makeElement = tag => document.createElement(tag);
  function flushAnimationFrames() {
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(now);
    return pending.length;
  }

  const context = {
    document,
    location: new URL(initialUrl),
    history: {
      get state() { return historyEntries[historyIndex].state; },
      get length() { return historyEntries.length; },
      replaceState(state, _title, url) {
        setLocation(url ?? context.location.href);
        historyEntries[historyIndex] = {url: context.location.href, state};
      },
      pushState(state, _title, url) {
        setLocation(url ?? context.location.href);
        historyEntries.splice(historyIndex + 1);
        historyEntries.push({url: context.location.href, state});
        historyIndex++;
      },
      back() { this.go(-1); },
      forward() { this.go(1); },
      go(delta) {
        const target = historyIndex + delta;
        if (target < 0 || target >= historyEntries.length) return;
        historyIndex = target;
        setLocation(historyEntries[target].url);
        emitWindow('popstate', {state: historyEntries[target].state});
      }
    },
    console: {error(...args) { consoleErrors.push(args); }, warn() {}, log() {}},
    navigator: { clipboard: { async writeText() {} } },
    localStorage: {
      getItem(key) { return storage.get(String(key)) ?? null; },
      setItem(key, value) {
        if (denyStorageWrites) throw new Error('Simulated storage permission denial');
        storage.set(String(key), String(value));
      }
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }), innerWidth: 1200,
    performance: { now: () => now },
    requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: class { constructor(callback) { this.callback = callback; resizeObservers.push(this); } observe(target) { this.target = target; } disconnect() {} },
    Intl, Date, URL, URLSearchParams, Promise, Error, Math, Set, Map,
    setTimeout(callback, delay = 0) {
      const id = nextTimer++;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    // The unrelated wall clock must not keep the fake clock running forever.
    setInterval() { return 0; }, clearInterval() {},
    addEventListener(name, listener) {
      if (!windowListeners.has(name)) windowListeners.set(name, []);
      windowListeners.get(name).push(listener);
    }
  };
  context.window = context;
  function setLocation(url) {
    context.location = new URL(url, context.location);
    context.location.reload = () => { reloads++; };
  }
  setLocation(initialUrl);
  function emitWindow(name, event = {}) {
    for (const listener of windowListeners.get(name) || []) listener({type: name, ...event});
  }
  const mapFixture = withMap ? createLeafletStub(document, mapZoom) : null;
  if (mapFixture) {
    context.L = mapFixture.L;
    context.KOREA_CANVAS_BASEMAP = { async addTo() { return {layer:{remove() {}},ready:Promise.resolve()}; } };
  }
  const FakeHls = class {
    static Events = { MANIFEST_PARSED: 'manifestParsed', FRAG_BUFFERED: 'fragBuffered', ERROR: 'hlsError' };
    static isSupported() { return hlsSupported; }
    constructor(options) { this.options = options; this.listeners = new Map(); this.destroyed = false; this.destroyCalls = 0; hlsPlayers.push(this); }
    on(event, listener) { if (!this.listeners.has(event)) this.listeners.set(event, []); this.listeners.get(event).push(listener); }
    loadSource(url) { this.source = url; }
    attachMedia(media) { this.media = media; }
    destroy() { this.destroyed = true; this.destroyCalls++; }
  };
  if (!lazyHls) context.Hls = FakeHls;
  context.KOREA_LOAD_SCRIPT = name => new Promise((resolve, reject) => { libraryRequests.push({name, resolve() { if (name === 'vendor/hls.min.js') context.Hls = FakeHls; resolve(); }, reject}); });

  function installYouTubeApi() {
    context.YT = {
      Player: class FakeYouTubePlayer {
        constructor(holder, options) {
          this.options = options;
          this.events = options.events;
          this.destroyed = false;
          this.state = -1;
          this.playCalls = 0;
          this.muteCalls = 0;
          this.iframe = makeElement('iframe');
          const parent = holder.parentNode;
          if (parent) {
            parent.insertBefore(this.iframe, holder);
            holder.remove();
          }
          players.push(this);
        }
        getIframe() { return this.iframe; }
        getPlayerState() { return this.state; }
        mute() { this.muteCalls++; }
        playVideo() { this.playCalls++; }
        destroy() { this.destroyed = true; this.iframe.remove(); }
      }
    };
  }

  if (apiReady) installYouTubeApi();
  vm.createContext(context);
  vm.runInContext(cameraSource, context, { filename: path.join(sourceDirectory, 'cameras.js') });
  if (withSeo) {
    vm.runInContext(fs.readFileSync(path.join(sourceDirectory, 'seo.js'), 'utf8'), context,
      { filename: path.join(sourceDirectory, 'seo.js') });
  }
  // Older media fixtures retain their Korean regions. Give those fixtures real
  // navigation links matching their data, while generated English HTML already
  // has the correct links and is left intact.
  if (useRegionMenu) {
    let menu = document.getElementById('region-menu');
    const legacy = document.getElementById('region');
    if (!menu && legacy) {
      menu = document.createElement('details');
      menu.id = 'region-menu';
      const summary = document.createElement('summary');
      summary.id = 'region-summary';
      const label = document.createElement('span');
      label.id = 'region-label';
      summary.appendChild(label);
      menu.appendChild(summary);
      legacy.parentNode.insertBefore(menu, legacy);
      legacy.remove();
    }
    const regionNames = ['all', ...new Set((context.KOREA_DISPLAY_CAMERAS || context.KOREA_CAMERAS).map(camera => camera.region))];
    const existing = menu ? [...menu.querySelectorAll('a[data-region]')] : [];
    if (menu && regionNames.some(region => !existing.some(link => link.dataset.region === region))) {
      existing.forEach(link => link.remove());
      const options = menu.querySelector('nav') || document.createElement('nav');
      if (!options.parentNode) menu.appendChild(options);
      for (const region of regionNames) {
        const link = document.createElement('a');
        link.dataset.region = region;
        link.href = context.KOREA_SEO?.regionPath(region) || '/?region=' + encodeURIComponent(region);
        link.textContent = region === 'all' ? 'All regions' : region;
        options.appendChild(link);
      }
    }
  }
  let catalog = null;
  if (deferCatalog) {
    context.KOREA_CATALOG_READY = new Promise((resolve, reject) => {
      catalog = {
        resolve(rows = context.KOREA_DISPLAY_CAMERAS || context.KOREA_CAMERAS) {
          context.KOREA_DISPLAY_CAMERAS = rows;
          resolve(rows);
        }, reject
      };
    });
  }
  beforeApp({document, context, dom});
  vm.runInContext(appCode, context, { filename: path.join(sourceDirectory, 'app.js') });

  function get(id) {
    const element = document.getElementById(id);
    assert.ok(element, `Expected a real element with id=${id}`);
    return element;
  }
  function dispatch(element, name = 'click', event = {}) {
    const listeners = element.listeners.get(name) ?? [];
    assert.ok(listeners.length, `No ${name} listener for #${element.id || element.tagName}`);
    const emitted = {target: element, currentTarget: element, type: name,
      button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {}, ...event};
    listeners.forEach(listener => listener(emitted));
    return emitted;
  }
  function fire(id, name = 'click', event = {}) { return dispatch(get(id), name, event); }
  function chooseCamera(id, event = {}) {
    assert.ok((context.KOREA_DISPLAY_CAMERAS || context.KOREA_CAMERAS).some(camera => camera.id === id));
    const button = document.querySelector('[data-select="' + id + '"]');
    assert.ok(button, 'The selected camera must have a rendered link');
    return fire('camera-list', 'click', { target: button, ...event });
  }
  function chooseRegion(region, event = {}) {
    const link = [...get('region-menu').querySelectorAll('a[data-region]')].find(item => item.dataset.region === region);
    assert.ok(link, 'The requested region must have a real navigation link');
    return fire('region-menu', 'click', {target: link, ...event});
  }
  function emit(player, name, data) {
    if (name === 'onStateChange') player.state = data;
    assert.equal(typeof player.events[name], 'function', `Missing YouTube handler ${name}`);
    player.events[name]({ target: player, data });
  }
  function emitHls(instance, event, data = {}) {
    const name = FakeHls.Events[event] || event;
    const handlers = instance.listeners.get(name) || [];
    assert.ok(handlers.length, `Missing HLS handler ${name}`);
    handlers.forEach(handler => handler(name, data));
  }
  function emitMedia(video, event) {
    const handlers = video.listeners.get(event) || [];
    assert.ok(handlers.length, `Missing media handler ${event}`);
    if (event === 'playing') { video.paused = false; video.readyState = 4; video.currentTime++; video.videoWidth = 1920; video.videoHeight = 1080; }
    if (event === 'pause' || event === 'ended') video.paused = true;
    handlers.forEach(handler => handler({ target: video, type: event }));
  }
  async function advance(milliseconds) {
    flushAnimationFrames();
    const end = now + milliseconds;
    for (;;) {
      let next;
      for (const [id, timer] of timers) {
        if (timer.at <= end && (!next || timer.at < next[1].at)) next = [id, timer];
      }
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      await flushMicrotasks();
    }
    now = end;
    await flushMicrotasks();
  }
  function completeApiLoad() {
    installYouTubeApi();
    assert.equal(typeof context.onYouTubeIframeAPIReady, 'function');
    context.onYouTubeIframeAPIReady();
  }
  async function start() {
    // The map starts with no selected camera. Select through the same delegated
    // click handler a visitor uses, which opens and starts that camera.
    chooseCamera((context.KOREA_DISPLAY_CAMERAS || context.KOREA_CAMERAS)[0].id);
    await flushMicrotasks();
    return players.at(-1);
  }
  function assertPlaybackError() {
    assert.equal(get('video-error').hidden, false, 'Expected the retry/error UI');
    assert.equal(get('playback-status').dataset.state, 'error');
    assert.equal(get('player-mount').hidden, true);
  }
  return { get, fire, dispatch, chooseCamera, chooseRegion, emit, emitWindow, advance, start, completeApiLoad,
    assertPlaybackError, players, scripts, scriptRequests, context, storage, hlsPlayers, videos, emitHls, emitMedia, document,
    operations: dom.operations, resetOperations: dom.resetOperations, snapshotOperations: dom.snapshotOperations,
    mapFixture, flushAnimationFrames, pendingFrames: () => frames.size, resize: (width = 1200, height = 800) => resizeObservers.forEach(observer => observer.callback([{target: observer.target, contentRect: {width, height}}])), libraryRequests,
    catalog, historyEntries, consoleErrors, reloadCount: () => reloads };
}


module.exports = { createHarness, flushMicrotasks, productionCameraSource, englishCameraSource, fixtureSource };
