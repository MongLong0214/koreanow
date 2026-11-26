'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const relayModule = import(pathToFileURL(path.join(__dirname, '../worker/hls.mjs')).href);
const origin = 'http://muju.cache.cdn.cloudn.co.kr';
const base = channel => origin + '/mujuresort/_definst_/cam' + channel + '.stream/';
const canonical = channel => base(channel) + 'playlist.m3u8';
const popupUrl = channel => 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=' + channel;
const signature = '0123456789abcdef0123456789abcdef';
const future = () => Math.floor(Date.now() / 1000) + 3600;
const signed = (channel = '07', expiry = future(), hash = signature) => canonical(channel) + '?e=' + expiry + '&h=' + hash;
const popup = media => '<video id=muju-video><source\n src="' + media + '" type="application/x-mpegURL"></video>';
const master = uri => '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=3194571\n' + uri + '\n';
const child = uri => '#EXTM3U\n#EXT-X-TARGETDURATION:12\n#EXT-X-MEDIA-SEQUENCE:336069\n#EXTINF:11.368,\n' + uri + '\n';
const request = (route = '/api/hls/muju-07/index.m3u8', method = 'GET') => new Request('https://example.test' + route, { method, headers: { Cookie: 'do-not-forward=yes', Authorization: 'do-not-forward' } });
const resource = pathname => '/api/hls/muju-07/resource?path=' + encodeURIComponent(pathname);
const cameraPath = file => new URL(base('07') + file).pathname;
const catalog = Object.fromEntries(Array.from({ length: 11 }, (_, i) => {
  const channel = String(i + 1).padStart(2, '0');
  return ['muju-' + channel, { streamUrl: canonical(channel), providerType: 'muju' }];
}));
const tsBytes = new Uint8Array(188 * 3); tsBytes[0] = tsBytes[188] = tsBytes[376] = 0x47;
async function handle(req, options = {}) { return (await relayModule).handleHls(req, { catalog, ...options }); }
async function flush() { for (let i = 0; i < 24; i++) await Promise.resolve(); }
async function expectError(response, code) { assert.equal(response.status, 502); assert.equal((await response.json()).error.code, code); }

test('all eleven saved official popups resolve only their exact channel and relay the master', async () => {
  for (const channel of Object.keys(catalog).map(id => id.slice(-2))) {
    const html = fs.readFileSync(path.join(__dirname, '400/research/muju-public-popup-catalog-v21', channel + '.redacted.html'), 'utf8');
    const media = signed(channel);
    const fixture = html.replace(/src="http:\/\/muju\.cache\.cdn\.cloudn\.co\.kr\/[^"\r\n]+"/, 'src="' + media + '"');
    assert.ok(fixture.includes(media));
    const calls = [];
    const response = await handle(request('/api/hls/muju-' + channel + '/index.m3u8'), { fetchImpl: async (url, init) => {
      calls.push(url);
      assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      assert.deepEqual(Object.keys(init.headers), ['Accept']);
      assert.ok(init.signal instanceof AbortSignal);
      if (calls.length === 1) { assert.equal(url, popupUrl(channel)); return new Response(fixture, { headers: { 'Set-Cookie': 'never-forward=1' } }); }
      assert.equal(url, media); return new Response(master('chunklist_w1055002598.m3u8'));
    } });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(response.headers.get('Location'), null);
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Content-Type'), 'application/vnd.apple.mpegurl');
    const body = await response.text();
    const local = '/api/hls/muju-' + channel + '/resource?path=' + encodeURIComponent(new URL(base(channel) + 'chunklist_w1055002598.m3u8').pathname);
    assert.ok(body.includes(local));
    assert.ok(!body.includes('http://') && !body.includes(signature) && !body.includes('?e='));
    assert.equal(Number(response.headers.get('Content-Length')), Buffer.byteLength(body));
  }
});

test('child playlists and whole TS use the query-free fixed resource relay without another popup', async () => {
  const calls = [];
  const childPath = cameraPath('chunklist_w1055002598.m3u8');
  const tsPath = cameraPath('media_w1055002598_336069.ts');
  const fetchImpl = async (url, init) => {
    calls.push(url); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual');
    assert.deepEqual(Object.keys(init.headers), ['Accept']);
    if (url === origin + childPath) return new Response(child('media_w1055002598_336069.ts'));
    assert.equal(url, origin + tsPath); return new Response(tsBytes);
  };
  const playlist = await handle(request(resource(childPath)), { fetchImpl });
  assert.equal(playlist.status, 200); assert.ok((await playlist.text()).includes(resource(tsPath)));
  const fragment = await handle(request(resource(tsPath)), { fetchImpl });
  assert.equal(fragment.status, 200); assert.deepEqual(new Uint8Array(await fragment.arrayBuffer()), tsBytes);
  assert.deepEqual(calls, [origin + childPath, origin + tsPath]);
});

test('every new index connection fetches exactly one popup and a fresh master, with no token cache', async () => {
  const calls = [];
  for (const hash of ['a'.repeat(32), 'b'.repeat(32)]) {
    let attemptCalls = 0;
    const media = signed('07', future(), hash);
    const response = await handle(request(), { fetchImpl: async url => {
      calls.push(url); attemptCalls++;
      if (attemptCalls === 1) { assert.equal(url, popupUrl('07')); return new Response(popup(media)); }
      assert.equal(url, media); return new Response(master('chunklist_w12.m3u8'));
    } });
    assert.equal(response.status, 200); await response.text(); assert.equal(attemptCalls, 2);
  }
  assert.equal(calls.filter(url => url === popupUrl('07')).length, 2);
  assert.notEqual(calls[1], calls[3]);
});

test('literal canonical catalog guards reject other channels, origins and normalized spellings before any fetch', async () => {
  let calls = 0;
  const bad = [
    canonical('00'), canonical('12'), canonical('7'), canonical('07').replace('http:', 'https:'),
    canonical('07').replace('muju.cache.cdn.cloudn.co.kr', 'attacker.test'),
    canonical('07').replace('muju.cache.cdn.cloudn.co.kr', 'muju.cache.cdn.cloudn.co.kr:80'),
    canonical('07').replace('http://', 'http://user:pass@'),
    canonical('07').replace('/_definst_/', '/x/../_definst_/'),
    canonical('07').replace('/cam07.', '/cam%30%37.'),
    canonical('07') + '?e=2000000000', canonical('07') + '#x', ' ' + canonical('07'),
    canonical('07').replace('/mujuresort/', '\\mujuresort\\'), canonical('07') + '/extra'
  ];
  for (const streamUrl of bad) {
    const response = await handle(request(), { catalog: { 'muju-07': { streamUrl, providerType: 'muju' } }, fetchImpl: async () => { calls++; return new Response(''); } });
    assert.equal(response.status, 404, streamUrl);
  }
  assert.equal(calls, 0);
});

test('resource cannot bypass fresh resolution, select another camera, override hosts or add signed query fields', async () => {
  let calls = 0;
  const path = cameraPath('chunklist_w12.m3u8');
  const routes = [
    '/api/hls/muju-07/index.m3u8?cam_num=11', resource(cameraPath('playlist.m3u8')),
    resource(path.replace('cam07', 'cam08')), resource('http://169.254.169.254/latest/meta-data/'),
    resource('//attacker.test/a.ts'), resource(path + '?e=2000000000&h=' + signature),
    resource(path.replace('chunklist_w12.m3u8', '../cam08.stream/chunklist_w12.m3u8')),
    resource(path.replace('chunklist_w12.m3u8', '%2e%2e/admin')),
    resource(path.replace('chunklist_w12.m3u8', '%252e%252e/admin')),
    resource(path) + '&e=2000000000', resource(path) + '&path=' + encodeURIComponent(path),
    resource(cameraPath('secret.txt')), '/api/hls/muju-12/index.m3u8'
  ];
  for (const route of routes) {
    const response = await handle(request(route), { fetchImpl: async () => { calls++; return new Response(''); } });
    assert.ok(response.status === 400 || response.status === 404, route);
  }
  assert.equal((await handle(request(undefined, 'POST'), { fetchImpl: async () => { calls++; } })).status, 405);
  assert.equal(calls, 0);
});

test('public media validates exact channel, authority, path and the two literal query values', async () => {
  const media = signed();
  const invalid = [
    media.replace('cam07', 'cam08'), media.replace('muju.cache.cdn.cloudn.co.kr', 'attacker.test'),
    media.replace('http:', 'https:'), media.replace('http://', 'http://user:pass@'),
    media.replace('muju.cache.cdn.cloudn.co.kr', 'muju.cache.cdn.cloudn.co.kr:80'),
    media.replace('/_definst_/', '/x/../_definst_/'), media.replace('/cam07.', '/cam%30%37.'),
    media + '#ignored', media + '&url=http://169.254.169.254', media + '&e=' + future(), media + '&h=' + signature,
    media.replace('e=' + future(), 'e=123456789'), media.replace('e=' + future(), 'e=12345678901'),
    media.replace('h=' + signature, 'h=' + 'z'.repeat(32)), media.replace('h=' + signature, 'h=' + 'a'.repeat(31)),
    media.replace('&h=', '&amp;amp;h='), media.replace('?e=', '?%65='), media.replace('?e=', '?E='),
    media.replace('&h=', ';h='), media + '&', ' ' + media, media.replace('http://', '//'),
    media.replace('e=' + future(), 'e=+' + future())
  ];
  for (const candidate of invalid) {
    let calls = 0;
    const response = await handle(request(), { fetchImpl: async url => {
      calls++; assert.equal(url, popupUrl('07')); return new Response(popup(candidate));
    } });
    await expectError(response, 'UNEXPECTED_PUBLIC_MEDIA'); assert.equal(calls, 1);
  }
});

test('HTML ampersands and either exact e/h order are accepted without forwarding encoded tokens', async () => {
  const expiry = future();
  for (const query of ['e=' + expiry + '&amp;h=' + signature, 'h=' + signature.toUpperCase() + '&e=' + expiry]) {
    let calls = 0;
    const response = await handle(request(), { fetchImpl: async url => {
      calls++;
      if (calls === 1) return new Response(popup(canonical('07') + '?' + query));
      assert.equal(url, canonical('07') + '?' + query.replace('&amp;', '&'));
      return new Response(master('chunklist_w12.m3u8'));
    } });
    assert.equal(response.status, 200); await response.text(); assert.equal(calls, 2);
  }
});

test('expired or exactly expiring public URLs stop before the master with no reconnect', async t => {
  const now = 2_000_000_000_000; t.mock.method(Date, 'now', () => now);
  for (const expiry of [1_999_999_999, 2_000_000_000]) {
    let calls = 0;
    const response = await handle(request(), { fetchImpl: async url => { calls++; assert.equal(url, popupUrl('07')); return new Response(popup(signed('07', expiry))); } });
    await expectError(response, 'PUBLIC_MEDIA_EXPIRED'); assert.equal(calls, 1);
  }
});

test('expiry during the one master transfer rejects its response and never refreshes the popup', async t => {
  let now = 2_000_000_000_000; t.mock.method(Date, 'now', () => now);
  let calls = 0;
  const response = await handle(request(), { fetchImpl: async () => {
    calls++;
    if (calls === 1) return new Response(popup(signed('07', 2_000_000_001)));
    now += 1000; return new Response(master('chunklist_w12.m3u8'));
  } });
  await expectError(response, 'PUBLIC_MEDIA_EXPIRED'); assert.equal(calls, 2);
});

test('missing, duplicate or unquoted source attributes cannot select a public URL', async () => {
  const media = signed();
  for (const html of ['<html>maintenance</html>', popup(media) + popup(media), '<source data-src="' + media + '">', '<source src="' + media + '" src="' + media + '">', '<source src="' + media + '" src=other>', '<source src=' + media + '>']) {
    let calls = 0;
    const response = await handle(request(), { fetchImpl: async () => { calls++; return new Response(html); } });
    await expectError(response, 'PUBLIC_HLS_UNAVAILABLE'); assert.equal(calls, 1);
  }
});

test('redirects and upstream status failures at either stage never follow or retry', async () => {
  for (const stage of [1, 2]) for (const status of [302, 404, 500]) {
    let calls = 0;
    const response = await handle(request(), { fetchImpl: async (_url, init) => {
      calls++; assert.equal(init.redirect, 'manual');
      if (calls < stage) return new Response(popup(signed()));
      return new Response(null, { status, headers: { Location: 'http://169.254.169.254/latest/meta-data/' } });
    } });
    await expectError(response, status === 302 ? 'UPSTREAM_REDIRECT' : 'UPSTREAM_STATUS'); assert.equal(calls, stage);
    assert.equal(response.headers.get('Location'), null);
  }
});

test('popup and master limits, invalid text and a signature echo fail without exposing raw URLs', async () => {
  for (const stage of [1, 2]) for (const bad of ['oversize', 'invalid-utf8']) {
    let calls = 0;
    const response = await handle(request(), { fetchImpl: async () => {
      calls++;
      if (calls < stage) return new Response(popup(signed()));
      return bad === 'oversize' ? new Response(new Uint8Array((stage === 1 ? 200_000 : 256 * 1024) + 1)) : new Response(Uint8Array.of(0xff, 0xfe));
    } });
    await expectError(response, bad === 'oversize' ? 'UPSTREAM_TOO_LARGE' : 'PUBLIC_CONNECTION_FAILED'); assert.equal(calls, stage);
  }
  let calls = 0;
  const response = await handle(request(), { fetchImpl: async () => ++calls === 1 ? new Response(popup(signed())) : new Response(master('chunklist_w12.m3u8') + '# public URL ' + signed() + '\n') });
  const body = await response.text(); assert.equal(response.status, 502); assert.equal(calls, 2);
  assert.ok(!body.includes(signature) && !body.includes('http://'));
});

test('master cannot introduce another channel, a query, a remote origin or an unsupported key', async () => {
  const invalid = [
    master('/mujuresort/_definst_/cam08.stream/chunklist_w12.m3u8'),
    master('http://169.254.169.254/latest/meta-data/'), master('//attacker.test/a.m3u8'),
    master('chunklist_w12.m3u8?e=2000000000'), master('../cam08.stream/chunklist_w12.m3u8'),
    master('%2e%2e/admin'), master('playlist.m3u8'), master('unknown.m3u8'),
    master('chunklist_w12.m3u8') + '#EXT-X-KEY:METHOD=AES-128,URI="key"\n'
  ];
  for (const manifest of invalid) {
    let calls = 0;
    const response = await handle(request(), { fetchImpl: async () => ++calls === 1 ? new Response(popup(signed())) : new Response(manifest) });
    assert.equal(response.status, 502); assert.equal(calls, 2);
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
  }
});

test('HEAD still validates the public flow and signed master but returns only local headers', async () => {
  let calls = 0;
  const response = await handle(request(undefined, 'HEAD'), { fetchImpl: async (_url, init) => {
    calls++; assert.equal(init.method, 'GET');
    return new Response(calls === 1 ? popup(signed()) : master('chunklist_w12.m3u8'));
  } });
  assert.equal(response.status, 200); assert.equal(await response.text(), ''); assert.equal(calls, 2);
  assert.ok(Number(response.headers.get('Content-Length')) > 0); assert.equal(response.headers.get('Location'), null);
});

test('the whole public connection has one 20-second deadline, even if fetch ignores abort', async t => {
  const { handleHls } = await relayModule; t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolvePopup, signal, calls = 0, cancelled = false;
  const pending = handleHls(request(), { catalog, fetchImpl: async (_url, init) => { calls++; signal = init.signal; return new Promise(resolve => { resolvePopup = resolve; }); } });
  await flush(); t.mock.timers.tick(20_000);
  const response = await pending; assert.equal(response.status, 504); assert.equal(signal.aborted, true);
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(popup(signed()))); }, cancel() { cancelled = true; } });
  resolvePopup(new Response(body)); await flush();
  assert.equal(cancelled, true); assert.equal(calls, 1, 'A late popup must not launch a master fetch');
});

test('master receives only the time remaining after the popup, not a fresh deadline', async t => {
  const { handleHls } = await relayModule; t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0, settled = false; const signals = [];
  const pending = handleHls(request(), { catalog, fetchImpl: async (_url, init) => {
    calls++; signals.push(init.signal);
    if (calls === 1) return new Promise(resolve => setTimeout(() => resolve(new Response(popup(signed()))), 15_000));
    return new Promise(() => {});
  } }).then(response => { settled = true; return response; });
  await flush(); t.mock.timers.tick(15_000); await flush(); assert.equal(calls, 2);
  t.mock.timers.tick(4_999); await flush(); assert.equal(settled, false);
  t.mock.timers.tick(1); const response = await pending;
  assert.equal(response.status, 504); assert.equal(signals[0], signals[1]); assert.equal(signals[0].aborted, true); assert.equal(calls, 2);
});

test('deadline cancels an incomplete popup body and prevents the master request', async t => {
  const { handleHls } = await relayModule; t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0, cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('<source')); }, cancel() { cancelled = true; } });
  const pending = handleHls(request(), { catalog, fetchImpl: async () => { calls++; return new Response(body); } });
  await flush(); t.mock.timers.tick(20_000);
  assert.equal((await pending).status, 504); assert.equal(cancelled, true); assert.equal(calls, 1);
});
