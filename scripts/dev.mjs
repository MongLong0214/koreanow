// Local development server. Use --port or PORT to choose the listening port.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { hlsCatalog } from '../server/catalog.mjs';
import { serveHls } from '../server/hls-adapter.mjs';

const web = path.resolve(import.meta.dirname,'../web');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const portArg=process.argv.indexOf('--port');
const port=Number(portArg>=0?process.argv[portArg+1]:(process.env.PORT||5173));
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
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:'+port);
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
    const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    const file=path.resolve(web,relative);
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    res.end(req.method==='HEAD'?undefined:fs.readFileSync(file));
  }catch(error){
    if(res.headersSent||res.destroyed){res.destroy(error);return;}
    res.writeHead(500);res.end('Request failed');
  }
}).listen(port,'0.0.0.0',()=>console.log('Korea, now. listening on port '+port));
