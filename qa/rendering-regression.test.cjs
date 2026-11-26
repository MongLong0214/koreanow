'use strict';

// Deterministic interaction/DOM-operation tests of the production app. These
// checks model node identity and media events; they do not measure browser FPS,
// layout, paint, real network latency, or delivery of third-party video.
const test = require('node:test');
const assert = require('node:assert/strict');
const {createHarness, flushMicrotasks, englishCameraSource} = require('./helpers/player-harness.cjs');

const favoritesKey = 'jigeum-korea:favorites:v1';
const make = options => createHarness({cameraSource: englishCameraSource, ...options});
const cameras = h => h.context.KOREA_DISPLAY_CAMERAS;
const rows = h => h.get('camera-list').children;
const ids = h => rows(h).map(row => row.dataset.camera);
const rowMap = h => new Map(rows(h).map(row => [row.dataset.camera, row]));
const sourceLink = (h, id) => h.document.querySelector('[data-select="' + id + '"]');
const bookmark = (h, id) => h.document.querySelector('[data-save="' + id + '"]');
const save = (h, id) => h.fire('camera-list', 'click', {target: bookmark(h, id)});
const search = (h, query) => { h.get('search').value = query; h.fire('search', 'input'); };
const expectedSearch = (h, query) => Array.from(cameras(h)).filter(camera => [
  camera.name, camera.region, camera.location, camera.categoryLabel,
  camera.provider, {iframe:'Broadcast', hls:'Live camera', youtube:'YouTube'}[camera.kind || 'youtube'], camera.searchAliases,
].filter(Boolean).join('\n').toLocaleLowerCase('en').includes(query.trim().toLocaleLowerCase('en')));

test('selecting cameras keeps all 400 row identities and changes only the selected rows', () => {
  const h = make();
  const initial = rowMap(h);
  assert.equal(initial.size, 400);
  const [first, second] = cameras(h).filter(camera => camera.kind === 'iframe');
  h.resetOperations();
  assert.equal(h.chooseCamera(first.id).defaultPrevented, true);
  assert.equal(sourceLink(h, first.id).getAttribute('aria-current'), 'true');
  assert.equal(h.get('viewer-title').textContent, first.name);
  h.chooseCamera(second.id);
  assert.equal(sourceLink(h, first.id).getAttribute('aria-current'), 'false');
  assert.equal(sourceLink(h, second.id).getAttribute('aria-current'), 'true');
  assert.equal(h.get('viewer-title').textContent, second.name);
  for (const row of rows(h)) assert.equal(row, initial.get(row.dataset.camera));
  assert.equal(h.operations.createdByTag.ARTICLE || 0, 0);
  assert.equal(h.operations.listReplacements, 0);
  assert.equal(h.operations.rowInsertions, 0);
  assert.equal(h.operations.rowRemovals, 0);
});

test('bookmark changes affect one control without rebuilding rows or map markers', () => {
  const h = make({withMap: true});
  const initial = rowMap(h), first = cameras(h)[0];
  h.resetOperations(); h.mapFixture.resetOperations();
  save(h, first.id);
  assert.equal(bookmark(h, first.id).getAttribute('aria-pressed'), 'true');
  assert.equal(h.get('saved-count').textContent, '1');
  assert.deepEqual(JSON.parse(h.storage.get(favoritesKey)), [first.id]);
  for (const row of rows(h)) {
    assert.equal(row, initial.get(row.dataset.camera));
    assert.equal(row.querySelector('[data-save]').getAttribute('aria-pressed'), String(row.dataset.camera === first.id));
  }
  assert.ok(h.operations.attributeWrites <= 4, 'A single bookmark must not rewrite 400 bookmark labels');
  assert.equal(h.operations.rowInsertions + h.operations.rowRemovals, 0);
  assert.equal(h.operations.createdByTag.ARTICLE || 0, 0);
  assert.equal(h.mapFixture.operations.markerCreates + h.mapFixture.operations.markerRemovals, 0);
});

test('Saved filtering removes unsaved rows and restores the same cached nodes', () => {
  const h = make(), initial = rowMap(h);
  const [first, second] = cameras(h);
  save(h, first.id); save(h, second.id);
  h.fire('saved-tab');
  assert.deepEqual(ids(h), [first.id, second.id]);
  const remainingBookmark = bookmark(h, second.id);
  remainingBookmark.focus();
  h.resetOperations();
  save(h, first.id);
  assert.deepEqual(ids(h), [second.id]);
  assert.equal(h.document.activeElement, remainingBookmark);
  assert.equal(h.operations.rowRemovals, 1);
  h.fire('explore-tab');
  assert.equal(rows(h).length, 400);
  for (const row of rows(h)) assert.equal(row, initial.get(row.dataset.camera));
  assert.equal(bookmark(h, first.id).getAttribute('aria-pressed'), 'false');
  assert.equal(h.operations.createdByTag.ARTICLE || 0, 0);
});

test('filtering preserves surviving keyboard targets and reuses rows on reset', () => {
  const h = make(), initial = rowMap(h);
  const target = sourceLink(h, cameras(h)[0].id);
  target.focus();
  h.resetOperations();
  search(h, '  sEOUL  ');
  h.flushAnimationFrames();
  assert.deepEqual(ids(h), expectedSearch(h, 'seoul').map(camera => camera.id));
  assert.equal(h.document.activeElement, target);
  for (const row of rows(h)) assert.equal(row, initial.get(row.dataset.camera));
  h.fire('reset-filters');
  for (const row of rows(h)) assert.equal(row, initial.get(row.dataset.camera));
  assert.equal(h.operations.createdByTag.ARTICLE || 0, 0);
  assert.equal(h.operations.listReplacements, 0);
});

test('removing a focused row moves keyboard focus to the corresponding surviving control', () => {
  const h = make();
  const removed = cameras(h).find(camera => !expectedSearch(h, 'Seoul').includes(camera));
  bookmark(h, removed.id).focus();
  search(h, 'Seoul'); h.flushAnimationFrames();
  assert.equal(h.document.activeElement, rows(h)[0].querySelector('[data-save]'));
  assert.equal(h.document.activeElement.isConnected, true);
});

test('a burst of search inputs produces one frame and only the final result collection', () => {
  const h = make();
  h.resetOperations();
  for (const query of ['B', 'Bus', 'Busan']) search(h, query);
  assert.equal(h.pendingFrames(), 1);
  assert.equal(rows(h).length, 400, 'Filtering waits for the scheduled frame');
  assert.equal(h.operations.rowInsertions + h.operations.rowRemovals, 0);
  assert.equal(h.flushAnimationFrames(), 1);
  const expected = expectedSearch(h, 'Busan');
  assert.deepEqual(ids(h), expected.map(camera => camera.id));
  assert.equal(h.operations.rowRemovals, 400 - expected.length);
  assert.equal(h.operations.rowInsertions, 0);
  assert.equal(h.operations.createdByTag.ARTICLE || 0, 0);
  h.resetOperations();
  search(h, '  bUSAN  '); h.flushAnimationFrames();
  assert.deepEqual(ids(h), expected.map(camera => camera.id));
  assert.equal(h.operations.rowInsertions + h.operations.rowRemovals, 0, 'Equivalent searches retain the existing collection');
});

test('reset cancels queued search work so a stale frame cannot restore the old query', () => {
  const h = make();
  search(h, 'no-such-camera-73492');
  assert.equal(h.pendingFrames(), 1);
  h.fire('reset-filters');
  assert.equal(h.pendingFrames(), 0);
  h.flushAnimationFrames();
  assert.equal(h.get('search').value, '');
  assert.equal(rows(h).length, 400);
  assert.equal(h.get('empty-state').hidden, true);
});

test('selection at a stable map zoom preserves every unaffected marker object', () => {
  const h = make({withMap: true, mapZoom: 12});
  const group = h.mapFixture.groups[0];
  const initial = new Set(group.getLayers());
  assert.ok(initial.size > 200, 'The production catalog must exercise many marker groups');
  h.mapFixture.resetOperations();
  h.chooseCamera(cameras(h)[0].id);
  h.flushAnimationFrames();
  const retained = group.getLayers().filter(marker => initial.has(marker));
  assert.equal(retained.length, initial.size);
  assert.equal(h.mapFixture.operations.clearLayers, 0);
  assert.equal(h.mapFixture.operations.markerCreates, 0);
  assert.equal(h.mapFixture.operations.markerRemovals, 0);
  assert.ok(group.getLayers().some(marker => marker.getElement().classList.contains('selected')));
});

test('resize bursts invalidate the map once and repeated identical sizes do no work', () => {
  const h = make({withMap: true});
  h.mapFixture.resetOperations();
  h.resize(1100, 800); h.resize(1000, 800); h.resize(900, 760);
  assert.equal(h.pendingFrames(), 1);
  assert.equal(h.mapFixture.operations.invalidations, 0);
  h.flushAnimationFrames();
  assert.equal(h.mapFixture.operations.invalidations, 1);
  h.resize(900, 760); h.resize(0, 0); h.flushAnimationFrames();
  assert.equal(h.mapFixture.operations.invalidations, 1);
  h.resize(900, 700); h.flushAnimationFrames();
  assert.equal(h.mapFixture.operations.invalidations, 2);
});

test('late lazy HLS loading cannot create a player after the viewer closes', async () => {
  const h = make({lazyHls: true});
  assert.equal(h.libraryRequests.length, 0, 'Map-only startup must not request HLS.js');
  h.chooseCamera(cameras(h).find(camera => camera.kind === 'hls').id);
  assert.equal(h.libraryRequests.length, 1);
  assert.equal(h.hlsPlayers.length + h.videos.length, 0);
  h.fire('close-viewer');
  h.libraryRequests[0].resolve();
  await flushMicrotasks();
  assert.equal(h.hlsPlayers.length + h.videos.length, 0);
  assert.equal(h.get('viewer').hidden, true);
  assert.equal(h.get('player-mount').children.length, 0);
});

test('switching cameras while HLS.js loads only opens the newest camera', async () => {
  const h = make({lazyHls: true});
  const [first, second] = cameras(h).filter(camera => camera.kind === 'hls');
  h.chooseCamera(first.id); h.chooseCamera(second.id);
  assert.equal(h.libraryRequests.length, 2, 'The test loader deliberately returns independent pending requests');
  h.libraryRequests[0].resolve();
  await flushMicrotasks();
  assert.equal(h.hlsPlayers.length, 0, 'The superseded request cannot open its camera');
  h.libraryRequests[1].resolve();
  await flushMicrotasks();
  assert.equal(h.hlsPlayers.length, 1);
  assert.equal(h.get('viewer-title').textContent, second.name);
  assert.equal(h.hlsPlayers[0].source, second.proxy ? '/api/hls/' + encodeURIComponent(second.id) + '/index.m3u8' : second.streamUrl);
});

test('a rejected HLS.js load retains native HLS playback when supported', async () => {
  const h = make({lazyHls: true, nativeHls: 'probably'});
  const camera = cameras(h).find(camera => camera.kind === 'hls');
  h.chooseCamera(camera.id);
  h.libraryRequests[0].reject(new Error('Simulated library request failure'));
  await flushMicrotasks();
  assert.equal(h.hlsPlayers.length, 0);
  assert.equal(h.videos.length, 1);
  const video = h.videos[0];
  assert.equal(video.src, camera.proxy ? '/api/hls/' + encodeURIComponent(camera.id) + '/index.m3u8' : camera.streamUrl);
  Object.assign(video, {readyState: 3, videoWidth: 1920, videoHeight: 1080,
    buffered: {length: 1, start: () => 0, end: () => 5}});
  h.emitMedia(video, 'loadedmetadata');
  assert.equal(video.playCalls, 1);
  h.emitMedia(video, 'playing');
  assert.equal(h.get('playback-status').dataset.state, 'playing');
  h.fire('close-viewer');
  assert.equal(video.src, '');
  assert.equal(video.parentNode, null);
});

test('a rejected HLS.js load shows a recoverable error only for the active attempt', async () => {
  const h = make({lazyHls: true});
  const camera = cameras(h).find(camera => camera.kind === 'hls');
  h.chooseCamera(camera.id);
  h.libraryRequests[0].reject(new Error('Simulated library request failure'));
  await flushMicrotasks();
  h.assertPlaybackError();
  h.fire('retry-video');
  assert.equal(h.libraryRequests.length, 2);
  h.libraryRequests[1].resolve();
  await flushMicrotasks();
  assert.equal(h.hlsPlayers.length, 1);
  assert.equal(h.get('video-error').hidden, true);
  h.fire('close-viewer');
  assert.equal(h.hlsPlayers[0].destroyed, true);
});

test('buffered river cameras wait for decoded dimensions and three seconds ahead before one play request', () => {
  const h = make();
  const camera = cameras(h).find(camera => camera.providerType === 'yeongsan');
  assert.ok(camera, 'The production catalog must include the buffered river-camera provider');
  h.chooseCamera(camera.id);
  const instance = h.hlsPlayers[0], video = h.videos[0];
  assert.equal(video.autoplay, false);
  h.emitHls(instance, 'MANIFEST_PARSED');
  assert.equal(video.playCalls, 0);
  Object.assign(video, {readyState: 3, videoWidth: 1920, videoHeight: 1080,
    buffered: {length: 1, start: () => 0, end: () => 2.9}});
  h.emitHls(instance, 'FRAG_BUFFERED');
  assert.equal(video.playCalls, 0);
  video.buffered.end = () => 3;
  video.videoWidth = 0;
  h.emitMedia(video, 'canplay');
  assert.equal(video.playCalls, 0);
  video.videoWidth = 1920;
  h.emitMedia(video, 'progress');
  assert.equal(video.playCalls, 1);
  h.emitHls(instance, 'FRAG_BUFFERED'); h.emitMedia(video, 'canplay');
  assert.equal(video.playCalls, 1, 'Additional buffer events must not duplicate the initial play request');
  h.emitMedia(video, 'playing');
  assert.equal(h.get('playback-status').dataset.state, 'playing');
});

test('typing before the asynchronous catalog arrives is respected on initial render', async () => {
  const h = make({deferCatalog: true});
  h.get('search').value = 'Busan';
  h.get('media-kind').value = 'hls';
  assert.equal(h.get('camera-list').children.length, 0);
  h.catalog.resolve();
  await flushMicrotasks();
  const expected = expectedSearch(h, 'Busan').filter(camera => camera.kind === 'hls');
  assert.ok(expected.length > 0 && expected.length < 400);
  assert.deepEqual(ids(h), expected.map(camera => camera.id));
  assert.equal(h.get('search').value, 'Busan');
  assert.equal(h.get('media-kind').value, 'hls');
  assert.equal(h.get('viewer').hidden, true);
  assert.equal(h.libraryRequests.length, 0);
});

test('catalog failure exposes a working Reload cameras action', async () => {
  const h = make({deferCatalog: true});
  h.catalog.reject(new Error('Simulated catalog fetch failure'));
  await flushMicrotasks();
  assert.equal(h.consoleErrors.length, 1);
  assert.equal(h.get('reset-filters').textContent, 'Reload cameras');
  assert.equal(h.get('empty-state').hidden, false);
  assert.equal(h.get('random-button').disabled, true);
  h.fire('reset-filters');
  assert.equal(h.reloadCount(), 1);
});

test('camera source links preserve modified clicks and handle plain clicks in the map', () => {
  const h = make(), camera = cameras(h)[0], link = sourceLink(h, camera.id);
  assert.equal(link.tagName, 'A');
  assert.equal(link.href, camera.sourceUrl);
  for (const event of [{ctrlKey:true}, {metaKey:true}, {shiftKey:true}, {altKey:true}, {button:1}, {defaultPrevented:true}]) {
    const emitted = h.chooseCamera(camera.id, event);
    assert.equal(emitted.defaultPrevented, event.defaultPrevented || false);
    assert.equal(h.get('viewer').hidden, true);
    assert.equal(h.get('player-mount').children.length, 0);
  }
  assert.equal(h.chooseCamera(camera.id).defaultPrevented, true);
  assert.equal(h.get('viewer').hidden, false);
  assert.equal(h.get('viewer-title').textContent, camera.name);
});
