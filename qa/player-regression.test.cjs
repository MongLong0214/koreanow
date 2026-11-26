'use strict';

// Run: node --test qa/player-regression.test.cjs
// Executes the real app unchanged with fixed provider fixtures. DOM, timers and
// external player APIs are replaced; this does not test actual video delivery.
// The catalog/filter case below uses the real current production camera source.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness, flushMicrotasks, productionCameraSource } = require('./helpers/player-harness.cjs');

test('initial map load shows all cameras without opening or requesting a player', () => {
  const h = createHarness();
  assert.equal(h.get('viewer').hidden, true);
  assert.equal(Number(h.get('result-count').textContent), h.context.KOREA_CAMERAS.length);
  assert.equal(h.scriptRequests.length, 0);
  assert.equal(h.players.length, 0);
  assert.equal(h.hlsPlayers.length, 0);
  assert.equal(h.videos.length, 0);
  assert.equal(h.get('player-mount').children.length, 0);
  assert.equal(h.context.location.hash, '');
});

test('API timeout followed by retry makes a fresh script request and can recover', async () => {
  const h = createHarness();
  await h.start();
  assert.equal(h.scriptRequests.length, 1);
  await h.advance(12_001);
  h.assertPlaybackError();

  h.fire('retry-video');
  await flushMicrotasks();
  assert.equal(h.scriptRequests.length, 2, 'Retry must not merely wait on the timed-out script');
  assert.equal(h.scripts.length, 1, 'Only the current API loader should remain attached');
  h.completeApiLoad();
  await flushMicrotasks();
  assert.equal(h.players.length, 1);
  h.emit(h.players[0], 'onReady');
  h.emit(h.players[0], 'onStateChange', 1);
  assert.equal(h.get('video-error').hidden, true);
  assert.equal(h.get('playback-status').dataset.state, 'playing');
});

test('initial buffering without frames reaches the playback timeout', async () => {
  const h = createHarness({ apiReady: true });
  const player = await h.start();
  h.emit(player, 'onReady');
  h.emit(player, 'onStateChange', 3);
  await h.advance(25_001);
  h.assertPlaybackError();
  assert.equal(player.destroyed, true);
});

test('autoplay blocking may wait for the user, but subsequent buffering must time out', async () => {
  const h = createHarness({ apiReady: true });
  const player = await h.start();
  h.emit(player, 'onReady');
  h.emit(player, 'onAutoplayBlocked');
  await h.advance(30_000);
  assert.equal(h.get('video-error').hidden, true, 'Waiting for a user gesture is not a network error');
  assert.equal(player.destroyed, false);

  h.emit(player, 'onStateChange', 3); // User pressed play inside the official iframe.
  await h.advance(25_001);
  h.assertPlaybackError();
  assert.equal(player.destroyed, true);
});

test('buffering after successful playback times out despite repeated buffering notifications', async () => {
  const h = createHarness({ apiReady: true });
  const player = await h.start();
  h.emit(player, 'onReady');
  h.emit(player, 'onStateChange', 1);
  await h.advance(30_000);
  assert.equal(player.destroyed, false, 'Normal playback must not hit the startup timeout');

  h.emit(player, 'onStateChange', 3);
  await h.advance(20_000);
  h.emit(player, 'onStateChange', 3);
  await h.advance(5_001);
  h.assertPlaybackError();
  assert.equal(player.destroyed, true);
});

test('rapid selection during API loading creates only the most recently selected player', async () => {
  const h = createHarness();
  await h.start();
  h.chooseCamera('gwangan');
  h.chooseCamera('homigot');
  await flushMicrotasks();
  assert.equal(h.scriptRequests.length, 1, 'Concurrent selections should share API initialization');
  h.completeApiLoad();
  await flushMicrotasks();

  assert.equal(h.players.length, 1);
  const expected = h.context.KOREA_CAMERAS.find(camera => camera.id === 'homigot');
  assert.equal(h.players[0].options.videoId, expected.videoId);
  assert.equal(h.get('viewer-title').textContent, expected.name);
});

test('callbacks from a destroyed camera cannot change the new camera or start old playback', async () => {
  const h = createHarness({ apiReady: true });
  const oldPlayer = await h.start();
  h.chooseCamera('gwangan');
  await flushMicrotasks();
  const current = h.players.at(-1);
  assert.equal(oldPlayer.destroyed, true);
  assert.notEqual(current, oldPlayer);
  h.emit(current, 'onReady');
  h.emit(current, 'onStateChange', 1);
  const stateBefore = h.get('playback-status').dataset.state;

  h.emit(oldPlayer, 'onReady');
  h.emit(oldPlayer, 'onError', 153);
  h.emit(oldPlayer, 'onStateChange', 3);
  h.emit(oldPlayer, 'onAutoplayBlocked');
  assert.equal(oldPlayer.playCalls, 0);
  assert.equal(current.destroyed, false);
  assert.equal(h.get('playback-status').dataset.state, stateBefore);
  assert.equal(h.get('video-error').hidden, true);
  await h.advance(30_000);
  assert.equal(current.destroyed, false, 'Stale buffering must not arm a current-player timeout');
});

test('closing the viewer while the API loads prevents a late player from appearing', async () => {
  const h = createHarness();
  await h.start();
  h.fire('close-viewer');
  h.completeApiLoad();
  await flushMicrotasks();
  await h.advance(30_000);

  assert.equal(h.players.length, 0);
  assert.equal(h.get('viewer').hidden, true);
  assert.equal(h.get('player-mount').children.length, 0);
});

test('timeout removes the player and ignores all later callbacks from that attempt', async () => {
  const h = createHarness({ apiReady: true });
  const player = await h.start();
  await h.advance(25_001);
  h.assertPlaybackError();
  assert.equal(player.destroyed, true);
  assert.equal(h.get('player-mount').children.length, 0);
  const message = h.get('playback-text').textContent;

  h.emit(player, 'onReady');
  h.emit(player, 'onStateChange', 1);
  h.emit(player, 'onAutoplayBlocked');
  h.emit(player, 'onError', 100);
  h.assertPlaybackError();
  assert.equal(h.get('playback-text').textContent, message);
  assert.equal(player.playCalls, 0);
});

test('API network error removes the failed loader and retry can recover', async () => {
  const h = createHarness();
  await h.start();
  assert.equal(h.scriptRequests.length, 1);
  assert.equal(typeof h.scripts[0].onerror, 'function');
  h.scripts[0].onerror(new Error('Simulated API transport failure'));
  await flushMicrotasks();
  h.assertPlaybackError();
  assert.equal(h.scripts.length, 0);

  h.fire('retry-video');
  await flushMicrotasks();
  assert.equal(h.scriptRequests.length, 2);
  h.completeApiLoad();
  await flushMicrotasks();
  assert.equal(h.players.length, 1);
  h.emit(h.players[0], 'onReady');
  h.emit(h.players[0], 'onStateChange', 1);
  assert.equal(h.get('playback-status').dataset.state, 'playing');
  assert.equal(h.get('video-error').hidden, true);
});

for (const [state, label] of [[2, 'paused'], [0, 'ended']]) {
  test(`${label} playback clears the watchdog without treating idle time as failure`, async () => {
    const h = createHarness({ apiReady: true });
    const player = await h.start();
    h.emit(player, 'onReady');
    h.emit(player, 'onStateChange', 3);
    await h.advance(20_000);
    h.emit(player, 'onStateChange', state);
    await h.advance(30_000);

    assert.equal(h.get('video-error').hidden, true);
    assert.equal(h.get('playback-status').dataset.state, label);
    assert.equal(player.destroyed, false);

    // Resuming/replaying is a new loading attempt and must be monitored again.
    h.emit(player, 'onStateChange', 3);
    await h.advance(25_001);
    h.assertPlaybackError();
    assert.equal(player.destroyed, true);
  });
}

test('late callbacks from a timed-out loader cannot settle or remove the retry loader', async () => {
  const h = createHarness();
  await h.start();
  const staleReady = h.context.onYouTubeIframeAPIReady;
  const staleError = h.scripts[0].onerror;
  await h.advance(12_001);
  h.fire('retry-video');
  await flushMicrotasks();
  assert.equal(h.scriptRequests.length, 2);
  const retryScript = h.scripts[0];
  const retryReady = h.context.onYouTubeIframeAPIReady;

  staleError(new Error('Late failure from first loader'));
  staleReady();
  await flushMicrotasks();
  assert.equal(h.scripts.length, 1);
  assert.equal(h.scripts[0], retryScript);
  assert.equal(h.context.onYouTubeIframeAPIReady, retryReady);
  assert.equal(h.get('video-error').hidden, true);

  h.completeApiLoad();
  await flushMicrotasks();
  assert.equal(h.players.length, 1);
  h.emit(h.players[0], 'onReady');
  h.emit(h.players[0], 'onStateChange', 1);
  assert.equal(h.get('playback-status').dataset.state, 'playing');
});

test('filtering out the selected camera destroys its player and ignores later events', async () => {
  const h = createHarness({ apiReady: true });
  const player = await h.start();
  h.emit(player, 'onReady');
  h.emit(player, 'onStateChange', 1);
  h.get('search').value = '부산';
  h.fire('search', 'input');
  h.flushAnimationFrames();

  const expected = h.context.KOREA_CAMERAS.filter(camera => [camera.name, camera.region, camera.location, camera.categoryLabel, camera.provider || ''].some(value => value.includes('부산')));
  assert.ok(expected.length > 0, 'The search must retain other cameras');
  assert.equal(Number(h.get('result-count').textContent), expected.length);
  assert.equal(player.destroyed, true);
  assert.equal(h.get('viewer').hidden, true);
  assert.equal(h.get('player-mount').children.length, 0);
  const priorState = h.get('playback-status').dataset.state;
  const priorErrorHidden = h.get('video-error').hidden;

  h.emit(player, 'onReady');
  h.emit(player, 'onStateChange', 3);
  h.emit(player, 'onError', 153);
  await h.advance(30_000);
  assert.equal(h.get('viewer').hidden, true);
  assert.equal(h.get('playback-status').dataset.state, priorState);
  assert.equal(h.get('video-error').hidden, priorErrorHidden);
  assert.equal(h.players.length, 1, 'Filtering must not initialize an unselected replacement player');
});

test('combined category, region and search filters expose an empty state and reset restores the list', () => {
  const h = createHarness();
  const total = h.context.KOREA_CAMERAS.length;
  assert.equal(Number(h.get('result-count').textContent), total);
  h.fire('categories', 'click', {
    target: { closest: selector => selector === '[data-category]' ? { dataset: { category: 'sea' } } : null }
  });
  const seaCameras = h.context.KOREA_CAMERAS.filter(camera => camera.category === 'sea');
  assert.ok(seaCameras.length > 0, 'Category filter must have results');
  assert.equal(Number(h.get('result-count').textContent), seaCameras.length);

  h.chooseRegion('부산');
  const busanSeaCameras = seaCameras.filter(camera => camera.region === '부산');
  assert.ok(busanSeaCameras.length > 0 && busanSeaCameras.length < seaCameras.length, 'Region must narrow the category');
  assert.equal(Number(h.get('result-count').textContent), busanSeaCameras.length);
  h.get('search').value = '호미곶';
  h.fire('search', 'input');
  h.flushAnimationFrames();
  assert.equal(Number(h.get('result-count').textContent), 0);
  assert.equal(h.get('empty-state').hidden, false);
  assert.equal(h.get('camera-list').hidden, true);
  assert.equal(h.get('random-button').disabled, true);

  h.fire('reset-filters');
  assert.equal(Number(h.get('result-count').textContent), total);
  assert.equal(h.get('empty-state').hidden, true);
  assert.equal(h.get('camera-list').hidden, false);
  assert.equal(h.get('random-button').disabled, false);
  assert.equal(h.get('search').value, '');
  assert.equal(h.get('region-label').textContent, 'All regions');
});

const favoritesKey = 'jigeum-korea:favorites:v1';
for (const [label, stored] of [
  ['malformed JSON', '{not-valid-json'],
  ['a non-array JSON value', '{"jeju":true}']
]) {
  test(`loading ${label} in favorites does not break browsing or the saved empty state`, () => {
    const h = createHarness({ storage: new Map([[favoritesKey, stored]]) });
    assert.equal(Number(h.get('saved-count').textContent), 0);
    assert.equal(Number(h.get('result-count').textContent), h.context.KOREA_CAMERAS.length);

    h.fire('saved-tab');
    assert.equal(Number(h.get('result-count').textContent), 0);
    assert.equal(h.get('empty-state').hidden, false);
    assert.equal(h.get('random-button').disabled, true);
    h.fire('reset-filters');
    assert.equal(Number(h.get('result-count').textContent), h.context.KOREA_CAMERAS.length);
    assert.equal(h.get('random-button').disabled, false);
  });
}

test('favorites loading retains known IDs once and discards unknown or invalid entries', () => {
  const stored = JSON.stringify(['missing-camera', 'jeju', 'jeju', null, 42, { id: 'gwangan' }]);
  const h = createHarness({ storage: new Map([[favoritesKey, stored]]) });
  assert.equal(Number(h.get('saved-count').textContent), 1);
  h.fire('saved-tab');
  assert.equal(Number(h.get('result-count').textContent), 1);
  const renderedIds = [...h.get('camera-list').innerHTML.matchAll(/data-camera="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(renderedIds, ['jeju']);

  h.chooseCamera('jeju');
  h.fire('viewer-save');
  assert.equal(Number(h.get('saved-count').textContent), 0);
  assert.equal(Number(h.get('result-count').textContent), 0);
  assert.deepEqual(JSON.parse(h.storage.get(favoritesKey)), []);
});

test('denied persistence keeps favorites usable in memory and explains that they are temporary', () => {
  const storage = new Map();
  const h = createHarness({ storage, denyStorageWrites: true });
  h.chooseCamera('jeju');
  h.fire('viewer-save');
  assert.equal(Number(h.get('saved-count').textContent), 1);
  assert.equal(h.get('toast').classList.contains('visible'), true);
  assert.match(h.get('toast').textContent, /for this visit only/, 'The user must be told that the favorite was not persisted');
  assert.equal(storage.has(favoritesKey), false);

  h.fire('saved-tab');
  assert.equal(Number(h.get('result-count').textContent), 1);
  assert.equal(h.get('empty-state').hidden, true);
  const reloaded = createHarness({ storage, denyStorageWrites: true });
  assert.equal(Number(reloaded.get('saved-count').textContent), 0);
  assert.equal(Number(reloaded.get('result-count').textContent), reloaded.context.KOREA_CAMERAS.length);
  assert.equal(Number(h.get('saved-count').textContent), 1, 'The original session still owns its temporary favorite');

  h.fire('viewer-save');
  assert.equal(Number(h.get('saved-count').textContent), 0);
  assert.equal(h.get('empty-state').hidden, false);
});


test('official CCTV iframe document load does not claim video playback', async () => {
  const h = createHarness();
  const camera = h.context.KOREA_CAMERAS.find(camera => camera.kind === 'iframe');
  assert.ok(camera, 'Catalog must contain an official iframe source');
  h.chooseCamera(camera.id);
  const frame = h.get('player-mount').children[0];
  assert.equal(frame.tagName, 'IFRAME');
  assert.equal(frame.src, camera.embedUrl);
  assert.equal(h.get('playback-status').dataset.state, 'loading');
  frame.onload();
  assert.equal(h.get('playback-status').dataset.state, 'source');
  assert.equal(h.players.length, 0, 'Official player must remain provider controlled');
  await h.advance(30_000);
  assert.equal(h.get('video-error').hidden, true, 'Document load clears the navigation watchdog');
  assert.equal(h.get('playback-status').dataset.state, 'source');
});

test('switching official iframes ignores previous load and error callbacks', async () => {
  const h = createHarness();
  const cameras = h.context.KOREA_CAMERAS.filter(camera => camera.kind === 'iframe');
  assert.ok(cameras.length >= 2, 'Race test needs two distinct official players');
  h.chooseCamera(cameras[0].id);
  const oldFrame = h.get('player-mount').children[0];
  h.chooseCamera(cameras[1].id);
  const currentFrame = h.get('player-mount').children[0];
  assert.notEqual(currentFrame, oldFrame);
  assert.equal(oldFrame.parentNode, null);
  oldFrame.onload();
  oldFrame.onerror();
  assert.equal(h.get('playback-status').dataset.state, 'loading', 'Old load must not mark the new frame as loaded');
  assert.equal(h.get('video-error').hidden, true, 'Old failure must not destroy the current frame');
  assert.equal(h.get('player-mount').children[0], currentFrame);
  currentFrame.onload();
  oldFrame.onerror();
  await h.advance(30_000);
  assert.equal(h.get('playback-status').dataset.state, 'source');
  assert.equal(h.get('video-error').hidden, true);
  assert.equal(h.get('viewer-title').textContent, cameras[1].name);
  assert.equal(h.get('player-mount').children[0], currentFrame);
});

function selectHls(h, { index = 0, withoutLimit = false, limited = false, providerType } = {}) {
  const candidates = h.context.KOREA_CAMERAS.filter(camera => camera.kind === 'hls' && (!limited || camera.sessionLimitSeconds === 15) && (!providerType || camera.providerType === providerType));
  const camera = candidates[index];
  assert.ok(camera, 'The actual catalog must supply an HLS camera for this case');
  // Isolated data fixture for the independent 25-second watchdog. Current
  // Yongpyong sources otherwise end their sessions at 15 seconds by design.
  if (withoutLimit) camera.sessionLimitSeconds = null;
  h.chooseCamera(camera.id);
  return { camera, instance: h.hlsPlayers.at(-1), video: h.videos.at(-1) };
}

test('HLS manifest parsing requests playback but only a media playing event reports playing', async () => {
  const h = createHarness();
  const { camera, instance, video } = selectHls(h);
  assert.equal(instance.source, camera.proxy ? '/api/hls/' + encodeURIComponent(camera.id) + '/index.m3u8' : camera.streamUrl);
  assert.equal(instance.media, video);
  assert.equal(h.get('playback-status').dataset.state, 'loading');
  h.emitHls(instance, 'MANIFEST_PARSED');
  await flushMicrotasks();
  assert.equal(video.playCalls, 1);
  assert.equal(h.get('playback-status').dataset.state, 'loading', 'A parsed playlist is not decoded playback');
  h.emitMedia(video, 'playing');
  assert.equal(h.get('playback-status').dataset.state, 'playing');
  assert.equal(h.get('video-error').hidden, true);
});

test('fatal HLS errors destroy the stream, release the video and ignore later callbacks', async () => {
  const h = createHarness();
  const { instance, video } = selectHls(h);
  h.emitHls(instance, 'ERROR', { fatal: true, details: 'fragLoadError' });
  h.assertPlaybackError();
  assert.equal(instance.destroyCalls, 1);
  assert.ok(video.pauseCalls > 0);
  assert.ok(video.loadCalls > 0);
  assert.equal(video.parentNode, null);
  h.emitHls(instance, 'MANIFEST_PARSED');
  h.emitMedia(video, 'playing');
  h.emitMedia(video, 'stalled');
  await h.advance(30_000);
  h.assertPlaybackError();
  assert.equal(video.playCalls, 0);
  assert.equal(h.get('video-limit').hidden, true, 'A failed stream cannot later show a normal session-end screen');
});

test('changing HLS cameras ignores all old HLS and media events', async () => {
  const h = createHarness();
  const old = selectHls(h, { withoutLimit: true });
  const current = selectHls(h, { index: 1, withoutLimit: true });
  assert.equal(old.instance.destroyed, true);
  assert.equal(old.video.parentNode, null);
  h.emitMedia(current.video, 'playing');
  h.emitHls(old.instance, 'MANIFEST_PARSED');
  h.emitHls(old.instance, 'ERROR', { fatal: true });
  h.emitHls(old.instance, 'ERROR', { fatal: false, details: 'bufferStalledError' });
  for (const event of ['playing', 'waiting', 'stalled', 'pause', 'ended', 'error']) h.emitMedia(old.video, event);
  await h.advance(30_000);
  assert.equal(old.video.playCalls, 0);
  assert.equal(current.instance.destroyed, false);
  assert.equal(h.get('playback-status').dataset.state, 'playing');
  assert.equal(h.get('player-mount').children[0], current.video);
  assert.equal(h.get('viewer-title').textContent, current.camera.name);
});

test('closing an HLS viewer destroys media and prevents late playback or errors', async () => {
  const h = createHarness();
  const { instance, video } = selectHls(h);
  h.fire('close-viewer');
  const priorState = h.get('playback-status').dataset.state;
  assert.equal(instance.destroyed, true);
  assert.ok(video.pauseCalls > 0 && video.loadCalls > 0);
  h.emitHls(instance, 'MANIFEST_PARSED');
  h.emitHls(instance, 'ERROR', { fatal: true });
  h.emitMedia(video, 'playing');
  await h.advance(30_000);
  assert.equal(h.get('viewer').hidden, true);
  assert.equal(h.get('player-mount').children.length, 0);
  assert.equal(h.get('playback-status').dataset.state, priorState);
  assert.equal(video.playCalls, 0);
  assert.equal(h.get('video-limit').hidden, true);
});

test('HLS startup without a decoded playing event fails at 25 seconds', async () => {
  const h = createHarness();
  const { instance } = selectHls(h, { withoutLimit: true });
  h.emitHls(instance, 'MANIFEST_PARSED');
  await h.advance(24_999);
  assert.equal(instance.destroyed, false);
  assert.equal(h.get('video-error').hidden, true);
  await h.advance(2);
  h.assertPlaybackError();
  assert.equal(instance.destroyed, true);
});

test('stalling after HLS playback has one 25-second deadline despite repeated notifications', async () => {
  const h = createHarness();
  const { instance, video } = selectHls(h, { withoutLimit: true });
  h.emitMedia(video, 'playing');
  await h.advance(30_000);
  assert.equal(instance.destroyed, false, 'Successful playback clears startup monitoring');
  h.emitMedia(video, 'waiting');
  await h.advance(20_000);
  h.emitHls(instance, 'ERROR', { fatal: false, details: 'bufferStalledError' });
  h.emitMedia(video, 'stalled');
  await h.advance(5_001);
  h.assertPlaybackError();
  assert.equal(instance.destroyed, true);
});

test('the actual 15-second source limit stops video and continue creates a fresh instance', async () => {
  const h = createHarness();
  const old = selectHls(h, { limited: true });
  h.emitHls(old.instance, 'MANIFEST_PARSED');
  h.emitMedia(old.video, 'playing');
  await h.advance(14_999);
  assert.equal(old.instance.destroyed, false);
  await h.advance(2);
  assert.equal(old.instance.destroyed, true);
  assert.equal(h.get('video-limit').hidden, false);
  assert.equal(h.get('video-error').hidden, true);
  assert.equal(h.get('playback-status').dataset.state, 'paused');
  assert.equal(h.get('player-mount').children.length, 0);

  h.fire('continue-video');
  const next = h.hlsPlayers.at(-1);
  assert.notEqual(next, old.instance);
  assert.equal(next.source, old.instance.source);
  assert.equal(h.get('video-limit').hidden, true);
  h.emitHls(old.instance, 'ERROR', { fatal: true });
  h.emitMedia(old.video, 'playing');
  assert.equal(h.get('playback-status').dataset.state, 'loading');
  h.emitHls(next, 'MANIFEST_PARSED');
  h.emitMedia(next.media, 'playing');
  assert.equal(h.get('playback-status').dataset.state, 'playing');
  assert.equal(next.destroyed, false);
});

test('a 15-second session with no playback ends in error, not a misleading continue screen', async () => {
  const h = createHarness();
  const { instance, video } = selectHls(h, { limited: true });
  h.emitHls(instance, 'MANIFEST_PARSED');
  assert.equal(video.readyState, 0);
  await h.advance(15_001);
  h.assertPlaybackError();
  assert.equal(instance.destroyed, true);
  assert.equal(h.get('video-limit').hidden, true);
});

for (const native of [false, true]) test(`Yongpyong keeps 15 seconds after ${native ? 'native metadata' : 'manifest parsing'} without extending repeated events`, async () => {
  const h = createHarness({ hlsSupported: !native, nativeHls: native ? 'probably' : '' });
  const { instance, video } = selectHls(h, { providerType: 'yongpyong' });
  const ready = () => native ? h.emitMedia(video, 'loadedmetadata') : h.emitHls(instance, 'MANIFEST_PARSED');
  await h.advance(8_000);
  ready();
  h.emitMedia(video, 'playing');
  await h.advance(7_001);
  assert.equal(h.get('player-mount').children[0], video, 'Manifest loading must not consume the provider viewing interval');
  ready();
  await h.advance(7_998);
  assert.equal(h.get('video-limit').hidden, true);
  await h.advance(2);
  assert.equal(h.get('video-limit').hidden, false, 'A repeated ready event must not extend the original interval');
  assert.equal(video.parentNode, null);
});

test('Phoenix starts its 180 seconds on first playing and resuming cannot extend it', async () => {
  const h = createHarness();
  const { instance, video } = selectHls(h, { providerType: 'phoenix' });
  await h.advance(5_000);
  h.emitHls(instance, 'MANIFEST_PARSED');
  await h.advance(7_000);
  h.emitMedia(video, 'playing');
  await h.advance(90_000);
  h.emitMedia(video, 'pause');
  h.emitMedia(video, 'playing');
  await h.advance(89_999);
  assert.equal(instance.destroyed, false, 'Connection and playlist loading must not consume the 180-second interval');
  await h.advance(2);
  assert.equal(instance.destroyed, true);
  assert.equal(h.get('video-limit').hidden, false, 'Resuming playback must not reset the first-playing deadline');
});

test('High1 retains its 30-second connection limit even when the first frame is late', async () => {
  const h = createHarness();
  const { instance, video } = selectHls(h, { providerType: 'high1' });
  await h.advance(8_000);
  h.emitHls(instance, 'MANIFEST_PARSED');
  await h.advance(14_000);
  h.emitMedia(video, 'playing');
  await h.advance(7_999);
  assert.equal(instance.destroyed, false);
  await h.advance(2);
  assert.equal(instance.destroyed, true, 'Neither manifest parsing nor first playing may defer the official connection cap');
  assert.equal(h.get('video-limit').hidden, false);
});

for (const providerType of ['busan', 'wellihilli']) test(`${providerType} starts its 30-second limit at first loadeddata without extending repeated events`, async () => {
  const h = createHarness();
  // The source catalog is being expanded independently; isolate this provider's
  // documented timer behavior with the same native HLS path used by the app.
  const camera = h.context.KOREA_CAMERAS.find(camera => camera.kind === 'hls');
  camera.providerType = providerType;
  camera.sessionLimitSeconds = 30;
  if (providerType === 'wellihilli') camera.sessionLimitReason = 'app';
  h.chooseCamera(camera.id);
  const instance = h.hlsPlayers.at(-1), video = h.videos.at(-1);
  await h.advance(3_000);
  h.emitHls(instance, 'MANIFEST_PARSED');
  await h.advance(5_000);
  h.emitMedia(video, 'loadeddata');
  h.emitMedia(video, 'playing');
  await h.advance(10_000);
  h.emitMedia(video, 'loadeddata');
  await h.advance(19_999);
  assert.equal(instance.destroyed, false, 'Neither connection nor manifest parsing starts the Busan interval');
  await h.advance(2);
  assert.equal(instance.destroyed, true);
  assert.equal(h.get('video-limit').hidden, false);
  if (providerType === 'wellihilli') assert.equal(h.get('video-limit-text').textContent, 'Your 30-second viewing session has ended. Select Continue watching to reconnect.');
});

test('late ready and playing events from a replaced limited source cannot change the new session deadline', async () => {
  for (const providerType of ['yongpyong', 'phoenix']) {
    const h = createHarness();
    const old = selectHls(h, { providerType });
    await h.advance(1_000);
    const current = selectHls(h, { providerType: 'phoenix', index: 1 });
    h.emitHls(current.instance, 'MANIFEST_PARSED');
    h.emitMedia(current.video, 'playing');
    await h.advance(10_000);
    h.emitHls(old.instance, 'MANIFEST_PARSED');
    h.emitMedia(old.video, 'playing');
    assert.equal(old.video.playCalls, 0);
    await h.advance(169_999);
    assert.equal(current.instance.destroyed, false);
    assert.equal(h.get('player-mount').children[0], current.video);
    await h.advance(2);
    assert.equal(current.instance.destroyed, true);
    assert.equal(h.get('video-limit').hidden, false);
  }
});

test('a browser with neither MSE HLS nor native HLS support receives an error and cleanup', () => {
  const h = createHarness({ hlsSupported: false, nativeHls: '' });
  const { video } = selectHls(h);
  h.assertPlaybackError();
  assert.equal(h.hlsPlayers.length, 0);
  assert.equal(video.parentNode, null);
  assert.ok(video.pauseCalls > 0 && video.loadCalls > 0);
});

test('native HLS metadata requests playback, actual playing updates status and close releases src', async () => {
  const h = createHarness({ hlsSupported: false, nativeHls: 'probably' });
  const { camera, video } = selectHls(h);
  assert.equal(h.hlsPlayers.length, 0);
  assert.equal(video.src, camera.proxy ? '/api/hls/' + encodeURIComponent(camera.id) + '/index.m3u8' : camera.streamUrl);
  h.emitMedia(video, 'loadedmetadata');
  await flushMicrotasks();
  assert.equal(video.playCalls, 1);
  assert.equal(h.get('playback-status').dataset.state, 'loading');
  h.emitMedia(video, 'playing');
  assert.equal(h.get('playback-status').dataset.state, 'playing');
  h.fire('close-viewer');
  assert.equal(video.src, '');
  assert.equal(video.parentNode, null);
  assert.ok(video.pauseCalls > 0 && video.loadCalls > 0);
});

test('each media-kind filter matches the real catalog and combines with region and search', () => {
  const h = createHarness({ cameraSource: productionCameraSource });
  const cameras = h.context.KOREA_CAMERAS;
  for (const kind of new Set(cameras.map(camera => camera.kind || 'youtube'))) {
    h.fire('reset-filters');
    const expected = cameras.filter(camera => (camera.kind || 'youtube') === kind);
    h.get('media-kind').value = kind;
    h.fire('media-kind', 'change');
    assert.equal(Number(h.get('result-count').textContent), expected.length);
    const rendered = [...h.get('camera-list').innerHTML.matchAll(/data-camera="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(rendered, Array.from(expected, camera => camera.id));
    h.chooseRegion(expected[0].region);
    assert.equal(Number(h.get('result-count').textContent), expected.filter(camera => camera.region === expected[0].region).length);
    h.get('search').value = 'no-such-qa-camera-73492';
    h.fire('search', 'input');
    h.flushAnimationFrames();
    assert.equal(Number(h.get('result-count').textContent), 0);
    assert.equal(h.get('random-button').disabled, true);
  }
  h.fire('reset-filters');
  assert.equal(Number(h.get('result-count').textContent), cameras.length);
  assert.equal(h.get('media-kind').value, 'all');
});
