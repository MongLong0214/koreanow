'use strict';

// Offline Leaflet surface for identity/churn checks. Projection is Web Mercator;
// layout, tiles, animation, canvas/WebGL and visual smoothness are not simulated.
function createLeafletStub(document, fixedZoom = 12) {
  const operations = { markerCreates: 0, markerRemovals: 0, markerIconChanges: 0, clearLayers: 0,
    markerMoves: 0, invalidations: 0, fitBounds: 0, flyTo: 0 };
  const maps = [], groups = [], markers = [];
  const point = (x, y) => ({ x, y, add(other) { return point(x + other.x, y + other.y); }, subtract(other) { return point(x - other.x, y - other.y); } });
  const ll = value => Array.isArray(value) ? {lat: value[0], lng: value[1]} : value;
  function project(value, zoom) {
    const {lat,lng} = ll(value), size = 256 * 2 ** zoom, sine = Math.sin(lat * Math.PI / 180);
    return point((lng + 180) / 360 * size, (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size);
  }
  const attributionControl = { setPrefix() {}, addAttribution() {}, removeAttribution() {} };
  const L = {
    point, latLng: (a, b) => b === undefined ? ll(a) : {lat:a,lng:b},
    latLngBounds(points) { return { points, getCenter() { return { lat:points.reduce((sum,p)=>sum+ll(p).lat,0)/points.length,lng:points.reduce((sum,p)=>sum+ll(p).lng,0)/points.length }; } }; },
    divIcon: options => options,
    control: { scale: () => ({addTo() { return this; }}) },
    map(id, options) {
      const events = new Map(), container = document.getElementById(id), overlay = document.createElement('div');
      const map = {
        options, zoom:fixedZoom, attributionControl, popup:null,
        setView(center, zoom) { this.center=ll(center); this.zoom=fixedZoom ?? zoom; return this; },
        getZoom() { return this.zoom; }, getCenter() { return this.center; },
        getSize() { return point(1200,800); }, getContainer() { return container; },
        getPanes() { return { overlayPane:overlay }; },
        project(value,zoom=this.zoom) { return project(value,zoom); },
        unproject(value,zoom=this.zoom) { const size=256*2**zoom; return {lng:value.x/size*360-180,lat:(2*Math.atan(Math.exp((.5-value.y/size)*2*Math.PI))-Math.PI/2)*180/Math.PI}; },
        on(name, listener) { if (!events.has(name)) events.set(name,[]); events.get(name).push(listener); return this; },
        off(name, listener) { events.set(name,(events.get(name)||[]).filter(item=>item!==listener)); return this; },
        fire(name) { for(const listener of events.get(name)||[]) listener({target:this}); return this; },
        fitBounds(bounds, config) { operations.fitBounds++; this.bounds=bounds; this.fitOptions=config; return this; },
        flyTo(center, zoom) { operations.flyTo++; this.center=ll(center); const changed=this.zoom!==zoom; this.zoom=zoom; if(changed)this.fire('zoomend'); return this; },
        zoomIn() { this.zoom++; this.fire('zoomend'); return this; },
        zoomOut() { this.zoom--; this.fire('zoomend'); return this; },
        invalidateSize() { operations.invalidations++; return this; },
        closePopup() { this.popup?.content?.remove(); this.popup=null; return this; },
        removeLayer(layer) { layer.remove?.(); return this; },
        hasLayer(layer) { return layer.map===this; }
      };
      maps.push(map); return map;
    },
    layerGroup() {
      const layers=new Set();
      const group={
        addTo(map) { this.map=map; return this; },
        addLayer(marker) { layers.add(marker); marker.group=this; this.map.getContainer().appendChild(marker.element); return this; },
        removeLayer(marker) { if(layers.delete(marker)){operations.markerRemovals++;marker.element.remove();marker.group=null;} return this; },
        clearLayers() { operations.clearLayers++; [...layers].forEach(marker=>this.removeLayer(marker)); return this; },
        getLayers() { return [...layers]; }, hasLayer(marker) { return layers.has(marker); }
      };
      groups.push(group); return group;
    },
    marker(position, options={}) {
      operations.markerCreates++;
      const events=new Map(), element=document.createElement('div');
      element.className='leaflet-marker-icon '+(options.icon?.className||''); element.innerHTML=options.icon?.html||'';
      if(options.title)element.setAttribute('title',options.title);
      element.tabIndex=0;
      const marker={
        position:ll(position),options,element,group:null,
        addTo(group) { group.addLayer(this); return this; },
        getElement() { return this.element; }, getLatLng() { return this.position; },
        setLatLng(next) { operations.markerMoves++;this.position=ll(next);return this; },
        setZIndexOffset(value) { this.options.zIndexOffset=value;return this; },
        setIcon(icon) { operations.markerIconChanges++;this.options.icon=icon;this.element.className='leaflet-marker-icon '+icon.className;this.element.innerHTML=icon.html;return this; },
        on(name,listener) { if(!events.has(name))events.set(name,[]);events.get(name).push(listener);return this; },
        off(name,listener) { events.set(name,(events.get(name)||[]).filter(item=>item!==listener));return this; },
        fire(name='click') { for(const listener of events.get(name)||[])listener({target:this});return this; },
        remove() { this.group?.removeLayer(this);return this; }
      };
      markers.push(marker); return marker;
    },
    popup() { return { setLatLng(value) {this.position=value;return this;},setContent(value){this.content=value;return this;},openOn(map){map.popup=this;map.getContainer().appendChild(this.content);return this;} }; }
  };
  return { L, maps, groups, markers, operations,
    resetOperations() { for(const key of Object.keys(operations))operations[key]=0; },
    snapshotOperations() { return {...operations}; } };
}

module.exports = { createLeafletStub };
