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

test('provider cutoff observes the retained real video without invalidating the strict frame clock',()=>{
  const rect={left:0,top:0,right:0,bottom:0,width:0,height:0};
  const retained={currentTime:0,readyState:0,networkState:0,videoWidth:0,videoHeight:0,paused:true,ended:false,seeking:false,error:null,
    buffered:{length:0},getBoundingClientRect:()=>rect,closest:()=>null,getVideoPlaybackQuality:()=>({totalVideoFrames:0,droppedVideoFrames:0})};
  const doc={visibilityState:'visible',querySelector:()=>null,defaultView:{getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})},
    getElementById:id=>id==='video-limit'?{hidden:false}:id==='playback-status'?{dataset:{state:'paused'}}:null};
  const iframe={getBoundingClientRect:()=>({left:0,top:0,right:400,bottom:300,width:400,height:300}),clientWidth:400,clientHeight:300};
  const begin=source.indexOf('const PLAYING_FRAME_CLOCK_POLICY='),end=source.indexOf('  // END exact pure playing-frame-clock candidate body');
  const h=evaluate(source.slice(begin,end)+section('observe','playable'),{document:{visibilityState:'visible'},innerWidth:1000,innerHeight:800,
    number:value=>Number.isFinite(value)?value:null,compactRect:value=>value?[value.left,value.top,value.width,value.height]:null,
    inBounds:(value,w,height)=>!!value&&value.width>0&&value.height>0&&value.right<=w&&value.bottom<=height});
  const attempt={},frames={supported:true,count:1,presented:12,mediaTime:24.8};
  const observed=h.observePlayerMedia(iframe,doc,retained,frames,500,attempt);
  assert.equal(observed.currentVideo,null);assert.equal(observed.observedVideo,retained);
  assert.equal(observed.sample.paused,true);assert.equal(observed.sample.readyState,0);assert.equal(observed.sample.currentTime,0);
  assert.equal(observed.sample.videoVisible,false);assert.equal(attempt.normalProviderLimitObserved,true);
  assert.equal(attempt.terminalControl.nativeSnapshotSource,'retained_actual_video');assert.equal(attempt.terminalControl.mediaRemoved,true);
  const state=h.createPlayingFrameClock({parentTimeOriginMs:100,startedPerfMs:1000,registeredAtPerfMs:999});
  const live={paused:false,ended:false,seeking:false,readyState:4,width:640,height:360,currentTime:24.8,mediaErrorCode:null,pageVisibility:'visible',appVisibility:'visible'};
  const point=(event,index,elapsed,native,frame=null)=>({event,observationIndex:index,clock:'parent_performance_now',atPerfMs:1000+elapsed,elapsedPerfMs:elapsed,frameCallbackCount:1,frame,native});
  h.observePlayingFrameClock(state,point('rvfc',0,100,live,{mediaTime:24.8,presentedFrames:12}));
  const terminal={...observed.sample,seeking:retained.seeking};
  h.observePlayingFrameClock(state,point('sample',1,500,terminal));h.observePlayingFrameClock(state,point('observation-end',2,501,terminal));
  assert.equal(h.summarizePlayingFrameClock(state).usable,true);
  assert.equal(h.summarizePlayingFrameClock(state).certifiesPlayback,false);
});

test('provider cutoff retains every original progress threshold and decoded-frame requirement',()=>{
  const h=evaluate(section('providerLimitOutcome','playable'));
  for(const [progress,target] of [[24.8087,25],[24.4435,25],[15.9344,17],[11.1639,12]]){
    assert.equal(h.providerLimitOutcome(progress,target,true).verdict,'fail');
    assert.equal(h.providerLimitOutcome(progress,target,true).reason,'provider_limit_before_required_verified_progress');
  }
  for(const target of [12,17,25]){
    assert.equal(h.providerLimitOutcome(target,target,true).verdict,'playback_pass');
    assert.equal(h.providerLimitOutcome(target,target,false).verdict,'fail');
  }
});

test('result rendering preserves unchanged camera rows and ignores large raw journals',()=>{
  const {createDom}=require('./helpers/instrumented-dom.cjs');
  const {document}=createDom('<html><body><table><tbody id="rows"></tbody></table></body></html>');
  const run={runId:'rows',cameras:Array.from({length:368},(_,i)=>({id:'camera-'+i,name:'Camera '+i})),attempts:[],activeAttempts:[],visualReviews:{}};
  let builds=0;
  const h=evaluate(section('verdictFor','buildResultRow')+section('renderResults','updateProgress'),{run,document,$:id=>document.getElementById(id),resultRows:new Map(),renderedResultRun:null,
    buildResultRow(camera){builds++;const row=document.createElement('tr');row.dataset.camera=camera.id;return row;}});
  h.renderResults();assert.equal(builds,368);
  const rows=[...document.getElementById('rows').children];
  const attempt={id:'camera-100',attemptId:'one',round:1,verdict:'running',metrics:{firstFrameMs:null,verifiedProgressSeconds:0},samples:{toJSON(){throw new Error('raw journal must not be fingerprinted');}}};
  run.activeAttempts.push(attempt);h.renderResults('camera-100');assert.equal(builds,369);
  assert.equal(document.getElementById('rows').children[99],rows[99]);assert.equal(document.getElementById('rows').children[101],rows[101]);
  assert.notEqual(document.getElementById('rows').children[100],rows[100]);
  h.renderResults();assert.equal(builds,369);
});

test('full checkpoint work is deferred until no visible attempt is active',async()=>{
  const run={runId:'save',attempts:[],activeAttempts:[{id:'active'}],interruptedAttempts:[],toJSON(){throw new Error('must not serialize during measurement');}};
  let writes=0;
  const note={dataset:{}};
  const h=evaluate(section('save','markRoundCompleted'),{run,saving:null,saveAgain:false,lastSaveAt:0,iso:()=>new Date(0).toISOString(),$:()=>note,
    writeCheckpoint:async value=>{writes++;assert.equal(value.activeAttempts.length,0);return {backend:'indexeddb'};},stop:()=>assert.fail('unexpected stop')});
  await h.save();assert.equal(writes,0);
  run.activeAttempts=[];delete run.toJSON;await h.save();assert.equal(writes,1);
});

test('batch scheduling isolates providers and waits for a quiet checkpoint before the next cameras',async()=>{
  const calls=[],pending=new Map(),saves=[];
  const start=source.indexOf('  async function measureBatches('),end=source.indexOf('  async function assetHash(');
  const h=evaluate(source.slice(start,end),{slots:[{},{},{}],
    measure(camera){calls.push(camera);return new Promise(resolve=>pending.set(camera.id,resolve));},
    save(){return new Promise(resolve=>saves.push(resolve));}});
  const queue=[{id:'a1',providerType:'a'},{id:'a2',providerType:'a'},{id:'b1',providerType:'b'},{id:'c1',providerType:'c'},{id:'b2',providerType:'b'}];
  const done=h.measureBatches(queue,1,new AbortController().signal);
  assert.deepEqual(calls.map(c=>c.id),['a1','b1','c1']);
  pending.get('a1')();pending.get('b1')();await new Promise(setImmediate);assert.equal(saves.length,0);assert.equal(calls.length,3);
  pending.get('c1')();await new Promise(setImmediate);assert.equal(saves.length,1);assert.equal(calls.length,3);
  saves[0]();await new Promise(setImmediate);assert.deepEqual(calls.map(c=>c.id),['a1','b1','c1','a2','b2']);
  pending.get('a2')();pending.get('b2')();await new Promise(setImmediate);assert.equal(saves.length,2);saves[1]();await done;
  assert.equal(queue.length,0);
});
