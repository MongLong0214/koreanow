import fs from 'node:fs';
import path from 'node:path';
import { cameras, hlsCatalog } from '../server/catalog.mjs';

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

// Vercel serves these files directly from its CDN. Only /api/hls/* invokes the
// Node function, so scripts, fonts and map assets never inflate its response.
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
let staticBytes = 0;
for (const file of files) {
  const destination = path.join(output, path.relative(web, file));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
  staticBytes += fs.statSync(file).size;
}

console.log(JSON.stringify({
  assets: files.length,
  staticBytes,
  videos: cameras.length,
  hlsRoutes: Object.keys(hlsCatalog).length
}));
