'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const sourceCode = fs.readFileSync(path.join(root, 'web/cameras.js'), 'utf8');
const englishCode = fs.readFileSync(path.join(root, 'web/catalog-en.js'), 'utf8');
const selection = JSON.parse(fs.readFileSync(path.join(root, 'qa/400/selected-catalog.json'), 'utf8'));
const displayFields = new Set(['name', 'location', 'description', 'region', 'provider', 'categoryLabel']);
const nonEnglish = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7af\ud7b0-\ud7ff\u3400-\u9fff]/u;
const plain = value => JSON.parse(JSON.stringify(value));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function loadPublicCatalog() {
  const context = vm.createContext({window: {}, location: {search: ''}, URLSearchParams});
  vm.runInContext(sourceCode, context, {filename: 'cameras.js'});
  return context;
}

function localize(context = loadPublicCatalog()) {
  const original = context.window.KOREA_CAMERAS;
  if (original) {
    // Any write through a shared object, including nested provenance, fails.
    deepFreeze(original);
    Object.defineProperty(context.window, 'KOREA_CAMERAS', {
      value: original, writable: false, configurable: false, enumerable: true
    });
  }
  vm.runInContext(englishCode, context, {filename: 'catalog-en.js'});
  return context;
}

test('normal publication exposes exactly the 400 selected sources with complete English coverage', () => {
  const {window} = localize();
  assert.equal(window.KOREA_CAMERAS.length, 400);
  assert.deepEqual(plain(window.KOREA_CAMERAS), selection);
  assert.deepEqual(plain(window.KOREA_DISPLAY_CAMERAS.map(camera => camera.id)), selection.map(camera => camera.id));
  assert.equal(new Set(window.KOREA_DISPLAY_CAMERAS.map(camera => camera.id)).size, 400);
  assert.equal(Object.keys(window.KOREA_EN.cameras).length, 400);
  for (const camera of window.KOREA_DISPLAY_CAMERAS) {
    assert.ok(Object.hasOwn(window.KOREA_EN.cameras, camera.id), camera.id + ' needs an explicit translation');
    for (const field of displayFields) {
      assert.equal(typeof camera[field], 'string', camera.id + '.' + field);
      assert.ok(camera[field].trim(), camera.id + '.' + field + ' is empty');
      assert.equal(nonEnglish.test(camera[field]), false, camera.id + '.' + field + ' still contains Korean/CJK');
    }
    assert.doesNotMatch(camera.name, /^Camera\s+(?:kbs|gits|busan|yeongsan|gimpo|gumi|chungju|changwon|jinju)-/,
      camera.id + ' must not use a diagnostic placeholder');
  }
});

test('localization cannot mutate or replace the original catalog and changes no playback or evidence field', () => {
  const context = loadPublicCatalog();
  const original = context.window.KOREA_CAMERAS;
  const before = JSON.stringify(original);
  localize(context);
  assert.equal(context.window.KOREA_CAMERAS, original);
  assert.equal(JSON.stringify(original), before);
  for (let index = 0; index < original.length; index++) {
    const raw = original[index], display = context.window.KOREA_DISPLAY_CAMERAS[index];
    assert.notEqual(display, raw, raw.id + ' needs a separate presentation object');
    const rawNonDisplay = Object.fromEntries(Object.entries(raw).filter(([key]) => !displayFields.has(key)));
    const shownNonDisplay = Object.fromEntries(Object.entries(display).filter(([key]) => !displayFields.has(key) && key !== 'searchAliases'));
    assert.deepEqual(plain(shownNonDisplay), plain(rawNonDisplay), raw.id + ' has changed technical/provenance data');
  }
});

test('source and embedded-player links retain exact public HTTP(S) destinations without credentials', () => {
  const {window} = localize();
  for (let index = 0; index < selection.length; index++) {
    const camera = window.KOREA_DISPLAY_CAMERAS[index];
    for (const field of ['sourceUrl', 'embedUrl']) {
      if (!camera[field]) continue;
      assert.equal(camera[field], selection[index][field], camera.id + '.' + field + ' changed');
      const url = new URL(camera[field]);
      assert.ok(['http:', 'https:'].includes(url.protocol), camera.id + ' has an unsafe link protocol');
      assert.ok(url.hostname, camera.id + ' has no source host');
      assert.equal(url.username, '', camera.id + ' includes a URL username');
      assert.equal(url.password, '', camera.id + ' includes a URL password');
    }
  }
});

test('original labels and alternate province names remain searchable after display translation', () => {
  const {window} = localize();
  for (let index = 0; index < selection.length; index++) {
    const raw = selection[index], display = window.KOREA_DISPLAY_CAMERAS[index];
    for (const original of [raw.name, raw.location, raw.region, raw.provider, raw.categoryLabel]) {
      assert.ok(display.searchAliases.includes(original), raw.id + ' lost original search text: ' + original);
    }
    assert.ok(display.searchAliases.includes(window.KOREA_EN.regionAliases[raw.region]), raw.id + ' lost province aliases');
  }
  const wonju = window.KOREA_DISPLAY_CAMERAS.find(camera => camera.id === 'gits-5253');
  assert.match(wonju.searchAliases, /Seowonju/);
  const jeonnam = window.KOREA_DISPLAY_CAMERAS.find(camera => camera.id === 'kbs-9994');
  assert.match(jeonnam.searchAliases, /Jeonnam/);
  assert.match(jeonnam.searchAliases, /Jeollanam-do/);
});

test('region coverage and caps are inherited from raw geography, without collapsing translated regions', () => {
  const {window} = localize();
  const rawCounts = new Map(), translatedCounts = new Map();
  for (const camera of selection) rawCounts.set(camera.region, (rawCounts.get(camera.region) || 0) + 1);
  for (const camera of window.KOREA_DISPLAY_CAMERAS) translatedCounts.set(camera.region, (translatedCounts.get(camera.region) || 0) + 1);
  assert.equal(rawCounts.size, 17);
  assert.equal(translatedCounts.size, 17);
  assert.equal(new Set([...rawCounts.keys()].map(region => window.KOREA_EN.regions[region])).size, 17);
  assert.equal(rawCounts.get('부산'), 78);
  for (const [region, count] of rawCounts) {
    assert.ok(count <= (region === '부산' ? 80 : 60), region + ' exceeds the raw regional cap');
    assert.equal(translatedCounts.get(window.KOREA_EN.regions[region]), count, region + ' changed during localization');
  }
  assert.equal(new Set(window.KOREA_DISPLAY_CAMERAS.map(camera => camera.provider)).size, 22);
});

test('landmark types, bridge numbers and directional camera identities survive translation', () => {
  const {window} = localize();
  const translated = window.KOREA_EN.cameras;
  for (const id of ['kbs-9958', 'kbs-9982', 'kbs-9983', 'kbs-9994']) assert.match(translated[id].name, /Island/, id);
  assert.match(translated['kbs-9959'].name, /River/);
  assert.match(translated['kbs-9986'].name, /Lighthouse/);
  assert.match(translated['yongpyong-08'].name, /Red Slope/);
  assert.match(translated['yeongsan-110022'].name, /Bridge No\. 2/);
  assert.match(translated['gits-5253'].name, /Interchange/);
  for (const [a, b] of [['gimpo-cctv103', 'gimpo-cctv104'], ['chungju-13', 'chungju-14'], ['jinju-1000001200', 'jinju-1000001202'], ['busan-ctv0000169', 'busan-ctv0000170']]) {
    assert.notEqual(translated[a].name, translated[b].name, a + ' and ' + b + ' lost their separate viewpoints');
  }
  assert.match(translated['gimpo-cctv103'].name, /Hangang-ro/);
  assert.match(translated['gimpo-cctv104'].name, /Ganghwa/);
});

test('verification can read the English dictionary without loading the camera catalog', () => {
  const {window} = localize(vm.createContext({window: {}}));
  assert.equal(Object.keys(window.KOREA_EN.cameras).length, 400);
  assert.equal(window.KOREA_DISPLAY_CAMERAS.length, 0);
  assert.equal(window.KOREA_CAMERAS, undefined);
});

test('a diagnostic-only candidate receives an English fallback without entering the selected dictionary', () => {
  const candidate = {id: 'diagnostic-1', name: '검증 후보', location: '아직 선정되지 않은 장소', region: '경기', provider: '기타 제공처', category: 'city', categoryLabel: '도시', kind: 'hls', sourceUrl: 'https://example.test/public-camera', sessionLimitSeconds: 30};
  const context = vm.createContext({window: {KOREA_CAMERAS: [candidate]}});
  localize(context);
  const display = context.window.KOREA_DISPLAY_CAMERAS[0];
  for (const field of displayFields) assert.equal(nonEnglish.test(display[field]), false, field);
  assert.equal(display.id, candidate.id);
  assert.equal(display.sourceUrl, candidate.sourceUrl);
  assert.equal(display.sessionLimitSeconds, candidate.sessionLimitSeconds);
  assert.ok(display.searchAliases.includes(candidate.name));
  assert.equal(Object.hasOwn(context.window.KOREA_EN.cameras, candidate.id), false);
  assert.equal(Object.keys(context.window.KOREA_EN.cameras).length, 400);
});
