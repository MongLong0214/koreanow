'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');

const root = path.resolve(__dirname, '..'), web = path.join(root, 'web');
const model = Promise.all([
  import(pathToFileURL(path.join(root, 'server/public-catalog.mjs')).href),
  import(pathToFileURL(path.join(root, 'server/seo-pages.mjs')).href),
]).then(([catalog, renderer]) => {
  const cameras = catalog.createPublicCatalog(web);
  return {cameras, ...renderer.createSeoAssets(web, cameras)};
});
const unescape = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const matchingIds = html => [...html.matchAll(/<article class="camera-card" data-camera="([^"]+)"/g)].map(match => unescape(match[1]));
const jsonLd = html => JSON.parse(/<script id="site-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);

test('shared SEO model recognizes only real collection routes and preserves the canonical origin', async () => {
  const {seo} = await model;
  assert.equal(seo.origin, 'https://koreanow.site');
  assert.equal(seo.regionPath('all'), '/');
  assert.equal(seo.regionFromPath('/'), 'all');
  assert.equal(seo.regionFromPath('/index.html'), 'all');
  for (const region of seo.regions) {
    const pathname = seo.regionPath(region);
    assert.match(pathname, /^\/regions\/[a-z-]+\/$/);
    assert.equal(seo.regionFromPath(pathname), region);
    assert.equal(seo.regionFromPath(pathname.slice(0, -1)), region);
    assert.equal(seo.regionFromPath(pathname + 'index.html'), region);
  }
  for (const pathname of ['/regions/not-a-region/', '/regions/seoul/fake/', '/camera/foo/', '/anything']) {
    assert.equal(seo.regionFromPath(pathname), null, pathname);
  }
  assert.throws(() => seo.regionPath('not-a-region'), /Unknown camera region/);
});

test('home and 17 regional pages contain exactly their real camera subsets before JavaScript', async () => {
  const {cameras, pages, regions, seo} = await model;
  assert.equal(pages.size, 18);
  assert.equal(regions.length, 18);
  const regionalIds = [];
  for (const region of regions) {
    const expected = region === 'all' ? cameras : cameras.filter(camera => camera.region === region);
    const html = pages.get(seo.regionPath(region));
    assert.deepEqual(matchingIds(html), expected.map(camera => camera.id));
    assert.equal(matchingIds(html).length, new Set(matchingIds(html)).size);
    assert.ok(html.includes('<body data-region="' + region + '">'));
    assert.match(html, /<h1 id="page-heading" class="sr-only">[^<]+<\/h1>/);
    assert.equal((html.match(/<h1 id="page-heading"/g) || []).length, 1);
    assert.equal(html.includes('<!-- CAMERA_ROWS -->'), false);
    if (region !== 'all') regionalIds.push(...matchingIds(html));
  }
  assert.equal(regionalIds.length, 400);
  assert.deepEqual([...regionalIds].sort(), cameras.map(camera => camera.id).sort());
});

test('camera links remain useful without JavaScript and have the same identity hooks the client adopts', async () => {
  const {cameras, pages} = await model;
  const html = pages.get('/');
  const links = [...html.matchAll(/<a class="camera-select" data-select="([^"]+)" href="([^"]+)" target="_blank" rel="noopener noreferrer" aria-label="([^"]+)" aria-current="false">/g)];
  assert.equal(links.length, 400);
  for (let index = 0; index < links.length; index++) {
    const [, id, href, label] = links[index], camera = cameras[index];
    assert.equal(unescape(id), camera.id);
    assert.equal(unescape(href), camera.sourceUrl);
    assert.equal(unescape(label), 'Open ' + camera.name + ' camera');
    assert.ok(['http:', 'https:'].includes(new URL(unescape(href)).protocol));
    assert.ok(html.includes('type="button" class="card-save" data-save="' + id + '"'));
  }
  assert.equal((html.match(/class="card-save"/g) || []).length, 400);
  assert.equal((html.match(/class="card-save"[^>]* disabled>/g) || []).length, 400,
    'Bookmarks stay disabled until the client adopts the static rows');
});

test('native region navigation exposes all canonical internal links with exactly one current region', async () => {
  const {pages, regions, seo} = await model;
  for (const region of regions) {
    const html = pages.get(seo.regionPath(region));
    assert.match(html, /<details id="region-menu" class="region-select region-disclosure">/);
    assert.match(html, /<summary id="region-summary" aria-label="Region">/);
    assert.equal(html.includes('id="region"'), false, 'There must not be a duplicate hidden select');
    const nav = /<nav class="region-options" aria-label="Browse regions">([\s\S]*?)<\/nav>/.exec(html)[1];
    const links = [...nav.matchAll(/<a href="([^"]+)" data-region="([^"]+)"([^>]*)>/g)];
    assert.equal(links.length, 18);
    assert.equal((nav.match(/aria-current="page"/g) || []).length, 1);
    for (const [, href, label, attributes] of links) {
      assert.equal(href, seo.regionPath(unescape(label)));
      assert.equal(attributes.includes('aria-current="page"'), label === region);
    }
  }
});

test('server and client metadata agree for every page, with unique titles, descriptions and canonicals', async () => {
  const {cameras, pages, regions, seo} = await model;
  const client = vm.createContext({window: {}});
  vm.runInContext(fs.readFileSync(path.join(web, 'seo.js'), 'utf8'), client);
  const titles = new Set(), descriptions = new Set(), canonicals = new Set();
  for (const region of regions) {
    const expected = client.window.KOREA_SEO.page(cameras, region), html = pages.get(expected.path);
    const title = unescape(/<title>([^<]+)<\/title>/.exec(html)[1]);
    const description = unescape(/<meta name="description" content="([^"]+)">/.exec(html)[1]);
    const canonical = /<link rel="canonical" href="([^"]+)">/.exec(html)[1];
    assert.equal(title, expected.title);
    assert.equal(description, expected.description);
    assert.equal(canonical, expected.url);
    assert.equal(canonical, seo.origin + expected.path);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.ok(html.includes('<meta property="og:url" content="' + canonical + '">'));
    assert.ok(html.includes('<meta property="og:image" content="https://koreanow.site/social/koreanow-card-v1.png">'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
    assert.deepEqual(jsonLd(html), JSON.parse(JSON.stringify(expected.schema)));
    titles.add(title); descriptions.add(description); canonicals.add(canonical);
  }
  assert.equal(titles.size, 18);
  assert.equal(descriptions.size, 18);
  assert.equal(canonicals.size, 18);
});

test('structured data describes the visible collection and contains no invented video or review fields', async () => {
  const {cameras, pages, regions, seo} = await model;
  for (const region of regions) {
    const expected = region === 'all' ? cameras : cameras.filter(camera => camera.region === region);
    const schema = jsonLd(pages.get(seo.regionPath(region)));
    assert.equal(schema['@context'], 'https://schema.org');
    const collection = schema['@graph'].find(item => item['@type'] === 'CollectionPage');
    assert.equal(collection.mainEntity['@type'], 'ItemList');
    assert.equal(collection.mainEntity.numberOfItems, expected.length);
    assert.deepEqual(collection.mainEntity.itemListElement.map(item => [item.position, item.name, item.url]),
      expected.map((camera, index) => [index + 1, camera.name, camera.sourceUrl]));
    const text = JSON.stringify(schema);
    for (const forbidden of ['VideoObject', 'uploadDate', 'thumbnailUrl', 'aggregateRating', 'reviewCount', 'datePublished', 'dateModified']) {
      assert.equal(text.includes('"' + forbidden + '"'), false, forbidden);
    }
    assert.equal(schema['@graph'].some(item => item['@type'] === 'BreadcrumbList'), region !== 'all');
  }
});

test('sitemap lists only the 18 canonical collections and robots permits noindex headers to be read', async () => {
  const {files, regions, seo} = await model;
  const sitemap = files.get('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, [...regions].map(region => seo.origin + seo.regionPath(region)));
  assert.equal(new Set(urls).size, 18);
  assert.doesNotMatch(sitemap, /<lastmod>|qa-candidates|#cam=|verification/);
  const robots = files.get('robots.txt');
  assert.match(robots, /Sitemap: https:\/\/koreanow\.site\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Disallow:.*(?:verification|qa-|playback-check|source-check)/);
});

test('nested pages use root-absolute assets and the custom error page is explicitly noindex', async () => {
  const {pages, files} = await model;
  for (const html of pages.values()) {
    for (const [, target] of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)) {
      assert.ok(target.startsWith('/') || target.startsWith('https://'), target);
    }
  }
  const error = files.get('404.html');
  assert.match(error, /<meta name="robots" content="noindex, follow">/);
  assert.match(error, /<h1>This page could not be found\.<\/h1>/);
  assert.match(error, /<a href="\/">Explore all cameras<\/a>/);
  assert.doesNotMatch(error, /rel="canonical"|CollectionPage|camera-card/);
});

test('development serves the same generated pages and catalog, canonical redirects, robots and real 404 responses', {timeout: 20000}, async () => {
  const {pages, files, cameras} = await model;
  const server = spawn(process.execPath, ['scripts/dev.mjs', '--port', '0'], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  const stopped = new Promise(resolve => server.once('exit', resolve));
  let output = '', errors = '';
  server.stderr.on('data', chunk => { errors += chunk; });
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Dev server did not start: ' + errors)), 10000);
      server.once('error', error => { clearTimeout(timeout); reject(error); });
      server.once('exit', code => { clearTimeout(timeout); reject(new Error('Dev server exited early (' + code + '): ' + errors)); });
      server.stdout.on('data', chunk => {
        output += chunk;
        const match = /listening on port (\d+)/.exec(output);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
    });
    const origin = 'http://127.0.0.1:' + port;
    for (const pathname of ['/', '/regions/seoul/', '/regions/jeju/']) {
      const response = await fetch(origin + pathname);
      assert.equal(response.status, 200, pathname);
      assert.match(response.headers.get('content-type'), /^text\/html/);
      assert.equal(await response.text(), pages.get(pathname), pathname);
    }
    for (const [pathname, destination] of [
      ['/index.html', '/'], ['/regions/seoul', '/regions/seoul/'],
      ['/regions/seoul/index.html?qa-candidates=1', '/regions/seoul/?qa-candidates=1'],
    ]) {
      const response = await fetch(origin + pathname, {redirect: 'manual'});
      assert.equal(response.status, 308, pathname);
      assert.equal(response.headers.get('location'), destination);
    }
    const head = await fetch(origin + '/regions/seoul/', {method: 'HEAD'});
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const catalog = await fetch(origin + '/catalog.json');
    assert.equal(catalog.status, 200);
    assert.deepEqual(await catalog.json(), cameras);
    for (const filename of ['robots.txt', 'sitemap.xml']) {
      const response = await fetch(origin + '/' + filename);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), files.get(filename));
    }
    for (const pathname of ['/regions/not-real/', '/missing.html']) {
      const response = await fetch(origin + pathname);
      assert.equal(response.status, 404, pathname);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      assert.equal(await response.text(), files.get('404.html'));
    }
    for (const pathname of ['/?qa-candidates', '/regions/seoul/?qa-candidates=1', '/verification.html', '/verification-data.json']) {
      const response = await fetch(origin + pathname);
      assert.equal(response.status, 200, pathname);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow', pathname);
      await response.arrayBuffer();
    }
    const write = await fetch(origin + '/regions/seoul/', {method: 'POST'});
    assert.equal(write.status, 405);
    assert.equal(write.headers.get('allow'), 'GET, HEAD');
  } finally {
    server.kill('SIGTERM');
    await stopped;
  }
});
