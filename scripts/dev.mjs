// Local development server. Use --port or PORT to choose the listening port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { hlsCatalog } from '../server/catalog.mjs';
import { serveHls } from '../server/hls-adapter.mjs';
import { serializePublicCatalog } from '../server/public-catalog.mjs';
import { createSeoAssets } from '../server/seo-pages.mjs';

const web = path.resolve(import.meta.dirname,'../web');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const portArg=process.argv.indexOf('--port');
const port=Number(portArg>=0?process.argv[portArg+1]:(process.env.PORT||5173));
let catalogStamp, publicCatalog;
let seoStamp, seoAssets;
function publicCatalogPayload() {
  const stamp=['cameras.js','catalog-en.js'].map(name=>{
    const stat=fs.statSync(path.join(web,name),{bigint:true});
    return stat.mtimeNs+':'+stat.size;
  }).join('|');
  if(stamp!==catalogStamp){publicCatalog=serializePublicCatalog(web);catalogStamp=stamp;}
  return publicCatalog;
}
function generatedSeoAssets() {
  const payload=publicCatalogPayload();
  const stamp=catalogStamp+'|'+['index.html','seo.js'].map(name=>{
    const stat=fs.statSync(path.join(web,name),{bigint:true});return stat.mtimeNs+':'+stat.size;
  }).join('|');
  if(stamp!==seoStamp){seoAssets=createSeoAssets(web,JSON.parse(payload));seoStamp=stamp;}
  return seoAssets;
}
// Node's HTTP client uses the environment's configured HTTP proxy with
// --use-env-proxy. This also supports plain-HTTP public camera origins; the
// deployed Vercel function uses native fetch instead.
function previewFetch(url, options) {
  if(new URL(url).protocol!=='http:')return fetch(url,options);
  return new Promise((resolve,reject)=>{
    const upstream=http.request(url,{method:options.method,headers:options.headers,signal:options.signal},response=>{
      const headers=new Headers();
      for(const [key,value] of Object.entries(response.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
      resolve(new Response(Readable.toWeb(response),{status:response.statusCode,headers}));
    });
    upstream.on('error',reject);upstream.end();
  });
}
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:'+port);
    if(url.searchParams.has('qa-candidates')||/^\/(?:qa-[^/]*\.html|playback-check\.html|source-check\.html|verification\.html|verification-data\.json)$/.test(url.pathname))res.setHeader('X-Robots-Tag','noindex, follow');
    if(url.pathname.startsWith('/api/hls/')) {
      const disconnected=new AbortController();
      req.on('aborted',()=>disconnected.abort());
      res.on('close',()=>{if(!res.writableEnded)disconnected.abort();});
      const request=new Request(url,{method:req.method,signal:disconnected.signal});
      const result=await serveHls(request,{catalog:hlsCatalog,fetchImpl:previewFetch});
      if(res.destroyed){await result.body?.cancel();return;}
      res.writeHead(result.status,Object.fromEntries(result.headers));
      if(!result.body){res.end();return;}
      const stream=Readable.fromWeb(result.body);
      stream.on('error',error=>res.destroy(error));res.on('close',()=>stream.destroy());stream.pipe(res);return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    if(url.pathname==='/catalog.json') {
      const payload=publicCatalogPayload();
      res.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Length':Buffer.byteLength(payload)});
      res.end(req.method==='HEAD'?undefined:payload);return;
    }
    const generated=generatedSeoAssets();
    const region=generated.seo.regionFromPath(url.pathname);
    if(region!==null) {
      const canonicalPath=generated.seo.regionPath(region);
      if(url.pathname!==canonicalPath){res.writeHead(308,{Location:canonicalPath+url.search});res.end();return;}
      const html=generated.pages.get(canonicalPath);
      res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
      res.end(req.method==='HEAD'?undefined:html);return;
    }
    if(['/robots.txt','/sitemap.xml'].includes(url.pathname)) {
      res.writeHead(200,{'Content-Type':mime[path.extname(url.pathname)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:generated.files.get(url.pathname.slice(1)));return;
    }
    const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    const file=path.resolve(web,relative);
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404,{'Content-Type':mime['.html'],'X-Robots-Tag':'noindex','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:generated.files.get('404.html'));return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    res.end(req.method==='HEAD'?undefined:fs.readFileSync(file));
  }catch(error){
    if(res.headersSent||res.destroyed){res.destroy(error);return;}
    res.writeHead(500);res.end('Request failed');
  }
}).listen(port,'0.0.0.0',()=>console.log('Korea, now. listening on port '+server.address().port));
