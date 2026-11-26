'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const api=import(pathToFileURL(path.join(root,'api/hls.js')).href).then(module=>module.default);
const configuration=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const generated=import(pathToFileURL(path.join(root,'server/seo-pages.mjs')).href).then(module=>module.createSeoAssets(path.join(root,'web')));

test('the Vercel build contains prerendered HTML and the preserved camera catalog as static files',async()=>{
  assert.equal(configuration.framework,null);
  assert.equal(configuration.outputDirectory,'dist');
  assert.equal(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),(await generated).pages.get('/'));
  assert.deepEqual(fs.readFileSync(path.join(root,'dist/cameras.js')),fs.readFileSync(path.join(root,'web/cameras.js')));
  assert.ok(!fs.existsSync(path.join(root,'dist/server')),'Static output must not expose a server bundle');
});

test('every non-template source asset is copied byte-for-byte and generated SEO assets match their source renderer',async()=>{
  let count=0;
  function check(directory){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(entry.name.startsWith('.'))continue;
      const file=path.join(directory,entry.name);
      if(entry.isDirectory()){check(file);continue;}
      const relative=path.relative(path.join(root,'web'),file).split(path.sep).join('/');
      if(relative==='index.html'){count++;continue;}
      assert.deepEqual(fs.readFileSync(path.join(root,'dist',relative)),fs.readFileSync(file),relative);
      count++;
    }
  }
  check(path.join(root,'web'));assert.ok(count>=15,'Application and player assets must be included');
  for(const [relative,content] of (await generated).files)assert.equal(fs.readFileSync(path.join(root,'dist',relative),'utf8'),content,relative);
  const cameraAssets=path.join(root,'web/assets');
  assert.ok(!fs.existsSync(cameraAssets)||!fs.readdirSync(cameraAssets).some(name=>/\.(?:jpe?g|png|webp|gif)$/i.test(name)),'Camera photos must not replace video');
});

test('the deployed API entry rejects unknown routes, writes and proxy overrides',async()=>{
  const app=await api;
  const functionConfig=configuration.functions['api/hls.js'];
  assert.equal(functionConfig.includeFiles,'web/cameras.js');
  assert.equal(functionConfig.supportsCancellation,true);
  assert.ok(functionConfig.maxDuration>25,'Platform timeout must allow the relay to enforce its own deadline');
  assert.equal((await app.fetch(new Request('https://site.test/api/hls'))).status,404);
  assert.equal((await app.fetch(new Request('https://site.test/api/hls/unknown/index.m3u8',{method:'POST'}))).status,405);
  const head=await app.fetch(new Request('https://site.test/api/hls/unknown/index.m3u8',{method:'HEAD'}));assert.equal(head.status,404);assert.equal(await head.text(),'');
  assert.ok([400,404].includes((await app.fetch(new Request('https://site.test/api/hls/unknown/index.m3u8?url=http://example.test/'))).status));
  assert.equal((await app.fetch(new Request('https://site.test/api/hls/unknown/index.m3u8'))).status,404);
});

test('the HLS route forwards original URLs without capture-generated query parameters',()=>{
  // A named :path* rewrite injected an extra query into clean index requests
  // on Vercel and collided with the relay's legitimate resource ?path= field.
  assert.equal(configuration.rewrites,undefined,'Keep API routing free of high-level named captures');
  assert.equal(configuration.headers,undefined,'Use a single raw route configuration for consistent processing');
  const relayRoutes=configuration.routes.filter(route=>route.dest==='/api/hls');
  assert.equal(relayRoutes.length,1);
  const route=relayRoutes[0];
  assert.equal(route.src,'^/api/hls/.*$');
  assert.equal(route.dest,'/api/hls');
  assert.equal(route.transforms,undefined,'Do not delete or rewrite caller query parameters');
  const pattern=new RegExp(route.src);
  for(const pathname of ['/api/hls/paju-35/index.m3u8','/api/hls/paju-35/resource','/api/hls/unknown/index.m3u8']) {
    const match=pattern.exec(pathname);
    assert.ok(match,pathname);
    assert.equal(match.length,1,'The API route must have no capture to inject into its query');
  }
  for(const pathname of ['/','/cameras.js','/vendor/hls.min.js','/api/other'])assert.equal(pattern.test(pathname),false);
  for(const headerRoute of configuration.routes.filter(item=>item.headers&&!item.status)) {
    assert.equal(headerRoute.continue,true,'Header rules must not terminate routing');
    assert.equal(headerRoute.transforms,undefined);
  }
  const globalHeaders=configuration.routes.find(item=>item.headers&&new RegExp(item.src).test('/api/hls/unknown/index.m3u8')).headers;
  assert.equal(globalHeaders['X-Content-Type-Options'],'nosniff');
  assert.equal(globalHeaders['Referrer-Policy'],'strict-origin-when-cross-origin');
  assert.equal(globalHeaders['Cache-Control'],undefined,'Do not override the relay no-store response policy');
});

test('canonical collection routing stays separate from the strict HLS relay and diagnostics are noindex',()=>{
  const staticRoutes=configuration.routes.filter(route=>route.dest&&route.dest!=='/api/hls');
  assert.deepEqual(staticRoutes,[{src:'^/regions/([a-z-]+)/$',dest:'/regions/$1/index.html'}]);
  const redirects=configuration.routes.filter(route=>route.status===308);
  assert.equal(redirects.length,2);
  const rootRedirect=redirects.find(route=>new RegExp(route.src).test('/index.html'));
  assert.equal(rootRedirect.headers.Location,'/');
  const regionRedirect=redirects.find(route=>new RegExp(route.src).test('/regions/seoul'));
  assert.equal(regionRedirect.headers.Location,'/regions/$1/');
  assert.ok(new RegExp(regionRedirect.src).test('/regions/seoul/index.html'));
  assert.equal(new RegExp(regionRedirect.src).test('/regions/seoul/'),false);
  for(const redirect of redirects)assert.equal(new RegExp(redirect.src).test('/api/hls/paju-35/index.m3u8'),false);
  const diagnostic=configuration.routes.find(route=>route.has?.some(condition=>condition.type==='query'&&condition.key==='qa-candidates'));
  assert.equal(diagnostic.headers['X-Robots-Tag'],'noindex, follow');
  assert.equal(diagnostic.continue,true);
  const audit=configuration.routes.find(route=>route.headers?.['X-Robots-Tag']&&new RegExp(route.src).test('/verification.html')&&!route.has);
  assert.equal(audit.headers['X-Robots-Tag'],'noindex, follow');
  assert.ok(new RegExp(audit.src).test('/verification-data.json'));
  for(const pathname of ['/qa-player-cause.html','/playback-check.html','/source-check.html']) {
    assert.ok(new RegExp(audit.src).test(pathname));
  }
  assert.equal(new RegExp(audit.src).test('/regions/seoul/'),false);
  assert.equal(audit.continue,true);
});
