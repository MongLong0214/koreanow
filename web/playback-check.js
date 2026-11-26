(() => {
  'use strict';
  const $=id=>document.getElementById(id), catalog=window.KOREA_CAMERAS||[];
  const KEY='jigeum-korea:playback-check:v1:'+((new URLSearchParams(location.search).get('qa-session')||'default').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40)), DB='jigeum-korea-playback-frames', CHECKPOINT_DB='jigeum-korea-playback-checkpoints-v1', SAMPLE_MS=500;
  const COLUMNS=['atMs','elapsedMs','currentTime','readyState','networkState','width','height','paused','ended','mediaErrorCode','frameCallbacks','presentedFrames','lastFrameMediaTime','totalVideoFrames','droppedVideoFrames','webkitDecodedFrames','appState','pageVisibility','appVisibility','videoVisible','iframeVisible','videoRect','iframeRect','buffered','appError','providerLimit'];
  const APP_LAYOUT='#viewer:not([hidden]){position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:auto!important;max-height:100dvh!important;margin:0!important;border-radius:0!important;animation:none!important}#viewer .viewer-topline{height:32px!important}#viewer .video-stage{height:clamp(200px,calc(100dvh - 76px),270px)!important;max-height:none!important}html,body{scroll-behavior:auto!important}';
  let run=null, controller=null, starting=false, restoring=true, saving=null, saveAgain=false, lastSaveAt=0, dbPromise, checkpointDbPromise, slots=[];
  const checkpointParents=new Map(), checkpointWriterId=crypto.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const iso=()=>new Date().toISOString(), number=value=>Number.isFinite(value)?value:null;
  const message=(text,error=false)=>{$('message').textContent=text;$('message').dataset.error=String(error);};
  const sleep=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('Stopped','AbortError'));return;}const done=()=>{signal?.removeEventListener('abort',abort);resolve();}, timer=setTimeout(done,ms), abort=()=>{clearTimeout(timer);reject(new DOMException('Stopped','AbortError'));};signal?.addEventListener('abort',abort,{once:true});});
  const compactRect=r=>r?[r.left,r.top,r.width,r.height].map(v=>Math.round(v*10)/10):null;
  const inBounds=(r,w,h)=>!!r&&r.width>0&&r.height>0&&r.left>=-1&&r.top>=-1&&r.right<=w+1&&r.bottom<=h+1;
  const sha=async value=>{if(!crypto.subtle)return null;const bytes=typeof value==='string'?new TextEncoder().encode(value):value;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');};
  const cameraMeta=c=>({...Object.fromEntries(['id','name','region','kind','provider','providerType','sourceId','videoId','sourceUrl','streamUrl','embedUrl','sessionLimitSeconds','sessionLimitReason','videoMode'].map(k=>[k,c[k]??null])),proxy:c.proxy===true});
  const targetFor=c=>c.providerType==='yongpyong'?12:c.providerType==='changwon'?17:c.providerType==='high1'?20:25;
  const filteredCatalog=()=>catalog.filter(c=>$('kind').value==='all'||(c.kind||'youtube')===$('kind').value);
  function parseCameraSelection(all,{kind,explicitIds='',startId,endId}){
    const explicit=explicitIds.trim().length>0;
    let cameras;
    if(explicit){
      const ids=explicitIds.trim().split(/[\s,]+/).filter(Boolean),byId=new Map(all.map(c=>[c.id,c])),seen=new Set();
      if(!ids.length)throw new Error('카메라 ID를 입력해 주세요.');
      cameras=ids.map(id=>{
        if(seen.has(id))throw new Error('중복된 카메라 ID: '+id);
        seen.add(id);
        const camera=byId.get(id);
        if(!camera)throw new Error('카탈로그에 없는 카메라 ID: '+id);
        if(kind!=='all'&&(camera.kind||'youtube')!==kind)throw new Error('선택한 제공 방식과 다른 카메라 ID: '+id);
        return camera;
      });
    }else{
      const list=all.filter(c=>kind==='all'||(c.kind||'youtube')===kind),a=list.findIndex(c=>c.id===startId),b=list.findIndex(c=>c.id===endId);
      if(a<0||b<a)throw new Error('시작 ID와 끝 ID의 목록 순서를 확인해 주세요.');
      cameras=list.slice(a,b+1);
    }
    return {mode:explicit?'explicit_ids':'range',kind,ids:cameras.map(c=>c.id),cameras};
  }
  function validateResumeSelection(saved,current){
    const original=saved.selection,ids=original?.ids??saved.cameras.map(c=>c.id),mode=original?.mode??'range';
    if(!Array.isArray(ids)||ids.length!==saved.cameras.length||ids.some((id,i)=>id!==saved.cameras[i].id))throw new Error('저장된 ID 목록과 검사 기록이 일치하지 않습니다. JSON을 보존하고 새 검사를 시작해 주세요.');
    if(mode!==current.mode||original?.kind!==current.kind||ids.length!==current.ids.length||ids.some((id,i)=>id!==current.ids[i]))throw new Error('저장된 검사와 ID 목록·순서 또는 제공 방식이 다릅니다. 원래 선택으로 되돌리거나 새 검사를 시작해 주세요.');
  }
  function selectedCameras(){return parseCameraSelection(catalog,{kind:$('kind').value,explicitIds:$('explicit-ids').value,startId:$('start-id').value,endId:$('end-id').value});}
  function updateSelectionUi(busy=!!(controller||starting||restoring)){
    const explicit=$('explicit-ids').value.trim().length>0;
    for(const id of ['start-id','end-id'])$(id).disabled=busy||explicit;
    try{const selected=selectedCameras();$('selection-note').textContent=(explicit?'입력한 순서대로 '+selected.ids.length+'개를 검사합니다.':'시작 ID부터 끝 ID까지 '+selected.ids.length+'개를 검사합니다.')+' 저장 검사를 이어갈 때는 원래 선택을 유지해 주세요.';$('explicit-ids').removeAttribute('aria-invalid');}
    catch(error){$('selection-note').textContent=error.message;if(explicit)$('explicit-ids').setAttribute('aria-invalid','true');else $('explicit-ids').removeAttribute('aria-invalid');}
  }
  function fillRange(){const list=filteredCatalog();for(const id of ['start-id','end-id']){$(id).replaceChildren(...list.map(c=>new Option(c.id+' · '+c.name,c.id)));}if(list.length)$('end-id').value=list.at(-1).id;$('catalog-count').textContent='· 카탈로그 '+catalog.length+'개';updateSelectionUi();}
  function restoreSelectionUi(value){const selected=value.selection,ids=selected?.ids??value.cameras.map(c=>c.id);$('kind').value=selected?.kind||'all';fillRange();$('explicit-ids').value=selected?.mode==='explicit_ids'?ids.join('\n'):'';$('start-id').value=selected?.startId??ids[0];$('end-id').value=selected?.endId??ids.at(-1);$('concurrency').value=String(selected?.requestedConcurrency||1);updateSelectionUi();}
  function openDb(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('frames');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return dbPromise;}
  async function frameStore(key,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('frames',value===undefined?'readonly':'readwrite'),store=tx.objectStore('frames'),req=value===undefined?store.get(key):store.put(value,key);let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  function frameStorageKey(runId,attempt,phase){
    if(typeof runId!=='string'||!runId||typeof attempt.attemptId!=='string'||!attempt.attemptId)throw new Error('frame_attempt_identity_missing');
    return 'v2:'+JSON.stringify([runId,attempt.id,attempt.round,attempt.attemptId,phase]);
  }
  function openCheckpointDb(){
    // A separate database leaves existing frame transactions and open QA tabs alone.
    if(!checkpointDbPromise)checkpointDbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(CHECKPOINT_DB,1);let abandoned=false;
      request.onupgradeneeded=()=>{const store=request.result.createObjectStore('runs',{keyPath:['sessionKey','runId']});store.createIndex('sessionKey','sessionKey',{unique:false});};
      request.onsuccess=()=>{if(abandoned){request.result.close();return;}request.result.onversionchange=()=>{request.result.close();checkpointDbPromise=null;};resolve(request.result);};
      request.onerror=()=>reject(request.error||new Error('checkpoint_database_open_failed'));
      request.onblocked=()=>{abandoned=true;reject(new Error('checkpoint_database_blocked'));};
    }).catch(error=>{checkpointDbPromise=null;throw error;});
    return checkpointDbPromise;
  }
  async function checkpointStore(sessionKey,value,expectedSnapshotSha256){
    const db=await openCheckpointDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('runs',value===undefined?'readonly':'readwrite'),store=tx.objectStore('runs');
      let result,conflict=null;
      if(value===undefined){const request=store.index('sessionKey').getAll(sessionKey);request.onsuccess=()=>{result=request.result;};}
      else{
        const previous=store.get([sessionKey,value.runId]);
        previous.onsuccess=()=>{
          const current=previous.result,currentHash=current?.snapshotSha256??null;
          if(expectedSnapshotSha256===undefined||(currentHash!==expectedSnapshotSha256&&currentHash!==value.snapshotSha256)||current&&Date.parse(current.checkpointAt)>Date.parse(value.checkpointAt)){
            conflict=new Error('checkpoint_write_conflict_or_clock_regression');conflict.name='CheckpointConflictError';tx.abort();return;
          }
          const request=store.put(value);request.onsuccess=()=>{result=request.result;};
        };
      }
      // Request success alone does not prove the write committed.
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(conflict||tx.error||new Error('checkpoint_transaction_failed'));
      tx.onabort=()=>reject(conflict||tx.error||new Error('checkpoint_transaction_aborted'));
    });
  }
  async function encodeCheckpoint(value){const text=JSON.stringify(value);if(typeof CompressionStream==='undefined')return {encoding:'json',data:text};const bytes=new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {encoding:'gzip-base64',data:btoa(binary)};}
  async function decodeCheckpoint(payload){
    if(!payload||typeof payload.data!=='string'||!['json','gzip-base64'].includes(payload.encoding))throw new Error('checkpoint_encoding_invalid');
    let text=payload.data;
    if(payload.encoding==='gzip-base64'){const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();}
    return JSON.parse(text);
  }
  function validateCheckpointValue(value,legacy=false){
    if(!value||value.schemaVersion!==1||typeof value.runId!=='string'||!value.runId||!Array.isArray(value.cameras)||!value.cameras.length||!Array.isArray(value.attempts)||typeof value.checkpointAt!=='string'||!Number.isFinite(Date.parse(value.checkpointAt)))throw new Error('checkpoint_run_incomplete');
    if(!legacy&&(!Array.isArray(value.activeAttempts)||!Array.isArray(value.interruptedAttempts)||!Array.isArray(value.sampleColumns)||!value.sampleColumns.length||!value.visualReviews||typeof value.visualReviews!=='object'||Array.isArray(value.visualReviews)||!['running','paused','completed','inconclusive'].includes(value.status)))throw new Error('checkpoint_run_incomplete');
    for(const key of ['activeAttempts','interruptedAttempts'])if(value[key]!==undefined&&!Array.isArray(value[key]))throw new Error('checkpoint_attempts_invalid');
    return value;
  }
  async function checkpointEnvelope(value){
    validateCheckpointValue(value);
    const payload=await encodeCheckpoint(value),snapshotSha256=await sha(JSON.stringify(value));
    if(typeof snapshotSha256!=='string'||snapshotSha256.length!==64)throw new Error('checkpoint_hash_unavailable');
    return {schemaVersion:1,sessionKey:KEY,runId:value.runId,checkpointAt:value.checkpointAt,writerId:checkpointWriterId,snapshotSha256,payload};
  }
  async function readCheckpointEnvelope(envelope,backend,legacy=false){
    if(legacy){const value=validateCheckpointValue(await decodeCheckpoint(envelope),true);return {value,backend,snapshotSha256:await sha(JSON.stringify(value)),checkpointAt:value.checkpointAt};}
    if(!envelope||envelope.schemaVersion!==1||envelope.sessionKey!==KEY||typeof envelope.snapshotSha256!=='string'||!/^[a-f0-9]{64}$/.test(envelope.snapshotSha256))throw new Error('checkpoint_envelope_invalid');
    const value=validateCheckpointValue(await decodeCheckpoint(envelope.payload));
    if(value.runId!==envelope.runId||value.checkpointAt!==envelope.checkpointAt||await sha(JSON.stringify(value))!==envelope.snapshotSha256)throw new Error('checkpoint_envelope_mismatch');
    return {value,backend,snapshotSha256:envelope.snapshotSha256,checkpointAt:value.checkpointAt};
  }
  function latestCheckpoint(candidates){
    if(!candidates.length)return null;
    for(const candidate of candidates)if(!candidate||!Number.isFinite(Date.parse(candidate.checkpointAt))||typeof candidate.value?.runId!=='string'||!candidate.snapshotSha256)throw new Error('checkpoint_candidate_invalid');
    const newest=Math.max(...candidates.map(x=>Date.parse(x.checkpointAt))),matches=candidates.filter(x=>Date.parse(x.checkpointAt)===newest);
    if(matches.some(x=>x.value.runId!==matches[0].value.runId||x.snapshotSha256!==matches[0].snapshotSha256))throw new Error('checkpoint_newest_ambiguous');
    const selected=matches.find(x=>x.backend==='indexeddb')||matches[0];
    // Concurrent tabs must not silently replace a sibling history of the same run.
    for(const older of candidates.filter(x=>x.value.runId===selected.value.runId)){
      for(const key of ['startedAt','origin','catalogSha256','appSha256','hlsBundleSha256','collectorSha256','cameras','sampleColumns'])if(JSON.stringify(older.value[key])!==JSON.stringify(selected.value[key]))throw new Error('checkpoint_same_run_identity_conflict');
      const all=[...selected.value.attempts,...(selected.value.interruptedAttempts||[]),...(selected.value.activeAttempts||[])];
      for(const previous of [...older.value.attempts,...(older.value.interruptedAttempts||[])]){
        const current=[...selected.value.attempts,...(selected.value.interruptedAttempts||[])].find(a=>a.attemptId===previous.attemptId);
        if(!current||JSON.stringify(current)!==JSON.stringify(previous))throw new Error('checkpoint_histories_conflict');
      }
      for(const previous of older.value.activeAttempts||[]){const current=all.find(a=>a.attemptId===previous.attemptId);if(!current||JSON.stringify((current.samples||[]).slice(0,(previous.samples||[]).length))!==JSON.stringify(previous.samples||[]))throw new Error('checkpoint_histories_conflict');}
    }
    return selected;
  }
  async function writeCheckpoint(value){
    const envelope=await checkpointEnvelope(value);
    const expected=checkpointParents.has(value.runId)?checkpointParents.get(value.runId):null;
    try{await checkpointStore(KEY,envelope,expected);checkpointParents.set(value.runId,envelope.snapshotSha256);return {backend:'indexeddb'};}
    catch(error){
      if(error.name==='CheckpointConflictError')throw error;
      // Legacy KEY is read-only. Per-run/writer fallback also preserves sibling tabs.
      try{localStorage.setItem(KEY+':checkpoint:'+value.runId+':'+checkpointWriterId,JSON.stringify(envelope));}
      catch(fallbackError){throw new Error('indexeddb: '+error.message+'; localStorage: '+fallbackError.message);}
      return {backend:'localStorage-per-run',primaryError:error.message};
    }
  }
  async function readStoredCheckpoints(){
    const candidates=[],warnings=[];let idbRead=false;
    try{for(const envelope of await checkpointStore(KEY)){try{const candidate=await readCheckpointEnvelope(envelope,'indexeddb');candidates.push(candidate);checkpointParents.set(candidate.value.runId,candidate.snapshotSha256);}catch(error){warnings.push('indexeddb ['+(envelope?.runId||'unknown')+']:'+error.message);}}idbRead=true;}
    catch(error){warnings.push('indexeddb:'+error.message);}
    try{
      const keys=[KEY];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(KEY+':checkpoint:'))keys.push(key);}
      for(const key of keys){try{const raw=localStorage.getItem(key);if(raw)candidates.push(await readCheckpointEnvelope(JSON.parse(raw),key===KEY?'localStorage-legacy':'localStorage-per-run',key===KEY));}catch(error){warnings.push('localStorage:'+error.message);}}
    }catch(error){warnings.push('localStorage:'+error.message);}
    const selected=latestCheckpoint(candidates);
    if(selected&&!checkpointParents.has(selected.value.runId))checkpointParents.set(selected.value.runId,idbRead?null:undefined);
    return {selected,warnings};
  }
  function save(){
    if(!run)return Promise.resolve();saveAgain=true;if(saving)return saving;
    saving=(async()=>{while(saveAgain){saveAgain=false;try{
      run.checkpointAt=iso();const plain=JSON.parse(JSON.stringify(run));
      for(const a of [...plain.attempts,...plain.activeAttempts,...plain.interruptedAttempts])for(const f of a.frames||[])if(f.storageKey)delete f.dataUrl;
      const stored=await writeCheckpoint(plain);lastSaveAt=Date.now();
      $('storage-note').textContent='자동 저장 '+new Date(lastSaveAt).toLocaleTimeString()+' · '+(stored.backend==='indexeddb'?'별도 검사 저장소':'대체 검사 저장소')+'에 원시 기록과 캡처를 보존합니다. JSON에는 캡처를 함께 담습니다.'+(stored.primaryError?' 기본 저장소 실패: '+stored.primaryError:'');
      $('storage-note').dataset.error=String(!!stored.primaryError);
    }catch(error){$('storage-note').textContent='자동 저장 실패: '+error.message+' · 중지 후 JSON을 다운로드해 기록을 보존해 주세요.';$('storage-note').dataset.error='true';if(error.name==='CheckpointConflictError')stop('checkpoint_write_conflict');}}})().finally(()=>{saving=null;});
    return saving;
  }
  function markRoundCompleted(value,round,at){value.roundCompletedAt||={};if(!Object.prototype.hasOwnProperty.call(value.roundCompletedAt,round))value.roundCompletedAt[round]=at;}
  function validateResumeEnvironment(value,observed){
    for(const key of ['appSha256','hlsBundleSha256','collectorSha256'])if(typeof value[key]!=='string'||!/^[a-f0-9]{64}$/.test(value[key])||observed[key]!==value[key])throw new Error('저장 이후 앱·플레이어·검사기 버전이 달라 이어갈 수 없습니다 ('+key+'). 기존 JSON을 보존하고 별도 검사를 시작해 주세요.');
  }
  async function restore(){try{
    const {selected,warnings}=await readStoredCheckpoints();if(!selected){if(warnings.length)message('이전 기록 복구 확인: '+warnings.join(' · '),true);return;}
    run=selected.value;run.interruptedAttempts||=[];
    for(const a of run.activeAttempts||[]){a.verdict='interrupted';a.endedAt=iso();a.reason='page_reloaded_before_attempt_completed';run.interruptedAttempts.push(a);}
    run.activeAttempts=[];run.recoveredFromCheckpointAt=run.checkpointAt;
    run.checkpointRecovery={backend:selected.backend,checkpointAt:run.checkpointAt,snapshotSha256:selected.snapshotSha256,warnings};
    if(run.status!=='completed')run.status='paused';$('resume').hidden=run.status==='completed';$('download').disabled=false;restoreSelectionUi(run);renderResults();updateProgress();
    message('저장된 검사를 찾았습니다. 이어서 시작하거나 JSON을 다운로드할 수 있습니다.'+(warnings.length?' 일부 저장소 확인 실패: '+warnings.join(' · '):''),warnings.length>0);
  }catch(error){message('이전 기록 복구 실패: '+error.message,true);}}
  function verdictFor(c){if(run.environmentChanged)return ['inconclusive','실행 중 앱 변경'];const attempts=run.attempts.filter(a=>a.id===c.id),review=run.visualReviews[c.id];if(review?.status==='rejected')return ['fail','화면 검토 제외'];if(attempts.some(a=>a.verdict==='fail'))return ['fail','재생 미통과'];if(attempts.some(a=>a.verdict==='manual_required'))return ['manual','수동 검증 필요'];if(attempts.length<2)return ['pending','미완료'];if(attempts.some(a=>a.verdict!=='playback_pass'))return ['inconclusive','추가 검증 필요'];if(review?.status!=='confirmed')return ['review','화면 확인 필요'];return ['pass','최종 통과'];}
  const attemptLabel=a=>!a?'대기':({playback_pass:'재생 조건 통과',fail:'미통과',manual_required:'수동 검증',inconclusive:'확인 불가',interrupted:'중단',running:'측정 중'}[a.verdict]||a.verdict);
  function renderResults(){if(!run)return;$('rows').replaceChildren(...run.cameras.map(c=>{const tr=document.createElement('tr');const name=document.createElement('td');name.textContent=c.name;const id=document.createElement('small');id.textContent=c.id;name.append(id);tr.append(name);const attempts=run.attempts.filter(a=>a.id===c.id);for(const round of [1,2]){const a=attempts.find(a=>a.round===round)||run.activeAttempts.find(a=>a.id===c.id&&a.round===round),td=document.createElement('td');td.textContent=attemptLabel(a);if(a){const note=document.createElement('small');note.textContent=a.reason||(a.metrics?'진행 '+a.metrics.verifiedProgressSeconds.toFixed(1)+'초 · 시작 '+(a.metrics.firstFrameMs===null?'—':(a.metrics.firstFrameMs/1000).toFixed(1)+'초'):'');td.append(note);}tr.append(td);}const pics=document.createElement('td');pics.className='optional';const box=document.createElement('div');box.className='thumbs';const frames=attempts.flatMap(a=>(a.frames||[]).map(f=>({...f,round:a.round})));for(const f of frames){if(f.dataUrl||f.storageKey){const link=document.createElement('a'),img=new Image();img.alt=c.name+' '+f.round+'회차 '+(f.phase==='early'?'초반':'마지막')+' 실제 영상 캡처';img.loading='lazy';link.target='_blank';link.rel='noopener';const apply=data=>{if(!data)return;img.src=data;link.href=data;};if(f.dataUrl)apply(f.dataUrl);else frameStore(f.storageKey).then(apply).catch(()=>{});link.append(img);box.append(link);}else{const note=document.createElement('span');note.textContent=f.reason||'캡처 없음';box.append(note);}}pics.append(box);tr.append(pics);const reviewCell=document.createElement('td'),review=document.createElement('select');review.className='review';review.setAttribute('aria-label',c.name+' 화면 검토');for(const [v,t] of [['pending','화면 미확인'],['confirmed','현장 영상 확인'],['rejected','자료·단색·정지 제외']])review.add(new Option(t,v));review.value=run.visualReviews[c.id]?.status||'pending';review.disabled=attempts.length<2;review.addEventListener('change',()=>{run.visualReviews[c.id]={status:review.value,reviewedAt:iso(),method:'operator_review'};save();renderResults();updateProgress();});reviewCell.append(review);tr.append(reviewCell);const end=document.createElement('td'),[state,label]=verdictFor(c);end.className='status';end.dataset.state=state;end.textContent=label;tr.append(end);return tr;}));}
  function updateProgress(){if(!run)return;const passed=run.cameras.filter(c=>verdictFor(c)[0]==='pass').length;$('progress').textContent=(run.currentRound||1)+'회차 · '+run.attempts.length+'/'+run.cameras.length*2+' 연결 기록 · 최종 통과 '+passed+'개';}
  function setBusy(busy){$('start').disabled=busy;$('resume').disabled=busy;$('stop').disabled=!busy;for(const id of ['kind','explicit-ids','concurrency'])$(id).disabled=busy;updateSelectionUi(busy);$('download').disabled=!run;}
  function makeSlots(count){$('stage').style.setProperty('--columns',count);slots=Array.from({length:count},()=>{const element=document.createElement('div');element.className='slot';const label=document.createElement('div');label.className='slot-label';const title=document.createElement('strong'),info=document.createElement('span');title.textContent='대기 중';label.append(title,info);element.append(label);return {element,title,info,iframe:null};});$('stage').replaceChildren(...slots.map(s=>s.element));}
  function availableSlots(){return Math.max(1,Math.min(3,Number($('concurrency').value),Math.floor(($('stage').clientWidth+10)/330)));}
  async function loadApp(slot,signal,camera){
    if(signal.aborted)throw new DOMException('Stopped','AbortError');
    const iframe=document.createElement('iframe');iframe.title='검증 중인 지금, 한국 실제 앱';iframe.allow='autoplay; fullscreen';iframe.referrerPolicy='strict-origin-when-cross-origin';slot.iframe=iframe;slot.element.append(iframe);
    const url=new URL('./',location.href);url.searchParams.set('playbackCheck',run.runId);if(new URL(location.href).searchParams.get('qa-candidates')==='1')url.searchParams.set('qa-candidates','1');
    const started=performance.now();let fullLoadObserved=false;
    const inspect=()=>{
      const d={expectedUrl:url.href,observedUrl:null,elapsedMs:performance.now()-started,readyState:null,cameraButtonCount:0,requestedCameraButtonFound:false,requiredControlsReady:false,cameraRuntimeReady:false,hlsReady:false,pendingImages:null,fullLoadObserved,observationError:null};
      try{const doc=iframe.contentDocument;d.observedUrl=doc?.URL??null;d.readyState=doc?.readyState??null;if(doc){d.cameraButtonCount=doc.querySelectorAll('[data-select]').length;d.requestedCameraButtonFound=!!doc.querySelector(camera?'[data-select="'+CSS.escape(camera.id)+'"]':'[data-select]');d.requiredControlsReady=!!(doc.getElementById('camera-list')&&doc.getElementById('player-mount')&&doc.getElementById('viewer')&&doc.getElementById('close-viewer'));d.cameraRuntimeReady=!!doc.getElementById('map')?.dataset?.camerasReadyAt;d.hlsReady=typeof iframe.contentWindow?.Hls?.isSupported==='function';d.pendingImages=Array.from(doc.images||[]).filter(image=>!image.complete).length;}}catch(error){d.observationError=error.name+': '+error.message;}
      slot.appLoadDiagnostic=d;return d;
    };
    await new Promise((resolve,reject)=>{
      let deadline,poll,settled=false;
      const clean=()=>{clearTimeout(deadline);clearInterval(poll);iframe.onload=null;iframe.onerror=null;signal.removeEventListener('abort',abort);};
      const finish=error=>{if(settled)return;settled=true;const d=inspect();d.outcome=error?error.message:'dom_ready';clean();if(error){error.appLoadDiagnostic=d;reject(error);}else resolve();};
      // SSR already contains anchors and controls. Wait for the app's camera
      // runtime (and delegated click handlers), not merely those initial nodes.
      // Production loads HLS only after selection; it must remain unpreloaded.
      const check=()=>{if(settled)return;const d=inspect();if(d.observedUrl===url.href&&['interactive','complete'].includes(d.readyState)&&d.requestedCameraButtonFound&&d.requiredControlsReady&&d.cameraRuntimeReady)finish();};
      const abort=()=>finish(new DOMException('Stopped','AbortError'));
      iframe.onload=()=>{if(iframe.contentDocument?.URL===url.href)fullLoadObserved=true;check();};iframe.onerror=()=>finish(new Error('app_iframe_load_failed'));
      deadline=setTimeout(()=>finish(new Error('app_iframe_load_timeout')),15000);poll=setInterval(check,50);signal.addEventListener('abort',abort,{once:true});iframe.src=url.href;check();
    });
    const doc=iframe.contentDocument;const style=doc.createElement('style');style.textContent=APP_LAYOUT;doc.head.append(style);doc.getElementById('close-viewer')?.click();await sleep(50,signal);return {iframe,doc};
  }
  function waitForPlayerVideo(doc,signal,timeoutMs){
    // The caller's click clock continues while the production loader runs.
    // Do not create media or load any script on the application's behalf.
    return new Promise((resolve,reject)=>{
      let observer,timer,settled=false;
      const finish=(video,error)=>{
        if(settled)return;settled=true;observer?.disconnect();clearTimeout(timer);
        signal.removeEventListener('abort',abort);
        if(error)reject(error);else resolve(video);
      };
      const inspect=()=>{const video=doc.querySelector('#player-mount > video');if(video)finish(video);};
      const abort=()=>finish(null,new DOMException('Stopped','AbortError'));
      if(signal.aborted){abort();return;}
      if(timeoutMs<=0){finish(null);return;}
      observer=new doc.defaultView.MutationObserver(inspect);
      observer.observe(doc.getElementById('player-mount'),{childList:true});
      signal.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>finish(null),timeoutMs);inspect();
    });
  }
  function selectedAppCamera(doc,camera,button){
    const selectedId=new URLSearchParams(new URL(doc.URL).hash.slice(1)).get('cam');
    const rowName=button.querySelector('h3')?.textContent??null;
    const viewerName=doc.getElementById('viewer-title')?.textContent??null;
    const selected=button.getAttribute('aria-current')==='true';
    const viewer=doc.getElementById('viewer');
    // Audit metadata may retain Korean names; production display names are
    // English. Bind the actual selected ID and row to its visible player.
    if(selectedId!==camera.id||!selected||!rowName||viewerName!==rowName||viewer?.hidden!==false||viewer.dataset.media!==camera.kind)
      throw new Error('actual_app_selected_camera_mismatch');
    return {id:selectedId,displayName:viewerName,selectedRow:true};
  }
  function instrumentNativeErrors(doc,attempt){
    // Capture before the app's target listener destroys a failed <video>.
    // Observe only: no preventDefault, recovery, pause, seek, or source changes.
    const listener=event=>{
      const video=event.target;
      if(attempt.observationEndedAt||video?.tagName!=='VIDEO'||video.parentElement?.id!=='player-mount')return;
      const atPerfMs=performance.now(),elapsedPerfMs=attempt.startedPerfMs===null?null:atPerfMs-attempt.startedPerfMs;
      let quality=null;try{quality=video.getVideoPlaybackQuality?.()||null;}catch{}
      const buffered=[];for(let i=0;i<video.buffered.length;i++)buffered.push([video.buffered.start(i),video.buffered.end(i)]);
      const observed={at:iso(),atPerfMs,elapsedPerfMs,perfClock:'parent_performance_now',code:video.error?.code??null,message:video.error?.message??null,currentTime:number(video.currentTime),readyState:video.readyState,networkState:video.networkState,width:video.videoWidth,height:video.videoHeight,paused:video.paused,ended:video.ended,totalVideoFrames:number(quality?.totalVideoFrames),droppedVideoFrames:number(quality?.droppedVideoFrames),webkitDecodedFrames:number(video.webkitDecodedFrameCount),buffered,pageVisibility:document.visibilityState,appVisibility:doc.visibilityState,appState:doc.getElementById('playback-status')?.dataset.state??null,firstPresentedElapsedPerfMs:attempt.frameTiming?.firstPresented?.elapsedPerfMs??null};
      if(attempt.nativeErrorEvents.length<20)attempt.nativeErrorEvents.push(observed);else attempt.nativeErrorEventsTruncated=true;
    };
    doc.addEventListener('error',listener,true);
    return ()=>doc.removeEventListener('error',listener,true);
  }
  // Diagnostic snapshots only. No loader wrapping, requests, seek, recovery, or
  // playback configuration changes are made by these observers.
  // BEGIN exact pure playing-frame-clock candidate body
const PLAYING_FRAME_CLOCK_POLICY='initial_paused_prefill_exclusion_v1_proposal';
const PLAYING_FRAME_CLOCK_EVENTS=new Set(['sample','rvfc','native-play','native-playing','native-pause','native-waiting','native-stalled','native-seeking','native-seeked','native-ended','observation-end']);
const frameClockNumber=value=>typeof value==='number'&&Number.isFinite(value);
const frameClockClone=value=>JSON.parse(JSON.stringify(value));

function createPlayingFrameClock({parentTimeOriginMs,startedPerfMs,registeredAtPerfMs,observationLimit=4096}){
  const state={schemaVersion:1,policy:PLAYING_FRAME_CLOCK_POLICY,clock:'parent_performance_now',
    parentTimeOriginMs,startedPerfMs,registeredAtPerfMs,observationLimit,observations:[],observationsTruncated:false,
    invalidReasons:[],firstPlayable:null,firstDecodedFrame:null,firstPlayingFrame:null,lastDecodedFrame:null,lastPlayingFrame:null,
    maxPostStartFrameSilenceMs:null,lastElapsedPerfMs:null,frameCallbackCount:0,lastPresentedFrames:null,
    observedPointCount:0,lastObservationIndex:null,ended:false};
  if(!frameClockNumber(parentTimeOriginMs)||parentTimeOriginMs<=0||!frameClockNumber(startedPerfMs)||startedPerfMs<0||
     !frameClockNumber(registeredAtPerfMs)||registeredAtPerfMs<0||registeredAtPerfMs>startedPerfMs)
    state.invalidReasons.push('invalid_parent_clock_or_registration');
  if(!Number.isInteger(observationLimit)||observationLimit<1||observationLimit>4096)state.invalidReasons.push('invalid_observation_limit');
  return state;
}

function observePlayingFrameClock(state,point){
  const reasons=[];
  const expectedObservationIndex=state.observedPointCount++;
  state.lastObservationIndex=point?.observationIndex??null;
  if(!Number.isInteger(point?.observationIndex)||point.observationIndex!==expectedObservationIndex)reasons.push('missing_or_reordered_observation');
  if(state.ended)reasons.push('observation_after_end');
  if(!point||!PLAYING_FRAME_CLOCK_EVENTS.has(point.event)||point.clock!=='parent_performance_now')reasons.push('invalid_event_or_clock');
  if(!frameClockNumber(point?.atPerfMs)||!frameClockNumber(point?.elapsedPerfMs)||point.elapsedPerfMs<0||
     Math.abs(point.atPerfMs-state.startedPerfMs-point.elapsedPerfMs)>0.001||
     state.lastElapsedPerfMs!==null&&point.elapsedPerfMs<state.lastElapsedPerfMs)reasons.push('invalid_or_regressing_monotonic_time');
  const native=point?.native;
  if(!native||!['paused','ended','seeking'].every(key=>typeof native[key]==='boolean')||
     !Number.isInteger(native.readyState)||native.readyState<0||native.readyState>4||
     !['width','height'].every(key=>Number.isInteger(native[key])&&native[key]>=0)||
     !frameClockNumber(native.currentTime)||native.currentTime<0||
     !(native.mediaErrorCode===null||Number.isInteger(native.mediaErrorCode)&&native.mediaErrorCode>=1&&native.mediaErrorCode<=4)||
     !['visible','hidden'].includes(native.pageVisibility)||!['visible','hidden'].includes(native.appVisibility))reasons.push('incomplete_native_snapshot');
  if(native?.mediaErrorCode!==null)reasons.push('native_media_error_or_missing_state');
  if(native?.pageVisibility!=='visible'||native?.appVisibility!=='visible')reasons.push('hidden_or_unobserved_page');
  if(['native-play','native-playing'].includes(point?.event)&&(native?.paused!==false||native?.ended!==false)||
     point?.event==='native-pause'&&native?.paused!==true||point?.event==='native-ended'&&native?.ended!==true||
     point?.event==='native-seeking'&&native?.seeking!==true||point?.event==='native-seeked'&&native?.seeking!==false)reasons.push('native_event_state_contradiction');
  if(point?.event==='native-playing'&&(!native||native.readyState<2||native.width<=0||native.height<=0))reasons.push('native_playing_without_playable_frame');
  const isFrame=point?.event==='rvfc';
  if(!Number.isInteger(point?.frameCallbackCount)||point.frameCallbackCount<0||point.frameCallbackCount!==state.frameCallbackCount+(isFrame?1:0))reasons.push('missing_or_reordered_frame_callback');
  if(isFrame&&(!point.frame||!frameClockNumber(point.frame.mediaTime)||point.frame.mediaTime<0||
     !Number.isInteger(point.frame.presentedFrames)||point.frame.presentedFrames<=0||
     state.lastPresentedFrames!==null&&point.frame.presentedFrames<=state.lastPresentedFrames))reasons.push('invalid_presented_frame_metadata');
  if(isFrame&&(!native||native.readyState<2||native.width<=0||native.height<=0))reasons.push('decoded_callback_without_native_frame');
  if(!isFrame&&point?.frame!==null)reasons.push('non_callback_has_frame_metadata');
  if(state.observations.length>=state.observationLimit){state.observationsTruncated=true;reasons.push('observation_journal_truncated');}
  else state.observations.push(frameClockClone(point??null));
  for(const reason of reasons)if(!state.invalidReasons.includes(reason))state.invalidReasons.push(reason);
  if(reasons.length)return state;

  state.lastElapsedPerfMs=point.elapsedPerfMs;
  const observationIndex=state.observations.length-1;
  const boundary={observationIndex,atPerfMs:point.atPerfMs,elapsedPerfMs:point.elapsedPerfMs,event:point.event};
  const playable=!native.paused&&!native.ended&&native.readyState>=2&&native.width>0&&native.height>0;
  if(state.firstPlayable===null&&playable){
    state.firstPlayable={...boundary,native:frameClockClone(native)};
    state.maxPostStartFrameSilenceMs=0;
  }

  // Evaluate the entire gap BEFORE a newly presented frame refreshes the anchor.
  // The first boundary is never cleared by a later pause, wait, seek, or ended event.
  if(state.firstPlayable!==null){
    const anchor=Math.max(state.firstPlayable.elapsedPerfMs,state.lastPlayingFrame?.elapsedPerfMs??state.firstPlayable.elapsedPerfMs);
    state.maxPostStartFrameSilenceMs=Math.max(state.maxPostStartFrameSilenceMs,point.elapsedPerfMs-anchor);
  }
  if(isFrame){
    state.frameCallbackCount=point.frameCallbackCount;state.lastPresentedFrames=point.frame.presentedFrames;
    const decoded={...boundary,frameCallbackCount:point.frameCallbackCount,...frameClockClone(point.frame),native:frameClockClone(native)};
    state.firstDecodedFrame??=decoded;state.lastDecodedFrame=decoded;
    if(playable){state.firstPlayingFrame??=decoded;state.lastPlayingFrame=decoded;}
    else if(!native.paused&&!native.ended&&!state.invalidReasons.includes('unpaused_callback_without_playable_native_state'))state.invalidReasons.push('unpaused_callback_without_playable_native_state');
  }
  if(point.event==='observation-end')state.ended=true;
  return state;
}

function summarizePlayingFrameClock(state){
  const reasons=[...state.invalidReasons];
  if(state.observationsTruncated&&!reasons.includes('observation_journal_truncated'))reasons.push('observation_journal_truncated');
  if(!state.ended)reasons.push('observation_end_missing');
  if(state.firstPlayable===null)reasons.push('playable_boundary_missing');
  if(state.firstDecodedFrame===null||state.firstPlayingFrame===null)reasons.push('presented_playing_frame_missing');
  return frameClockClone({schemaVersion:state.schemaVersion,policy:state.policy,clock:state.clock,
    usable:reasons.length===0,certifiesPlayback:false,reasons,observationCount:state.observations.length,
    observedPointCount:state.observedPointCount,lastObservationIndex:state.lastObservationIndex,
    observationsTruncated:state.observationsTruncated,frameCallbackCount:state.frameCallbackCount,
    firstPlayable:state.firstPlayable,firstDecodedFrame:state.firstDecodedFrame,firstPlayingFrame:state.firstPlayingFrame,
    lastDecodedFrame:state.lastDecodedFrame,lastPlayingFrame:state.lastPlayingFrame,maxPostStartFrameSilenceMs:state.maxPostStartFrameSilenceMs,
    frameSilenceAtLeastTwoSeconds:state.maxPostStartFrameSilenceMs!==null&&state.maxPostStartFrameSilenceMs>=2000});
}

function replayPlayingFrameClock(evidence){
  if(!evidence||evidence.schemaVersion!==1||evidence.policy!==PLAYING_FRAME_CLOCK_POLICY||evidence.clock!=='parent_performance_now'||
     !Array.isArray(evidence.observations)||typeof evidence.observationsTruncated!=='boolean'||
     !Number.isInteger(evidence.observedPointCount)||evidence.observedPointCount<1||
     !Number.isInteger(evidence.lastObservationIndex)||evidence.lastObservationIndex!==evidence.observedPointCount-1)
    return {usable:false,certifiesPlayback:false,reasons:['required_new_frame_clock_evidence_missing']};
  const state=createPlayingFrameClock(evidence);
  for(const point of evidence.observations)observePlayingFrameClock(state,point);
  if(evidence.observationsTruncated)state.observationsTruncated=true;
  if(state.observedPointCount!==evidence.observedPointCount||state.lastObservationIndex!==evidence.lastObservationIndex)state.invalidReasons.push('final_observation_count_mismatch');
  return summarizePlayingFrameClock(state);
}

  // END exact pure playing-frame-clock candidate body
  function playingFrameNative(native){return Object.fromEntries(['paused','ended','seeking','readyState','width','height','currentTime','mediaErrorCode','pageVisibility','appVisibility'].map(key=>[key,native?.[key]??null]));}
  function recordPlayingFramePoint(attempt,event,atPerfMs,native,frame=null,reference={}){
    if(!attempt.playingFrameClock)return;
    const point={event,observationIndex:attempt.playingFrameClockObservationCount++,clock:'parent_performance_now',atPerfMs,
      elapsedPerfMs:atPerfMs-attempt.startedPerfMs,frameCallbackCount:attempt.frameTiming.presentedCallbackCount,
      frame,native:playingFrameNative(native),...reference};
    observePlayingFrameClock(attempt.playingFrameClock,point);
    attempt.metrics.maxPlayingFrameSilenceMs=attempt.playingFrameClock.maxPostStartFrameSilenceMs;
  }
  function instrumentPlayingFrameClock(doc,attempt){
    const names=['play','playing','pause','waiting','stalled','seeking','seeked','ended'];
    attempt.playingFrameClockInstrumentation={schemaVersion:1,phase:'document_capture',clock:'parent_performance_now',
      registeredAtPerfMs:performance.now(),registeredBeforeSelection:attempt.startedPerfMs===null,nativeEventNames:names};
    let lastOriginalNativeIndex=-1;
    const listener=event=>{
      const video=event.target;
      if(attempt.observationEndedAt||!attempt.playingFrameClock||video?.tagName!=='VIDEO'||video.parentElement?.id!=='player-mount')return;
      let observed,nativePlaybackEventIndex=null;
      if(event.type!=='play'){
        const index=attempt.nativePlaybackEvents.length-1,original=attempt.nativePlaybackEvents[index];
        if(index>lastOriginalNativeIndex&&original?.event===event.type&&original.captureOnDocument&&original.eventPhase===1&&!attempt.nativePlaybackEventsTruncated){
          observed=original;nativePlaybackEventIndex=index;lastOriginalNativeIndex=index;
        }else if(!attempt.playingFrameClock.invalidReasons.includes('native_event_binding_failed'))attempt.playingFrameClock.invalidReasons.push('native_event_binding_failed');
      }
      if(!observed){const atPerfMs=performance.now();observed={event:event.type,atPerfMs,elapsedPerfMs:atPerfMs-attempt.startedPerfMs,perfClock:'parent_performance_now',
        eventPhase:event.eventPhase,captureOnDocument:event.currentTarget===doc,nativeAtEvent:causeNative(video,doc),frameCallbackCount:attempt.frameTiming.presentedCallbackCount};}
      const nativeEventIndex=attempt.playingFrameNativeEventCount++;
      const retained={...observed,nativePlaybackEventIndex,nativeEventIndex};
      if(attempt.playingFrameNativeEvents.length<200)attempt.playingFrameNativeEvents.push(retained);
      else{attempt.playingFrameNativeEventsTruncated=true;if(!attempt.playingFrameClock.invalidReasons.includes('native_event_journal_truncated'))attempt.playingFrameClock.invalidReasons.push('native_event_journal_truncated');}
      if(event.eventPhase!==1||event.currentTarget!==doc){if(!attempt.playingFrameClock.invalidReasons.includes('native_capture_phase_missing'))attempt.playingFrameClock.invalidReasons.push('native_capture_phase_missing');}
      recordPlayingFramePoint(attempt,'native-'+event.type,observed.atPerfMs,observed.nativeAtEvent,null,{nativeEventIndex,nativePlaybackEventIndex});
    };
    for(const name of names)doc.addEventListener(name,listener,true);
    return ()=>{for(const name of names)doc.removeEventListener(name,listener,true);};
  }
  function playingFrameBindingErrors(attempt){
    const errors=[],state=attempt.playingFrameClock,points=state?.observations||[],timing=attempt.frameTiming,instrumentation=attempt.playingFrameClockInstrumentation;
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),near=(a,b)=>typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=.001;
    if(!state||state.parentTimeOriginMs!==timing?.parentTimeOriginMs||state.startedPerfMs!==attempt.startedPerfMs||
       state.registeredAtPerfMs!==instrumentation?.registeredAtPerfMs||instrumentation?.phase!=='document_capture'||instrumentation?.registeredBeforeSelection!==true)
      errors.push('attempt_clock_registration_binding_failed');
    if(state?.observedPointCount!==attempt.playingFrameClockObservationCount||state?.observedPointCount!==attempt.playingFrameClockFinalObservationCount||points.length!==state?.observedPointCount)
      errors.push('capture_observation_count_mismatch');
    const samples=points.filter(p=>p.event==='sample');
    if(samples.length!==attempt.samples.length||samples.length!==attempt.playingFrameClockSampleCount)errors.push('sample_coverage_mismatch');
    for(let i=0;i<samples.length;i++){
      const p=samples[i],row=Object.fromEntries(COLUMNS.map((key,column)=>[key,attempt.samples[i]?.[column]??null]));
      if(p.sampleIndex!==i||!near(p.elapsedPerfMs,row.elapsedMs)||p.frameCallbackCount!==row.frameCallbacks||
         ['currentTime','readyState','width','height','paused','ended','mediaErrorCode','pageVisibility','appVisibility'].some(key=>p.native[key]!==row[key]))errors.push('sample_row_binding_failed');
    }
    const nativePoints=points.filter(p=>p.event.startsWith('native-')),originalIndices=[];
    if(attempt.playingFrameNativeEventsTruncated!==false||nativePoints.length!==attempt.playingFrameNativeEvents.length||nativePoints.length!==attempt.playingFrameNativeEventCount)
      errors.push('native_event_coverage_mismatch');
    for(let i=0;i<nativePoints.length;i++){
      const p=nativePoints[i],row=attempt.playingFrameNativeEvents[i];
      if(!row||p.nativeEventIndex!==i||row.nativeEventIndex!==i||p.event!=='native-'+row.event||p.nativePlaybackEventIndex!==row.nativePlaybackEventIndex||
         !near(p.atPerfMs,row.atPerfMs)||!near(p.elapsedPerfMs,row.elapsedPerfMs)||p.frameCallbackCount!==row.frameCallbackCount||
         row.eventPhase!==1||row.captureOnDocument!==true||!same(p.native,playingFrameNative(row.nativeAtEvent)))errors.push('native_row_binding_failed');
      if(row?.event==='play'){if(row.nativePlaybackEventIndex!==null)errors.push('native_play_binding_failed');}
      else if(row){
        originalIndices.push(row.nativePlaybackEventIndex);const original=attempt.nativePlaybackEvents[row.nativePlaybackEventIndex];
        if(!original||['event','atPerfMs','elapsedPerfMs','frameCallbackCount','eventPhase','captureOnDocument'].some(key=>row[key]!==original[key])||!same(row.nativeAtEvent,original.nativeAtEvent))errors.push('original_native_row_binding_failed');
      }
    }
    const expectedNativeIndices=attempt.nativePlaybackEvents.map((row,i)=>row.elapsedPerfMs!==null&&row.elapsedPerfMs>=0?i:null).filter(i=>i!==null);
    if(attempt.nativePlaybackEventsTruncated||!same(originalIndices,expectedNativeIndices))errors.push('original_native_coverage_mismatch');
    const callbacks=points.filter(p=>p.event==='rvfc');
    if(callbacks.length!==timing?.presentedCallbackCount||callbacks.length!==state?.frameCallbackCount)errors.push('original_callback_count_mismatch');
    if(typeof timing?.callbackRegisteredElapsedPerfMs!=='number'||!Number.isFinite(timing.callbackRegisteredElapsedPerfMs)||timing.callbackRegisteredElapsedPerfMs<0||
       !callbacks[0]||timing.callbackRegisteredElapsedPerfMs>callbacks[0].elapsedPerfMs)errors.push('callback_registration_chronology_invalid');
    for(const [point,original] of [[callbacks[0],timing?.firstPresented],[callbacks.at(-1),timing?.lastPresented]]){
      if(!point||!original||!near(point.atPerfMs,original.atPerfMs)||!near(point.elapsedPerfMs,original.elapsedPerfMs)||point.frame.mediaTime!==original.mediaTime||point.frame.presentedFrames!==original.presentedFrames)errors.push('original_callback_boundary_mismatch');
    }
    if(callbacks[0]&&timing?.firstPresented?.nativeAtFirstPresented&&['paused','ended','readyState','width','height'].some(key=>callbacks[0].native[key]!==timing.firstPresented.nativeAtFirstPresented[key]))errors.push('original_first_decoded_native_mismatch');
    const last=points.at(-1);
    if(last?.event!=='observation-end'||last.observationEnd!==true||!near(last.atPerfMs,attempt.observationEndedAtPerfMs)||!near(last.elapsedPerfMs,attempt.observationEndedElapsedPerfMs))errors.push('observation_end_binding_failed');
    return [...new Set(errors)];
  }
  function closePlayingFrameClock(attempt,doc,video){
    if(!attempt.playingFrameClock)return null;
    const atPerfMs=performance.now();attempt.observationEndedAtPerfMs=atPerfMs;attempt.observationEndedElapsedPerfMs=atPerfMs-attempt.startedPerfMs;
    recordPlayingFramePoint(attempt,'observation-end',atPerfMs,causeNative(video,doc),null,{observationEnd:true});
    attempt.playingFrameClockFinalObservationCount=attempt.playingFrameClockObservationCount;
    const summary=summarizePlayingFrameClock(attempt.playingFrameClock);
    for(const reason of playingFrameBindingErrors(attempt)){summary.usable=false;if(!summary.reasons.includes(reason))summary.reasons.push(reason);}
    attempt.playingFrameClockSummary=summary;
    attempt.metrics.legacyMaxFrameSilenceMs=attempt.metrics.maxFrameSilenceMs;
    attempt.metrics.maxPlayingFrameSilenceMs=summary.maxPostStartFrameSilenceMs;
    return summary;
  }
  function causeSafeUrl(value){if(typeof value!=='string'||!value)return null;try{const u=new URL(value,location.href);return ['http:','https:'].includes(u.protocol)?u.origin+u.pathname:null;}catch{return null;}}
  function causeSafeText(value,max=6000){if(value==null)return null;return String(value).replace(/https?:\/\/[^\s<>"')]+/g,url=>causeSafeUrl(url)||'[URL omitted]').replace(/\b(authorization|cookie|token|api[_-]?key|signature|credential|password)\s*[:=]\s*[^\s,;]+/gi,'$1=[redacted]').slice(0,max);}
  function causeTiming(value){return value?Object.fromEntries(['start','first','end'].map(k=>[k,number(value[k])])):null;}
  function causeLoadStats(value){return value?{aborted:typeof value.aborted==='boolean'?value.aborted:null,loaded:number(value.loaded),total:number(value.total),retry:number(value.retry),chunkCount:number(value.chunkCount),loading:causeTiming(value.loading),parsing:causeTiming(value.parsing),buffering:causeTiming(value.buffering)}:null;}
  function causeFragment(f){return f?{sn:typeof f.sn==='number'?number(f.sn):causeSafeText(f.sn,40),type:causeSafeText(f.type,40),level:number(f.level),cc:number(f.cc),start:number(f.start),duration:number(f.duration),end:number(f.end),gap:typeof f.gap==='boolean'?f.gap:null,url:causeSafeUrl(f.url)}:null;}
  function causeLoadContext(value){return value?{type:causeSafeText(value.type,60),url:causeSafeUrl(value.url),responseType:causeSafeText(value.responseType,40),rangeStart:number(value.rangeStart),rangeEnd:number(value.rangeEnd),fragment:causeFragment(value.frag),partIndex:number(value.part?.index)}:null;}
  function causeError(value){return value?{name:causeSafeText(value.name,100),message:causeSafeText(value.message,2000),stack:causeSafeText(value.stack,12000)}:null;}
  function causeNetwork(value){return value?{status:number(value.status),statusText:causeSafeText(value.statusText,200),readyState:number(value.readyState),url:causeSafeUrl(value.responseURL||value.url),responseType:causeSafeText(value.responseType,40)}:null;}
  function causeNative(media,doc){
    let quality=null;try{quality=media?.getVideoPlaybackQuality?.()||null;}catch{}
    const buffered=[];if(media)for(let i=0;i<media.buffered.length;i++)buffered.push([media.buffered.start(i),media.buffered.end(i)]);
    return {currentTime:number(media?.currentTime),readyState:media?.readyState??null,networkState:media?.networkState??null,width:media?.videoWidth??null,height:media?.videoHeight??null,paused:media?.paused??null,ended:media?.ended??null,seeking:media?.seeking??null,mediaErrorCode:media?.error?.code??null,totalVideoFrames:number(quality?.totalVideoFrames),droppedVideoFrames:number(quality?.droppedVideoFrames),webkitDecodedFrames:number(media?.webkitDecodedFrameCount),buffered,pageVisibility:document.visibilityState,appVisibility:doc.visibilityState,appState:doc.getElementById('playback-status')?.dataset.state??null};
  }
  function instrumentNativePlayback(doc,attempt){
    const names=['seeking','seeked','playing','pause','waiting','stalled','ended'];
    attempt.nativePlaybackInstrumentation={schemaVersion:1,phase:'document_capture',registeredAtPerfMs:performance.now(),registeredBeforeSelection:attempt.startedPerfMs===null};
    const listener=event=>{
      const video=event.target;
      if(attempt.observationEndedAt||video?.tagName!=='VIDEO'||video.parentElement?.id!=='player-mount')return;
      const atPerfMs=performance.now(),elapsedPerfMs=attempt.startedPerfMs===null?null:atPerfMs-attempt.startedPerfMs;
      const observed={event:event.type,atPerfMs,elapsedPerfMs,perfClock:'parent_performance_now',eventPhase:event.eventPhase,captureOnDocument:event.currentTarget===doc,nativeAtEvent:causeNative(video,doc),frameCallbackCount:attempt.frameTiming?.presentedCallbackCount??null};
      if(attempt.nativePlaybackEvents.length<200)attempt.nativePlaybackEvents.push(observed);else attempt.nativePlaybackEventsTruncated=true;
    };
    for(const name of names)doc.addEventListener(name,listener,true);
    return ()=>{for(const name of names)doc.removeEventListener(name,listener,true);};
  }
  function instrumentHls(win,attempt){
    const descriptor=Object.getOwnPropertyDescriptor(win,'Hls');
    let originalValue=win.Hls,observedValue=originalValue;
    attempt.hlsDiagnosticsAttached=false;
    attempt.hlsInstrumentation={registeredAtPerfMs:performance.now(),registeredBeforeSelection:attempt.startedPerfMs===null,mode:originalValue?'existing_global':'lazy_global_assignment'};
    const wrap=Original=>{
    if(typeof Original!=='function'||typeof Original.isSupported!=='function')return Original;
    attempt.hlsDiagnosticsAttached=true;
    attempt.hlsInstrumentation.attachedAtPerfMs=performance.now();
    attempt.hlsDiagnostics={schemaVersion:2,hlsVersion:Original.version??null,constructedInstances:0,loaderInstrumentation:'none',lifecycleClock:'parent_performance_now'};
    return class extends Original{
      constructor(config){
        super(config);
        attempt.hlsDiagnostics.constructedInstances++;
        const hlsState=()=>({version:Original.version??null,startPosition:number(this.startPosition),hasEnoughToStart:typeof this.hasEnoughToStart==='boolean'?this.hasEnoughToStart:null});
        for(const name of ['FRAG_LOADING','FRAG_BUFFERED','FRAG_LOAD_EMERGENCY_ABORTED','LEVEL_SWITCHING']){
          if(!Original.Events[name])continue;
          this.on(Original.Events[name],(_event,data)=>{
            if(attempt.observationEndedAt)return;
            const atPerfMs=performance.now(),elapsedPerfMs=attempt.startedPerfMs===null?null:atPerfMs-attempt.startedPerfMs;
            const observed={event:name,atPerfMs,elapsedPerfMs,perfClock:'parent_performance_now',hlsState:hlsState(),nativeAtEvent:causeNative(this.media||win.document.querySelector('#player-mount > video'),win.document),frameCallbackCount:attempt.frameTiming?.presentedCallbackCount??null,fragment:causeFragment(data.frag),loadContext:causeLoadContext(data.context||data.frag?.loader?.context)};
            if(attempt.hlsLifecycleEvents.length<200)attempt.hlsLifecycleEvents.push(observed);else attempt.hlsLifecycleEventsTruncated=true;
          });
        }
        this.on(Original.Events.ERROR,(_event,data)=>{
          if(attempt.observationEndedAt)return;
          // Both this listener and the rVFC callback read the parent collector's
          // monotonic clock. Keep the historical wall-clock field as well.
          const atPerfMs=performance.now(),elapsedPerfMs=attempt.startedPerfMs===null?null:atPerfMs-attempt.startedPerfMs;
          const media=this.media||win.document.querySelector('#player-mount > video');
          const nativeAtError=causeNative(media,win.document),loaderStats=causeLoadStats(data.stats||data.frag?.stats),childTimeOriginMs=number(win.performance.timeOrigin),parentTimeOriginMs=number(performance.timeOrigin);
          const loadingStartParentPerfMs=loaderStats?.loading?.start!==null&&loaderStats?.loading?.start!==undefined&&childTimeOriginMs!==null&&parentTimeOriginMs!==null?loaderStats.loading.start+childTimeOriginMs-parentTimeOriginMs:null;
          const loaderStatsTiming={clock:'child_window_performance_now',childTimeOriginMs,parentTimeOriginMs,loadingStartParentPerfMs,loadingStartElapsedPerfMs:loadingStartParentPerfMs!==null&&attempt.startedPerfMs!==null?loadingStartParentPerfMs-attempt.startedPerfMs:null};
          const event={at:iso(),elapsedMs:attempt.startedAtMs===null?null:Date.now()-attempt.startedAtMs,elapsedClock:'wall_clock_legacy',atPerfMs,elapsedPerfMs,perfClock:'parent_performance_now',type:data.type??null,details:data.details??null,fatal:data.fatal===true,status:number(data.response?.code??data.networkDetails?.status),fragmentSequence:data.frag?.sn??null,fragmentStart:number(data.frag?.start),fragmentDuration:number(data.frag?.duration),nativeAtError,firstPresentedElapsedPerfMs:attempt.frameTiming?.firstPresented?.elapsedPerfMs??null,rvfcObservedBeforeError:!!attempt.frameTiming?.firstPresented,frameCallbackCount:attempt.frameTiming?.presentedCallbackCount??null,hlsState:hlsState(),reason:causeSafeText(data.reason),error:causeError(data.error),alternateError:causeError(data.err),fragment:causeFragment(data.frag),partIndex:number(data.part?.index),loaderStats,loaderStatsTiming,loadContext:causeLoadContext(data.context||data.loader?.context||data.frag?.loader?.context),networkDetails:causeNetwork(data.networkDetails),response:data.response?{code:number(data.response.code),url:causeSafeUrl(data.response.url)}:null};
          if(attempt.frameTiming&&!attempt.frameTiming.firstPositiveCounterObservation&&((nativeAtError.totalVideoFrames??0)>0||(nativeAtError.webkitDecodedFrames??0)>0))attempt.frameTiming.firstPositiveCounterObservation={observedBy:'hls_error',atPerfMs,elapsedPerfMs,totalVideoFrames:nativeAtError.totalVideoFrames,webkitDecodedFrames:nativeAtError.webkitDecodedFrames};
          if(attempt.hlsEvents.length<100)attempt.hlsEvents.push(event);else attempt.hlsEventsTruncated=true;
          if(event.fatal)attempt.fatalHls=event;
        });
      }
    };
    };
    if(descriptor&&(!Object.hasOwn(descriptor,'value')||!descriptor.configurable)){
      if(Object.hasOwn(descriptor,'value')&&descriptor.writable&&originalValue){
        observedValue=wrap(originalValue);win.Hls=observedValue;
        return ()=>{if(win.Hls===observedValue)win.Hls=originalValue;};
      }
      attempt.hlsInstrumentation.error='hls_global_cannot_be_observed';
      return ()=>{};
    }
    observedValue=wrap(originalValue);
    // The UMD assignment is observed synchronously, before the loader's
    // onload promise resumes startVideo(). No preloading or fetch wrapping.
    const get=()=>observedValue;
    Object.defineProperty(win,'Hls',{configurable:true,enumerable:descriptor?.enumerable??true,get,set(value){originalValue=value;observedValue=wrap(value);}});
    return ()=>{
      if(Object.getOwnPropertyDescriptor(win,'Hls')?.get!==get)return;
      if(!descriptor&&originalValue===undefined)delete win.Hls;
      else Object.defineProperty(win,'Hls',{configurable:descriptor?.configurable??true,enumerable:descriptor?.enumerable??true,writable:descriptor?.writable??true,value:originalValue});
    };
  }
  function observe(iframe,doc,video,frames,elapsed){const vr=video?.getBoundingClientRect(),fr=iframe.getBoundingClientRect(),style=video?doc.defaultView.getComputedStyle(video):null;const frameVisible=document.visibilityState==='visible'&&inBounds(fr,innerWidth,innerHeight);const videoVisible=!!video&&frameVisible&&doc.visibilityState==='visible'&&inBounds(vr,iframe.clientWidth,iframe.clientHeight)&&style.display!=='none'&&style.visibility==='visible'&&Number(style.opacity)>0&&!video.closest('[hidden]');let quality=null;try{quality=video?.getVideoPlaybackQuality?.()||null;}catch{}const error=doc.getElementById('video-error'),limit=doc.getElementById('video-limit'),buffered=[];if(video)for(let i=0;i<video.buffered.length;i++)buffered.push([video.buffered.start(i),video.buffered.end(i)]);return {atMs:Date.now(),elapsedMs:elapsed,currentTime:video?number(video.currentTime):null,readyState:video?.readyState??null,networkState:video?.networkState??null,width:video?.videoWidth??null,height:video?.videoHeight??null,paused:video?.paused??null,ended:video?.ended??null,mediaErrorCode:video?.error?.code??null,frameCallbacks:frames.supported?frames.count:null,presentedFrames:frames.presented,lastFrameMediaTime:frames.mediaTime,totalVideoFrames:number(quality?.totalVideoFrames),droppedVideoFrames:number(quality?.droppedVideoFrames),webkitDecodedFrames:number(video?.webkitDecodedFrameCount),appState:doc.getElementById('playback-status')?.dataset.state??null,pageVisibility:document.visibilityState,appVisibility:doc.visibilityState,videoVisible,iframeVisible:frameVisible,videoRect:compactRect(vr),iframeRect:compactRect(fr),buffered,appError:error&&!error.hidden?doc.getElementById('video-error-title')?.textContent||'app_error':null,providerLimit:!!limit&&!limit.hidden};}
  function playable(s){return s.videoVisible&&s.width>0&&s.height>0&&s.readyState>=2&&!s.paused&&!s.ended;}
  async function capture(video,attempt,phase,elapsed){const previous=attempt.frames.find(f=>f.phase===phase);if(previous?.reason==='canvas_tainted_or_blocked')return;const result={phase,capturedAt:iso(),elapsedMs:elapsed,width:320,height:180,dataUrl:null,reason:null,sha256:null,meanLuma:null,varianceLuma:null,blockLuma:null};try{if(!video||video.readyState<2||video.videoWidth===0)throw new Error('no_decoded_frame_at_capture');const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(video,0,0,320,180);const pixels=context.getImageData(0,0,320,180).data;let sum=0,sum2=0;const blocks=new Array(64).fill(0),counts=new Array(64).fill(0);for(let i=0;i<pixels.length;i+=4){const l=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2],n=i/4,x=n%320,y=Math.floor(n/320),b=Math.floor(y/22.5)*8+Math.floor(x/40);sum+=l;sum2+=l*l;blocks[b]+=l;counts[b]++;}const count=pixels.length/4;result.meanLuma=sum/count;result.varianceLuma=Math.max(0,sum2/count-result.meanLuma**2);result.blockLuma=blocks.map((v,i)=>Math.round(v/counts[i]*100)/100);result.sha256=await sha(pixels);result.dataUrl=canvas.toDataURL('image/jpeg',.65);try{const key=frameStorageKey(run.runId,attempt,phase);await frameStore(key,result.dataUrl);result.storageKey=key;}catch{result.storageWarning='frame_database_write_failed';}}catch(error){result.reason=error.name==='SecurityError'?'canvas_tainted_or_blocked':error.message;}const i=attempt.frames.findIndex(f=>f.phase===phase);if(i<0)attempt.frames.push(result);else attempt.frames[i]=result;}
  function visualFlags(attempt){const flags=[];for(const f of attempt.frames){if(f.reason)flags.push(f.phase+':'+f.reason);if(f.varianceLuma!==null&&f.varianceLuma<6.25)flags.push(f.phase+':low_spatial_variance');if(f.meanLuma!==null&&f.meanLuma<5)flags.push(f.phase+':very_dark');}const [a,b]=attempt.frames;if(a?.sha256&&a.sha256===b?.sha256)flags.push('identical_captured_frames');if(a?.blockLuma&&b?.blockLuma)attempt.frameDifferenceMean=a.blockLuma.reduce((sum,v,i)=>sum+Math.abs(v-b.blockLuma[i]),0)/64;return flags;}
  async function measure(camera,round,slot,signal){const attempt={id:camera.id,round,attemptId:crypto.randomUUID?.()||String(Date.now()),verdict:'running',reason:null,preparedAt:iso(),startedAt:null,startedAtMs:null,startedPerfMs:null,frameTiming:{schemaVersion:1,clock:'parent_performance_now',parentTimeOriginMs:performance.timeOrigin,childTimeOriginMs:null,callbackRegisteredElapsedPerfMs:null,presentedCallbackCount:0,firstPresented:null,lastPresented:null,firstPositiveCounterObservation:null},endedAt:null,independentAppIframe:true,normalProviderLimitObserved:false,playingFrameClock:null,playingFrameClockObservationCount:0,playingFrameClockFinalObservationCount:null,playingFrameClockSampleCount:0,playingFrameNativeEvents:[],playingFrameNativeEventCount:0,playingFrameNativeEventsTruncated:false,metrics:{firstFrameMs:null,verifiedProgressSeconds:0,maxNoProgressMs:0,maxFrameSilenceMs:null,legacyMaxFrameSilenceMs:null,maxPlayingFrameSilenceMs:null,maxBufferingMs:0,maxSampleGapMs:0,timelineJumps:0},samples:[],hlsEvents:[],hlsEventsTruncated:false,hlsLifecycleEvents:[],hlsLifecycleEventsTruncated:false,nativePlaybackEvents:[],nativePlaybackEventsTruncated:false,nativeErrorEvents:[],nativeErrorEventsTruncated:false,fatalHls:null,frames:[],frameDifferenceMean:null,visualFlags:[],cleanup:null};run.activeAttempts.push(attempt);slot.title.textContent=round+'회차 · '+camera.name;slot.info.textContent=camera.id;renderResults();updateProgress();let iframe,doc,video,cancelFrame=null,removeHlsObserver=null,removeNativeErrorObserver=null,removeNativePlaybackObserver=null,removePlayingFrameObserver=null;const frames={supported:false,count:0,presented:null,mediaTime:null,lastAt:null};let outcome=null,reason=null;
    try{if((camera.kind||'youtube')!=='hls'){outcome='manual_required';reason='cross_origin_media_requires_manual_browser_verification';attempt.independentAppIframe=false;return;}({iframe,doc}=await loadApp(slot,signal,camera));attempt.appLoadDiagnostic=slot.appLoadDiagnostic;removeHlsObserver=instrumentHls(iframe.contentWindow,attempt);removeNativeErrorObserver=instrumentNativeErrors(doc,attempt);removeNativePlaybackObserver=instrumentNativePlayback(doc,attempt);removePlayingFrameObserver=instrumentPlayingFrameClock(doc,attempt);const button=doc.querySelector('#camera-list [data-select="'+CSS.escape(camera.id)+'"]');if(!button)throw new Error('camera_not_in_actual_app');attempt.startedAt=iso();attempt.startedAtMs=Date.now();attempt.startedPerfMs=performance.now();attempt.frameTiming.childTimeOriginMs=iframe.contentWindow.performance.timeOrigin;const started=attempt.startedPerfMs;attempt.playingFrameClock=createPlayingFrameClock({parentTimeOriginMs:performance.timeOrigin,startedPerfMs:started,registeredAtPerfMs:attempt.playingFrameClockInstrumentation.registeredAtPerfMs});button.click();attempt.selectedCamera=selectedAppCamera(doc,camera,button);video=await waitForPlayerVideo(doc,signal,10000-(performance.now()-started));if(!video){outcome='fail';reason='first_frame_not_observed_within_10_seconds';return;}attempt.videoElementObservedElapsedPerfMs=performance.now()-started;if(video?.requestVideoFrameCallback){
        frames.supported=true;
        const callback=(callbackTimestampMs,data)=>{
          const atPerfMs=performance.now(),elapsedPerfMs=atPerfMs-started;
          frames.count++;attempt.frameTiming.presentedCallbackCount=frames.count;frames.presented=number(data.presentedFrames);frames.mediaTime=number(data.mediaTime);frames.lastAt=elapsedPerfMs;
          const presented={atPerfMs,elapsedPerfMs,mediaTime:frames.mediaTime,presentedFrames:frames.presented};
          if(!attempt.frameTiming.firstPresented){
            let quality=null;try{quality=video.getVideoPlaybackQuality?.()||null;}catch{}
            const nativeAtFirstPresented={currentTime:number(video.currentTime),readyState:video.readyState,width:video.videoWidth,height:video.videoHeight,paused:video.paused,ended:video.ended,mediaErrorCode:video.error?.code??null,totalVideoFrames:number(quality?.totalVideoFrames),droppedVideoFrames:number(quality?.droppedVideoFrames),webkitDecodedFrames:number(video.webkitDecodedFrameCount)};
            attempt.frameTiming.firstPresented={...presented,callbackTimestampMs:number(callbackTimestampMs),presentationTimeMs:number(data.presentationTime),expectedDisplayTimeMs:number(data.expectedDisplayTime),callbackMetadataClock:'video_window_performance; do_not_compare_directly_with_parent_elapsed',nativeAtFirstPresented};
            if(!attempt.frameTiming.firstPositiveCounterObservation&&((nativeAtFirstPresented.totalVideoFrames??0)>0||(nativeAtFirstPresented.webkitDecodedFrames??0)>0))attempt.frameTiming.firstPositiveCounterObservation={observedBy:'first_rvfc',atPerfMs,elapsedPerfMs,totalVideoFrames:nativeAtFirstPresented.totalVideoFrames,webkitDecodedFrames:nativeAtFirstPresented.webkitDecodedFrames};
          }
          attempt.frameTiming.lastPresented=presented;
          recordPlayingFramePoint(attempt,'rvfc',atPerfMs,causeNative(video,doc),{mediaTime:frames.mediaTime,presentedFrames:frames.presented},{frameCallbackIndex:frames.count-1});
          cancelFrame=video.requestVideoFrameCallback(callback);
        };
        attempt.frameTiming.callbackRegisteredElapsedPerfMs=performance.now()-started;
        cancelFrame=video.requestVideoFrameCallback(callback);
      }attempt.frameCallbackSupported=frames.supported;let previous=null,noProgressStart=null,bufferingStart=null,lastEndCapture=-Infinity,frameProof=false;const target=targetFor(camera);
      for(;;){if(signal.aborted)throw new DOMException('Stopped','AbortError');const elapsed=performance.now()-started;const currentVideo=doc.querySelector('#player-mount > video');const s=observe(iframe,doc,currentVideo,frames,elapsed);attempt.samples.push(COLUMNS.map(key=>s[key]??null));attempt.playingFrameClockSampleCount++;recordPlayingFramePoint(attempt,'sample',started+elapsed,{...s,seeking:currentVideo?.seeking??null},null,{sampleIndex:attempt.samples.length-1});const m=attempt.metrics;if(!s.iframeVisible||s.pageVisibility!=='visible'||s.appVisibility!=='visible'){outcome='inconclusive';reason='video_not_visible_in_viewport';break;}if(attempt.fatalHls||s.mediaErrorCode||s.appError){outcome='fail';reason=attempt.fatalHls?'fatal_hls_error':s.mediaErrorCode?'native_media_error':s.appError;break;}if(currentVideo&&!s.videoVisible){outcome='inconclusive';reason='video_not_visible_in_viewport';break;}if(attempt.playingFrameClock.invalidReasons.length||attempt.playingFrameClock.observationsTruncated){outcome='inconclusive';reason='playing_frame_clock_evidence_invalid';break;}if(m.firstFrameMs===null&&playable(s)){m.firstFrameMs=elapsed;attempt.firstFrame={at:iso(),width:s.width,height:s.height,currentTime:s.currentTime};}if((m.firstFrameMs===null&&elapsed>10000)||(m.firstFrameMs!==null&&m.firstFrameMs>10000)){outcome='fail';reason='first_frame_not_observed_within_10_seconds';break;}
        if(previous&&m.firstFrameMs!==null){const dt=(elapsed-previous.elapsedMs)/1000,delta=s.currentTime!==null&&previous.currentTime!==null?s.currentTime-previous.currentTime:null;m.maxSampleGapMs=Math.max(m.maxSampleGapMs,dt*1000);if(dt>1.25){outcome='inconclusive';reason='sampling_gap_over_1250ms';break;}if(playable(s)&&playable(previous)&&delta!==null&&delta>0&&delta<=Math.min(dt*1.5+.25,dt+1)){m.verifiedProgressSeconds+=Math.min(delta,dt);noProgressStart=null;}else if(currentVideo&&s.currentTime!==null&&previous.currentTime!==null&&delta<=.001&&!s.ended){if(noProgressStart===null)noProgressStart=previous.elapsedMs;m.maxNoProgressMs=Math.max(m.maxNoProgressMs,elapsed-noProgressStart);}else{if(delta!==null&&(delta<0||delta>Math.min(dt*1.5+.25,dt+1)))m.timelineJumps++;noProgressStart=null;}if(currentVideo&&(s.appState==='loading'||(s.readyState<3&&!s.paused))){if(bufferingStart===null)bufferingStart=elapsed;m.maxBufferingMs=Math.max(m.maxBufferingMs,elapsed-bufferingStart);}else bufferingStart=null;if(currentVideo&&frames.supported&&frames.lastAt!==null)m.maxFrameSilenceMs=Math.max(m.maxFrameSilenceMs??0,elapsed-frames.lastAt);m.legacyMaxFrameSilenceMs=m.maxFrameSilenceMs;if(m.maxNoProgressMs>=2000||m.maxPlayingFrameSilenceMs>=2000){outcome='fail';reason='actual_video_freeze_at_least_2_seconds';break;}if(m.maxBufferingMs>=3000){outcome='fail';reason='buffering_at_least_3_seconds';break;}}
        if(m.firstFrameMs!==null&&elapsed-m.firstFrameMs>=5000&&!attempt.frames.some(f=>f.phase==='early'))await capture(currentVideo,attempt,'early',elapsed);if(['yongpyong','changwon'].includes(camera.providerType)&&m.verifiedProgressSeconds>=target-1&&elapsed-lastEndCapture>=500&&currentVideo){await capture(currentVideo,attempt,'end',elapsed);lastEndCapture=elapsed;}frameProof=frameProof||frames.count>0||(s.totalVideoFrames??0)>0||(s.webkitDecodedFrames??0)>0;if(s.providerLimit){attempt.normalProviderLimitObserved=true;outcome=m.verifiedProgressSeconds>=target&&frameProof?'playback_pass':'fail';reason=outcome==='fail'?'provider_limit_before_required_verified_progress':null;break;}if(m.verifiedProgressSeconds>=target&&!['yongpyong','changwon'].includes(camera.providerType)){await capture(currentVideo,attempt,'end',elapsed);outcome=frameProof?'playback_pass':'inconclusive';reason=frameProof?null:'decoded_frame_evidence_unavailable';break;}if(s.ended){outcome='fail';reason='stream_ended_before_observation_complete';break;}if(elapsed>45000){outcome='fail';reason='observation_deadline_exceeded';break;}slot.info.textContent='시작 '+(m.firstFrameMs===null?'대기':(m.firstFrameMs/1000).toFixed(1)+'초')+' · 진행 '+m.verifiedProgressSeconds.toFixed(1)+'/'+target+'초';previous=s;if(Date.now()-lastSaveAt>2000)save();await sleep(SAMPLE_MS,signal);}
    }catch(error){if(error.appLoadDiagnostic)attempt.appLoadDiagnostic=error.appLoadDiagnostic;outcome=error.name==='AbortError'?'interrupted':'inconclusive';reason=error.name==='AbortError'?(run.stopReason||'operator_stop'):error.message;}finally{let frameClockSummary=null;try{frameClockSummary=closePlayingFrameClock(attempt,doc,doc?.querySelector('#player-mount > video')||video);}catch(error){attempt.playingFrameClockCloseError=error.message;}if(outcome==='playback_pass'&&!frameClockSummary?.usable){outcome='inconclusive';reason='playing_frame_clock_evidence_invalid';}else if(outcome==='playback_pass'&&frameClockSummary.maxPostStartFrameSilenceMs>=2000){outcome='fail';reason='actual_video_freeze_at_least_2_seconds';}attempt.observationEndedAt=iso();removeHlsObserver?.();removeNativeErrorObserver?.();removeNativePlaybackObserver?.();removePlayingFrameObserver?.();if(cancelFrame!==null)video?.cancelVideoFrameCallback?.(cancelFrame);if(video?.readyState>=2&&!attempt.frames.some(f=>f.phase==='end'))await capture(video,attempt,'end',attempt.startedAtMs===null?null:Date.now()-attempt.startedAtMs);if(attempt.startedAt!==null)for(const phase of ['early','end'])if(!attempt.frames.some(f=>f.phase===phase))attempt.frames.push({phase,capturedAt:null,elapsedMs:null,width:null,height:null,dataUrl:null,reason:phase==='early'?'five_playing_seconds_not_reached':'no_decoded_frame_at_end',sha256:null,meanLuma:null,varianceLuma:null,blockLuma:null});let closed=false,remaining=null;try{const close=doc?.getElementById('close-viewer');if(close){close.click();closed=true;remaining=doc.getElementById('player-mount')?.children.length??null;}}catch{}const cleanupFrame=iframe||slot.iframe;cleanupFrame?.remove();slot.iframe=null;attempt.cleanup={closeUiClicked:closed,remainingMediaChildren:remaining,iframeRemoved:cleanupFrame?!cleanupFrame.isConnected:null};attempt.verdict=outcome||'inconclusive';attempt.reason=reason;attempt.endedAt=iso();if(!attempt.samples.length)attempt.metrics=null;else if(attempt.metrics.firstFrameMs===null){attempt.metrics.maxNoProgressMs=null;attempt.metrics.maxBufferingMs=null;attempt.metrics.maxFrameSilenceMs=null;}attempt.visualFlags=visualFlags(attempt);if(attempt.verdict==='playback_pass'&&remaining!==0){attempt.verdict='fail';attempt.reason='actual_app_cleanup_failed';}run.activeAttempts=run.activeAttempts.filter(a=>a!==attempt);if(attempt.verdict==='interrupted')run.interruptedAttempts.push(attempt);else run.attempts.push(attempt);slot.title.textContent=camera.name;slot.info.textContent=attemptLabel(attempt)+(reason?' · '+reason:'');renderResults();updateProgress();await save();}}
  async function assetHash(path='app.js'){try{const response=await fetch(new URL(path,location.href),{cache:'no-store',signal:AbortSignal.timeout(5000)});return response.ok?await sha(await response.text()):null;}catch{return null;}}
  async function start(resume=false){if(controller||starting||restoring)return;starting=true;setBusy(true);try{const currentHash=await sha(JSON.stringify(catalog));if(resume){if(!run||run.catalogSha256!==currentHash||run.origin!==location.origin)throw new Error('카탈로그 또는 출처가 달라 저장 검사를 이어갈 수 없습니다. JSON을 저장하고 새 검사를 시작해 주세요.');validateResumeSelection(run,selectedCameras());const [appSha256,hlsBundleSha256,collectorSha256]=await Promise.all([assetHash(),assetHash('vendor/hls.min.js'),assetHash('playback-check.js')]);validateResumeEnvironment(run,{appSha256,hlsBundleSha256,collectorSha256});}else{const selected=selectedCameras(),cameras=selected.cameras;run={schemaVersion:1,runId:crypto.randomUUID?.()||String(Date.now()),origin:location.origin,appUrl:new URL('./',location.href).href,startedAt:iso(),endedAt:null,status:'running',userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},catalogSha256:currentHash,appSha256:await assetHash(),hlsBundleSha256:await assetHash('vendor/hls.min.js'),collectorSha256:await assetHash('playback-check.js'),selection:{mode:selected.mode,ids:selected.ids,kind:selected.kind,startId:cameras[0].id,endId:cameras.at(-1).id,requestedConcurrency:Number($('concurrency').value)},protocol:{sampleIntervalMs:SAMPLE_MS,rounds:2,roundOrder:'all_round_1_then_all_round_2',startupDeadlineMs:10000,ordinaryTargetSeconds:25,yongpyongTargetSeconds:12,yongpyongRequiresNormalLimit:true,changwonTargetSeconds:17,changwonRequiresNormalLimit:true,high1TargetSeconds:20,maxFreezeMs:2000,frameSilencePolicy:PLAYING_FRAME_CLOCK_POLICY,frameSilenceJournalLimit:4096,legacyFrameSilenceMetric:'maxFrameSilenceMs',activeFrameSilenceMetric:'maxPlayingFrameSilenceMs',maxBufferingMs:3000,finalPassRequiresOperatorVisualReview:true,actualAppUiSelection:true,appIframeLayoutOverride:APP_LAYOUT},sampleColumns:COLUMNS,cameras:cameras.map(cameraMeta),attempts:[],activeAttempts:[],interruptedAttempts:[],visualReviews:{}};}$('settings').open=false;setBusy(true);run.status='running';run.stopReason=null;controller=new AbortController();const signal=controller.signal,count=availableSlots();run.selection.effectiveConcurrency=count;makeSlots(count);if($('stage').clientHeight<290)throw new Error('영상이 보일 공간이 부족합니다. 창 높이를 늘린 뒤 다시 시작해 주세요.');message('이 탭을 보이는 상태로 유지해 주세요. 다른 탭으로 이동하면 중단합니다.');await save();for(const round of [1,2]){if(signal.aborted)break;run.currentRound=round;const queue=run.cameras.filter(c=>!run.attempts.some(a=>a.id===c.id&&a.round===round));await Promise.all(slots.map(async slot=>{while(queue.length&&!signal.aborted){const camera=queue.shift();await measure(camera,round,slot,signal);await sleep(0,signal).catch(()=>{});}}));if(!signal.aborted){markRoundCompleted(run,round,iso());}}run.status=signal.aborted?'paused':'completed';run.endedAt=iso();if(!signal.aborted){run.appSha256AtEnd=await assetHash();run.hlsBundleSha256AtEnd=await assetHash('vendor/hls.min.js');run.collectorSha256AtEnd=await assetHash('playback-check.js');if(run.appSha256&&run.appSha256AtEnd&&run.appSha256!==run.appSha256AtEnd){run.status='inconclusive';run.environmentChanged=true;}}message(run.status==='completed'?'두 회차 측정이 끝났습니다. 실제 캡처를 검토하고 JSON을 내려받으세요.':'검사가 중단되었습니다. 기록을 저장했습니다.');}catch(error){message(error.message,true);if(run){run.status='paused';run.stopReason=error.message;}}finally{controller=null;starting=false;setBusy(false);$('resume').hidden=!run||run.status==='completed';renderResults();updateProgress();await save();}}
  function stop(reason='operator_stop'){if(!controller)return;run.stopReason=reason;controller.abort();message('진행 중인 영상을 닫고 기록을 저장하는 중입니다.');}
  async function download(){if(!run)return;try{const result=JSON.parse(JSON.stringify(run));for(const a of [...result.attempts,...result.activeAttempts,...result.interruptedAttempts])for(const f of a.frames||[])if(!f.dataUrl&&f.storageKey){try{f.dataUrl=await frameStore(f.storageKey)||null;if(!f.dataUrl)f.reason='saved_frame_missing';}catch{f.dataUrl=null;f.reason='saved_frame_read_failed';}}result.exportedAt=iso();const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='playback-check-'+run.runId+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('JSON 다운로드를 시작했습니다. 실제 캡처와 원시 표본이 포함됩니다.');}catch(error){message('JSON 다운로드 실패: '+error.message,true);}}
  $('kind').addEventListener('change',fillRange);$('explicit-ids').addEventListener('input',()=>updateSelectionUi());for(const id of ['start-id','end-id'])$(id).addEventListener('change',()=>updateSelectionUi());$('start').addEventListener('click',()=>start(false));$('resume').addEventListener('click',()=>start(true));$('stop').addEventListener('click',()=>stop());$('download').addEventListener('click',download);document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')stop('page_became_hidden');});window.addEventListener('resize',()=>{if(controller&&(slots.length>availableSlots()||$('stage').clientHeight<290))stop('viewport_no_longer_fits_visible_players');});window.addEventListener('pagehide',()=>{stop('page_unloaded');});fillRange();setBusy(true);restore().finally(()=>{restoring=false;setBusy(false);});
})();
