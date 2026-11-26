(() => {
  'use strict';
  const paths={
    search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
    bookmark:'<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.3"/>',
    chevronDown:'<path d="m7 10 5 5 5-5"/>',
    globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5.5 6.5h13M5.5 17.5h13"/>',
    pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    video:'<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-4v12l-6-4"/>',
    videoOff:'<path d="m3 3 18 18M9 6h4a2 2 0 0 1 2 2v2l6-4v12l-5-3M15 16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2"/>',
    x:'<path d="m6 6 12 12M6 18 18 6"/>',
    play:'<path d="m8 5 11 7-11 7Z"/>',
    youtube:'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/>',
    share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    minus:'<path d="M5 12h14"/>',
    locate:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
    shuffle:'<path d="M3 7h3c4 0 7 10 11 10h4m-4-4 4 4-4 4M3 17h3c1.6 0 3-1.6 4.5-3.5M13.5 10.5C15 8.6 16 7 18 7h3m-4-4 4 4-4 4"/>'
  };
  const icon=(name)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.video)+'</svg>';
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  const $=id=>document.getElementById(id);
  const cameras=window.KOREA_DISPLAY_CAMERAS||window.KOREA_CAMERAS||[];
  const knownIds=new Set(cameras.map(c=>c.id));
  const storageKey='jigeum-korea:favorites:v1';
  let favorites=new Set();
  try{const stored=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(stored)) favorites=new Set(stored.filter(id=>knownIds.has(id)));}catch{}
  const state={category:'all',region:'all',kind:'all',query:'',savedOnly:false,selected:null};
  let map=null,layer=null,player=null,playerToken=0,apiPromise=null,toastTimeout,playerTimeout=null,viewerReturnFocus=null;
  const markerMap=new Map();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compactViewport=matchMedia('(max-width: 760px)');
  const modalBackground=[...document.querySelectorAll('.topbar,.sidebar,.skip-link,.map-stage > :not(#viewer)')];
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const watchUrl=c=>c.sourceUrl;
  const mediaKind=c=>c.kind||'youtube';
  const mediaLabels={youtube:'YouTube',iframe:'Broadcast',hls:'Live camera'};
  let hlsInstance=null,videoElement=null,sessionTimer=null;
  function toast(message){clearTimeout(toastTimeout);$('toast').textContent=message;$('toast').classList.add('visible');toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),2600);}
  function filtered(){const q=state.query.trim().toLocaleLowerCase('en');return cameras.filter(c=>(state.category==='all'||c.category===state.category)&&(state.region==='all'||c.region===state.region)&&(state.kind==='all'||mediaKind(c)===state.kind)&&(!state.savedOnly||favorites.has(c.id))&&(!q||[c.name,c.region,c.location,c.categoryLabel,c.provider||'',mediaLabels[mediaKind(c)],c.searchAliases||''].some(v=>String(v||'').toLocaleLowerCase('en').includes(q))));}
  function updateSaveControls(){
    $('saved-count').textContent=favorites.size;
    document.querySelectorAll('[data-save]').forEach(b=>{const saved=favorites.has(b.dataset.save);b.setAttribute('aria-pressed',String(saved));const c=cameras.find(c=>c.id===b.dataset.save);b.setAttribute('aria-label',(saved?'Unsave ':'Save ')+c.name);});
    if(state.selected){const saved=favorites.has(state.selected.id);$('viewer-save').setAttribute('aria-pressed',String(saved));$('viewer-save').setAttribute('aria-label',saved?'Unsave place':'Save place');}
  }
  function save(id){const willSave=!favorites.has(id);willSave?favorites.add(id):favorites.delete(id);let persisted=true;try{localStorage.setItem(storageKey,JSON.stringify([...favorites]));}catch{persisted=false;}if(state.savedOnly) render();else updateSaveControls();toast(persisted?(willSave?'Place saved':'Place removed from Saved'):'Saved for this visit only. Browser storage is unavailable.');}
  function focusReference(element){
    if(element?.dataset?.select)return {kind:'select',id:element.dataset.select};
    if(element?.dataset?.save)return {kind:'save',id:element.dataset.save};
    if(element?.id&&!$('viewer').contains(element))return {kind:'id',id:element.id};
    return null;
  }
  function findFocusTarget(reference){
    if(!reference)return null;
    return reference.kind==='id'?$(reference.id):document.querySelector('[data-'+reference.kind+'="'+reference.id+'"]');
  }
  function setListCollapsed(collapsed){
    document.body.classList.toggle('list-collapsed',collapsed);
    $('list-toggle').setAttribute('aria-expanded',String(!collapsed));
    $('list-toggle').setAttribute('aria-label',collapsed?'Show camera list':'Hide camera list');
  }
  setListCollapsed(compactViewport.matches);
  function restoreViewerFocus(){
    let target=findFocusTarget(viewerReturnFocus)||document.querySelector('[data-select]')||$('reset-filters');
    if(document.body.classList.contains('list-collapsed')&&target&&$('camera-list').contains(target))target=markerMap.get(state.selected?.id)?.getElement()||$('list-toggle');
    if(target&&!target.closest('[hidden]')){
      if($('camera-list').contains(target))target.scrollIntoView?.({block:'nearest',inline:'nearest'});
      target.focus({preventScroll:true});
    }
    else $('explore-tab').focus({preventScroll:true});
  }
  function syncViewerMode(){
    const modal=compactViewport.matches&&!$('viewer').hidden;
    $('viewer').setAttribute('role',modal?'dialog':'region');
    if(modal)$('viewer').setAttribute('aria-modal','true');else $('viewer').removeAttribute('aria-modal');
    modalBackground.forEach(element=>{element.inert=modal;});
    document.body.classList.toggle('viewer-modal',modal);
    return modal;
  }
  compactViewport.addEventListener?.('change',()=>{
    setListCollapsed(compactViewport.matches);
    if(syncViewerMode()&&!$('viewer').contains(document.activeElement))$('close-viewer').focus({preventScroll:true});
  });
  function render(){
    const focus=focusReference(document.activeElement);
    map?.closePopup();
    const visible=filtered();
    $('camera-list').innerHTML=visible.map(c=>'<article class="camera-card'+(state.selected?.id===c.id?' active':'')+'" data-camera="'+c.id+'"><button class="camera-select" data-select="'+c.id+'" aria-label="Open '+escapeHtml(c.name)+' camera" aria-pressed="'+(state.selected?.id===c.id)+'"><span class="camera-row-icon" aria-hidden="true">'+icon('video')+'</span><h3>'+escapeHtml(c.name)+'</h3></button><button class="card-save" data-save="'+c.id+'" aria-label="Save '+escapeHtml(c.name)+'" aria-pressed="false">'+icon('bookmark')+'</button></article>').join('');
    $('result-count').textContent=visible.length;
    $('video-total').textContent=cameras.length.toLocaleString('en');
    $('video-matches').hidden=visible.length===cameras.length;
    $('video-matches').textContent=visible.length.toLocaleString('en')+' /';
    $('video-count').setAttribute('aria-label',visible.length===cameras.length?cameras.length+' videos in total':'Showing '+visible.length+' of '+cameras.length+' videos');
    $('empty-state').hidden=visible.length>0;$('camera-list').hidden=visible.length===0;
    $('empty-title').textContent=state.savedOnly&&!favorites.size?'Save a place you love':'No places found';
    $('empty-description').textContent=state.savedOnly&&!favorites.size?'Select the bookmark beside a place to keep it here.':'Try another place name or region.';
    $('list-title').firstChild.textContent=state.savedOnly?'Saved ':'Places ';
    $('random-button').disabled=visible.length===0;
    updateSaveControls();renderMarkers(visible);
    if(state.selected&&!visible.some(c=>c.id===state.selected.id))closeViewer({restoreFocus:$('viewer').contains(document.activeElement)});
    if(focus&&focus.kind!=='id'&&!$('viewer').getAttribute('aria-modal')){
      const target=findFocusTarget(focus)||document.querySelector('[data-'+focus.kind+']')||$('reset-filters');
      target.focus({preventScroll:true});
    }
  }
  function createMarkerIcon(c){return L.divIcon({className:'camera-marker'+(state.selected?.id===c.id?' selected':''),html:'<span class="pin-marker">'+icon('video')+'</span><span class="pin-label">'+escapeHtml(c.name)+'</span>',iconSize:[44,44],iconAnchor:[22,22]});}
  function bindMarkerActivation(marker,activate){
    marker.on('click',activate);
    marker.getElement()?.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();if(!event.repeat)activate();}
    });
  }
  function renderMarkers(visible){
    if(!map||!layer)return;layer.clearLayers();markerMap.clear();
    const zoom=map.getZoom(),groups=new Map(),coordinateCounts=new Map();
    for(const camera of visible){const coordinate=camera.lat+','+camera.lng;coordinateCounts.set(coordinate,(coordinateCounts.get(coordinate)||0)+1);}
    for(const camera of visible){
      const point=map.project([camera.lat,camera.lng],zoom);
      const separateSelected=camera.id===state.selected?.id&&coordinateCounts.get(camera.lat+','+camera.lng)===1;
      const key=separateSelected?camera.id:Math.floor(point.x/64)+':'+Math.floor(point.y/64);
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(camera);
    }
    $('map').classList.toggle('quiet-labels',visible.length>12&&zoom<11);
    for(const group of groups.values()){
      if(group.length===1){
        const c=group[0];const marker=L.marker([c.lat,c.lng],{icon:createMarkerIcon(c),title:c.name,alt:c.name+' camera',keyboard:true,zIndexOffset:c.id===state.selected?.id?500:0}).addTo(layer);
        bindMarkerActivation(marker,()=>select(c.id,{focusMap:true,autoPlay:true}));markerMap.set(c.id,marker);continue;
      }
      const center=[group.reduce((n,c)=>n+c.lat,0)/group.length,group.reduce((n,c)=>n+c.lng,0)/group.length];
      const regions=[...new Set(group.map(c=>c.region))];const label=regions.length===1?regions[0]:'Nearby';
      const title='Show '+group.length+' cameras · '+label;
      const selected=group.some(camera=>camera.id===state.selected?.id);
      const cluster=L.marker(center,{icon:L.divIcon({className:'camera-marker camera-cluster'+(selected?' selected':''),html:'<span class="pin-marker cluster-marker">'+group.length+'</span><span class="pin-label">'+escapeHtml(label)+'</span>',iconSize:[44,44],iconAnchor:[22,22]}),title,alt:title,keyboard:true,zIndexOffset:selected?500:0}).addTo(layer);
      bindMarkerActivation(cluster,()=>{
        closeViewer({restoreFocus:false});
        if(zoom>=13||new Set(group.map(c=>c.lat+','+c.lng)).size===1){
          const choices=document.createElement('div');choices.className='cluster-choices';choices.setAttribute('role','group');choices.setAttribute('aria-label','Choose a camera at this location');
          for(const camera of group){const button=document.createElement('button');button.type='button';button.textContent=camera.name;button.dataset.select=camera.id;button.addEventListener('click',()=>{if(!filtered().some(item=>item.id===camera.id)){map.closePopup();return;}select(camera.id,{autoPlay:true});});choices.appendChild(button);}
          const popup=L.popup({maxHeight:240,maxWidth:260,closeButton:true}).setLatLng(center).setContent(choices).openOn(map);choices.querySelector('button')?.focus({preventScroll:true});return;
        }
        $('map').focus({preventScroll:true});map.fitBounds(L.latLngBounds(group.map(c=>[c.lat,c.lng])),{padding:[55,65],maxZoom:Math.min(14,zoom+3),animate:!reducedMotion});
      });
    }
  }
  function initMap(){
    if(!window.L){$('map-notice').hidden=false;return;}
    map=L.map('map',{zoomControl:false,attributionControl:true,minZoom:5,maxZoom:20,zoomSnap:.25,zoomDelta:1,wheelPxPerZoomLevel:100,maxBounds:[[30.5,120],[41.7,137]],maxBoundsViscosity:.7,scrollWheelZoom:true}).setView([35.7,128.3],6.7);
    map.attributionControl.setPrefix(false);
    initBasemap();
    L.control.scale({position:'bottomleft',imperial:false,maxWidth:90,updateWhenIdle:true}).addTo(map);
    layer=L.layerGroup().addTo(map);map.on('zoomend',()=>renderMarkers(filtered()));fitMap(false);
    new ResizeObserver(()=>map.invalidateSize({pan:false})).observe($('map'));
  }
  function initBasemap(){
    const attribution='<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>';
    let vector=null,canvas=null,geography=null,ready=false,startupTimer=null,canvasStarted=false;
    const showOverview=()=>{
      $('map').dataset.basemap='overview';
      $('map-notice').textContent='Map details unavailable. Cameras still work.';
      $('map-notice').hidden=false;
      if(!geography&&window.KOREA_GEOGRAPHY&&typeof L.geoJSON==='function'){
        geography=L.geoJSON(window.KOREA_GEOGRAPHY,{interactive:false,smoothFactor:.8,style:feature=>({color:feature.id==='KOR'?'#58646c':'#29383e',weight:feature.id==='KOR'?1:.7,fillColor:feature.id==='KOR'?'#172127':'#11191f',fillOpacity:1,opacity:1})}).addTo(map);
        map.attributionControl.addAttribution(attribution);
      }
    };
    const showDetailed=renderer=>{
      ready=true;clearTimeout(startupTimer);
      if(geography){map.removeLayer(geography);geography=null;map.attributionControl.removeAttribution(attribution);}
      $('map').dataset.basemap=renderer==='canvas'?'detailed-canvas':'detailed';$('map-notice').hidden=true;
    };
    const removeVector=()=>{
      if(!vector)return;
      const previous=vector,remove=previous.onRemove;vector=null;
      const sourceAttribution=previous.getAttribution();if(sourceAttribution)map.attributionControl.removeAttribution(sourceAttribution);
      previous.onRemove=function(leafletMap){
        try{if(this.getMaplibreMap())remove.call(this,leafletMap);else this.getContainer()?.remove();}
        catch{this.getContainer()?.remove();}
      };
      map.removeLayer(previous);
    };
    const startCanvas=async()=>{
      if(canvasStarted)return;canvasStarted=true;clearTimeout(startupTimer);removeVector();
      $('map').dataset.basemap='loading';
      try{
        const fallback=await window.KOREA_CANVAS_BASEMAP.addTo(map);canvas=fallback.layer;
        await fallback.ready;showDetailed('canvas');
      }catch(error){
        console.warn('Map details unavailable:',error.message);
        if(canvas){map.removeLayer(canvas);canvas=null;}
        showOverview();
      }
    };
    $('map').dataset.basemap='loading';
    if(!window.maplibregl||typeof L.maplibreGL!=='function'){startCanvas();return;}
    try{
      vector=L.maplibreGL({style:'map-style-dark.json',interactive:false,padding:.1,updateInterval:16});
      vector.addTo(map);
      const renderer=vector.getMaplibreMap();
      renderer.on('load',()=>{if(!canvasStarted)showDetailed('webgl');});
      // Individual source or glyph requests can recover; the deadline below
      // switches renderer only if the initial detailed map never becomes ready.
      renderer.on('error',()=>{});
      renderer.on('webglcontextlost',startCanvas);
      startupTimer=setTimeout(()=>{if(!ready)startCanvas();},20000);
    }catch{
      console.warn('WebGL unavailable; using the Canvas map.');
      startCanvas();
    }
  }
  function fitMap(animate=true){if(!map)return;const points=filtered();if(!points.length)return;const bounds=L.latLngBounds(points.map(c=>[c.lat,c.lng]));const collapsed=document.body.classList.contains('list-collapsed');map.fitBounds(bounds,{paddingTopLeft:compactViewport.matches?[35,140]:[collapsed?60:332,96],paddingBottomRight:compactViewport.matches?[35,70]:[70,70],maxZoom:12,animate:animate&&!reducedMotion});}
  function setPlayback(text,status){$('playback-text').textContent=text;$('playback-status').dataset.state=status;}
  function clearPlaybackTimer(){clearTimeout(playerTimeout);playerTimeout=null;}
  function watchPlayback(token){
    if(playerTimeout!==null)return;
    playerTimeout=setTimeout(()=>{playerTimeout=null;if(token===playerToken)showVideoError('TIMEOUT');},25000);
  }
  function stopPlayer(){playerToken++;clearPlaybackTimer();clearTimeout(sessionTimer);sessionTimer=null;if(hlsInstance){try{hlsInstance.destroy();}catch{}hlsInstance=null;}if(videoElement){try{videoElement.pause();videoElement.removeAttribute('src');videoElement.load();}catch{}videoElement=null;}$('video-limit').hidden=true;if(player){try{player.destroy();}catch{}player=null;}$('player-mount').replaceChildren();$('player-mount').hidden=true;}
  function closeViewer({restoreFocus=true}={}){const wasVisible=!$('viewer').hidden;stopPlayer();$('viewer').hidden=true;syncViewerMode();if(wasVisible&&restoreFocus)restoreViewerFocus();}
  function updateHash(id){const url=new URL(location.href);url.hash='cam='+encodeURIComponent(id);history.replaceState(null,'',url);}
  function select(id,{focusMap=false,autoPlay=false,writeHash=true,focusViewer=autoPlay}={}){
    const camera=cameras.find(c=>c.id===id);if(!camera)return;
    if(focusViewer)viewerReturnFocus=focusReference(document.activeElement)||{kind:'select',id};
    stopPlayer();state.selected=camera;
    $('viewer-title').textContent=camera.name;
    $('source-link').href=watchUrl(camera);$('error-source-link').href=watchUrl(camera);
    const kind=mediaKind(camera);$('viewer').dataset.media=kind;
    $('play-label').textContent=kind==='iframe'?'Open broadcast':kind==='hls'?'Play live camera':'Play YouTube video';
    $('preview').hidden=false;$('video-error').hidden=true;$('viewer').hidden=false;$('viewer').scrollTop=0;setPlayback('Press play to open this camera','idle');
    if(writeHash)updateHash(id);render();syncViewerMode();
    if(focusViewer)$('close-viewer').focus({preventScroll:true});
    if(focusMap&&map){const zoom=Math.max(7.5,map.getZoom());const point=map.project([camera.lat,camera.lng],zoom);if(innerWidth>760){point.x+=innerWidth>1150?125:85;}map.flyTo(map.unproject(point,zoom),zoom,{duration:reducedMotion?0:.7,animate:!reducedMotion});}
    if(autoPlay)startVideo();
  }
  function loadYouTubeApi(){
    if(window.YT?.Player)return Promise.resolve();if(apiPromise)return apiPromise;
    apiPromise=new Promise((resolve,reject)=>{
      document.querySelector('script[data-youtube-api]')?.remove();
      const script=document.createElement('script');let settled=false;
      const finish=(error)=>{
        if(settled)return;settled=true;clearTimeout(timer);script.onerror=null;
        if(window.onYouTubeIframeAPIReady===ready)window.onYouTubeIframeAPIReady=undefined;
        if(error){script.remove();reject(error);}else resolve();
      };
      const ready=()=>{if(window.YT?.Player)finish();};
      const timer=setTimeout(()=>finish(new Error('API_TIMEOUT')),12000);
      window.onYouTubeIframeAPIReady=ready;
      script.src='https://www.youtube.com/iframe_api';script.dataset.youtubeApi='true';
      script.onerror=()=>finish(new Error('API_LOAD_FAILED'));document.head.appendChild(script);
    }).catch(error=>{apiPromise=null;throw error;});
    return apiPromise;
  }
  function showVideoError(code){
    const mediaHadFocus=$('player-mount').contains(document.activeElement)||$('preview').contains(document.activeElement);
    stopPlayer();const messages={100:['Camera unavailable','The broadcast may have ended or its address may have changed.'],101:['Watch this video on YouTube','This video does not allow playback on other websites.'],150:['Watch this video on YouTube','This video does not allow playback on other websites.'],153:['Connection restricted','This browser could not verify the video source. Try the original page.'],5:['Video could not play','Try a different browser or open the original source.'],NETWORK:['Player could not load','Check your connection or content blocker, then try again.'],TIMEOUT:['Taking longer than expected','Try again in a moment, or open the original source.'],MEDIA:['Video could not load','Try again or check the original stream.'],UNSUPPORTED:['Unsupported video format','Try another browser or open the original source.']};
    const message=messages[code]||['Unable to connect','Please try again in a moment or check the original source.'];
    $('preview').hidden=true;$('player-mount').hidden=true;$('video-error').hidden=false;$('video-error-title').textContent=message[0];$('video-error-description').textContent=message[1];setPlayback('Unable to connect','error');
    $('reload-page').hidden=code!=='NETWORK';
    if(mediaHadFocus)$('retry-video').focus({preventScroll:true});
  }
  function openOfficialFrame(camera,token){
    const frame=document.createElement('iframe');
    frame.title=camera.name+' official broadcast player';frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.allow='autoplay; fullscreen; picture-in-picture';frame.allowFullscreen=true;
    frame.onload=()=>{if(token!==playerToken)return;clearPlaybackTimer();setPlayback('Official player · Use its Play and Continue controls','source');};
    frame.onerror=()=>{if(token===playerToken)showVideoError('NETWORK');};
    frame.src=camera.embedUrl;$('player-mount').replaceChildren(frame);$('player-mount').hidden=false;$('preview').hidden=true;
    setPlayback('Opening the official player…','loading');watchPlayback(token);
  }
  function openHlsVideo(camera,token){
    const bufferedStartup=camera.providerType==='yeongsan';
    const video=document.createElement('video');videoElement=video;
    video.controls=true;video.autoplay=!bufferedStartup;video.muted=true;video.playsInline=true;video.preload='auto';
    video.setAttribute('aria-label',camera.name+' video');video.setAttribute('playsinline','');
    let hasPlayed=false,sessionStarted=false,initialPlayRequested=false;
    const current=()=>token===playerToken;
    const startSession=()=>{
      if(!current()||sessionStarted||!camera.sessionLimitSeconds)return;
      sessionStarted=true;sessionTimer=setTimeout(()=>{
        if(!current())return;if(!hasPlayed){showVideoError('TIMEOUT');return;}
        const mediaHadFocus=$('player-mount').contains(document.activeElement);stopPlayer();$('preview').hidden=true;$('video-error').hidden=true;$('video-limit').hidden=false;
        $('video-limit-text').textContent=camera.sessionLimitReason==='app'?'Your '+camera.sessionLimitSeconds+'-second viewing session has ended. Select Continue watching to reconnect.':'Playback paused at the '+camera.sessionLimitSeconds+'-second viewing limit set by '+camera.provider+'.';
        setPlayback('Session ended · Continue watching to reconnect','paused');if(mediaHadFocus)$('continue-video').focus({preventScroll:true});
      },camera.sessionLimitSeconds*1000);
    };
    const play=()=>{
      if(!current())return;
      if(bufferedStartup){
        if(initialPlayRequested||hasPlayed)return;
        let ahead=0;
        for(let i=0;i<video.buffered.length;i++)if(video.currentTime>=video.buffered.start(i)&&video.currentTime<video.buffered.end(i))ahead=Math.max(ahead,video.buffered.end(i)-video.currentTime);
        if(ahead<3||video.readyState<2||!video.videoWidth||!video.videoHeight)return;
        initialPlayRequested=true;
      }
      const promise=video.play();promise?.catch(error=>{if(!current())return;if(error?.name==='NotAllowedError'){clearPlaybackTimer();setPlayback('Press play on the video to begin','ready');}else showVideoError('MEDIA');});
    };
    const manifestReady=()=>{if(!current())return;if(camera.providerType==='yongpyong')startSession();play();};
    if(bufferedStartup){
      for(const event of ['play','pause'])video.addEventListener(event,()=>{if(current())initialPlayRequested=true;});
      for(const event of ['loadeddata','canplay','progress'])video.addEventListener(event,play);
    }
    if(camera.providerType==='busan'||camera.providerType==='wellihilli')video.addEventListener('loadeddata',startSession);
    video.addEventListener('playing',()=>{if(!current())return;hasPlayed=true;if(camera.providerType==='phoenix')startSession();clearPlaybackTimer();setPlayback(camera.videoMode==='recent_clip'?'Recent recording playing':'Live camera playing','playing');});
    for(const event of ['waiting','stalled'])video.addEventListener(event,()=>{if(!current())return;watchPlayback(token);setPlayback('Buffering…','loading');});
    video.addEventListener('pause',()=>{if(!current())return;clearPlaybackTimer();setPlayback('Paused','paused');});
    video.addEventListener('ended',()=>{if(!current())return;clearPlaybackTimer();setPlayback('Recording ended · Play again to replay','ended');});
    video.addEventListener('error',()=>{if(current())showVideoError('MEDIA');});
    $('player-mount').replaceChildren(video);$('player-mount').hidden=false;$('preview').hidden=true;watchPlayback(token);
    const stream=camera.proxy?'/api/hls/'+encodeURIComponent(camera.id)+'/index.m3u8':camera.streamUrl;
    try{
      if(window.Hls?.isSupported()){
        hlsInstance=new Hls({maxBufferLength:10,maxMaxBufferLength:20,backBufferLength:0,capLevelToPlayerSize:true,...(camera.providerType==='jeju'?{liveSyncDurationCount:1,liveMaxLatencyDurationCount:3}:{}),...(['high1','daegu','gwangju','changwon','cheonan','gits'].includes(camera.providerType)?{progressive:true}:{})});
        hlsInstance.on(Hls.Events.MANIFEST_PARSED,manifestReady);
        if(bufferedStartup)hlsInstance.on(Hls.Events.FRAG_BUFFERED,play);
        hlsInstance.on(Hls.Events.ERROR,(_event,data)=>{if(!current())return;if(data.fatal)showVideoError('MEDIA');else if(data.details==='bufferStalledError'){watchPlayback(token);setPlayback('Buffering…','loading');}});
        hlsInstance.loadSource(stream);hlsInstance.attachMedia(video);
      }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=stream;video.addEventListener('loadedmetadata',manifestReady);}
      else {showVideoError('UNSUPPORTED');return;}
      // Match provider start points; High1 retains its connection-time 30-second cap.
      if(!['yongpyong','phoenix','busan','wellihilli'].includes(camera.providerType))startSession();
    }catch{if(current())showVideoError('MEDIA');}
  }
  async function startVideo(){
    if(!state.selected||$('viewer').hidden)return;stopPlayer();const token=playerToken;const camera=state.selected;
    if($('preview').contains(document.activeElement)||$('video-error').contains(document.activeElement)||$('video-limit').contains(document.activeElement))$('close-viewer').focus({preventScroll:true});
    $('preview').hidden=false;$('video-error').hidden=true;setPlayback('Connecting to the camera…','loading');
    if(mediaKind(camera)==='iframe'){openOfficialFrame(camera,token);return;}
    if(mediaKind(camera)==='hls'){openHlsVideo(camera,token);return;}
    try{await loadYouTubeApi();if(token!==playerToken)return;
      const holder=document.createElement('div');holder.id='youtube-player';$('player-mount').replaceChildren(holder);$('preview').hidden=true;$('player-mount').hidden=false;
      watchPlayback(token);
      player=new YT.Player(holder,{width:'100%',height:'100%',videoId:camera.videoId,playerVars:{origin:location.origin,playsinline:1,autoplay:1,mute:1,controls:1,rel:0},events:{onReady(event){if(token!==playerToken)return;const frame=event.target.getIframe();frame.setAttribute('title',camera.name+' YouTube video');frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');frame.setAttribute('allow','autoplay; encrypted-media; picture-in-picture; fullscreen');setPlayback('Ready · Starting with sound off','ready');event.target.mute();event.target.playVideo();},onStateChange(event){if(token!==playerToken)return;if(event.data===1||event.data===0||event.data===2)clearPlaybackTimer();else if(event.data===3)watchPlayback(token);const states={[-1]:['Connecting…','loading'],0:['Broadcast or recording ended','ended'],1:['Playing · Check the original player for live status','playing'],2:['Paused','paused'],3:['Loading video…','loading'],5:['Ready to play','ready']};const result=states[event.data];if(result)setPlayback(...result);},onError(event){if(token===playerToken)showVideoError(event.data);},onAutoplayBlocked(){if(token===playerToken){clearPlaybackTimer();setPlayback('Press play in the player to begin','ready');}}}});
    }catch{if(token===playerToken)showVideoError('NETWORK');}
  }
  function reset(){const resetHadFocus=document.activeElement===$('reset-filters');state.category='all';state.region='all';state.kind='all';$('media-kind').value='all';state.query='';state.savedOnly=false;$('search').value='';$('region').value='all';syncFilters();render();fitMap();if(resetHadFocus)$('search').focus({preventScroll:true});}
  function syncFilters(){document.querySelectorAll('[data-category]').forEach(b=>{const active=b.dataset.category===state.category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('explore-tab').classList.toggle('active',!state.savedOnly);$('saved-tab').classList.toggle('active',state.savedOnly);$('explore-tab').setAttribute('aria-pressed',String(!state.savedOnly));$('saved-tab').setAttribute('aria-pressed',String(state.savedOnly));}
  function random(){const visible=filtered();if(!visible.length)return;const options=visible.length>1?visible.filter(c=>c.id!==state.selected?.id):visible;const c=options[Math.floor(Math.random()*options.length)];select(c.id,{focusMap:true,autoPlay:true});const card=document.querySelector('[data-camera="'+c.id+'"]');if(card)card.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'nearest',inline:'nearest'});}
  $('camera-list').addEventListener('click',e=>{const bookmark=e.target.closest('[data-save]');if(bookmark){save(bookmark.dataset.save);return;}const selectButton=e.target.closest('[data-select]');if(selectButton)select(selectButton.dataset.select,{focusMap:true,autoPlay:true});});
  $('categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;state.category=b.dataset.category;syncFilters();render();fitMap();});
  $('search').addEventListener('input',e=>{state.query=e.target.value;if(state.query.trim())setListCollapsed(false);render();});
  [...new Set(cameras.map(c=>c.region))].sort((a,b)=>a.localeCompare(b,'en')).forEach(region=>{const option=document.createElement('option');option.value=region;option.textContent=region;$('region').appendChild(option);});
  $('media-kind').addEventListener('change',e=>{state.kind=e.target.value;render();fitMap();});
  $('region').addEventListener('change',e=>{state.region=e.target.value;render();fitMap();});
  $('explore-tab').addEventListener('click',()=>{state.savedOnly=false;setListCollapsed(false);syncFilters();render();fitMap();});
  $('saved-tab').addEventListener('click',()=>{setListCollapsed(false);state.savedOnly=true;state.category='all';state.region='all';state.kind='all';$('media-kind').value='all';state.query='';$('region').value='all';$('search').value='';syncFilters();render();fitMap();});
  $('reset-filters').addEventListener('click',reset);$('random-button').addEventListener('click',random);$('play-button').addEventListener('click',startVideo);$('retry-video').addEventListener('click',startVideo);$('continue-video').addEventListener('click',startVideo);$('close-viewer').addEventListener('click',closeViewer);$('viewer-save').addEventListener('click',()=>{if(state.selected)save(state.selected.id);});
  $('reload-page').addEventListener('click',()=>location.reload());
  $('zoom-in').addEventListener('click',()=>map?.zoomIn());$('zoom-out').addEventListener('click',()=>map?.zoomOut());$('fit-map').addEventListener('click',()=>fitMap());
  $('list-toggle').addEventListener('click',()=>setListCollapsed(!document.body.classList.contains('list-collapsed')));
  document.querySelector('.skip-link')?.addEventListener('click',event=>{event.preventDefault();setListCollapsed(false);$('camera-list').focus({preventScroll:true});});
  $('share-button').addEventListener('click',async()=>{if(!state.selected)return;const url=new URL(location.href);url.hash='cam='+encodeURIComponent(state.selected.id);try{await navigator.clipboard.writeText(url.href);toast('Link copied');}catch{$('share-url').value=url.href;$('share-dialog').showModal();$('share-url').select();}});
  $('close-share').addEventListener('click',()=>$('share-dialog').close());
  $('share-dialog').addEventListener('close',()=>{if(!$('viewer').hidden)$('share-button').focus({preventScroll:true});});
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();closeViewer({restoreFocus:false});state.selected=null;const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);setListCollapsed(compactViewport.matches);reset();});
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return;
    if($('viewer').getAttribute('aria-modal')==='true'){
      if(e.key==='Escape'){e.preventDefault();closeViewer();}
      else if(e.key==='Tab'){
        const focusable=[...$('viewer').querySelectorAll('button,a[href],input,iframe,[tabindex]')].filter(element=>!element.disabled&&element.tabIndex>=0&&element.getClientRects().length);
        const first=focusable[0],last=focusable.at(-1),active=document.activeElement;
        if(first&&((e.shiftKey&&active===first)||(!e.shiftKey&&active===last)||!$('viewer').contains(active))){e.preventDefault();(e.shiftKey?last:first).focus();}
      }
      return;
    }
    if(e.target.matches('input,textarea,select'))return;
    if(e.key==='/'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();$('search').focus();}
    else if(e.key.toLowerCase()==='r'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey)random();
    else if(e.key==='Escape')closeViewer();
  });
  addEventListener('hashchange',()=>{const id=new URLSearchParams(location.hash.slice(1)).get('cam');if(knownIds.has(id)){reset();select(id,{focusMap:true,writeHash:false,focusViewer:true});}});
  addEventListener('storage',e=>{if(e.key!==storageKey)return;try{const values=JSON.parse(e.newValue||'[]');favorites=new Set(Array.isArray(values)?values.filter(id=>knownIds.has(id)):[]);render();}catch{}});
  $('viewer').hidden=true;initMap();const requested=new URLSearchParams(location.hash.slice(1)).get('cam');const validRequest=knownIds.has(requested);if(validRequest)select(requested,{focusMap:true,writeHash:false,focusViewer:compactViewport.matches});else{render();syncViewerMode();}
})();
