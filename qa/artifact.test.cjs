'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const api=import(pathToFileURL(path.join(root,'api/hls.js')).href).then(module=>module.default);
const configuration=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));

test('the Vercel build contains the complete HTML and camera catalog as static files',()=>{
  assert.equal(configuration.framework,null);
  assert.equal(configuration.outputDirectory,'dist');
  for(const file of ['index.html','cameras.js']) {
    assert.deepEqual(fs.readFileSync(path.join(root,'dist',file)),fs.readFileSync(path.join(root,'web',file)));
  }
  assert.ok(!fs.existsSync(path.join(root,'dist/server')),'Static output must not expose a server bundle');
});

test('every source asset is copied byte-for-byte into the static deployment output',()=>{
  let count=0;
  function check(directory){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(entry.name.startsWith('.'))continue;
      const file=path.join(directory,entry.name);
      if(entry.isDirectory()){check(file);continue;}
      const relative=path.relative(path.join(root,'web'),file).split(path.sep).join('/');
      assert.deepEqual(fs.readFileSync(path.join(root,'dist',relative)),fs.readFileSync(file),relative);
      count++;
    }
  }
  check(path.join(root,'web'));assert.ok(count>=15,'Application and player assets must be included');
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
  const relayRoutes=configuration.routes.filter(route=>route.dest);
  assert.equal(relayRoutes.length,1);
  const route=relayRoutes[0];
  assert.equal(route.dest,'/api/hls');
  assert.equal(route.transforms,undefined,'Do not delete or rewrite caller query parameters');
  const pattern=new RegExp(route.src);
  for(const pathname of ['/api/hls/paju-35/index.m3u8','/api/hls/paju-35/resource','/api/hls/unknown/index.m3u8']) {
    const match=pattern.exec(pathname);
    assert.ok(match,pathname);
    assert.equal(match.length,1,'The API route must have no capture to inject into its query');
  }
  for(const pathname of ['/','/cameras.js','/vendor/hls.min.js','/api/other'])assert.equal(pattern.test(pathname),false);
  for(const headerRoute of configuration.routes.filter(item=>item.headers)) {
    assert.equal(headerRoute.continue,true,'Header rules must not terminate routing');
    assert.equal(headerRoute.transforms,undefined);
  }
  const globalHeaders=configuration.routes.find(item=>item.headers&&new RegExp(item.src).test('/api/hls/unknown/index.m3u8')).headers;
  assert.equal(globalHeaders['X-Content-Type-Options'],'nosniff');
  assert.equal(globalHeaders['Referrer-Policy'],'strict-origin-when-cross-origin');
  assert.equal(globalHeaders['Cache-Control'],undefined,'Do not override the relay no-store response policy');
});
