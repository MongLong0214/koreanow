'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../web/map-basemap.js'), 'utf8');
const geometry = [[{x: 0, y: 0}, {x: 20, y: 0}, {x: 20, y: 20}]];

function harness() {
  let timerId = 0, fontLoads = 0;
  const timers = new Map(), layers = [], pendingSymbolizers = [];
  // Deliberately never finish the UI font request. A drawable map must not need it.
  const pendingFont = new Promise(() => {});

  class PaintSymbolizer {
    constructor(options) {
      this.options = options;
      this.drawCalls = [];
      pendingSymbolizers.push(this);
    }
    draw(...args) { this.drawCalls.push(args); }
  }
  class LabelSymbolizer {
    constructor(options) { this.options = options; }
  }
  const renderer = {
    GeomType: {Point: 1, Line: 2, Polygon: 3},
    exp: () => () => 1,
    linear: () => () => 1,
    LineSymbolizer: PaintSymbolizer,
    PolygonSymbolizer: PaintSymbolizer,
    CenteredTextSymbolizer: LabelSymbolizer,
    LineLabelSymbolizer: LabelSymbolizer,
    leafletLayer(options) {
      const listeners = new Map();
      const layer = {
        options,
        listeners,
        originalSymbolizers: pendingSymbolizers.splice(0),
        on(type, callback) {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type).add(callback);
          return this;
        },
        off(type, callback) {
          const callbacks = listeners.get(type);
          callbacks?.delete(callback);
          if (!callbacks?.size) listeners.delete(type);
          return this;
        },
        emit(type) { for (const callback of [...(listeners.get(type) || [])]) callback(); },
        addTo(map) { this.map = map; return this; },
        async drawTile(tileGeometry) {
          // The real Canvas renderer awaits its task list before painting tiles.
          await Promise.all(options.tasks || []);
          options.paintRules[0].symbolizer.draw({}, tileGeometry, 7, {props: {class: 'wood'}});
          this.emit('tileload');
        },
      };
      layers.push(layer);
      return layer;
    },
  };
  const context = vm.createContext({
    window: {protomapsL: renderer},
    document: {
      fonts: {load() { fontLoads++; return pendingFont; }},
      createElement(tag) {
        assert.equal(tag, 'canvas');
        return {getContext(type) { assert.equal(type, '2d'); return {}; }};
      },
    },
    AbortController,
    fetch: async () => ({ok: true, json: async () => ({tiles: ['https://tiles.example.test/{z}/{x}/{y}.pbf'], maxzoom: 14})}),
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, {callback, delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  vm.runInContext(code, context);
  return {
    addTo: context.window.KOREA_CANVAS_BASEMAP.addTo,
    layers,
    timers,
    get fontLoads() { return fontLoads; },
    expireMapDeadline() {
      const deadline = [...timers].find(([, timer]) => timer.delay === 20000);
      assert.ok(deadline, 'Map readiness must retain a failure deadline');
      timers.delete(deadline[0]);
      deadline[1].callback();
    },
  };
}

function assertObservationCleanedUp(layer, timers) {
  assert.equal(layer.listeners.size, 0);
  assert.equal(timers.size, 0);
  layer.options.paintRules.forEach((rule, index) => {
    assert.equal(rule.symbolizer, layer.originalSymbolizers[index], 'Temporary readiness observers must be removed');
  });
}

test('Canvas readiness waits for the visible tile set without depending on the interface web font', async () => {
  const fixture = harness();
  const map = {};
  const {layer, ready} = await fixture.addTo(map);
  assert.equal(layer.map, map);
  assert.equal(fixture.fontLoads, 0, 'Map setup must not request or wait for a downloadable font');
  for (const rule of layer.options.labelRules) {
    assert.match(rule.symbolizer.options.font, /\b(?:\d+px) system-ui, sans-serif$/);
    assert.doesNotMatch(rule.symbolizer.options.font, /Jigeum Sans/);
  }
  let resolved = false;
  ready.then(() => { resolved = true; });
  await layer.drawTile(geometry);
  await Promise.resolve();
  assert.equal(resolved, false, 'One drawn tile cannot reveal cameras over still-loading tiles');
  assert.ok(layer.listeners.has('load'));
  assert.equal(layer.listeners.has('tileload'), false);
  layer.emit('load');
  await ready;
  assert.equal(layer.originalSymbolizers[0].drawCalls.length, 1);
  assertObservationCleanedUp(layer, fixture.timers);
});

test('blank tile completions do not signal readiness until a map feature is drawn', async () => {
  const fixture = harness();
  const {layer, ready} = await fixture.addTo({});
  let resolved = false;
  ready.then(() => { resolved = true; });
  layer.emit('tileload');
  layer.emit('load');
  await Promise.resolve();
  assert.equal(resolved, false, 'A failed tile can emit completion without drawing a map');

  await layer.drawTile([]);
  layer.emit('load');
  await Promise.resolve();
  assert.equal(resolved, false, 'An empty feature cannot make the map ready');
  assert.ok(layer.listeners.has('load'));

  await layer.drawTile(geometry);
  await Promise.resolve();
  assert.equal(resolved, false, 'Feature drawing still waits for all visible tiles to complete');
  layer.emit('load');
  await ready;
  assert.equal(resolved, true);
  assertObservationCleanedUp(layer, fixture.timers);
});

test('a blank map times out cleanly and a subsequent map can become ready', async () => {
  const fixture = harness();
  const failed = await fixture.addTo({});
  const rejection = assert.rejects(failed.ready, /Map tiles could not be rendered/);
  failed.layer.emit('tileload');
  failed.layer.emit('load');
  fixture.expireMapDeadline();
  await rejection;
  assertObservationCleanedUp(failed.layer, fixture.timers);

  const retry = await fixture.addTo({});
  await retry.layer.drawTile(geometry);
  retry.layer.emit('load');
  await retry.ready;
  assertObservationCleanedUp(retry.layer, fixture.timers);
  assert.equal(fixture.fontLoads, 0);
});
