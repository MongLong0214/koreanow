'use strict';

// Exercise the real app with media/timer stubs; no stream is requested. These
// buffer snapshots come from the 2026-11-26 group B browser audit, run
// 24350e52-2297-4142-a317-7ad0dcd5b332. They reproduced paused, decoded frames
// that never reached video.play() despite a later playable buffered range.
const test = require('node:test');
const assert = require('node:assert/strict');
const {createHarness, flushMicrotasks, englishCameraSource} = require('./helpers/player-harness.cjs');

const capturedStarts = [
  ['yeongsan-13003', 1, [[0, 0.999], [2.015, 12.029]], 2.015],
  ['yeongsan-110048', 1, [[0, 0.997], [3.001, 12.018]], 3.001],
  ['yeongsan-13068', 1, [[0, 2], [3.005, 10.972]], 3.005],
  ['yeongsan-13050', 2, [[0, 1.014], [2.033, 11.999]], 2.033],
  ['yeongsan-110018', 2, [[0, 0.997], [2.004, 12.027]], 2.004],
  ['yeongsan-110006', 2, [[0, 0.995], [3.971, 12.002]], 3.971],
  ['yeongsan-110028', 2, [[0, 1.004], [2.975, 12.967]], 2.975],
  ['yeongsan-110034', 2, [[0, 1.008], [4.038, 12.04]], 4.038],
  ['yeongsan-110032', 2, [[0, 2], [2.974, 11.969]], 2.974],
  ['yeongsan-13068', 2, [[0.000001, 11.002001]], 0.000001],
];

function timeRanges(ranges) {
  return {length: ranges.length, start: i => ranges[i][0], end: i => ranges[i][1]};
}

function openRiver(id = 'yeongsan-13003', options = {}) {
  const h = createHarness({cameraSource: englishCameraSource, ...options});
  const camera = h.context.KOREA_DISPLAY_CAMERAS.find(camera => camera.id === id);
  assert.equal(camera?.providerType, 'yeongsan');
  h.chooseCamera(id);
  const video = h.videos[0], instance = h.hlsPlayers[0], seeks = [];
  let currentTime = 0;
  Object.defineProperty(video, 'currentTime', {
    get: () => currentTime,
    set: value => { currentTime = value; seeks.push(value); },
  });
  const ready = ranges => Object.assign(video, {
    readyState: 4, videoWidth: 320, videoHeight: 240, buffered: timeRanges(ranges),
  });
  return {h, camera, video, instance, seeks, ready};
}

for (const [id, round, ranges, expectedStart] of capturedStarts) {
  test(`captured ${id} round ${round} starts once from its usable buffered range`, () => {
    const {h, video, instance, seeks, ready} = openRiver(id);
    assert.equal(video.autoplay, false);
    ready(ranges);
    h.emitHls(instance, 'FRAG_BUFFERED');
    assert.equal(video.currentTime, expectedStart);
    assert.equal(video.playCalls, 1);
    assert.deepEqual(seeks, [expectedStart]);
    assert.equal(instance.source, '/api/hls/' + id + '/index.m3u8');
    h.emitHls(instance, 'FRAG_BUFFERED');
    h.emitMedia(video, 'canplay');
    h.emitMedia(video, 'progress');
    assert.equal(video.playCalls, 1, 'Queued startup events cannot issue another play request');
    assert.deepEqual(seeks, [expectedStart], 'Alignment is limited to the initial start');
    assert.equal(h.hlsPlayers.length, 1, 'Alignment must reuse the existing source connection');
  });
}

for (const ranges of [[[0, 0.999], [2.015, 12.029]], [[0.000001, 11.002001]]]) {
  test(`native HLS aligns a usable buffered start at ${ranges.at(-1)[0]}`, () => {
    const {h, video, seeks, ready} = openRiver(undefined, {hlsSupported: false, nativeHls: 'probably'});
    ready(ranges);
    h.emitMedia(video, 'loadedmetadata');
    assert.equal(video.playCalls, 1);
    assert.deepEqual(seeks, [ranges.at(-1)[0]]);
    assert.equal(video.src, '/api/hls/yeongsan-13003/index.m3u8');
    assert.equal(h.hlsPlayers.length, 0);
  });
}

test('an already playable current range is preferred without seeking forward or backward', () => {
  const {h, video, instance, seeks, ready} = openRiver();
  video.currentTime = 11;
  seeks.length = 0;
  ready([[0, 5], [10, 14], [20, 30]]);
  h.emitHls(instance, 'FRAG_BUFFERED');
  assert.equal(video.currentTime, 11);
  assert.equal(video.playCalls, 1);
  assert.deepEqual(seeks, []);
});

test('separate short ranges never add up to the three-second prefill target', () => {
  const {h, video, instance, seeks, ready} = openRiver();
  ready([[0, 2], [3, 5.9]]);
  h.emitHls(instance, 'FRAG_BUFFERED');
  assert.equal(video.playCalls, 0);
  assert.deepEqual(seeks, []);
  ready([[0, 2], [3, 6], [7, 20]]);
  h.emitMedia(video, 'progress');
  assert.equal(video.playCalls, 1);
  assert.deepEqual(seeks, [3], 'Use the earliest sufficient range, not the later live edge');
});

test('a future buffered range cannot trigger a seek before decoded video readiness', () => {
  const {h, video, instance, seeks, ready} = openRiver();
  ready([[0, 0.999], [2.015, 12.029]]);
  video.readyState = 1;
  h.emitHls(instance, 'FRAG_BUFFERED');
  video.readyState = 4;
  video.videoWidth = 0;
  h.emitMedia(video, 'canplay');
  assert.equal(video.playCalls, 0);
  assert.deepEqual(seeks, []);
  video.videoWidth = 320;
  h.emitMedia(video, 'loadeddata');
  assert.equal(video.playCalls, 1);
  assert.deepEqual(seeks, [2.015]);
});

for (const action of ['play', 'pause']) {
  test(`a user's ${action} before prefill disables later automatic alignment`, () => {
    const {h, video, instance, seeks, ready} = openRiver();
    h.emitMedia(video, action);
    ready([[0, 0.999], [2.015, 12.029]]);
    h.emitHls(instance, 'FRAG_BUFFERED');
    h.emitMedia(video, 'progress');
    assert.equal(video.playCalls, 0);
    assert.deepEqual(seeks, []);
  });
}

test('a native play request is respected before its queued play event is delivered', () => {
  const {h, video, instance, seeks, ready} = openRiver();
  ready([[0, 0.999], [2.015, 12.029]]);
  // HTMLMediaElement.play() changes paused synchronously, then queues `play`.
  video.paused = false;
  h.emitHls(instance, 'FRAG_BUFFERED');
  assert.equal(video.playCalls, 0);
  assert.deepEqual(seeks, []);
  h.emitMedia(video, 'play');
  h.emitMedia(video, 'pause');
  h.emitMedia(video, 'progress');
  assert.equal(video.playCalls, 0);
  assert.deepEqual(seeks, []);
});

test('buffer updates during playback and after a user pause cannot seek or resume the video', () => {
  const {h, video, instance, seeks, ready} = openRiver();
  h.emitMedia(video, 'playing');
  seeks.length = 0;
  const pausedAt = video.currentTime;
  ready([[10, 20]]);
  h.emitHls(instance, 'FRAG_BUFFERED');
  assert.equal(video.currentTime, pausedAt, 'No automatic alignment during active playback');
  assert.deepEqual(seeks, []);
  h.emitMedia(video, 'pause');
  ready([[20, 30]]);
  h.emitHls(instance, 'FRAG_BUFFERED');
  h.emitMedia(video, 'canplay');
  assert.equal(video.currentTime, pausedAt);
  assert.equal(video.playCalls, 0);
  assert.deepEqual(seeks, []);
  assert.equal(h.get('playback-status').dataset.state, 'paused');
});

for (const retire of ['close', 'switch']) {
  test(`${retire} invalidates old buffer events before they can seek or start playback`, () => {
    const {h, video, instance, seeks, ready} = openRiver();
    if (retire === 'close') h.fire('close-viewer');
    else h.chooseCamera('yeongsan-110014');
    assert.equal(instance.destroyed, true);
    ready([[0, 0.999], [2.015, 12.029]]);
    h.emitHls(instance, 'FRAG_BUFFERED');
    h.emitMedia(video, 'loadeddata');
    assert.equal(video.playCalls, 0);
    assert.deepEqual(seeks, []);
  });
}

test('alignment leaves the provider cap anchored to the original connection', async () => {
  const {h, camera, video, instance, seeks, ready} = openRiver();
  assert.ok(camera.sessionLimitSeconds > 5);
  await h.advance(5_000);
  ready([[0, 0.999], [2.015, 12.029]]);
  h.emitHls(instance, 'FRAG_BUFFERED');
  h.emitMedia(video, 'playing');
  await h.advance(camera.sessionLimitSeconds * 1000 - 5_001);
  assert.equal(instance.destroyed, false);
  await h.advance(2);
  assert.equal(instance.destroyed, true);
  assert.equal(h.get('video-limit').hidden, false);
  assert.equal(h.get('player-mount').children.length, 0);
  const before = seeks.slice();
  ready([[10, 20]]);
  h.emitHls(instance, 'FRAG_BUFFERED');
  assert.deepEqual(seeks, before);
  assert.equal(video.playCalls, 1);
  assert.equal(h.hlsPlayers.length, 1, 'Provider cutoff must not reconnect automatically');
});

test('autoplay rejection after alignment preserves the explicit-play fallback without retries', async () => {
  const {h, video, instance, seeks, ready} = openRiver();
  video.play = function () {
    this.playCalls++;
    return Promise.reject(Object.assign(new Error('User gesture required'), {name: 'NotAllowedError'}));
  };
  ready([[0, 0.999], [2.015, 12.029]]);
  h.emitHls(instance, 'FRAG_BUFFERED');
  await flushMicrotasks();
  assert.equal(h.get('playback-status').dataset.state, 'ready');
  assert.equal(h.get('video-error').hidden, true);
  h.emitMedia(video, 'progress');
  h.emitHls(instance, 'FRAG_BUFFERED');
  assert.equal(video.playCalls, 1);
  assert.deepEqual(seeks, [2.015]);
});
