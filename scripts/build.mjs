import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { cameras, hlsCatalog } from '../server/catalog.mjs';
import { serializePublicCatalog } from '../server/public-catalog.mjs';
import { createSeoAssets } from '../server/seo-pages.mjs';

const root = path.resolve(import.meta.dirname, '..');
const web = path.join(root, 'web');
const output = path.join(root, 'dist');
const files = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(directory,entry.name);
    if (entry.isDirectory()) collect(file);
    else {
      if(entry.name==='qa-viewport.html') throw new Error('Remove the temporary QA route before building.');
      files.push(file);
    }
  }
}
collect(web);
if (!cameras.length || new Set(cameras.map(camera => camera.id)).size !== cameras.length) {
  throw new Error('The primary camera catalog must contain unique IDs.');
}
const publicCatalog = serializePublicCatalog(web);
const seoAssets = createSeoAssets(web, JSON.parse(publicCatalog));

// Vercel serves these files directly from its CDN. Only /api/hls/* invokes the
// Node function, so scripts, fonts and map assets never inflate its response.
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
let staticBytes = 0;
for (const file of files) {
  const relative = path.relative(web, file);
  if (seoAssets.files.has(relative.split(path.sep).join('/'))) continue;
  const destination = path.join(output, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
  staticBytes += fs.statSync(file).size;
}
fs.writeFileSync(path.join(output, 'catalog.json'), publicCatalog);
staticBytes += Buffer.byteLength(publicCatalog);
for (const [relative, content] of seoAssets.files) {
  const destination = path.join(output, relative);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, content);
  staticBytes += Buffer.byteLength(content);
}

console.log(JSON.stringify({
  assets: files.filter(file => !seoAssets.files.has(path.relative(web, file).split(path.sep).join('/'))).length + 1 + seoAssets.files.size,
  staticBytes,
  videos: cameras.length,
  hlsRoutes: Object.keys(hlsCatalog).length,
  publicCatalogBytes: Buffer.byteLength(publicCatalog),
  publicCatalogGzipBytes: zlib.gzipSync(publicCatalog).length,
  collectionPages: seoAssets.pages.size
}));
