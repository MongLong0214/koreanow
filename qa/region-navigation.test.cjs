'use strict';

// Runs the app against its actual generated HTML. This covers DOM adoption and
// navigation state, not rendering, crawling by a search engine, or browser FPS.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {createHarness, englishCameraSource, flushMicrotasks} = require('./helpers/player-harness.cjs');
let assets;

test.before(async () => {
  const {createSeoAssets} = await import('../server/seo-pages.mjs');
  assets = createSeoAssets(path.join(__dirname, '..', 'web'));
});

function make(region = 'all', options = {}) {
  const pathname = assets.seo.regionPath(region);
  return createHarness({cameraSource: englishCameraSource, withSeo: true,
    htmlSource: assets.pages.get(pathname), initialUrl: 'https://koreanow.site' + pathname, ...options});
}
const rows = h => h.get('camera-list').children;
const ids = h => rows(h).map(row => row.dataset.camera);
const regionIds = (h, region) => Array.from(h.context.KOREA_DISPLAY_CAMERAS)
  .filter(camera => region === 'all' || camera.region === region).map(camera => camera.id);
const sourceLink = (h, id) => h.document.querySelector('[data-select="' + id + '"]');

function assertPage(h, region) {
  const page = assets.seo.page(h.context.KOREA_DISPLAY_CAMERAS, region);
  assert.equal(h.context.location.pathname, page.path);
  assert.equal(h.document.body.dataset.region, region);
  assert.equal(h.document.title, page.title);
  assert.equal(h.document.querySelector('link[rel="canonical"]').href, page.url);
  assert.equal(h.get('page-heading').textContent, page.heading);
  assert.equal(h.document.querySelector('meta[name="description"]').getAttribute('content'), page.description);
  assert.equal(h.document.querySelector('meta[property="og:url"]').getAttribute('content'), page.url);
  assert.equal(h.document.querySelector('meta[property="og:title"]').getAttribute('content'), page.title);
  const schema = JSON.parse(h.get('site-schema').textContent);
  const collection = schema['@graph'].find(item => item['@type'] === 'CollectionPage');
  assert.equal(collection.url, page.url);
  assert.equal(collection.mainEntity.numberOfItems, regionIds(h, region).length);
  const current = h.get('region-menu').querySelectorAll('a[data-region]')
    .filter(link => link.getAttribute('aria-current') === 'page');
  assert.equal(current.length, 1);
  assert.equal(current[0].dataset.region, region);
}

test('home startup adopts all 400 prerendered rows without recreating their DOM', async () => {
  const h = make('all', {deferCatalog: true,
    storage: new Map([['jigeum-korea:favorites:v1', '["kbs-109242"]']])});
  const original = new Map(rows(h).map(row => [row.dataset.camera, row]));
  assert.equal(original.size, 400);
  const originalLink = sourceLink(h, 'kbs-109242');
  h.resetOperations();
  h.catalog.resolve(); await flushMicrotasks();
  assert.equal(h.consoleErrors.length, 0);
  assert.equal(rows(h).length, 400);
  for (const row of rows(h)) assert.equal(row, original.get(row.dataset.camera));
  assert.equal(sourceLink(h, 'kbs-109242'), originalLink);
  assert.equal(original.get('kbs-109242').querySelector('[data-save]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.operations.createdByTag.ARTICLE || 0, 0);
  assert.equal(h.operations.rowInsertions + h.operations.rowRemovals, 0);
  assert.equal(h.operations.listReplacements, 0);
  assert.equal(h.get('viewer').hidden, true);
  assert.equal(h.libraryRequests.length, 0);
  assertPage(h, 'all');
});

test('a regional URL adopts only its prerendered subset and preserves it when navigating away and back', () => {
  let original;
  const h = make('Seoul', {beforeApp({document, dom}) {
    original = new Map(document.getElementById('camera-list').children.map(row => [row.dataset.camera, row]));
    dom.resetOperations();
  }});
  assert.ok(original.size > 0 && original.size < 400);
  assert.deepEqual(ids(h), regionIds(h, 'Seoul'));
  assert.equal(h.operations.createdByTag.ARTICLE || 0, 0);
  assert.equal(h.operations.rowInsertions + h.operations.rowRemovals, 0);
  assertPage(h, 'Seoul');
  h.chooseRegion('all');
  assert.equal(rows(h).length, 400);
  h.context.history.back();
  assert.deepEqual(ids(h), [...original.keys()]);
  for (const row of rows(h)) assert.equal(row, original.get(row.dataset.camera));
  assertPage(h, 'Seoul');
});

test('plain region navigation updates path, current link, heading, canonical and structured data together', () => {
  const h = make();
  h.chooseCamera(h.context.KOREA_DISPLAY_CAMERAS[0].id);
  assert.equal(h.get('viewer').hidden, false);
  h.get('region-menu').open = true;
  const event = h.chooseRegion('Busan');
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.context.history.length, 2);
  assert.equal(h.context.location.hash, '');
  assert.equal(h.get('region-menu').open, false);
  assert.equal(h.document.activeElement, h.get('region-summary'));
  assert.equal(h.get('viewer').hidden, true);
  assert.deepEqual(ids(h), regionIds(h, 'Busan'));
  assertPage(h, 'Busan');
  h.chooseRegion('North Chungcheong');
  assert.deepEqual(ids(h), regionIds(h, 'North Chungcheong'));
  assertPage(h, 'North Chungcheong');
});

test('modified region clicks keep native navigation without mutating the current app', () => {
  const h = make('Seoul');
  const original = ids(h), title = h.document.title;
  h.get('region-menu').open = true;
  for (const event of [{ctrlKey:true}, {metaKey:true}, {shiftKey:true}, {altKey:true}, {button:1}, {defaultPrevented:true}]) {
    const emitted = h.chooseRegion('Busan', event);
    assert.equal(emitted.defaultPrevented, event.defaultPrevented || false);
    assert.equal(h.context.location.pathname, '/regions/seoul/');
    assert.equal(h.context.history.length, 1);
    assert.equal(h.get('region-menu').open, true);
    assert.equal(h.document.title, title);
    assert.deepEqual(ids(h), original);
  }
});

test('back and forward restore the query/source filters saved for each regional entry', () => {
  const h = make();
  h.get('search').value = 'Bridge'; h.fire('search', 'input');
  h.get('media-kind').value = 'hls'; h.fire('media-kind', 'change');
  h.flushAnimationFrames();
  const homeIds = ids(h);
  assert.ok(homeIds.length > 0 && homeIds.length < 400);
  h.chooseRegion('Busan');
  h.get('search').value = 'no-such-camera-73492'; h.fire('search', 'input'); h.flushAnimationFrames();
  assert.equal(rows(h).length, 0);
  h.chooseRegion('Jeju');
  h.context.history.back();
  assert.equal(h.get('search').value, 'no-such-camera-73492');
  assert.equal(h.get('media-kind').value, 'hls');
  assert.equal(rows(h).length, 0);
  assertPage(h, 'Busan');
  h.context.history.back();
  assert.equal(h.get('search').value, 'Bridge');
  assert.equal(h.get('media-kind').value, 'hls');
  assert.deepEqual(ids(h), homeIds);
  assertPage(h, 'all');
  h.context.history.forward();
  assert.equal(h.get('search').value, 'no-such-camera-73492');
  assert.equal(rows(h).length, 0);
  assertPage(h, 'Busan');
});

test('a camera deep link outside the regional page restores the home collection and canonical', () => {
  const target = 'kbs-9967';
  const h = make('Seoul', {initialUrl: 'https://koreanow.site/regions/seoul/#cam=' + target});
  assert.equal(h.context.location.hash, '#cam=' + target);
  assert.equal(rows(h).length, 400);
  assert.equal(h.get('viewer').hidden, false);
  assert.equal(sourceLink(h, target).getAttribute('aria-current'), 'true');
  assertPage(h, 'all');
});

test('reset from a region synchronizes the home path and metadata with the full list', () => {
  const h = make('Busan');
  h.get('search').value = 'no-such-camera-73492'; h.fire('search', 'input'); h.flushAnimationFrames();
  h.fire('reset-filters');
  assert.equal(rows(h).length, 400);
  assert.equal(h.get('search').value, '');
  assert.equal(h.get('region-label').textContent, 'All regions');
  assertPage(h, 'all');
});

test('catalog failure preserves crawlable camera links and regional navigation in the generated HTML', async () => {
  const h = make('Seoul', {deferCatalog:true});
  const original = rows(h).slice(), originalIds = ids(h);
  const originalLinks = original.map(row => row.querySelector('[data-select]'));
  h.catalog.reject(new Error('Simulated catalog request failure')); await flushMicrotasks();
  assert.equal(h.consoleErrors.length, 1);
  assert.deepEqual(ids(h), originalIds);
  for (let index = 0; index < original.length; index++) {
    assert.equal(rows(h)[index], original[index]);
    assert.equal(rows(h)[index].querySelector('[data-select]'), originalLinks[index]);
    assert.ok(originalLinks[index].href.startsWith('https://'));
  }
  assert.equal(h.get('camera-list').hidden, false);
  assert.equal(h.get('empty-state').hidden, true);
  assert.equal(h.get('region-menu').querySelectorAll('a[data-region]').length, 18);
  assert.equal(h.get('map-notice').hidden, false);
  assert.equal(h.get('map-notice').querySelector('button').textContent, 'Reload cameras');
  h.dispatch(h.get('map-notice').querySelector('button'));
  assert.equal(h.reloadCount(), 1);
  assertPage(h, 'Seoul');
});
