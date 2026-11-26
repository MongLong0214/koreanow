'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const adapterModule = import(pathToFileURL(path.join(root, 'server/hls-adapter.mjs')).href);
const catalogModule = import(pathToFileURL(path.join(root, 'server/catalog.mjs')).href);
const catalog = { high1: { streamUrl: 'http://59.30.12.195:1935/live/ch1.stream/playlist.m3u8', providerType: 'high1' } };
const segmentPath = '/live/ch1.stream/media_w123456_31.ts';
const route = '/api/hls/high1/resource?path=' + encodeURIComponent(segmentPath);
const request = (url = route, init) => new Request('https://site.test' + url, init);
const prefix = () => {
  const bytes = new Uint8Array(188 * 3);
  bytes[0] = bytes[188] = bytes[376] = 0x47;
  return bytes;
};
async function serve(req, fetchImpl) {
  return (await adapterModule).serveHls(req, { catalog, fetchImpl });
}

test('the function catalog retains all fixed routes without changing the 400-video public catalog', async () => {
  const { cameras, diagnosticCameras, hlsCatalog } = await catalogModule;
  assert.equal(cameras.length, 400);
  assert.equal(diagnosticCameras.length, 1522);
  const expected = Object.fromEntries([...cameras, ...diagnosticCameras]
    .filter(camera => camera.kind === 'hls' && camera.proxy)
    .map(camera => [camera.id, { streamUrl: camera.streamUrl, providerType: camera.providerType }]));
  assert.deepEqual(hlsCatalog, expected);
  assert.equal(Object.keys(hlsCatalog).length, 376);
  assert.ok(Object.isFrozen(hlsCatalog));
});

test('the adapter preserves original paths and queries and cannot turn extra parameters into upstream URLs', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(url, 'http://59.30.12.195.nip.io:1935/live/ch1.stream/playlist.m3u8');
    assert.equal(options.redirect, 'manual');
    assert.deepEqual(Object.keys(options.headers), ['Accept']);
    return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nchunklist_w123456.m3u8\n');
  };
  const response = await serve(request('/api/hls/high1/index.m3u8', {
    headers: { Cookie: 'private=not-forwarded', Authorization: 'not-forwarded' }
  }), fetchImpl);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(await response.text(), /\/api\/hls\/high1\/resource\?path=%2Flive%2Fch1.stream%2Fchunklist_w123456.m3u8/);
  for (const invalid of [
    '/api/hls/high1/index.m3u8?url=https://example.test/',
    route + '&url=https://example.test/',
    route + '&path=' + encodeURIComponent(segmentPath),
    '/api/hls/high1/resource?path=' + encodeURIComponent('/live/ch2.stream/media_w123456_31.ts')
  ]) {
    assert.equal((await serve(request(invalid), fetchImpl)).status, 400);
  }
  assert.equal(calls, 1);
});

test('media larger than 4.5 MB is returned progressively without buffering the complete response', async () => {
  const total = 188 * 30000;
  let sent = 0;
  let pulls = 0;
  const response = await serve(request(), async () => new Response(new ReadableStream({
    pull(controller) {
      pulls++;
      if (!sent) {
        const chunk = prefix();
        sent += chunk.length;
        controller.enqueue(chunk);
      } else if (sent < total) {
        const chunk = new Uint8Array(Math.min(64 * 1024, total - sent));
        sent += chunk.length;
        controller.enqueue(chunk);
      } else controller.close();
    }
  }, { highWaterMark: 0 }), { headers: { 'Content-Length': String(total) } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'video/mp2t');
  assert.equal(response.headers.get('Content-Length'), String(total));
  assert.equal(pulls, 1, 'Only the validation prefix is read before returning the streaming response');
  assert.equal(sent, 188 * 3);
  let received = 0;
  for await (const chunk of response.body) received += chunk.length;
  assert.equal(received, total);
  assert.ok(received > 4.5 * 1024 * 1024);
});

test('a client disconnect aborts the native upstream fetch and errors an in-flight media read', async () => {
  const client = new AbortController();
  let upstreamSignal;
  let bodyController;
  const response = await serve(request(route, { signal: client.signal }), async (_url, options) => {
    upstreamSignal = options.signal;
    const body = new ReadableStream({
      start(controller) { bodyController = controller; controller.enqueue(prefix()); }
    });
    upstreamSignal.addEventListener('abort', () => bodyController.error(upstreamSignal.reason), { once: true });
    return new Response(body);
  });
  const reader = response.body.getReader();
  assert.equal((await reader.read()).value.length, 188 * 3);
  const pending = reader.read();
  client.abort(new Error('Client disconnected'));
  assert.equal(upstreamSignal.aborted, true);
  await assert.rejects(pending, /Client disconnected/);
  reader.releaseLock();
});

test('cancelling the returned media body aborts and cancels the upstream body', async () => {
  let upstreamSignal;
  let cancelled = 0;
  const response = await serve(request(), async (_url, options) => {
    upstreamSignal = options.signal;
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(prefix()); },
      cancel() { cancelled++; }
    }));
  });
  await response.body.cancel('Viewer closed');
  assert.equal(upstreamSignal.aborted, true);
  assert.equal(cancelled, 1);
});

test('a disconnect while fetching a manifest aborts before response headers', async () => {
  const client = new AbortController();
  let upstreamSignal;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = serve(request('/api/hls/high1/index.m3u8', { signal: client.signal }), async (_url, options) => {
    upstreamSignal = options.signal;
    started();
    return new Promise((_resolve, reject) => {
      upstreamSignal.addEventListener('abort', () => reject(upstreamSignal.reason), { once: true });
    });
  });
  await ready;
  client.abort(new Error('Client disconnected'));
  const response = await pending;
  assert.equal(upstreamSignal.aborted, true);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, 'UPSTREAM_FETCH_FAILED');
});
