function startApp() {
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
  const icons = new Map(Object.entries(paths).map(([name, path]) => [
    name,
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>',
  ]));
  const icon = name => icons.get(name) || icons.get('video');
  document.querySelectorAll('[data-icon]').forEach(element => {
    element.innerHTML = icon(element.dataset.icon);
  });
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, document.getElementById(id));
    return elements.get(id);
  };
  const cameras = window.KOREA_DISPLAY_CAMERAS || window.KOREA_CAMERAS || [];
  const camerasById = new Map(cameras.map(camera => [camera.id, camera]));
  const knownIds = new Set(camerasById.keys());
  const seo = window.KOREA_SEO;
  const regions = new Set(cameras.map(camera => camera.region));
  const initialRegion = seo?.regionFromPath(location.pathname) ||
    document.body.dataset.region || 'all';
  const storageKey = 'jigeum-korea:favorites:v1';
  let favorites = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(stored)) favorites = new Set(stored.filter(id => knownIds.has(id)));
  } catch {}
  const state = {
    category: 'all',
    region: regions.has(initialRegion) ? initialRegion : 'all',
    kind: $('media-kind').value || 'all',
    query: $('search').value || '',
    savedOnly: false,
    selected: null,
  };
  let map = null;
  let mapView = null;
  let layer = null;
  let player = null;
  let playerToken = 0;
  let apiPromise = null;
  let toastTimeout = null;
  let playerTimeout = null;
  let viewerReturnFocus = null;
  const markerMap = new Map();
  const markerRecords = new Map();
  const rows = new Map();
  const requestFrame = window.requestAnimationFrame?.bind(window) || (callback => setTimeout(callback, 16));
  const cancelFrame = window.cancelAnimationFrame?.bind(window) || clearTimeout;
  let renderFrame = null;
  let markerFrame = null;
  let renderedCameras = null;
  let renderedSelection = null;
  let favoritesVersion = 0;
  let filterKey = '';
  let visibleCameras = cameras;
  let visibleIds = new Set(knownIds);
  let markerLayout = null;
  let projectionZoom = null;
  const projectedPoints = new Map();
  const regionMenu = $('region-menu');
  const regionLinks = regionMenu ? [...regionMenu.querySelectorAll('a[data-region]')] : [];
  const pageMetadata = new Map();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compactViewport = matchMedia('(max-width: 760px)');
  const modalBackground = [...document.querySelectorAll('.topbar,.sidebar,.skip-link,.map-stage > :not(#viewer)')];
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const watchUrl = camera => camera.sourceUrl;
  const mediaKind = camera => camera.kind || 'youtube';
  const mediaLabels = { youtube: 'YouTube', iframe: 'Broadcast', hls: 'Live camera' };
  // Camera data is immutable for this page. Normalize it once, not per keystroke.
  const searchText = new Map(cameras.map(camera => [
    camera.id,
    [
      camera.name,
      camera.region,
      camera.location,
      camera.categoryLabel,
      camera.provider,
      mediaLabels[mediaKind(camera)],
      camera.searchAliases,
    ].filter(Boolean).join('\n').toLocaleLowerCase('en'),
  ]));
  let hlsInstance = null;
  let videoElement = null;
  let sessionTimer = null;

  function toast(message) {
    clearTimeout(toastTimeout);
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 2600);
  }

  // Filtering and list rendering share one derived collection.
  function filtered() {
    const query = state.query.trim().toLocaleLowerCase('en');
    const key = JSON.stringify([
      state.category, state.region, state.kind, query,
      state.savedOnly, state.savedOnly ? favoritesVersion : 0,
    ]);
    if (key === filterKey) return visibleCameras;
    filterKey = key;
    const next = cameras.filter(camera =>
      (state.category === 'all' || camera.category === state.category) &&
      (state.region === 'all' || camera.region === state.region) &&
      (state.kind === 'all' || mediaKind(camera) === state.kind) &&
      (!state.savedOnly || favorites.has(camera.id)) &&
      (!query || searchText.get(camera.id).includes(query))
    );
    if (next.length !== visibleCameras.length || next.some((camera, index) => camera !== visibleCameras[index])) {
      visibleCameras = next;
      visibleIds = new Set(next.map(camera => camera.id));
    }
    return visibleCameras;
  }

  function updateRowSaved(id) {
    const row = rows.get(id);
    if (!row) return;
    const saved = favorites.has(id);
    if (row.saved === saved) return;
    row.saved = saved;
    row.saveButton.setAttribute('aria-pressed', String(saved));
    row.saveButton.setAttribute('aria-label', (saved ? 'Unsave ' : 'Save ') + camerasById.get(id).name);
  }

  function updateSaveControls(changedIds = []) {
    $('saved-count').textContent = favorites.size;
    changedIds.forEach(updateRowSaved);
    if (state.selected) {
      const saved = favorites.has(state.selected.id);
      $('viewer-save').setAttribute('aria-pressed', String(saved));
      $('viewer-save').setAttribute('aria-label', saved ? 'Unsave place' : 'Save place');
    }
  }

  function save(id) {
    if (!knownIds.has(id)) return;
    const willSave = !favorites.has(id);
    if (willSave) favorites.add(id);
    else favorites.delete(id);
    favoritesVersion++;
    let persisted = true;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...favorites]));
    } catch {
      persisted = false;
    }
    updateSaveControls([id]);
    if (state.savedOnly) render();
    toast(persisted
      ? (willSave ? 'Place saved' : 'Place removed from Saved')
      : 'Saved for this visit only. Browser storage is unavailable.');
  }
  function focusReference(element) {
    if (element?.dataset?.select) return { kind: 'select', id: element.dataset.select };
    if (element?.dataset?.save) return { kind: 'save', id: element.dataset.save };
    if (element?.id && !$('viewer').contains(element)) return { kind: 'id', id: element.id };
    return null;
  }

  function findFocusTarget(reference) {
    if (!reference) return null;
    if (reference.kind === 'id') return $(reference.id);
    const row = rows.get(reference.id);
    if (row?.element.parentNode !== $('camera-list')) return null;
    return reference.kind === 'select' ? row.selectButton : row.saveButton;
  }
  function setListCollapsed(collapsed) {
    if (window.KOREA_MAP_VIEW) {
      window.KOREA_MAP_VIEW.setListCollapsed(collapsed);
      return;
    }
    document.body.classList.toggle('list-collapsed', collapsed);
    $('list-toggle').setAttribute('aria-expanded', String(!collapsed));
    $('list-toggle').setAttribute('aria-label', collapsed ? 'Show camera list' : 'Hide camera list');
  }
  if (!window.KOREA_MAP_VIEW) setListCollapsed(compactViewport.matches);

  function restoreViewerFocus() {
    let target = findFocusTarget(viewerReturnFocus) ||
      rows.get(filtered()[0]?.id)?.selectButton || $('reset-filters');
    if (document.body.classList.contains('list-collapsed') && target && $('camera-list').contains(target)) {
      target = markerMap.get(state.selected?.id)?.getElement() || $('list-toggle');
    }
    if (target && !target.closest('[hidden]')) {
      if ($('camera-list').contains(target)) target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      target.focus({ preventScroll: true });
    } else {
      $('explore-tab').focus({ preventScroll: true });
    }
  }

  function syncViewerMode() {
    const modal = compactViewport.matches && !$('viewer').hidden;
    $('viewer').setAttribute('role', modal ? 'dialog' : 'region');
    if (modal) $('viewer').setAttribute('aria-modal', 'true');
    else $('viewer').removeAttribute('aria-modal');
    modalBackground.forEach(element => { element.inert = modal; });
    document.body.classList.toggle('viewer-modal', modal);
    return modal;
  }
  compactViewport.addEventListener?.('change', () => {
    if (!window.KOREA_MAP_VIEW) setListCollapsed(compactViewport.matches);
    if (syncViewerMode() && !$('viewer').contains(document.activeElement)) {
      $('close-viewer').focus({ preventScroll: true });
    }
  });

  // Row nodes are keyed by camera ID and survive filtering and selection.
  function createRow(camera) {
    const element = document.createElement('article');
    element.className = 'camera-card';
    element.dataset.camera = camera.id;

    const selectButton = document.createElement('a');
    selectButton.className = 'camera-select';
    selectButton.dataset.select = camera.id;
    selectButton.href = camera.sourceUrl;
    selectButton.target = '_blank';
    selectButton.rel = 'noopener noreferrer';
    selectButton.setAttribute('aria-label', 'Open ' + camera.name + ' camera');
    selectButton.setAttribute('aria-current', String(camera.id === state.selected?.id));

    const rowIcon = document.createElement('span');
    rowIcon.className = 'camera-row-icon';
    rowIcon.setAttribute('aria-hidden', 'true');
    rowIcon.innerHTML = icon('video');
    const title = document.createElement('h3');
    title.textContent = camera.name;
    selectButton.appendChild(rowIcon);
    selectButton.appendChild(title);

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'card-save';
    saveButton.dataset.save = camera.id;
    saveButton.innerHTML = icon('bookmark');
    element.appendChild(selectButton);
    element.appendChild(saveButton);
    element.classList.toggle('active', camera.id === state.selected?.id);

    const row = { element, selectButton, saveButton, saved: null };
    rows.set(camera.id, row);
    updateRowSaved(camera.id);
    return row;
  }

  function updateSelectedRows() {
    const next = state.selected?.id || null;
    if (renderedSelection === next) return;
    const previous = rows.get(renderedSelection);
    if (previous) {
      previous.element.classList.remove('active');
      previous.selectButton.setAttribute('aria-current', 'false');
    }
    const selected = rows.get(next);
    if (selected) {
      selected.element.classList.add('active');
      selected.selectButton.setAttribute('aria-current', 'true');
    }
    renderedSelection = next;
  }

  function adoptRows() {
    const existing = [];
    for (const element of [...$('camera-list').children]) {
      const camera = camerasById.get(element.dataset.camera);
      const selectButton = element.querySelector('[data-select]');
      const saveButton = element.querySelector('[data-save]');
      if (!camera || !selectButton || !saveButton) {
        element.remove();
        continue;
      }
      rows.set(camera.id, { element, selectButton, saveButton, saved: null });
      saveButton.disabled = false;
      updateRowSaved(camera.id);
      existing.push(camera);
    }
    // Adopt build-time HTML without replacing its nodes or parsing it again.
    if (existing.length) renderedCameras = existing;
  }

  function reconcileRows(visible) {
    if (renderedCameras === visible) return;
    const list = $('camera-list');
    for (const camera of renderedCameras || []) {
      if (!visibleIds.has(camera.id)) rows.get(camera.id).element.remove();
    }
    // Keep surviving DOM nodes in place, including their keyboard focus.
    let cursor = list.firstElementChild;
    for (const camera of visible) {
      const row = rows.get(camera.id) || createRow(camera);
      if (row.element === cursor) cursor = cursor.nextElementSibling;
      else list.insertBefore(row.element, cursor);
    }
    renderedCameras = visible;
  }

  function scheduleRender() {
    if (renderFrame !== null) return;
    renderFrame = requestFrame(() => {
      renderFrame = null;
      render();
    });
  }

  function render() {
    if (renderFrame !== null) {
      cancelFrame(renderFrame);
      renderFrame = null;
    }
    const activeElement = document.activeElement;
    const focus = focusReference(activeElement);
    const visible = filtered();
    const collectionChanged = renderedCameras !== visible;
    if (collectionChanged) {
      map?.closePopup();
      reconcileRows(visible);
      $('result-count').textContent = visible.length;
      $('video-total').textContent = cameras.length.toLocaleString('en');
      $('video-matches').hidden = visible.length === cameras.length;
      $('video-matches').textContent = visible.length.toLocaleString('en') + ' /';
      $('video-count').setAttribute('aria-label', visible.length === cameras.length
        ? cameras.length + ' videos in total'
        : 'Showing ' + visible.length + ' of ' + cameras.length + ' videos');
      $('empty-state').hidden = visible.length > 0;
      $('camera-list').hidden = visible.length === 0;
      $('random-button').disabled = visible.length === 0;
    }
    $('empty-title').textContent = state.savedOnly && !favorites.size
      ? 'Save a place you love' : 'No places found';
    $('empty-description').textContent = state.savedOnly && !favorites.size
      ? 'Select the bookmark beside a place to keep it here.'
      : 'Try another place name or region.';
    $('list-title').firstChild.textContent = state.savedOnly ? 'Saved ' : 'Places ';
    updateSelectedRows();
    updateSaveControls();
    renderMarkers(visible);
    if (state.selected && !visibleIds.has(state.selected.id)) {
      closeViewer({ restoreFocus: $('viewer').contains(document.activeElement) });
    }
    if (focus && focus.kind !== 'id' &&
        !$('camera-list').contains(activeElement) &&
        !$('viewer').getAttribute('aria-modal')) {
      const firstRow = rows.get(visible[0]?.id);
      const target = findFocusTarget(focus) ||
        (focus.kind === 'select' ? firstRow?.selectButton : firstRow?.saveButton) ||
        $('reset-filters');
      target.focus({ preventScroll: true });
    }
  }

  function markerIcon(group) {
    const single = group.cameras.length === 1;
    const selected = group.cameras.some(camera => camera.id === state.selected?.id);
    return L.divIcon({
      className: 'camera-marker' + (single ? '' : ' camera-cluster') + (selected ? ' selected' : ''),
      html: single
        ? '<span class="pin-marker">' + icon('video') + '</span><span class="pin-label">' + escapeHtml(group.cameras[0].name) + '</span>'
        : '<span class="pin-marker cluster-marker">' + group.cameras.length + '</span><span class="pin-label">' + escapeHtml(group.label) + '</span>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }

  function bindMarkerActivation(marker, activate) {
    marker.on('click', activate);
    marker.getElement()?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) activate();
      }
    });
  }

  function describeGroup(key, cameras) {
    const single = cameras.length === 1;
    const first = cameras[0];
    const sameRegion = cameras.every(camera => camera.region === first.region);
    const label = sameRegion ? first.region : 'Nearby';
    return {
      key: single ? 'camera:' + first.id : 'cluster:' + key,
      cameras,
      label,
      title: single ? first.name : 'Show ' + cameras.length + ' cameras · ' + label,
      center: single
        ? [first.lat, first.lng]
        : [
          cameras.reduce((sum, camera) => sum + camera.lat, 0) / cameras.length,
          cameras.reduce((sum, camera) => sum + camera.lng, 0) / cameras.length,
        ],
      sharedLocation: cameras.every(camera => camera.lat === first.lat && camera.lng === first.lng),
    };
  }

  function getMarkerLayout(visible, zoom) {
    if (markerLayout?.cameras === visible && markerLayout.zoom === zoom) return markerLayout;
    if (projectionZoom !== zoom) {
      projectionZoom = zoom;
      projectedPoints.clear();
    }
    const cells = new Map();
    const coordinates = new Map();
    const cameraCells = new Map();
    for (const camera of visible) {
      const coordinate = camera.lat + ',' + camera.lng;
      coordinates.set(coordinate, (coordinates.get(coordinate) || 0) + 1);
      let point = projectedPoints.get(camera.id);
      if (!point) {
        point = map.project([camera.lat, camera.lng], zoom);
        projectedPoints.set(camera.id, point);
      }
      const key = Math.floor(point.x / 64) + ':' + Math.floor(point.y / 64);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(camera);
      cameraCells.set(camera.id, key);
    }
    const groups = new Map([...cells].map(([key, cameras]) => [key, describeGroup(key, cameras)]));
    markerLayout = { cameras: visible, zoom, coordinates, cameraCells, groups };
    return markerLayout;
  }

  function activateMarker(record) {
    const group = record.group;
    if (group.cameras.length === 1) {
      select(group.cameras[0].id, { focusMap: true, autoPlay: true });
      return;
    }
    closeViewer({ restoreFocus: false });
    const zoom = map.getZoom();
    if (zoom >= 13 || group.sharedLocation) {
      const choices = document.createElement('div');
      choices.className = 'cluster-choices';
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', 'Choose a camera at this location');
      for (const camera of group.cameras) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = camera.name;
        button.dataset.select = camera.id;
        button.addEventListener('click', () => {
          filtered();
          if (!visibleIds.has(camera.id)) {
            map.closePopup();
            return;
          }
          select(camera.id, { autoPlay: true });
        });
        choices.appendChild(button);
      }
      L.popup({ maxHeight: 240, maxWidth: 260, closeButton: true })
        .setLatLng(group.center).setContent(choices).openOn(map);
      choices.firstElementChild?.focus({ preventScroll: true });
      return;
    }
    $('map').focus({ preventScroll: true });
    map.fitBounds(L.latLngBounds(group.cameras.map(camera => [camera.lat, camera.lng])), {
      padding: [55, 65],
      maxZoom: Math.min(14, zoom + 3),
      animate: !reducedMotion,
    });
  }

  function reconcileMarker(group) {
    const selected = group.cameras.some(camera => camera.id === state.selected?.id);
    let record = markerRecords.get(group.key);
    if (!record) {
      const single = group.cameras.length === 1;
      const marker = L.marker(group.center, {
        icon: markerIcon(group),
        title: group.title,
        alt: group.title + (single ? ' camera' : ''),
        keyboard: true,
        zIndexOffset: selected ? 500 : 0,
      }).addTo(layer);
      record = { marker, group, selected };
      markerRecords.set(group.key, record);
      bindMarkerActivation(marker, () => activateMarker(record));
      if (single) markerMap.set(group.cameras[0].id, marker);
      marker.getElement()?.setAttribute('aria-label', group.title + (single ? ' camera' : ''));
      return;
    }
    const previous = record.group;
    const element = record.marker.getElement();
    if (previous.center[0] !== group.center[0] || previous.center[1] !== group.center[1]) {
      record.marker.setLatLng(group.center);
    }
    if (previous.cameras.length !== group.cameras.length) {
      const count = element?.querySelector('.cluster-marker');
      if (count) count.textContent = group.cameras.length;
    }
    if (previous.label !== group.label) {
      const label = element?.querySelector('.pin-label');
      if (label) label.textContent = group.label;
    }
    if (previous.title !== group.title && element) {
      element.setAttribute('title', group.title);
      element.setAttribute('aria-label', group.title);
    }
    if (record.selected !== selected) {
      element?.classList.toggle('selected', selected);
      record.marker.setZIndexOffset(selected ? 500 : 0);
      record.selected = selected;
    }
    record.group = group;
  }

  function renderMarkers(visible) {
    if (markerFrame !== null) {
      cancelFrame(markerFrame);
      markerFrame = null;
    }
    // Do not spend the map's first frame on projecting and mounting cameras.
    // The basemap owns readiness, including WebGL-to-Canvas recovery.
    if (!map || !layer || !mapView.isReady) return;
    const zoom = map.getZoom();
    const layout = getMarkerLayout(visible, zoom);
    const selected = state.selected;
    const selectedCell = selected && visibleIds.has(selected.id) &&
      layout.coordinates.get(selected.lat + ',' + selected.lng) === 1
      ? layout.cameraCells.get(selected.id) : null;
    const next = new Map();
    for (const [key, group] of layout.groups) {
      if (key === selectedCell && group.cameras.length > 1) {
        const remaining = describeGroup(key, group.cameras.filter(camera => camera.id !== selected.id));
        const selectedGroup = describeGroup(key, [selected]);
        next.set(remaining.key, remaining);
        next.set(selectedGroup.key, selectedGroup);
      } else {
        next.set(group.key, group);
      }
    }
    $('map').classList.toggle('quiet-labels', visible.length > 12 && zoom < 11);
    for (const [key, record] of markerRecords) {
      if (next.has(key)) continue;
      layer.removeLayer(record.marker);
      markerRecords.delete(key);
      if (record.group.cameras.length === 1) markerMap.delete(record.group.cameras[0].id);
    }
    for (const group of next.values()) reconcileMarker(group);
    if (!$('map').dataset.markersReadyAt) {
      $('map').dataset.markersReadyAt = String(Math.round(window.performance.now()));
      window.performance.mark?.('koreanow:markers-ready');
    }
  }

  function scheduleMarkerRender() {
    if (!mapView?.isReady || markerFrame !== null) return;
    markerFrame = requestFrame(() => {
      markerFrame = null;
      renderMarkers(filtered());
    });
  }
  function initMap() {
    const view = mapView = window.KOREA_MAP_VIEW;
    map = view?.map || null;
    if (!map) {
      $('map-notice').hidden = false;
      return;
    }
    layer = L.layerGroup().addTo(map);
    map.on('zoomend', scheduleMarkerRender);
    // This event follows the basemap's paint barrier. Reconcile synchronously
    // so recovery never reveals stale markers from a filter changed in flight.
    map.on('basemapready', () => renderMarkers(filtered()));
    view.setFitHandler(fitMap);
    // Adopting the map must preserve a visitor's pan/zoom while data loaded.
    // Only an actual restored filter or the diagnostic catalog needs a new fit.
    if (!view.hasInitialBounds || state.query.trim() || state.kind !== 'all' ||
      new URLSearchParams(location.search).get('qa-candidates') === '1') fitMap(false);
  }
  function fitMap(animate = true) {
    if (!map) return;
    const points = filtered();
    if (!points.length) return;
    window.KOREA_MAP_VIEW.fitBounds(points.map(camera => [camera.lat, camera.lng]), animate);
  }

  // Every playback attempt owns a token. Late library/network callbacks may not
  // restart a closed player or replace the camera the user selected afterward.
  function setPlayback(text, status) {
    $('playback-text').textContent = text;
    $('playback-status').dataset.state = status;
  }

  function clearPlaybackTimer() {
    clearTimeout(playerTimeout);
    playerTimeout = null;
  }

  function watchPlayback(token) {
    if (playerTimeout !== null) return;
    playerTimeout = setTimeout(() => {
      playerTimeout = null;
      if (token === playerToken) showVideoError('TIMEOUT');
    }, 25000);
  }

  function stopPlayer() {
    playerToken++;
    clearPlaybackTimer();
    clearTimeout(sessionTimer);
    sessionTimer = null;
    if (hlsInstance) {
      try { hlsInstance.destroy(); } catch {}
      hlsInstance = null;
    }
    if (videoElement) {
      try {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
      } catch {}
      videoElement = null;
    }
    $('video-limit').hidden = true;
    if (player) {
      try { player.destroy(); } catch {}
      player = null;
    }
    $('player-mount').replaceChildren();
    $('player-mount').hidden = true;
  }

  function closeViewer({ restoreFocus = true } = {}) {
    const wasVisible = !$('viewer').hidden;
    stopPlayer();
    $('viewer').hidden = true;
    syncViewerMode();
    if (wasVisible && restoreFocus) restoreViewerFocus();
  }

  function updateHash(id) {
    const url = new URL(location.href);
    url.hash = 'cam=' + encodeURIComponent(id);
    history.replaceState(history.state, '', url);
  }

  function select(id, {
    focusMap = false, autoPlay = false, writeHash = true, focusViewer = autoPlay,
  } = {}) {
    const camera = camerasById.get(id);
    if (!camera) return;
    if (renderFrame !== null) {
      render();
      if (!visibleIds.has(id)) return;
    }
    if (focusViewer) viewerReturnFocus = focusReference(document.activeElement) || { kind: 'select', id };
    stopPlayer();
    state.selected = camera;
    $('viewer-title').textContent = camera.name;
    $('source-link').href = watchUrl(camera);
    $('error-source-link').href = watchUrl(camera);
    const kind = mediaKind(camera);
    $('viewer').dataset.media = kind;
    $('play-label').textContent = kind === 'iframe' ? 'Open broadcast'
      : kind === 'hls' ? 'Play live camera' : 'Play YouTube video';
    $('preview').hidden = false;
    $('video-error').hidden = true;
    $('viewer').hidden = false;
    $('viewer').scrollTop = 0;
    setPlayback('Press play to open this camera', 'idle');
    if (writeHash) updateHash(id);
    map?.closePopup();
    updateSelectedRows();
    updateSaveControls();
    renderMarkers(filtered());
    syncViewerMode();
    if (focusViewer) $('close-viewer').focus({ preventScroll: true });
    if (focusMap && map) {
      const zoom = Math.max(7.5, map.getZoom());
      const point = map.project([camera.lat, camera.lng], zoom);
      if (innerWidth > 760) point.x += innerWidth > 1150 ? 125 : 85;
      map.flyTo(map.unproject(point, zoom), zoom, {
        duration: reducedMotion ? 0 : .7,
        animate: !reducedMotion,
      });
    }
    if (autoPlay) startVideo();
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      document.querySelector('script[data-youtube-api]')?.remove();
      const script = document.createElement('script');
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onerror = null;
        if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = undefined;
        if (error) {
          script.remove();
          reject(error);
        } else {
          resolve();
        }
      };
      const ready = () => { if (window.YT?.Player) finish(); };
      const timer = setTimeout(() => finish(new Error('API_TIMEOUT')), 12000);
      window.onYouTubeIframeAPIReady = ready;
      script.src = 'https://www.youtube.com/iframe_api';
      script.dataset.youtubeApi = 'true';
      script.onerror = () => finish(new Error('API_LOAD_FAILED'));
      document.head.appendChild(script);
    }).catch(error => {
      apiPromise = null;
      throw error;
    });
    return apiPromise;
  }
  function showVideoError(code) {
    const mediaHadFocus = $('player-mount').contains(document.activeElement) ||
      $('preview').contains(document.activeElement);
    stopPlayer();
    const messages = {
      100: ['Camera unavailable', 'The broadcast may have ended or its address may have changed.'],
      101: ['Watch this video on YouTube', 'This video does not allow playback on other websites.'],
      150: ['Watch this video on YouTube', 'This video does not allow playback on other websites.'],
      153: ['Connection restricted', 'This browser could not verify the video source. Try the original page.'],
      5: ['Video could not play', 'Try a different browser or open the original source.'],
      NETWORK: ['Player could not load', 'Check your connection or content blocker, then try again.'],
      TIMEOUT: ['Taking longer than expected', 'Try again in a moment, or open the original source.'],
      MEDIA: ['Video could not load', 'Try again or check the original stream.'],
      UNSUPPORTED: ['Unsupported video format', 'Try another browser or open the original source.'],
    };
    const message = messages[code] ||
      ['Unable to connect', 'Please try again in a moment or check the original source.'];

    $('preview').hidden = true;
    $('player-mount').hidden = true;
    $('video-error').hidden = false;
    $('video-error-title').textContent = message[0];
    $('video-error-description').textContent = message[1];
    setPlayback('Unable to connect', 'error');
    $('reload-page').hidden = code !== 'NETWORK';
    if (mediaHadFocus) $('retry-video').focus({ preventScroll: true });
  }

  function openOfficialFrame(camera, token) {
    const frame = document.createElement('iframe');
    frame.title = camera.name + ' official broadcast player';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.onload = () => {
      if (token !== playerToken) return;
      clearPlaybackTimer();
      setPlayback('Official player · Use its Play and Continue controls', 'source');
    };
    frame.onerror = () => {
      if (token === playerToken) showVideoError('NETWORK');
    };
    frame.src = camera.embedUrl;
    $('player-mount').replaceChildren(frame);
    $('player-mount').hidden = false;
    $('preview').hidden = true;
    setPlayback('Opening the official player…', 'loading');
    watchPlayback(token);
  }

  function openHlsVideo(camera, token, { libraryError = false } = {}) {
    const bufferedStartup = camera.providerType === 'yeongsan';
    const video = document.createElement('video');
    videoElement = video;
    video.controls = true;
    video.autoplay = !bufferedStartup;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-label', camera.name + ' video');
    video.setAttribute('playsinline', '');

    let hasPlayed = false;
    let sessionStarted = false;
    let initialPlayRequested = false;
    const current = () => token === playerToken;

    const startSession = () => {
      if (!current() || sessionStarted || !camera.sessionLimitSeconds) return;
      sessionStarted = true;
      sessionTimer = setTimeout(() => {
        if (!current()) return;
        if (!hasPlayed) {
          showVideoError('TIMEOUT');
          return;
        }
        const mediaHadFocus = $('player-mount').contains(document.activeElement);
        stopPlayer();
        $('preview').hidden = true;
        $('video-error').hidden = true;
        $('video-limit').hidden = false;
        $('video-limit-text').textContent = camera.sessionLimitReason === 'app'
          ? 'Your ' + camera.sessionLimitSeconds + '-second viewing session has ended. Select Continue watching to reconnect.'
          : 'Playback paused at the ' + camera.sessionLimitSeconds + '-second viewing limit set by ' + camera.provider + '.';
        setPlayback('Session ended · Continue watching to reconnect', 'paused');
        if (mediaHadFocus) $('continue-video').focus({ preventScroll: true });
      }, camera.sessionLimitSeconds * 1000);
    };

    const play = () => {
      if (!current()) return;
      if (bufferedStartup) {
        if (initialPlayRequested || hasPlayed || !video.paused) return;
        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
        const buffered = video.buffered;
        const position = video.currentTime;
        let startAt = null;
        for (let i = 0; i < buffered.length; i++) {
          const candidate = Math.max(position, buffered.start(i));
          if (buffered.end(i) - candidate >= 3) {
            startAt = candidate;
            break;
          }
        }
        if (startAt === null) return;
        // A short first range or a nonzero media start must not strand prefill
        // at time zero. Align once to three contiguous buffered seconds.
        initialPlayRequested = true;
        if (startAt > position) video.currentTime = startAt;
      }
      const promise = video.play();
      promise?.catch(error => {
        if (!current()) return;
        if (error?.name === 'NotAllowedError') {
          clearPlaybackTimer();
          setPlayback('Press play on the video to begin', 'ready');
        } else {
          showVideoError('MEDIA');
        }
      });
    };

    const manifestReady = () => {
      if (!current()) return;
      if (camera.providerType === 'yongpyong') startSession();
      play();
    };
    if (bufferedStartup) {
      for (const event of ['play', 'pause']) {
        video.addEventListener(event, () => {
          if (current()) initialPlayRequested = true;
        });
      }
      for (const event of ['loadeddata', 'canplay', 'progress']) {
        video.addEventListener(event, play);
      }
    }
    if (camera.providerType === 'busan' || camera.providerType === 'wellihilli') {
      video.addEventListener('loadeddata', startSession);
    }
    video.addEventListener('playing', () => {
      if (!current()) return;
      hasPlayed = true;
      if (camera.providerType === 'phoenix') startSession();
      clearPlaybackTimer();
      setPlayback(
        camera.videoMode === 'recent_clip' ? 'Recent recording playing' : 'Live camera playing',
        'playing',
      );
    });
    for (const event of ['waiting', 'stalled']) {
      video.addEventListener(event, () => {
        if (!current()) return;
        watchPlayback(token);
        setPlayback('Buffering…', 'loading');
      });
    }
    video.addEventListener('pause', () => {
      if (!current()) return;
      clearPlaybackTimer();
      setPlayback('Paused', 'paused');
    });
    video.addEventListener('ended', () => {
      if (!current()) return;
      clearPlaybackTimer();
      setPlayback('Recording ended · Play again to replay', 'ended');
    });
    video.addEventListener('error', () => {
      if (current()) showVideoError('MEDIA');
    });

    $('player-mount').replaceChildren(video);
    $('player-mount').hidden = false;
    $('preview').hidden = true;
    watchPlayback(token);
    const stream = camera.proxy
      ? '/api/hls/' + encodeURIComponent(camera.id) + '/index.m3u8'
      : camera.streamUrl;
    try {
      if (window.Hls?.isSupported()) {
        hlsInstance = new Hls({
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
          backBufferLength: 0,
          capLevelToPlayerSize: true,
          ...(camera.providerType === 'jeju'
            ? { liveSyncDurationCount: 1, liveMaxLatencyDurationCount: 3 }
            : {}),
          ...(['high1', 'daegu', 'gwangju', 'changwon', 'cheonan', 'gits'].includes(camera.providerType)
            ? { progressive: true }
            : {}),
        });
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, manifestReady);
        if (bufferedStartup) hlsInstance.on(Hls.Events.FRAG_BUFFERED, play);
        hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
          if (!current()) return;
          if (data.fatal) {
            showVideoError('MEDIA');
          } else if (data.details === 'bufferStalledError') {
            watchPlayback(token);
            setPlayback('Buffering…', 'loading');
          }
        });
        hlsInstance.loadSource(stream);
        hlsInstance.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream;
        video.addEventListener('loadedmetadata', manifestReady);
      } else {
        showVideoError(libraryError ? 'NETWORK' : 'UNSUPPORTED');
        return;
      }
      // Match provider start points; High1 retains its connection-time 30-second cap.
      if (!['yongpyong', 'phoenix', 'busan', 'wellihilli'].includes(camera.providerType)) {
        startSession();
      }
    } catch {
      if (current()) showVideoError('MEDIA');
    }
  }

  async function startVideo() {
    if (!state.selected || $('viewer').hidden) return;
    stopPlayer();
    const token = playerToken;
    const camera = state.selected;
    if ($('preview').contains(document.activeElement) ||
        $('video-error').contains(document.activeElement) ||
        $('video-limit').contains(document.activeElement)) {
      $('close-viewer').focus({ preventScroll: true });
    }
    $('preview').hidden = false;
    $('video-error').hidden = true;
    setPlayback('Connecting to the camera…', 'loading');

    if (mediaKind(camera) === 'iframe') {
      openOfficialFrame(camera, token);
      return;
    }
    if (mediaKind(camera) === 'hls') {
      try {
        if (!window.Hls && window.KOREA_LOAD_SCRIPT) {
          await window.KOREA_LOAD_SCRIPT('vendor/hls.min.js');
        }
        if (token === playerToken) openHlsVideo(camera, token);
      } catch {
        if (token === playerToken) openHlsVideo(camera, token, { libraryError: true });
      }
      return;
    }

    try {
      await loadYouTubeApi();
      if (token !== playerToken) return;
      const holder = document.createElement('div');
      holder.id = 'youtube-player';
      $('player-mount').replaceChildren(holder);
      $('preview').hidden = true;
      $('player-mount').hidden = false;
      watchPlayback(token);
      player = new YT.Player(holder, {
        width: '100%',
        height: '100%',
        videoId: camera.videoId,
        playerVars: {
          origin: location.origin,
          playsinline: 1,
          autoplay: 1,
          mute: 1,
          controls: 1,
          rel: 0,
        },
        events: {
          onReady(event) {
            if (token !== playerToken) return;
            const frame = event.target.getIframe();
            frame.setAttribute('title', camera.name + ' YouTube video');
            frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
            setPlayback('Ready · Starting with sound off', 'ready');
            event.target.mute();
            event.target.playVideo();
          },
          onStateChange(event) {
            if (token !== playerToken) return;
            if (event.data === 1 || event.data === 0 || event.data === 2) {
              clearPlaybackTimer();
            } else if (event.data === 3) {
              watchPlayback(token);
            }
            const states = {
              [-1]: ['Connecting…', 'loading'],
              0: ['Broadcast or recording ended', 'ended'],
              1: ['Playing · Check the original player for live status', 'playing'],
              2: ['Paused', 'paused'],
              3: ['Loading video…', 'loading'],
              5: ['Ready to play', 'ready'],
            };
            const result = states[event.data];
            if (result) setPlayback(...result);
          },
          onError(event) {
            if (token === playerToken) showVideoError(event.data);
          },
          onAutoplayBlocked() {
            if (token === playerToken) {
              clearPlaybackTimer();
              setPlayback('Press play in the player to begin', 'ready');
            }
          },
        },
      });
    } catch {
      if (token === playerToken) showVideoError('NETWORK');
    }
  }
  function plainNavigation(event) {
    return !event.defaultPrevented && !(event.button > 0) &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function syncRegionControl() {
    if ($('region-label')) {
      $('region-label').textContent = state.region === 'all' ? 'All regions' : state.region;
    }
    for (const link of regionLinks) {
      if (link.dataset.region === state.region) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function updatePageMetadata() {
    if (!seo) return;
    if (!pageMetadata.has(state.region)) {
      pageMetadata.set(state.region, seo.page(cameras, state.region));
    }
    const page = pageMetadata.get(state.region);
    document.title = page.title;
    document.body.dataset.region = state.region;
    if ($('page-heading')) $('page-heading').textContent = page.heading;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = page.url;
    for (const [selector, content] of [
      ['meta[name="description"]', page.description],
      ['meta[property="og:url"]', page.url],
      ['meta[property="og:title"]', page.title],
      ['meta[property="og:description"]', page.description],
      ['meta[name="twitter:title"]', page.title],
      ['meta[name="twitter:description"]', page.description],
    ]) {
      document.querySelector(selector)?.setAttribute('content', content);
    }
    if ($('site-schema')) $('site-schema').textContent = JSON.stringify(page.schema);
  }

  function filterSnapshot() {
    return {
      category: state.category, region: state.region, kind: state.kind,
      query: state.query, savedOnly: state.savedOnly,
    };
  }

  function replaceRegionUrl({ preserveHash = false } = {}) {
    if (!seo) return;
    const url = new URL(location.href);
    url.pathname = seo.regionPath(state.region);
    if (!preserveHash) url.hash = '';
    history.replaceState({ filters: filterSnapshot() }, '', url);
    updatePageMetadata();
  }

  function changeRegion(region) {
    if (region !== 'all' && !regions.has(region)) return;
    if (regionMenu) {
      regionMenu.open = false;
      $('region-summary')?.focus({ preventScroll: true });
    }
    if (state.region === region) return;
    if (seo) {
      history.replaceState({ filters: filterSnapshot() }, '', location.href);
    }
    state.region = region;
    syncRegionControl();
    if (seo) {
      const url = new URL(location.href);
      url.pathname = seo.regionPath(region);
      url.hash = '';
      history.pushState({ filters: filterSnapshot() }, '', url);
      updatePageMetadata();
    }
    render();
    fitMap();
  }

  function reset({ preserveHash = false } = {}) {
    const resetHadFocus = document.activeElement === $('reset-filters');
    state.category = 'all';
    state.region = 'all';
    state.kind = 'all';
    state.query = '';
    state.savedOnly = false;
    $('media-kind').value = 'all';
    $('search').value = '';
    syncRegionControl();
    replaceRegionUrl({ preserveHash });
    syncFilters();
    render();
    fitMap();
    if (resetHadFocus) $('search').focus({ preventScroll: true });
  }

  function syncFilters() {
    document.querySelectorAll('[data-category]').forEach(button => {
      const active = button.dataset.category === state.category;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('explore-tab').classList.toggle('active', !state.savedOnly);
    $('saved-tab').classList.toggle('active', state.savedOnly);
    $('explore-tab').setAttribute('aria-pressed', String(!state.savedOnly));
    $('saved-tab').setAttribute('aria-pressed', String(state.savedOnly));
  }

  function random() {
    const visible = filtered();
    if (!visible.length) return;
    const options = visible.length > 1
      ? visible.filter(camera => camera.id !== state.selected?.id) : visible;
    const camera = options[Math.floor(Math.random() * options.length)];
    select(camera.id, { focusMap: true, autoPlay: true });
    rows.get(camera.id)?.element.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }

  // One delegated listener serves the entire reusable camera list.
  $('camera-list').addEventListener('click', event => {
    const bookmark = event.target.closest('[data-save]');
    if (bookmark) {
      save(bookmark.dataset.save);
      return;
    }
    const selectButton = event.target.closest('[data-select]');
    if (selectButton && plainNavigation(event)) {
      event.preventDefault();
      select(selectButton.dataset.select, { focusMap: true, autoPlay: true });
    }
  });
  $('categories').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    syncFilters();
    render();
    fitMap();
  });
  $('search').addEventListener('input', event => {
    state.query = event.target.value;
    if (state.query.trim()) setListCollapsed(false);
    scheduleRender();
  });
  $('media-kind').addEventListener('change', event => {
    state.kind = event.target.value;
    render();
    fitMap();
  });
  regionMenu?.addEventListener('click', event => {
    const link = event.target.closest('[data-region]');
    if (!link || !plainNavigation(event)) return;
    event.preventDefault();
    changeRegion(link.dataset.region);
  });
  document.addEventListener('click', event => {
    if (regionMenu?.open && !regionMenu.contains(event.target)) regionMenu.open = false;
  });
  $('explore-tab').addEventListener('click', () => {
    state.savedOnly = false;
    setListCollapsed(false);
    syncFilters();
    render();
    fitMap();
  });
  $('saved-tab').addEventListener('click', () => {
    setListCollapsed(false);
    state.savedOnly = true;
    state.category = 'all';
    state.region = 'all';
    state.kind = 'all';
    state.query = '';
    $('media-kind').value = 'all';
    syncRegionControl();
    $('search').value = '';
    syncFilters();
    replaceRegionUrl();
    render();
    fitMap();
  });
  $('reset-filters').addEventListener('click', reset);
  $('random-button').addEventListener('click', random);
  $('play-button').addEventListener('click', startVideo);
  $('retry-video').addEventListener('click', startVideo);
  $('continue-video').addEventListener('click', startVideo);
  $('close-viewer').addEventListener('click', closeViewer);
  $('viewer-save').addEventListener('click', () => {
    if (state.selected) save(state.selected.id);
  });
  $('reload-page').addEventListener('click', () => location.reload());
  if (!window.KOREA_MAP_VIEW) $('list-toggle').addEventListener('click', () => {
    setListCollapsed(!document.body.classList.contains('list-collapsed'));
  });
  document.querySelector('.skip-link')?.addEventListener('click', event => {
    event.preventDefault();
    setListCollapsed(false);
    $('camera-list').focus({ preventScroll: true });
  });
  $('share-button').addEventListener('click', async () => {
    if (!state.selected) return;
    const url = new URL(location.href);
    url.hash = 'cam=' + encodeURIComponent(state.selected.id);
    try {
      await navigator.clipboard.writeText(url.href);
      toast('Link copied');
    } catch {
      $('share-url').value = url.href;
      $('share-dialog').showModal();
      $('share-url').select();
    }
  });
  $('close-share').addEventListener('click', () => $('share-dialog').close());
  $('share-dialog').addEventListener('close', () => {
    if (!$('viewer').hidden) $('share-button').focus({ preventScroll: true });
  });
  document.querySelector('.brand').addEventListener('click', event => {
    if (!plainNavigation(event)) return;
    event.preventDefault();
    closeViewer({ restoreFocus: false });
    state.selected = null;
    const url = new URL(location.href);
    url.pathname = '/';
    url.hash = '';
    history.replaceState(null, '', url);
    setListCollapsed(compactViewport.matches);
    reset();
    updatePageMetadata();
  });
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && regionMenu?.open) {
      event.preventDefault();
      regionMenu.open = false;
      $('region-summary')?.focus({ preventScroll: true });
      return;
    }
    if ($('viewer').getAttribute('aria-modal') === 'true') {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeViewer();
      } else if (event.key === 'Tab') {
        const focusable = [...$('viewer').querySelectorAll('button,a[href],input,iframe,[tabindex]')]
          .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
        const first = focusable[0];
        const last = focusable.at(-1);
        const active = document.activeElement;
        if (first && ((event.shiftKey && active === first) ||
            (!event.shiftKey && active === last) || !$('viewer').contains(active))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
      return;
    }
    if (event.target.matches('input,textarea,select')) return;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      $('search').focus();
    } else if (event.key.toLowerCase() === 'r' && !event.repeat &&
        !event.ctrlKey && !event.metaKey && !event.altKey) {
      random();
    } else if (event.key === 'Escape') {
      closeViewer();
    }
  });
  addEventListener('hashchange', () => {
    const id = new URLSearchParams(location.hash.slice(1)).get('cam');
    if (!knownIds.has(id)) return;
    if (state.selected?.id === id && !$('viewer').hidden) return;
    filtered();
    if (!visibleIds.has(id)) reset({ preserveHash: true });
    select(id, { focusMap: true, writeHash: false, focusViewer: true });
  });
  addEventListener('popstate', event => {
    if (!seo) return;
    closeViewer({ restoreFocus: false });
    state.selected = null;
    const restored = event.state?.filters;
    state.region = seo.regionFromPath(location.pathname) || 'all';
    state.category = ['all', 'city', 'sea', 'nature'].includes(restored?.category)
      ? restored.category : 'all';
    state.kind = ['all', 'hls', 'iframe', 'youtube'].includes(restored?.kind)
      ? restored.kind : 'all';
    state.query = typeof restored?.query === 'string' ? restored.query : '';
    state.savedOnly = restored?.savedOnly === true;
    $('search').value = state.query;
    $('media-kind').value = state.kind;
    syncRegionControl();
    syncFilters();
    updatePageMetadata();
    render();
    fitMap();
    const requested = new URLSearchParams(location.hash.slice(1)).get('cam');
    if (visibleIds.has(requested)) {
      select(requested, { focusMap: true, writeHash: false, focusViewer: false });
    }
  });
  addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    try {
      const values = JSON.parse(event.newValue || '[]');
      const next = new Set(Array.isArray(values) ? values.filter(id => knownIds.has(id)) : []);
      const changedIds = [...new Set([...favorites, ...next])]
        .filter(id => favorites.has(id) !== next.has(id));
      if (!changedIds.length) return;
      favorites = next;
      favoritesVersion++;
      updateSaveControls(changedIds);
      if (state.savedOnly) render();
    } catch {}
  });

  $('viewer').hidden = true;
  adoptRows();
  syncRegionControl();
  initMap();
  render();
  $('map').dataset.camerasReadyAt = String(Math.round(window.performance.now()));
  window.performance.mark?.('koreanow:cameras-ready');
  const requested = new URLSearchParams(location.hash.slice(1)).get('cam');
  if (knownIds.has(requested)) {
    if (!visibleIds.has(requested)) reset({ preserveHash: true });
    select(requested, { focusMap: true, writeHash: false, focusViewer: compactViewport.matches });
  } else {
    syncViewerMode();
  }
}

function showStartupError(error) {
  console.error('Camera catalog unavailable:', error);
  const list = document.getElementById('camera-list');
  const hasStaticRows = list.children.length > 0;
  list.hidden = !hasStaticRows;
  document.getElementById('empty-state').hidden = hasStaticRows;
  document.getElementById('random-button').disabled = true;
  let retry;
  if (hasStaticRows) {
    const notice = document.getElementById('map-notice');
    notice.dataset.catalogError = 'true';
    notice.textContent = 'Camera locations could not load. Source links still work. ';
    notice.hidden = false;
    retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'secondary-button';
    notice.appendChild(retry);
  } else {
    document.getElementById('empty-title').textContent = 'Cameras could not load';
    document.getElementById('empty-description').textContent = 'Check your connection and refresh to try again.';
    document.getElementById('result-count').textContent = '—';
    document.getElementById('video-total').textContent = '—';
    retry = document.getElementById('reset-filters');
  }
  retry.textContent = 'Reload cameras';
  retry.addEventListener('click', () => location.reload(), { once: true });
}

if (window.KOREA_CATALOG_READY) {
  window.KOREA_CATALOG_READY.then(startApp).catch(showStartupError);
} else {
  startApp();
}
