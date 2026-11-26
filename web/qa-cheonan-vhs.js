(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const IDS = ['cheonan-1', 'cheonan-11', 'cheonan-16', 'gits-41212', 'gits-6068', 'gits-158', 'gumi-45', 'gumi-22', 'gumi-1'];
  const PINNED_ASSETS = {
    '/vendor/hls.min.js': 'cfc70cc9e9fc63d071919e087670abc760c8fd1bc889b88588026e4d22193bbe',
    '/vendor/qa-videojs-8.24.2/video.min.js': '8723f5804455c25e77097055ecc6bf98933015f072ae0c9f387a86ece1e84088'
  };
  const cameras = IDS.map(id => (window.KOREA_CAMERAS || []).find(c => c.id === id));
  const run = {
    schemaVersion: 2, runId: crypto.randomUUID(), purpose: 'engine_comparison_not_release_evidence',
    pageUrl: location.href, origin: location.origin, startedAt: null, endedAt: null,
    officialCheonanPlayerVersionKnown: false,
    versions: {hls: window.Hls?.version ?? null, videojs: window.videojs?.VERSION ?? null, vhs: window.videojs?.VhsSourceHandler?.VERSION ?? null},
    method: {singleActiveVideo: true, sampleIntervalMs: 250, policyStarts: 'before first source connection',
      addedSeekRetryRecovery: false, engineInternalSeekRetryObserved: true, rawWarningsPreserved: true,
      vhsDefaultBufferPolicy: true, sameBytesAcrossLiveConnections: false, releasePassComputed: false},
    assets: {}, attempts: [], plans: [], errors: []
  };
  let busy = false, stopRequested = false, finishActive = null, assetsPromise = null;
  const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const finite = value => Number.isFinite(value) ? value : null;
  function simple(value, depth = 0) {
    if (value == null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'string') return value.slice(0, 4000);
    if (value instanceof Error) return {name: value.name, message: value.message};
    if (depth > 2) return Object.prototype.toString.call(value);
    if (Array.isArray(value)) return value.slice(0, 40).map(v => simple(v, depth + 1));
    if (typeof value === 'object') return Object.fromEntries(Object.keys(value).slice(0, 30).filter(k => !['target', 'player', 'tech', 'response', 'request'].includes(k)).map(k => [k, simple(value[k], depth + 1)]));
    return String(value);
  }
  function uriSummary(uri) {
    try {const u = new URL(uri, location.href); return {origin: u.origin, pathname: u.pathname, queryOmitted: !!u.search};}
    catch {return {invalid: true};}
  }
  function buttons() {
    for (const id of ['single', 'cheonan-batch', 'gits-batch', 'gumi-batch', 'source', 'engine']) $(id).disabled = busy;
    $('stop').disabled = !busy; $('download').disabled = !run.attempts.length && !run.errors.length;
  }
  function render() {
    $('rows').replaceChildren(...run.attempts.map(a => {
      const row = document.createElement('tr');
      const values = [a.name + ' / ' + a.engine, a.firstDecodedFrameMs == null ? '—' : (a.firstDecodedFrameMs / 1000).toFixed(3) + 's',
        a.naturalProgressSeconds.toFixed(3) + 's', a.finalDropRatio == null ? '—' : (a.finalDropRatio * 100).toFixed(2) + '%',
        a.errors.length + ' / ' + a.endReason];
      for (const value of values) {const td = document.createElement('td'); td.textContent = value; row.append(td);} return row;
    }));
  }
  async function assetProof() {
    const paths = ['/app.js', '/vendor/hls.min.js', '/vendor/qa-videojs-8.24.2/video.min.js', '/vendor/qa-videojs-8.24.2/video-js.min.css', '/vendor/qa-videojs-8.24.2/provenance.json', '/qa-cheonan-vhs.html', '/qa-cheonan-vhs.js', '/cameras.js'];
    await Promise.all(paths.map(async path => {
      const response = await fetch(path, {cache: 'no-store'}); if (!response.ok) throw new Error(path + ' HTTP ' + response.status);
      const bytes = await response.arrayBuffer(); run.assets[path] = {bytes: bytes.byteLength, sha256: await sha(bytes)};
      if (path.endsWith('provenance.json')) run.vendorProvenance = JSON.parse(new TextDecoder().decode(bytes));
    }));
    run.appSha256 = run.assets['/app.js'].sha256;
    if (run.versions.hls !== '1.7.4' || run.versions.videojs !== '8.24.2' || run.versions.vhs !== '3.17.5') throw new Error('Unexpected Hls.js / Video.js / VHS version');
    for (const [path, expectedHash] of Object.entries(PINNED_ASSETS)) {
      if (run.assets[path].sha256 !== expectedHash) throw new Error('Pinned engine asset hash mismatch: ' + path);
    }
    const expected = run.vendorProvenance.files['video.min.js'].sha256;
    if (run.assets['/vendor/qa-videojs-8.24.2/video.min.js'].sha256 !== expected) throw new Error('Video.js asset hash mismatch');
  }
  async function measure(id, engine) {
    const c = cameras.find(camera => camera.id === id);
    if (!c || !Number.isFinite(c.sessionLimitSeconds) || c.sessionLimitSeconds <= 0) throw new Error('Missing catalog policy');
    const capMs = c.sessionLimitSeconds * 1000, mediaUrl = c.proxy ? '/api/hls/' + encodeURIComponent(c.id) + '/index.m3u8' : c.streamUrl;
    const hlsConfig = {maxBufferLength: 10, maxMaxBufferLength: 20, backBufferLength: 0, capLevelToPlayerSize: true,
      ...(['high1', 'daegu', 'gwangju', 'changwon', 'cheonan', 'gits'].includes(c.providerType) ? {progressive: true} : {})};
    const vhsConfig = {autoplay: true, muted: true, controls: true, preload: 'auto', fluid: false,
      techOrder: ['html5'], html5: {vhs: {overrideNative: true}, nativeAudioTracks: false, nativeVideoTracks: false}};
    let video = document.createElement('video'); video.controls = true; video.muted = true; video.autoplay = true;
    video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto'; video.crossOrigin = 'anonymous';
    video.id = 'diagnostic-video-' + run.attempts.length; if (engine === 'vhs') video.className = 'video-js';
    $('mount').replaceChildren(video);
    const a = {attemptId: crypto.randomUUID(), id: c.id, name: c.name, providerType: c.providerType, engine,
      sourceId: c.sourceId, region: c.region, sourceUrl: c.sourceUrl, streamUrl: c.streamUrl, mediaUrl, proxy: c.proxy === true, startedAt: new Date().toISOString(),
      sessionLimitSeconds: c.sessionLimitSeconds, sessionLimitReason: c.sessionLimitReason, config: engine === 'hls' ? hlsConfig : vhsConfig, versions: {...run.versions},
      firstDecodedFrameMs: null, firstPlayableSampleMs: null, firstFrameMetadata: null, playRequestedAtMs: null,
      naturalProgressSeconds: 0, maxTimelineFreezeMs: 0, maxFrameSilenceMs: 0, maxSampleGapMs: 0, timelineJumps: [],
      samples: [], frameCallbacks: [], events: [], errors: [], vhsRequests: [], videojsLogs: [], captures: [],
      cleanup: null, endReason: null, finalDropRatio: null};
    const start = performance.now(); let player = null, hls = null, tech = null, interval, capTimer, frameId;
    let finished = false, requestedPlay = false, previous = null, stallStart = null, lastFrameAt = null, resolveDone;
    const eventController = new AbortController(), captureJobs = [], capturePhases = new Set(), done = new Promise(resolve => {resolveDone = resolve;});
    let historyCursor = window.videojs?.log.history().length || 0;
    const elapsed = () => performance.now() - start;
    function ranges() {const result = []; for (let i = 0; i < video.buffered.length; i++) result.push([video.buffered.start(i), video.buffered.end(i)]); return result;}
    function point() {
      const q = video.getVideoPlaybackQuality?.(), buffered = ranges();
      const current = buffered.find(range => video.currentTime >= range[0] - .05 && video.currentTime <= range[1]);
      return {elapsedMs: elapsed(), currentTime: video.currentTime, readyState: video.readyState, networkState: video.networkState,
        width: video.videoWidth, height: video.videoHeight, paused: video.paused, ended: video.ended,
        visibility: document.visibilityState, frameCallbackCount: a.frameCallbacks.length,
        totalVideoFrames: q ? finite(q.totalVideoFrames) : null, droppedVideoFrames: q ? finite(q.droppedVideoFrames) : null,
        webkitDecodedFrameCount: finite(video.webkitDecodedFrameCount), buffered,
        forwardBuffer: current ? Math.max(0, current[1] - video.currentTime) : 0,
        mediaError: video.error?.code ?? null, mediaErrorMessage: video.error?.message ?? null};
    }
    function log(event, extra = {}) {if (!finished) a.events.push({event, ...point(), ...extra});}
    function logs() {
      if (engine !== 'vhs') return; const history = videojs.log.history();
      for (const entry of history.slice(historyCursor)) a.videojsLogs.push({observedAtMs: elapsed(), arguments: simple(entry)});
      historyCursor = history.length;
    }
    function capture(phase) {
      if (video.readyState < 2 || !video.videoWidth) {a.captures.push({phase, elapsedMs: elapsed(), unavailable: 'no_decoded_frame', readyState: video.readyState}); return;}
      try {
        const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = Math.round(320 * video.videoHeight / video.videoWidth);
        const context = canvas.getContext('2d'); context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', .76), bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
        const frame = {phase, elapsedMs: elapsed(), mediaTime: video.currentTime, readyState: video.readyState, paused: video.paused,
          mediaError: video.error?.code ?? null, width: canvas.width, height: canvas.height, dataUrl};
        a.captures.push(frame); captureJobs.push(sha(bytes).then(value => {frame.sha256 = value;}));
      } catch (error) {a.captures.push({phase, elapsedMs: elapsed(), error: error.name + ': ' + error.message});}
    }
    function vhsStats() {
      const vhs = tech?.vhs; if (!vhs) return null;
      const stats = vhs.stats || {}, keys = ['mediaRequests', 'mediaRequestsAborted', 'mediaRequestsTimedout', 'mediaRequestsErrored', 'mediaTransferDuration', 'mediaBytesTransferred', 'mediaSecondsLoaded', 'mediaAppends', 'bandwidth'];
      const media = vhs.playlists?.media?.();
      return {stats: Object.fromEntries(keys.map(key => [key, finite(stats[key])])),
        playlist: media ? {targetDuration: media.targetDuration, mediaSequence: media.mediaSequence, endList: media.endList === true,
          segmentCount: media.segments?.length ?? null, durations: media.segments?.map(segment => segment.duration) ?? []} : null};
    }
    const onVhsResponse = (request, error, response) => {
      if (finished) return;
      const entry = {elapsedMs: elapsed(), requestType: request?.requestType ?? null, uri: uriSummary(request?.uri || ''),
        status: response?.statusCode ?? request?.status ?? null, aborted: request?.aborted === true, timedout: request?.timedout === true,
        bytes: response?.body?.byteLength ?? response?.body?.length ?? request?.response?.byteLength ?? null,
        requestDurationMs: request?.requestTime ? Date.now() - request.requestTime : null, error: error ? simple(error) : null};
      a.vhsRequests.push(entry);
      if (error || (entry.status !== null && entry.status >= 400)) a.errors.push({engine: 'vhs', kind: 'request_error', ...entry});
    };
    async function finish(reason) {
      if (finished) return;
      a.finalSample = point(); a.samples.push(a.finalSample); a.endReason = reason;
      a.stopRequestedAtMs = elapsed(); a.policyOverrunMs = Math.max(0, a.stopRequestedAtMs - capMs);
      capture('end'); logs(); a.finalVhsState = vhsStats(); finished = true;
      clearInterval(interval); clearTimeout(capTimer); eventController.abort();
      if (frameId !== undefined) video.cancelVideoFrameCallback?.(frameId);
      const native = video;
      try {
        if (hls) hls.destroy(); if (player) player.dispose();
        native.pause(); native.removeAttribute('src'); native.querySelectorAll('source').forEach(source => source.remove()); native.load();
      } catch (error) {a.cleanupError = simple(error);}
      videojs.Vhs.xhr.offResponse(onVhsResponse); $('mount').replaceChildren();
      a.mediaStoppedAtMs = elapsed(); a.cleanup = {paused: native.paused, srcRemoved: !native.hasAttribute('src'),
        hlsDestroyed: !hls || hls.media === null, videojsDisposed: !player || player.isDisposed(),
        nativeVideoElementsRemaining: $('mount').querySelectorAll('video').length, cleanupError: a.cleanupError ?? null};
      const quality = a.finalSample; a.finalDropRatio = quality.totalVideoFrames > 0 && quality.droppedVideoFrames !== null ? quality.droppedVideoFrames / quality.totalVideoFrames : null;
      await Promise.allSettled(captureJobs); a.endedAt = new Date().toISOString(); a.observedDurationMs = elapsed();
      run.attempts.push(a); finishActive = null; render();
      $('details').textContent = JSON.stringify({...a, samples: a.samples.length, events: a.events.length, frameCallbacks: a.frameCallbacks.length,
        captures: a.captures.map(({dataUrl, ...frame}) => frame)}, null, 2); resolveDone();
    }
    finishActive = () => finish('operator_stop'); capTimer = setTimeout(() => finish('provider_connection_limit'), capMs);
    function armFrameCallback() {
      if (!video.requestVideoFrameCallback) {a.frameCallbackUnavailable = true; return;}
      const callback = (_now, metadata) => {
        if (finished) return; const time = elapsed();
        if (a.firstDecodedFrameMs === null) {a.firstDecodedFrameMs = time; a.firstFrameMetadata = {mediaTime: metadata.mediaTime, presentedFrames: metadata.presentedFrames};}
        lastFrameAt = time; a.frameCallbacks.push([time, metadata.mediaTime, metadata.presentedFrames]); frameId = video.requestVideoFrameCallback(callback);
      }; frameId = video.requestVideoFrameCallback(callback);
    }
    function play() {
      if (finished || requestedPlay) return; requestedPlay = true; a.playRequestedAtMs = elapsed(); log('play-requested');
      const promise = engine === 'vhs' ? player.play() : video.play();
      promise?.catch(error => {if (!finished) {a.errors.push({engine, kind: 'play_rejected', elapsedMs: elapsed(), error: simple(error)}); log('play-rejected', {error: simple(error)});}});
    }
    for (const event of ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'waiting', 'stalled', 'seeking', 'seeked', 'pause', 'ended', 'error']) {
      $('mount').addEventListener(event, e => {
        if (finished || !(e.target instanceof HTMLVideoElement)) return;
        video = e.target; log('native-' + event);
        if (event === 'error') {a.errors.push({engine, kind: 'native_media_error', ...point()}); finish('native_media_error');}
      }, {capture: true, signal: eventController.signal});
    }
    const playable = s => s.width > 0 && s.height > 0 && s.readyState >= 2 && !s.paused && !s.ended;
    interval = setInterval(() => {
      if (finished) return; if (elapsed() >= capMs) {finish('provider_connection_limit'); return;}
      const s = point(); a.samples.push(s); logs();
      if (s.visibility !== 'visible') {finish('hidden_observation'); return;}
      if (a.firstPlayableSampleMs === null && playable(s)) a.firstPlayableSampleMs = s.elapsedMs;
      if (previous) {
        const dt = (s.elapsedMs - previous.elapsedMs) / 1000, delta = s.currentTime - previous.currentTime;
        a.maxSampleGapMs = Math.max(a.maxSampleGapMs, dt * 1000);
        if (playable(s) && playable(previous) && delta > 0 && delta <= Math.min(dt * 1.5 + .25, dt + 1)) {a.naturalProgressSeconds += Math.min(delta, dt); stallStart = null;}
        else if (a.firstDecodedFrameMs !== null && delta <= .001 && !s.ended) {stallStart ??= previous.elapsedMs; a.maxTimelineFreezeMs = Math.max(a.maxTimelineFreezeMs, s.elapsedMs - stallStart);}
        else {if (delta < 0 || delta > Math.min(dt * 1.5 + .25, dt + 1)) a.timelineJumps.push({elapsedMs: s.elapsedMs, delta, wallSeconds: dt}); stallStart = null;}
      }
      if (lastFrameAt !== null) a.maxFrameSilenceMs = Math.max(a.maxFrameSilenceMs, s.elapsedMs - lastFrameAt);
      for (const seconds of [5, 15, 25]) if (s.elapsedMs >= seconds * 1000 && !capturePhases.has(seconds)) {capturePhases.add(seconds); capture('connection_' + seconds + 's');}
      previous = s;
      $('status').textContent = c.name + ' / ' + engine + ' · ' + (s.elapsedMs / 1000).toFixed(1) + '/' + c.sessionLimitSeconds + '초 · 진행 ' + a.naturalProgressSeconds.toFixed(2) + '초 · 버퍼 ' + s.forwardBuffer.toFixed(2) + '초 · 오류 ' + a.errors.length;
    }, 250);
    try {
      if (engine === 'hls') {
        if (!Hls.isSupported()) {finish('hls_unsupported'); return done;}
        armFrameCallback(); hls = new Hls(hlsConfig);
        const configKeys = ['maxBufferLength', 'maxMaxBufferLength', 'backBufferLength', 'capLevelToPlayerSize', 'progressive', 'liveSyncDurationCount', 'liveMaxLatencyDurationCount', 'startPosition', 'initialLiveManifestSize'];
        a.resolvedConfig = Object.fromEntries(configKeys.map(key => [key, simple(hls.config[key])]));
        for (const name of ['MANIFEST_LOADING', 'MANIFEST_LOADED', 'MANIFEST_PARSED', 'LEVEL_LOADING', 'LEVEL_LOADED', 'FRAG_LOADING', 'FRAG_LOADED', 'FRAG_BUFFERED', 'BUFFER_APPENDED', 'BUFFER_CODECS']) hls.on(Hls.Events[name], (_event, data) => {
          if (finished) return; const stats = data.frag?.stats || data.stats;
          log('hls-' + name, {fragment: data.frag ? {sn: data.frag.sn, duration: data.frag.duration, start: data.frag.start, startPTS: data.frag.startPTS, endPTS: data.frag.endPTS, startDTS: data.frag.startDTS, endDTS: data.frag.endDTS} : null,
            stats: stats ? {loaded: stats.loaded, total: stats.total, loading: simple(stats.loading)} : null,
            playlist: data.details ? {startSN: data.details.startSN, endSN: data.details.endSN, targetduration: data.details.targetduration, live: data.details.live, totalduration: data.details.totalduration, fragments: data.details.fragments?.length} : null,
            codecs: name === 'BUFFER_CODECS' ? Object.fromEntries(Object.entries(data).map(([key, track]) => [key, {codec: track.codec, container: track.container}])) : null});
        });
        hls.on(Hls.Events.MANIFEST_PARSED, play);
        hls.on(Hls.Events.ERROR, (_event, data) => {if (finished) return; const error = {engine, kind: 'hls_error', ...point(), type: data.type, details: data.details, fatal: data.fatal === true, status: data.response?.code ?? data.networkDetails?.status ?? null, reason: data.reason ?? data.error?.message ?? null}; a.errors.push(error); log('hls-error', error); if (data.fatal) finish('fatal_hls_error');});
        a.connectionStartedAtMs = elapsed(); hls.loadSource(mediaUrl); hls.attachMedia(video);
      } else {
        videojs.Vhs.xhr.onResponse(onVhsResponse);
        player = videojs(video, vhsConfig); tech = player.tech(true); video = tech.el();
        a.actualTechName = player.techName_; armFrameCallback();
        player.on('error', () => {if (finished) return; const error = player.error(); a.errors.push({engine, kind: 'videojs_error', ...point(), error: simple(error)}); log('videojs-error', {error: simple(error)}); finish('videojs_error');});
        player.on('xhr-hooks-ready', () => {if (finished) return; tech = player.tech(true); a.vhsSourceHandlerActive = !!tech.vhs; a.resolvedConfig = {vhs: simple(tech.vhs?.options_), techName: player.techName_}; log('vhs-hooks-ready');});
        for (const event of ['loadedplaylist', 'loadedmetadata', 'mediachange', 'mediachanging', 'retryplaylist', 'bandwidthupdate', 'usage', 'error']) tech.on(event, e => {
          if (finished) return; const extra = {name: e.name ?? null, vhsState: vhsStats()}; log('vhs-tech-' + event, extra);
          if (event === 'retryplaylist' || (event === 'usage' && /underflow|gap-skip|resync|error/.test(e.name || ''))) a.errors.push({engine, kind: 'vhs_' + event, ...point(), ...extra});
        });
        for (const event of ['gapjumped', 'seekablerangeschanged', 'bufferedrangeschanged']) player.on(event, e => {if (!finished) log('vhs-' + event, {metadata: simple(e)});});
        player.ready(() => {
          if (finished) return;
          try {a.connectionStartedAtMs = elapsed(); player.src({src: mediaUrl, type: 'application/x-mpegURL'}); play();}
          catch (error) {a.errors.push({engine, kind: 'source_setup_exception', elapsedMs: elapsed(), error: simple(error)}); finish('source_setup_exception');}
        });
      }
    } catch (error) {a.errors.push({engine, kind: 'setup_exception', elapsedMs: elapsed(), error: simple(error)}); finish('setup_exception');}
    await done;
  }
  async function execute(plan) {
    if (busy) return; busy = true; stopRequested = false; run.startedAt ??= new Date().toISOString();
    run.plans.push({startedAt: new Date().toISOString(), plan}); buttons();
    try {
      assetsPromise ??= assetProof(); await assetsPromise;
      for (const item of plan) {if (stopRequested) break; await measure(item.id, item.engine); await sleep(250);}
    } catch (error) {run.errors.push({at: new Date().toISOString(), error: simple(error)}); $('details').textContent = error.stack || error.message;}
    finally {busy = false; run.endedAt = new Date().toISOString(); $('status').textContent = '완료 · ' + run.attempts.length + '개 연결 · 출시 판정 아님'; buttons();}
  }
  function crossPlan(ids) {return [{id: ids[0], engine: 'hls'}, {id: ids[1], engine: 'vhs'}, {id: ids[2], engine: 'hls'}, {id: ids[0], engine: 'vhs'}, {id: ids[1], engine: 'hls'}, {id: ids[2], engine: 'vhs'}];}
  if (cameras.some(c => !c) || !window.Hls || !window.videojs?.Vhs) { $('status').textContent = 'qa-candidates=1 카탈로그와 두 엔진 자산이 필요합니다'; return; }
  for (const c of cameras) $('source').add(new Option(c.id + ' · ' + c.name, c.id));
  $('single').onclick = () => execute([{id: $('source').value, engine: $('engine').value}]);
  $('cheonan-batch').onclick = () => execute(crossPlan(IDS.slice(0, 3)));
  $('gits-batch').onclick = () => execute(crossPlan(IDS.slice(3, 6)));
  $('gumi-batch').onclick = () => execute(crossPlan(IDS.slice(6, 9)));
  $('stop').onclick = () => {stopRequested = true; finishActive?.();};
  $('download').onclick = () => {const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], {type: 'application/json'})), link = document.createElement('a'); link.href = url; link.download = 'engine-comparison-' + run.runId + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);};
  $('status').textContent = '대기 · Hls.js ' + run.versions.hls + ' / Video.js ' + run.versions.videojs + ' / VHS ' + run.versions.vhs;
  buttons();
})();
