'use strict';

// Deterministic collector lifecycle checks, not evidence of live playback.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../web/playback-check.js'),'utf8');
const diagnostic=fs.readFileSync(path.join(__dirname,'../web/source-check.js'),'utf8');
function section(start,end){return source.slice(source.indexOf('  function '+start),source.indexOf('  function '+end));}
function clock(){let id=0;const timers=new Map();return {timers,setTimeout(fn,ms){const key=++id;timers.set(key,{fn,ms});return key;},clearTimeout(key){timers.delete(key);},expire(){for(const [key,{fn}] of [...timers]){timers.delete(key);fn();}}};}
function evaluate(code,bindings={}){const context=vm.createContext({URL,URLSearchParams,AbortController,DOMException,...bindings});vm.runInContext(code,context);return context;}

function mediaWaitHarness(){
  const scheduler=clock(),observers=[];let video=null;
  const mount={};
  class MutationObserver{constructor(callback){this.callback=callback;observers.push(this);}observe(target,options){assert.equal(target,mount);assert.equal(options.childList,true);}disconnect(){this.disconnected=true;}}
  const doc={defaultView:{MutationObserver},getElementById:id=>id==='player-mount'?mount:null,querySelector:selector=>{assert.equal(selector,'#player-mount > video');return video;}};
  const context=evaluate(section('waitForPlayerVideo','selectedAppCamera'),scheduler);
  return {...scheduler,observers,doc,wait:context.waitForPlayerVideo,insert(value){video=value;for(const observer of observers)if(!observer.disconnected)observer.callback();}};
}

test('actual app becomes ready before the lazy HLS library exists',async()=>{
  const scheduler=clock(),base='https://koreanow.test/playback-check.html';
  const contentDocument={URL:'about:blank',readyState:'complete',images:[],querySelectorAll:()=>[{}],querySelector:()=>({}),getElementById:id=>id==='close-viewer'?{click(){}}:id==='map'?{dataset:{camerasReadyAt:'50'}}:{},createElement:()=>({}),head:{append(){}}};
  const iframe={contentDocument,contentWindow:{},set src(value){contentDocument.URL=value;}};
  // loadApp is async, so extract it directly rather than the sync helper utility.
  const start=source.indexOf('  async function loadApp('),end=source.indexOf('  function waitForPlayerVideo(');
  const h=evaluate(source.slice(start,end),{...scheduler,setInterval:()=>17,clearInterval(){},document:{createElement:()=>iframe},location:{href:base},run:{runId:'cold-start'},performance:{now:()=>100},CSS:{escape:value=>value},APP_LAYOUT:'',sleep:()=>Promise.resolve()});
  const slot={element:{append(value){assert.equal(value,iframe);}}};
  const result=await h.loadApp(slot,new AbortController().signal,{id:'camera-one'});
  assert.equal(result.doc,contentDocument);
  assert.equal(slot.appLoadDiagnostic.hlsReady,false);
  assert.equal(slot.appLoadDiagnostic.outcome,'dom_ready');
  assert.equal(scheduler.timers.size,0);
});

test('delayed media insertion is observed without loading HLS or creating a video',async()=>{
  const h=mediaWaitHarness(),abort=new AbortController();let settled=false;
  const pending=h.wait(h.doc,abort.signal,7200).then(value=>{settled=true;return value;});
  await Promise.resolve();assert.equal(settled,false);
  assert.equal([...h.timers.values()][0].ms,7200);
  const video={id:'real-app-video'};h.insert(video);
  assert.equal(await pending,video);
  assert.equal(h.observers[0].disconnected,true);
  assert.equal(h.timers.size,0);
});

test('SSR camera anchors remain unclicked until the application runtime is ready',async()=>{
  const scheduler=clock(),map={dataset:{}};let poll,settled=false;
  const doc={URL:'about:blank',readyState:'interactive',images:[],querySelectorAll:()=>[{}],querySelector:()=>({}),
    getElementById:id=>id==='map'?map:id==='close-viewer'?{click(){}}:{},createElement:()=>({}),head:{append(){}}};
  const iframe={contentDocument:doc,contentWindow:{},set src(value){doc.URL=value;}};
  const start=source.indexOf('  async function loadApp('),end=source.indexOf('  function waitForPlayerVideo(');
  const h=evaluate(source.slice(start,end),{...scheduler,setInterval(callback){poll=callback;return 17;},clearInterval(){},
    document:{createElement:()=>iframe},location:{href:'https://koreanow.test/playback-check.html'},run:{runId:'ssr-race'},
    performance:{now:()=>100},CSS:{escape:value=>value},APP_LAYOUT:'',sleep:()=>Promise.resolve()});
  const slot={element:{append(){}}};
  const pending=h.loadApp(slot,new AbortController().signal,{id:'camera-one'}).then(value=>{settled=true;return value;});
  await Promise.resolve();assert.equal(settled,false);
  assert.equal(slot.appLoadDiagnostic.requestedCameraButtonFound,true);
  assert.equal(slot.appLoadDiagnostic.requiredControlsReady,true);
  assert.equal(slot.appLoadDiagnostic.cameraRuntimeReady,false);
  map.dataset.camerasReadyAt='100';poll();
  assert.equal((await pending).doc,doc);
  assert.equal(slot.appLoadDiagnostic.cameraRuntimeReady,true);
  assert.equal(slot.appLoadDiagnostic.hlsReady,false);
  assert.equal(scheduler.timers.size,0);
});

test('lazy-media startup deadline and cancellation disconnect their observers',async()=>{
  let h=mediaWaitHarness();
  const deadline=h.wait(h.doc,new AbortController().signal,20);h.expire();
  assert.equal(await deadline,null);assert.equal(h.observers[0].disconnected,true);
  h=mediaWaitHarness();const abort=new AbortController(),pending=h.wait(h.doc,abort.signal,10000);
  const rejected=assert.rejects(pending,{name:'AbortError'});abort.abort();await rejected;
  assert.equal(h.timers.size,0);assert.equal(h.observers[0].disconnected,true);
  const expired=mediaWaitHarness();assert.equal(await expired.wait(expired.doc,abort.signal,0).catch(error=>error.name),'AbortError');
});

function hlsHarness(existing=false){
  const doc={visibilityState:'visible',getElementById:()=>null,querySelector:()=>null};
  class Original{
    static version='test-real-constructor';
    static Events={FRAG_LOADING:'fragLoading',FRAG_BUFFERED:'fragBuffered',FRAG_LOAD_EMERGENCY_ABORTED:'abort',LEVEL_SWITCHING:'levelSwitching',ERROR:'error'};
    static isSupported(){return true;}
    constructor(config){this.config=config;this.handlers=new Map();}
    on(name,listener){this.handlers.set(name,listener);}
  }
  let now=10;
  const h=evaluate(section('causeSafeUrl','observe'),{number:value=>Number.isFinite(value)?value:null,iso:()=>new Date(0).toISOString(),performance:{now:()=>now,timeOrigin:1000},document:doc,location:{href:'https://koreanow.test/'}});
  const win={document:doc,performance:{timeOrigin:1000},...(existing?{Hls:Original}:{})};
  const attempt={startedPerfMs:null,startedAtMs:null,frameTiming:{presentedCallbackCount:0},hlsEvents:[],hlsLifecycleEvents:[]};
  return {win,attempt,Original,attach:h.instrumentHls,advance(value){now=value;}};
}

test('lazy HLS assignment attaches diagnostics before construction, preserving configuration and static APIs',()=>{
  const h=hlsHarness(),remove=h.attach(h.win,h.attempt);
  assert.equal(h.win.Hls,undefined);assert.equal(h.attempt.hlsDiagnosticsAttached,false);
  assert.equal(h.attempt.hlsInstrumentation.registeredBeforeSelection,true);
  h.attempt.startedPerfMs=20;h.advance(1500);h.win.Hls=h.Original;
  assert.equal(h.attempt.hlsDiagnosticsAttached,true);
  assert.equal(h.attempt.hlsInstrumentation.mode,'lazy_global_assignment');
  assert.equal(h.attempt.hlsInstrumentation.attachedAtPerfMs,1500);
  assert.equal(h.win.Hls.Events,h.Original.Events);assert.equal(h.win.Hls.isSupported(),true);
  const config={maxBufferLength:10,progressive:true},instance=new h.win.Hls(config);
  assert.equal(instance.config,config);assert.ok(instance instanceof h.Original);
  assert.equal(h.attempt.hlsDiagnostics.constructedInstances,1);
  instance.handlers.get('error')('error',{fatal:true,type:'networkError',details:'manifestLoadError'});
  assert.equal(h.attempt.fatalHls.fatal,true);assert.equal(h.attempt.hlsEvents.length,1);
  remove();assert.equal(h.win.Hls,h.Original);
  assert.equal(Object.getOwnPropertyDescriptor(h.win,'Hls').get,undefined);
});

test('HLS observation is reversible before a load and with an already loaded library',()=>{
  const cold=hlsHarness(),removeCold=cold.attach(cold.win,cold.attempt);removeCold();
  assert.equal(Object.hasOwn(cold.win,'Hls'),false);
  const warm=hlsHarness(true),removeWarm=warm.attach(warm.win,warm.attempt);
  assert.notEqual(warm.win.Hls,warm.Original);assert.equal(warm.attempt.hlsInstrumentation.mode,'existing_global');
  removeWarm();assert.equal(warm.win.Hls,warm.Original);
});

test('selection identity uses the actual selected camera and translated display name',()=>{
  const h=evaluate(section('selectedAppCamera','instrumentNativeErrors'));
  const camera={id:'camera-1',name:'원래 이름',kind:'hls'};
  const viewer={hidden:false,dataset:{media:'hls'}},title={textContent:'English camera name'};
  const doc={URL:'https://koreanow.test/?playbackCheck=run#cam=camera-1',getElementById:id=>id==='viewer'?viewer:title};
  const button={getAttribute:()=> 'true',querySelector:()=>({textContent:'English camera name'})};
  assert.equal(h.selectedAppCamera(doc,camera,button).id,'camera-1');
  doc.URL='https://koreanow.test/#cam=camera-2';assert.throws(()=>h.selectedAppCamera(doc,camera,button),/selected_camera_mismatch/);
  doc.URL='https://koreanow.test/#cam=camera-1';title.textContent='Another camera';assert.throws(()=>h.selectedAppCamera(doc,camera,button),/selected_camera_mismatch/);
});

function diagnosticHarness(cameras,id){
  const scheduler=clock(),instances=[],listeners={};
  const select={value:'',append(option){if(!this.value)this.value=option.value;}},output={},run={};
  const video={removeAttribute(){},load(){},addEventListener(name,fn){listeners[name]=fn;},play:()=>Promise.resolve()};
  class Hls{static isSupported(){return true;}static Events=new Proxy({},{get:(_,key)=>key});constructor(config){this.config=config;this.handlers=new Map();instances.push(this);}on(event,fn){this.handlers.set(event,fn);}loadSource(url){this.source=url;}attachMedia(media){this.media=media;}destroy(){this.destroyed=true;}}
  const win={Hls,KOREA_CAMERAS:cameras,addEventListener(){}};
  const document={querySelector:selector=>({'#source':select,'#result':output,'#run':run,video}[selector]),createElement:()=>({})};
  evaluate(diagnostic,{...scheduler,window:win,Hls,document,location:{search:'?id='+id,origin:'https://koreanow.test'},fetch:()=>assert.fail('diagnostics must not start a preliminary provider connection')});
  return {run,select,instances,video,output,...scheduler};
}

test('source diagnostic opens the production relay exactly once and respects the source cap',()=>{
  const camera={id:'gits-6958',kind:'hls',name:'Camera',proxy:true,streamUrl:'https://provider.test/popup',providerType:'gits',sessionLimitSeconds:40};
  const h=diagnosticHarness([camera],camera.id);h.run.onclick();
  assert.equal(h.instances.length,1);assert.equal(h.instances[0].source,'/api/hls/gits-6958/index.m3u8');
  assert.equal(h.instances[0].config.progressive,true);assert.equal(h.instances[0].media,h.video);
  assert.equal([...h.timers.values()][0].ms,40000);h.expire();assert.equal(h.instances[0].destroyed,true);
});

test('source diagnostic preserves direct playback and ignores stale player callbacks on a new selection',()=>{
  const cameras=[{id:'first',kind:'hls',name:'First',proxy:true,streamUrl:'https://provider.test/first',providerType:'paju'},{id:'second',kind:'hls',name:'Second',streamUrl:'https://provider.test/second.m3u8',providerType:'busan',sessionLimitSeconds:30}];
  const h=diagnosticHarness(cameras,'first');h.run.onclick();h.select.value='second';h.run.onclick();
  assert.equal(h.instances[0].destroyed,true);assert.equal(h.instances[1].source,cameras[1].streamUrl);
  const before=h.output.textContent;h.instances[0].handlers.get('MANIFEST_PARSED')();assert.equal(h.output.textContent,before);
  assert.equal(h.timers.size,1);
});
