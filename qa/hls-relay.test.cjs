'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const relayModule = import(pathToFileURL(path.join(__dirname, '../worker/hls.mjs')).href);
const jejuUrl = 'http://59.8.86.94:8080/media/api/v1/hls/vurix/192871/100001/0/0';
const yangyangUrl = 'https://weather.yangyang.go.kr/rscFiles/POSTDATA/CCTV/007/007_stream.m3ust';
const high1Url = 'http://59.30.12.195:1935/live/ch1.stream/playlist.m3u8';
const catalog = { jeju: { streamUrl: jejuUrl, providerType: 'jeju' }, yangyang: { streamUrl: yangyangUrl, providerType: 'yangyang' }, high1: { streamUrl: high1Url, providerType: 'high1' } };
const tsPath = '/media/api/v1/ts/' + 'a'.repeat(64) + '_31';
const tsBytes = new Uint8Array(188 * 3); tsBytes[0] = tsBytes[188] = tsBytes[376] = 0x47;
const playlist = uri => '#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:31\n#EXTINF:1.02,\n' + uri + '\n';
const request = (route = '/api/hls/jeju/index.m3u8', method = 'GET') => new Request('https://example.test' + route, { method });
const resource = (id, pathname) => '/api/hls/' + id + '/resource?path=' + encodeURIComponent(pathname);
async function handle(req, options = {}) { return (await relayModule).handleHls(req, { catalog, ...options }); }
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

test('Jeju manifest uses the pinned upstream and rewrites every media URI without caching', async () => {
  let call;
  const response = await handle(request(), { fetchImpl: async (url, init) => { call = { url, init }; return new Response(playlist(tsPath)); } });
  assert.equal(call.url, jejuUrl.replace('59.8.86.94:', '59.8.86.94.nip.io:')); 
  assert.equal(call.init.redirect, 'manual');
  assert.equal(call.init.method, 'GET');
  assert.ok(call.init.signal instanceof AbortSignal);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/vnd.apple.mpegurl');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.text();
  assert.ok(body.includes(resource('jeju', tsPath)));
  assert.ok(!body.includes('http://'));
  assert.ok(body.includes('#EXT-X-MEDIA-SEQUENCE:31'));
});

test('Yangyang relative fragments stay in their own observed camera folder', async () => {
  const response = await handle(request('/api/hls/yangyang/index.m3u8'), { fetchImpl: async url => { assert.equal(url, yangyangUrl); return new Response(playlist('007_stream16.ts') + '#EXT-X-ENDLIST\n'); } });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(body.includes(resource('yangyang', '/rscFiles/POSTDATA/CCTV/007/007_stream16.ts')));
  assert.ok(body.includes('#EXT-X-ENDLIST'), 'Finite video must not be changed into a live playlist');
});

test('High1 master, child playlist and media stay within the selected channel', async () => {
  const master = await handle(request('/api/hls/high1/index.m3u8'), { fetchImpl: async url => {
    assert.equal(url, high1Url.replace('59.30.12.195:', '59.30.12.195.nip.io:'));
    return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=3194571\nchunklist_w123456.m3u8\n');
  } });
  assert.equal(master.status, 200);
  const childPath = '/live/ch1.stream/chunklist_w123456.m3u8';
  assert.ok((await master.text()).includes(resource('high1', childPath)));
  const child = await handle(request(resource('high1', childPath)), { fetchImpl: async url => {
    assert.equal(url, 'http://59.30.12.195.nip.io:1935' + childPath);
    return new Response(playlist('media_w123456_31.ts'));
  } });
  assert.equal(child.status, 200);
  assert.equal(child.headers.get('Content-Type'), 'application/vnd.apple.mpegurl');
  const fragmentPath = '/live/ch1.stream/media_w123456_31.ts';
  assert.ok((await child.text()).includes(resource('high1', fragmentPath)));
  const fragment = await handle(request(resource('high1', fragmentPath)), { fetchImpl: async () => new Response(tsBytes) });
  assert.equal(fragment.status, 200);
  assert.equal(fragment.headers.get('Content-Type'), 'video/mp2t');
  assert.deepEqual(new Uint8Array(await fragment.arrayBuffer()), tsBytes);
  let calls = 0;
  for (const path of [childPath.replace('ch1', 'ch2'), fragmentPath.replace('ch1', 'ch2'), '/live/ch1.stream/secrets.txt', '/live/ch1.stream/other.m3u8']) {
    assert.equal((await handle(request(resource('high1', path)), { fetchImpl: async () => { calls++; return new Response(''); } })).status, 400);
  }
  assert.equal(calls, 0);
});

test('High1 master cannot smuggle another channel or remote origin into its playlist', async () => {
  for (const target of ['/live/ch2.stream/chunklist_w123.m3u8', 'http://attacker.test/chunklist_w123.m3u8']) {
    const response = await handle(request('/api/hls/high1/index.m3u8'), { fetchImpl: async () => new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n' + target + '\n') });
    assert.equal(response.status, 502);
  }
});

test('allowed URI attributes are also rewritten and unsafe embedded URIs fail closed', async () => {
  const body = '#EXTM3U\n#EXT-X-MAP:URI="' + tsPath + '"\n#EXTINF:1,\n' + tsPath;
  const response = await handle(request(), { fetchImpl: async () => new Response(body) });
  assert.equal(response.status, 200);
  assert.equal((await response.text()).split(resource('jeju', tsPath)).length - 1, 2);
  const invalid = await handle(request(), { fetchImpl: async () => new Response(body.replace('URI="' + tsPath, 'URI="https://attacker.test/fragment.ts')) });
  assert.equal(invalid.status, 502);
});

test('resource route only fetches a fixed-source TS and returns validated video bytes', async () => {
  const response = await handle(request(resource('jeju', tsPath)), { fetchImpl: async (url, init) => { assert.equal(url, 'http://59.8.86.94.nip.io:8080' + tsPath); assert.equal(init.redirect, 'manual'); return new Response(tsBytes, { headers: { 'Content-Type': 'application/octet-stream' } }); } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'video/mp2t');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), tsBytes);
});

test('SSRF, traversal, nested encoding, query overrides and unknown cameras never fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response(tsBytes); };
  const paths = ['http://169.254.169.254/latest/meta-data/', '//attacker.test/a.ts', '/media/api/v1/ts/../admin', '/media/api/v1/ts/%2e%2e/admin', '/media/api/v1/ts/%252e%252e/admin', tsPath + '?url=http://attacker.test', tsPath + '#fragment', tsPath.replace('_31', '_31/extra'), tsPath.replace('a'.repeat(64), 'a'.repeat(63)), tsPath.replace('/media/', '\\media/')];
  const routes = paths.map(value => resource('jeju', value)).concat(['/api/hls/unknown/index.m3u8', '/api/hls/constructor/index.m3u8', '/api/hls/jeju/index.m3u8?path=' + encodeURIComponent(tsPath), resource('jeju', tsPath) + '&url=http://attacker.test', resource('jeju', tsPath) + '&path=' + encodeURIComponent(tsPath), resource('yangyang', '/rscFiles/POSTDATA/CCTV/009/009_stream1.ts'), resource('yangyang', '/rscFiles/POSTDATA/CCTV/007/readme.txt')]);
  for (const route of routes) {
    const response = await handle(request(route), { fetchImpl });
    assert.ok(response.status === 400 || response.status === 404, route);
  }
  assert.equal(calls, 0);
});

test('catalog entries cannot repoint pinned origins, source IDs or provider paths', async () => {
  let calls = 0;
  const invalid = [
    { streamUrl: 'http://169.254.169.254/' + new URL(jejuUrl).pathname, providerType: 'jeju' },
    { streamUrl: jejuUrl.replace('100001', '999999'), providerType: 'jeju' },
    { streamUrl: jejuUrl + '?key=changed', providerType: 'jeju' },
    { streamUrl: jejuUrl.replace('http://', 'http://user:password@'), providerType: 'jeju' },
    { streamUrl: yangyangUrl.replace('007', '008'), providerType: 'yangyang' },
    { streamUrl: yangyangUrl, providerType: 'unknown' }
  ];
  for (const entry of invalid) {
    const response = await handle(request(), { catalog: { jeju: entry }, fetchImpl: async () => { calls++; return new Response(''); } });
    assert.equal(response.status, 404);
  }
  assert.equal(calls, 0);
});

test('methods are restricted and HEAD validates media before returning headers only', async () => {
  let calls = 0;
  const fetchImpl = async (_url, init) => { calls++; assert.equal(init.method, 'GET'); return new Response(tsBytes); };
  const rejected = await handle(request(resource('jeju', tsPath), 'POST'), { fetchImpl });
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get('Allow'), 'GET, HEAD');
  assert.equal(calls, 0);
  const head = await handle(request(resource('jeju', tsPath), 'HEAD'), { fetchImpl });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('Content-Length'), String(tsBytes.length));
  assert.equal(calls, 1);
});

test('upstream redirects and failures are errors without following another host', async () => {
  for (const status of [302, 404, 500]) {
    let calls = 0;
    const response = await handle(request(), { fetchImpl: async (_url, init) => { calls++; assert.equal(init.redirect, 'manual'); return new Response(null, { status, headers: { Location: 'http://169.254.169.254/' } }); } });
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(calls, 1);
  }
});

test('invalid manifests, remote URIs, unobserved paths and encryption cannot reach the client', async () => {
  const invalid = ['<html>maintenance</html>', '#EXTM3U\n', playlist('http://attacker.test/a.ts'), playlist('/media/api/v1/ts/%2e%2e/admin'), playlist('../admin'), playlist(tsPath + '?token=unused'), playlist(tsPath) + '#EXT-X-KEY:METHOD=AES-128,URI="/key"\n'];
  for (const body of invalid) {
    const response = await handle(request(), { fetchImpl: async () => new Response(body) });
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
  }
});

test('HTML or image data returned as a successful segment is rejected', async () => {
  for (const body of ['<html>maintenance</html>', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), new Uint8Array(600)]) {
    const response = await handle(request(resource('jeju', tsPath)), { fetchImpl: async () => new Response(body, { headers: { 'Content-Type': 'video/mp2t' } }) });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'INVALID_SEGMENT');
  }
});

test('declared manifest and TS size limits reject before response headers', async () => {
  for (const [route, limit] of [['/api/hls/jeju/index.m3u8', 256 * 1024], [resource('jeju', tsPath), 8 * 1024 * 1024]]) {
    const response = await handle(request(route), { fetchImpl: async () => new Response('x', { headers: { 'Content-Length': String(limit + 1) } }) });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'UPSTREAM_TOO_LARGE');
  }
});

test('a buffered manifest exceeding its actual byte limit fails before headers', async () => {
  const upstream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(256 * 1024)); controller.enqueue(new Uint8Array(1)); controller.close(); } });
  const response = await handle(request(), { fetchImpl: async () => new Response(upstream) });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, 'UPSTREAM_TOO_LARGE');
});

test('20-second manifest deadline covers an unresponsive fetch even if it ignores abort', async t => {
  const { handleHls } = await relayModule;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const pending = handleHls(request(), { catalog, fetchImpl: async (_url, init) => { signal = init.signal; return new Promise(() => {}); } });
  await flush();
  t.mock.timers.tick(20_000);
  const response = await pending;
  assert.equal(signal.aborted, true);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, 'UPSTREAM_TIMEOUT');
});

test('25-second segment deadline cancels a stalled prefix before headers', async t => {
  const { handleHls } = await relayModule;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(tsBytes.subarray(0, 200)); }, cancel() { cancelled = true; } });
  const pending = handleHls(request(resource('jeju', tsPath)), { catalog, fetchImpl: async () => new Response(body) });
  await flush();
  t.mock.timers.tick(25_000);
  const response = await pending;
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, 'UPSTREAM_TIMEOUT');
  assert.equal(cancelled, true);
});

test('a fragmented 377-byte TS prefix is validated and reaches the client before upstream EOF', async () => {
  const { handleHls } = await relayModule;
  let upstream, resolved = false, ended = false;
  const body = new ReadableStream({ start(controller) { upstream = controller; } });
  const pending = handleHls(request(resource('jeju', tsPath)), { catalog, fetchImpl: async () => new Response(body) }).then(value => { resolved = true; return value; });
  upstream.enqueue(tsBytes.subarray(0, 1));
  upstream.enqueue(tsBytes.subarray(1, 188));
  upstream.enqueue(tsBytes.subarray(188, 376));
  await flush();
  assert.equal(resolved, false, 'All three TS sync positions must be received before exposing headers');
  upstream.enqueue(tsBytes.subarray(376, 377));
  await flush(); await flush();
  assert.equal(resolved, true, 'Do not wait for a whole 5 MB TS fragment');
  const response = await pending;
  assert.equal(response.status, 200);
  const reader = response.body.getReader(), parts = [];
  const first = await reader.read(); parts.push(first.value);
  assert.equal(first.done, false);
  assert.equal(first.value[0], 0x47);
  assert.equal(ended, false, 'The first bytes precede upstream EOF');
  upstream.enqueue(tsBytes.subarray(377)); upstream.close(); ended = true;
  for (;;) { const item = await reader.read(); if (item.done) break; parts.push(item.value); }
  assert.deepEqual(Buffer.concat(parts.map(part => Buffer.from(part))), Buffer.from(tsBytes));
});

test('downstream cancellation aborts and cancels the source and clears the deadline', async t => {
  const { handleHls } = await relayModule;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal, cancels = 0;
  const body = new ReadableStream({ start(controller) { controller.enqueue(tsBytes); }, cancel() { cancels++; } });
  const response = await handleHls(request(resource('jeju', tsPath)), { catalog, fetchImpl: async (_url, init) => { signal = init.signal; return new Response(body); } });
  assert.equal(response.status, 200);
  await response.body.cancel('viewer closed');
  assert.equal(signal.aborted, true);
  assert.equal(cancels, 1);
  t.mock.timers.tick(30_000); await flush();
  assert.equal(cancels, 1, 'Cancelled responses must not fire another deadline');
});

test('a late actual TS overflow errors the existing stream without pretending to return HTTP 502', async () => {
  let upstream, cancelled = false;
  const body = new ReadableStream({ start(controller) { upstream = controller; controller.enqueue(tsBytes); }, cancel() { cancelled = true; } });
  const response = await handle(request(resource('jeju', tsPath)), { fetchImpl: async () => new Response(body) });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  assert.deepEqual((await reader.read()).value, tsBytes);
  upstream.enqueue(new Uint8Array(8 * 1024 * 1024 - tsBytes.length));
  assert.equal((await reader.read()).value.length, 8 * 1024 * 1024 - tsBytes.length);
  upstream.enqueue(new Uint8Array(1));
  await assert.rejects(reader.read(), error => error.code === 'UPSTREAM_TOO_LARGE');
  assert.equal(response.status, 200, 'Headers were already sent; the body carries the failure');
  assert.equal(cancelled, true);
});

test('the 25-second transfer deadline includes prefix time and errors a late stalled stream', async t => {
  const { handleHls } = await relayModule;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let upstream, cancelled = false, signal;
  const body = new ReadableStream({ start(controller) { upstream = controller; }, cancel() { cancelled = true; } });
  const pending = handleHls(request(resource('jeju', tsPath)), { catalog, fetchImpl: async (_url, init) => { signal = init.signal; return new Response(body); } });
  await flush(); t.mock.timers.tick(5_000);
  upstream.enqueue(tsBytes);
  const response = await pending;
  const reader = response.body.getReader(); await reader.read();
  const stalled = reader.read();
  const rejected = assert.rejects(stalled, error => error.code === 'UPSTREAM_TIMEOUT');
  t.mock.timers.tick(19_999); await flush();
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); await rejected;
  assert.equal(response.status, 200);
  assert.equal(signal.aborted, true);
  assert.equal(cancelled, true);
});

test('successful TS EOF releases its reader and clears the timer', async t => {
  const { handleHls } = await relayModule;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const body = new ReadableStream({ start(controller) { controller.enqueue(tsBytes); controller.close(); } });
  const response = await handleHls(request(resource('jeju', tsPath)), { catalog, fetchImpl: async (_url, init) => { signal = init.signal; return new Response(body, { headers: { 'Content-Length': String(tsBytes.length) } }); } });
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), tsBytes);
  assert.equal(body.locked, false);
  t.mock.timers.tick(30_000); await flush();
  assert.equal(signal.aborted, false, 'Completed media must not be aborted by a forgotten timer');
});
