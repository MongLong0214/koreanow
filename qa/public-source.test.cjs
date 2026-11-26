'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const modulePromise = import(pathToFileURL(path.join(__dirname,'../worker/hls.mjs')).href);
const source = 'https://gits.gg.go.kr/web/popup/webCctvPopup.do?cctvId=1627';
const resolver = 'https://gitsview.gg.go.kr/1627/public-per-view-ticket!hls';
const media = 'https://cctvsec.ktict.co.kr:8082/gyeonggi01/gyeonggi1627D/playlist.m3u8?view=fresh';
const river = 'https://cctvlo.yeongsanriver.go.kr/live/cctv110020/hls.m3u8';
const catalog = {'gits-1627':{providerType:'gits',streamUrl:source},'yeongsan-110020':{providerType:'yeongsan',streamUrl:river}};
async function handle(route, fetchImpl, override=catalog) {
  return (await modulePromise).handleHls(new Request('https://example.test'+route),{catalog:override,fetchImpl});
}

test('public view URL is freshly resolved for each connection and never cached',async()=>{
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push(url);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');
    if(url===source)return new Response('$.get("'+resolver+'", function (data) {});');
    assert.equal(url,resolver);return new Response(media);
  };
  for(let i=0;i<2;i++){
    const r=await handle('/api/hls/gits-1627/index.m3u8',fetchImpl);
    assert.equal(r.status,302);assert.equal(r.headers.get('location'),media);assert.equal(r.headers.get('cache-control'),'no-store');
  }
  assert.deepEqual(calls,[source,resolver,source,resolver]);
});

test('published uppercase routing IDs resolve without broadening the public media host or path',async()=>{
  const route='https://cctvsec.ktict.co.kr:8082/mstrm0601hls/72CBD5CD19E945FB66CD073C4DE0439E/live/01CT000000826/002/visumy.m3u8?view=fresh';
  const r=await handle('/api/hls/gits-1627/index.m3u8',async url=>new Response(url===source?'$.get("'+resolver+'");':route));
  assert.equal(r.status,302);assert.equal(r.headers.get('location'),route);
  for(const bad of [route.replace('72CBD5','72XBD5'),route.replace('/live/','/private/'),route.replace('ktict.co.kr:8082','ktict.co.kr:8083')]){
    const rejected=await handle('/api/hls/gits-1627/index.m3u8',async url=>new Response(url===source?'$.get("'+resolver+'");':bad));
    assert.equal(rejected.status,502);
  }
});

test('public resolver cannot become a general proxy or change catalog camera IDs',async()=>{
  let calls=0;
  for(const route of ['/api/hls/gits-9999/index.m3u8','/api/hls/gits-1627/index.m3u8?url=https://attacker.test','/api/hls/gits-1627/resource?path=/anything']){
    const r=await handle(route,async()=>{calls++;return new Response('');});assert.ok([400,404].includes(r.status));
  }
  assert.equal(calls,0);
  const r=await handle('/api/hls/gits-1627/index.m3u8',async()=>{calls++;return new Response('');},{'gits-1627':{providerType:'gits',streamUrl:source+'&key=unexpected'}});
  assert.equal(r.status,404);assert.equal(calls,0);
});

test('a popup for another camera and an unreviewed media host fail closed',async()=>{
  let r=await handle('/api/hls/gits-1627/index.m3u8',async()=>new Response('$.get("'+resolver.replace('/1627/','/7777/')+'");'));
  assert.equal(r.status,502);
  for(const target of ['https://attacker.test/video.m3u8','http://cctvsec.ktict.co.kr:8082/gyeonggi01/gyeonggi1627D/playlist.m3u8','https://cctvsec.ktict.co.kr:8082/private/anything']){
    r=await handle('/api/hls/gits-1627/index.m3u8',async url=>new Response(url===source?'$.get("'+resolver+'");':target));assert.equal(r.status,502);
  }
});

test('public player errors and redirects do not certify a stream or leak tickets',async()=>{
  for(const status of [302,403,503]){
    const r=await handle('/api/hls/gits-1627/index.m3u8',async()=>new Response('public-per-view-ticket',{status,headers:{Location:'https://attacker.test'}}));
    assert.equal(r.status,502);assert.ok(!(await r.text()).includes('public-per-view-ticket'));
  }
});

test('river playback starts the exact public station and returns its published stream',async()=>{
  let called;
  const r=await handle('/api/hls/yeongsan-110020/index.m3u8',async(url,init)=>{
    called=url;assert.equal(init.credentials,'omit');return new Response('<input type="hidden" id="vi_link_ssl" value="'+river+'" />');
  });
  assert.equal(called,'https://www.yeongsanriver.go.kr/sumun/videoDetail.do?wlobscd=110020');
  assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/api/hls/yeongsan-110020/resource?path=%2Flive%2Fcctv110020%2Fhls.m3u8');
});

test('river station mismatch and unexpected stream query are rejected',async()=>{
  const r=await handle('/api/hls/yeongsan-110020/index.m3u8',async()=>new Response('<input id="vi_link_ssl" value="'+river.replace('110020','110022')+'">'));
  assert.equal(r.status,502);
  let called=false;
  const q=await handle('/api/hls/yeongsan-110020/index.m3u8',async()=>{called=true;return new Response('');},{'yeongsan-110020':{providerType:'yeongsan',streamUrl:river+'?key=other'}});
  assert.equal(q.status,404);assert.equal(called,false);
});


test('river manifests and segments stay in the catalog station on the same origin',async()=>{
 const manifest='#EXTM3U\n#EXT-X-VERSION:4\n#EXT-X-TARGETDURATION:2\n#EXTINF:1.0,\n2026-11-25/21/09-53_224.ts\n';
 const r=await handle('/api/hls/yeongsan-110020/resource?path=%2Flive%2Fcctv110020%2Fhls.m3u8',async url=>{assert.equal(url,river);return new Response(manifest);});
 assert.equal(r.status,200);assert.match(await r.text(),/resource\?path=%2Flive%2Fcctv110020%2F2026-11-25%2F21%2F09-53_224.ts/);
 let called=false;
 const bad=await handle('/api/hls/yeongsan-110020/resource?path=%2Flive%2Fcctv110022%2F2026-11-25%2F21%2F09-53_224.ts',async()=>{called=true;return new Response('');});
 assert.equal(bad.status,400);assert.equal(called,false);
});
