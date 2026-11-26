const select=document.querySelector('#source'),output=document.querySelector('#result'),video=document.querySelector('video');
const sources=window.KOREA_CAMERAS.filter(c=>c.kind==='hls');
for(const c of sources){const o=document.createElement('option');o.value=c.id;o.textContent=c.id+' · '+c.name;select.append(o);}
const selected=new URLSearchParams(location.search).get('id');if(sources.some(c=>c.id===selected))select.value=selected;
let player,stopTimer,runToken=0;
const lines=[];
function log(value){lines.push(value);output.textContent=JSON.stringify(lines,null,2);}
function safeUrl(value){const url=new URL(value,location.origin);return url.origin+url.pathname.replace(/[a-f0-9]{32}/gi,'[view-route]');}
function playbackUrl(camera){return camera.proxy?'/api/hls/'+encodeURIComponent(camera.id)+'/index.m3u8':camera.streamUrl;}
function playbackConfig(camera){return {
  maxBufferLength:10,maxMaxBufferLength:20,backBufferLength:0,capLevelToPlayerSize:true,
  ...(camera.providerType==='jeju'?{liveSyncDurationCount:1,liveMaxLatencyDurationCount:3}:{}),
  ...(['high1','daegu','gwangju','changwon','cheonan','gits'].includes(camera.providerType)?{progressive:true}:{}),
};}
function stopMedia(){clearTimeout(stopTimer);player?.destroy();player=null;video.removeAttribute('src');video.load();}
document.querySelector('#run').onclick=()=>{
  const token=++runToken;
  stopMedia();lines.length=0;
  const camera=sources.find(c=>c.id===select.value);
  if(!camera){log({error:'camera_not_found'});return;}
  const current=()=>token===runToken;
  const stream=playbackUrl(camera),config=playbackConfig(camera);
  const play=()=>{if(current())video.play().catch(error=>{if(current())log({playError:error.message});});};
  log({id:camera.id,origin:location.origin,startedAt:new Date().toISOString(),playbackUrl:safeUrl(stream),proxy:camera.proxy===true,diagnosticOnly:true});
  // Use the application's exact public entry point. A preliminary fetch would
  // start a second provider session and can consume or replace a per-view URL.
  if(window.Hls?.isSupported()){
    const instance=player=new Hls(config);
    log({hlsConfig:config});
    for(const name of ['MANIFEST_LOADING','MANIFEST_LOADED','LEVEL_LOADING','LEVEL_LOADED','FRAG_LOADING','FRAG_LOADED','BUFFER_APPENDED']){
      instance.on(Hls.Events[name],(_,event)=>{if(current())log({event:name,at:new Date().toISOString(),url:event.url?safeUrl(event.url):undefined,fragDuration:event.frag?.duration,stats:event.stats?{loaded:event.stats.loaded,total:event.stats.total,loading:event.stats.loading}:null});});
    }
    instance.on(Hls.Events.ERROR,(_,event)=>{if(current())log({event:'hls-error',type:event.type,details:event.details,fatal:event.fatal,status:event.response?.code??event.networkDetails?.status??null});});
    instance.on(Hls.Events.MANIFEST_PARSED,()=>{if(current()){log({event:'manifest-parsed'});play();}});
    instance.loadSource(stream);instance.attachMedia(video);
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){
    video.addEventListener('loadedmetadata',play,{once:true});video.src=stream;
  }else{log({error:'hls_playback_unsupported'});return;}
  const cap=camera.sessionLimitSeconds||30;
  stopTimer=setTimeout(()=>{if(current()){stopMedia();log({event:'session-ended',limitSeconds:cap});}},cap*1000);
};
video.addEventListener('playing',()=>log({event:'playing',at:new Date().toISOString(),width:video.videoWidth,height:video.videoHeight,currentTime:video.currentTime}));
video.addEventListener('error',()=>log({event:'native-error',code:video.error?.code??null}));
window.addEventListener('pagehide',()=>{runToken++;stopMedia();});
