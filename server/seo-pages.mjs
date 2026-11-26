import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createPublicCatalog} from './public-catalog.mjs';

const escape = value => String(value).replace(/[&<>"']/g, character =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
const videoIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-4v12l-6-4"/></svg>';
const bookmarkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z"/></svg>';

function replace(html, pattern, value) {
  let matches = 0;
  const expression = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const output = html.replace(expression, (...args) => { matches++; return typeof value === 'function' ? value(...args) : value; });
  if (matches !== 1) throw new Error('SEO template slot must occur exactly once: ' + pattern);
  return output;
}

function renderRows(cameras) {
  return cameras.map(camera => '<article class="camera-card" data-camera="' + escape(camera.id) + '">' +
    '<a class="camera-select" data-select="' + escape(camera.id) + '" href="' + escape(camera.sourceUrl) +
    '" target="_blank" rel="noopener noreferrer" aria-label="Open ' + escape(camera.name) + ' camera" aria-current="false">' +
    '<span class="camera-row-icon" aria-hidden="true">' + videoIcon + '</span><h3>' + escape(camera.name) + '</h3></a>' +
    '<button type="button" class="card-save" data-save="' + escape(camera.id) + '" aria-label="Save ' + escape(camera.name) +
    '" aria-pressed="false" disabled>' + bookmarkIcon + '</button></article>').join('');
}

export function createSeoAssets(webDirectory, cameras = createPublicCatalog(webDirectory)) {
  const web = path.resolve(webDirectory);
  const context = vm.createContext({window: {}});
  vm.runInContext(fs.readFileSync(path.join(web, 'seo.js'), 'utf8'), context, {filename: 'seo.js', timeout: 1000});
  const seo = context.window.KOREA_SEO;
  const template = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  const pages = new Map(), files = new Map();
  const scopes = ['all', ...seo.regions];
  for (const region of scopes) {
    const metadata = seo.page(cameras, region);
    const subset = region === 'all' ? cameras : cameras.filter(camera => camera.region === region);
    if (!subset.length) throw new Error('Cannot publish an empty regional collection: ' + region);
    // The map can frame this collection before the client catalog arrives.
    const bounds = [[Infinity, Infinity], [-Infinity, -Infinity]];
    for (const {lat, lng} of subset) {
      bounds[0][0] = Math.min(bounds[0][0], lat);
      bounds[0][1] = Math.min(bounds[0][1], lng);
      bounds[1][0] = Math.max(bounds[1][0], lat);
      bounds[1][1] = Math.max(bounds[1][1], lng);
    }
    let html = replace(template, /<title>[\s\S]*?<\/title>/, '<title>' + escape(metadata.title) + '</title>');
    for (const [kind, key, content] of [
      ['name', 'description', metadata.description], ['property', 'og:url', metadata.url],
      ['property', 'og:title', metadata.title], ['property', 'og:description', metadata.description],
      ['name', 'twitter:title', metadata.title], ['name', 'twitter:description', metadata.description],
    ]) html = replace(html, new RegExp('<meta ' + kind + '="' + key + '" content="[^"]*">'),
      '<meta ' + kind + '="' + key + '" content="' + escape(content) + '">');
    html = replace(html, /<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + metadata.url + '">');
    html = replace(html, /<body data-region="[^"]*">/, '<body data-region="' + escape(region) + '">');
    html = replace(html, /(<div id="map"[^>]* data-bounds=")[^"]*(")/,
      (_all, start, end) => start + escape(JSON.stringify(bounds)) + end);
    html = replace(html, /(<h1 id="page-heading"[^>]*>)[\s\S]*?(<\/h1>)/, (_all, start, end) => start + escape(metadata.heading) + end);
    html = replace(html, /(<script id="site-schema" type="application\/ld\+json">)[\s\S]*?(<\/script>)/,
      (_all, start, end) => start + JSON.stringify(metadata.schema).replace(/</g, '\\u003c') + end);
    html = replace(html, /(<span id="region-label">)[\s\S]*?(<\/span>)/,
      (_all, start, end) => start + escape(region === 'all' ? 'All regions' : region) + end);
    const regionLinks = scopes.map(item => '<a href="' + seo.regionPath(item) + '" data-region="' + escape(item) + '"' +
      (item === region ? ' aria-current="page"' : '') + '>' + escape(item === 'all' ? 'All regions' : item) + '</a>').join('');
    html = replace(html, /<!-- REGION_LINKS -->/, regionLinks);
    html = replace(html, /<!-- CAMERA_ROWS -->/, renderRows(subset));
    html = replace(html, /(<span id="result-count">)[\s\S]*?(<\/span>)/, (_all, start, end) => start + subset.length + end);
    html = replace(html, /(<strong id="video-total">)[\s\S]*?(<\/strong>)/, (_all, start, end) => start + cameras.length + end);
    html = replace(html, /<span id="video-matches"[^>]*>[\s\S]*?<\/span>/,
      '<span id="video-matches"' + (region === 'all' ? ' hidden' : '') + '>' + (region === 'all' ? '' : subset.length + ' /') + '</span>');
    pages.set(metadata.path, html);
    files.set(metadata.path === '/' ? 'index.html' : metadata.path.slice(1) + 'index.html', html);
  }
  files.set('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + scopes.map(region =>
      '  <url><loc>' + seo.origin + seo.regionPath(region) + '</loc></url>').join('\n') + '\n</urlset>\n');
  files.set('robots.txt', 'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ' + seo.origin + '/sitemap.xml\n');
  files.set('404.html', '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, follow"><meta name="theme-color" content="#080808"><title>Page not found | Korea, now.</title>' +
    '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><style>html{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080808;color:#ededee;font:16px/1.6 system-ui,sans-serif}main{max-width:36rem;padding:2rem}h1{font-size:2rem;line-height:1.2;font-weight:500}p{color:#acb5bc}a{display:inline-block;margin-top:1rem;padding:.7rem 1.2rem;border:1px solid #ffffff40;border-radius:2rem;color:inherit;text-decoration:none}a:focus-visible{outline:2px solid #b4e3ed;outline-offset:4px}</style></head>' +
    '<body><main><p>Korea, now.</p><h1>This page could not be found.</h1><p>The address may have changed. Explore the camera map to find a place in South Korea.</p><a href="/">Explore all cameras</a></main></body></html>\n');
  return {pages, files, seo, regions: scopes};
}
