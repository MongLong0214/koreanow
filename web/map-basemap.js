(() => {
  'use strict';
  const tileJsonUrl='https://tiles.openfreemap.org/planet';
  // Canvas labels must be drawable before the interface web font arrives.
  const labelFontFamily='system-ui, sans-serif';
  const attribution='<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="/vendor/maplibre-dark-style-LICENSE.txt" target="_blank" rel="noopener">Style</a>';
  let libraryPromise;
  function loadLibrary(){
    if(window.protomapsL)return Promise.resolve(window.protomapsL);
    if(libraryPromise)return libraryPromise;
    libraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const finish=error=>{clearTimeout(timer);script.onload=null;script.onerror=null;if(error){script.remove();reject(error);}else resolve(window.protomapsL);};
      const timer=setTimeout(()=>finish(new Error('Canvas map renderer timed out')),15000);
      script.onload=()=>finish(window.protomapsL?null:new Error('Canvas map renderer unavailable'));
      script.onerror=()=>finish(new Error('Canvas map renderer could not load'));
      script.src='/vendor/protomaps-leaflet.js';document.head.appendChild(script);
    }).catch(error=>{libraryPromise=null;throw error;});
    return libraryPromise;
  }
  async function loadTileJson(){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(tileJsonUrl,{signal:controller.signal});
      if(!response.ok)throw new Error('Map source returned '+response.status);
      const source=await response.json();
      if(!Array.isArray(source.tiles)||typeof source.tiles[0]!=='string')throw new Error('Map tile addresses unavailable');
      return source;
    }finally{clearTimeout(timer);}
  }
  function makeRules(p,onFeatureDrawn){
    const englishFields=['name:en','name_en'];
    const asciiName=/^[\x00-\x7f]*$/;
    const letter=/\p{Letter}/u;
    const latin=/\p{Script=Latin}/u;
    const nameCache=new WeakMap();
    const validName=value=>{
      if(typeof value!=='string'||!value.trim())return false;
      if(asciiName.test(value))return true;
      for(const character of value)if(letter.test(character)&&!latin.test(character))return false;
      return true;
    };
    const names=(_zoom,feature)=>{
      let fields=nameCache.get(feature.props);
      if(!fields){
        fields=englishFields.filter(key=>validName(feature.props[key]));
        nameCache.set(feature.props,fields);
      }
      return fields;
    };
    const isClass=(...classes)=>(_zoom,feature)=>classes.includes(feature.props.class);
    const isLine=(_zoom,feature)=>feature.geomType===p.GeomType.Line;
    const isPolygon=(_zoom,feature)=>feature.geomType===p.GeomType.Polygon;
    const line=(color,width,extra={})=>new p.LineSymbolizer({color,width,lineCap:'round',lineJoin:'round',...extra});
    const polygon=(fill,extra={})=>new p.PolygonSymbolizer({fill,...extra});
    const roadWidth=p.exp(1.35,[[6,.45],[10,1.2],[14,3],[18,11],[20,20]]);
    const minorWidth=p.exp(1.45,[[11,.7],[14,1.3],[18,6],[20,13]]);
    const motorwayWidth=p.exp(1.35,[[5,.6],[9,1.6],[14,4],[18,15],[20,26]]);
    const paintRules=[
      {dataLayer:'landcover',symbolizer:polygon('#1b2c27',{opacity:.55}),filter:isClass('wood','grass')},
      {dataLayer:'landuse',symbolizer:polygon('#222d32',{opacity:.65}),filter:isClass('residential','commercial','industrial')},
      {dataLayer:'landuse',symbolizer:polygon('#1b3028'),filter:isClass('park','forest','cemetery')},
      {dataLayer:'park',symbolizer:polygon('#1b3028',{opacity:.75})},
      {dataLayer:'water',symbolizer:polygon('#0c161c'),filter:isPolygon},
      {dataLayer:'waterway',minzoom:8,symbolizer:line('#0c161c',p.exp(1.3,[[8,.5],[14,2],[20,8]])),filter:isLine},
      {dataLayer:'aeroway',minzoom:11,symbolizer:polygon('#26363d'),filter:isPolygon},
      {dataLayer:'building',minzoom:13,symbolizer:polygon('#253239',{stroke:'#3a4951',width:.55}),filter:isPolygon},
      {dataLayer:'transportation',minzoom:13,symbolizer:polygon('#293b43'),filter:isPolygon},
      {dataLayer:'transportation',minzoom:13,symbolizer:line('#405147',p.linear([[13,.7],[20,3]]),{dash:[2,3]}),filter:isClass('path','track')},
      {dataLayer:'transportation',minzoom:11,symbolizer:line('#344148',minorWidth),filter:isClass('minor','service','residential')},
      {dataLayer:'transportation',minzoom:7,symbolizer:line('#202c32',z=>roadWidth(z)+1.3),filter:isClass('primary','secondary','tertiary','trunk')},
      {dataLayer:'transportation',minzoom:7,symbolizer:line('#4a595e',roadWidth),filter:isClass('primary','secondary','tertiary','trunk')},
      {dataLayer:'transportation',minzoom:5,symbolizer:line('#263637',z=>motorwayWidth(z)+1.6),filter:isClass('motorway')},
      {dataLayer:'transportation',minzoom:5,symbolizer:line('#63756c',motorwayWidth),filter:isClass('motorway')},
      {dataLayer:'transportation',minzoom:12,symbolizer:line('#5b6464',p.linear([[12,.7],[18,2],[20,4]]),{dash:[3,3]}),filter:isClass('rail','transit')},
      {dataLayer:'aeroway',minzoom:12,symbolizer:line('#47575d',p.exp(1.5,[[12,2],[17,35],[20,55]])),filter:(z,f)=>isLine(z,f)&&f.props.class==='runway'},
      {dataLayer:'boundary',symbolizer:line('#45545b',.65,{dash:[3,3],opacity:.75}),filter:(_z,f)=>f.props.admin_level===4&&Number(f.props.maritime)!==1},
      {dataLayer:'boundary',symbolizer:line('#68797f',1.1,{opacity:.85}),filter:(_z,f)=>f.props.admin_level===2&&Number(f.props.maritime)!==1}
    ];
    // Count features after the public symbolizer draws them. A tileload event
    // alone is insufficient: the Canvas library also completes failed tiles.
    const observedRules=[];
    let featureDrawn=false;
    for(const rule of paintRules){
      const symbolizer=rule.symbolizer;
      observedRules.push([rule,symbolizer]);
      rule.symbolizer={
        before(context,zoom){symbolizer.before?.(context,zoom);},
        draw(context,geometry,zoom,feature){
          symbolizer.draw(context,geometry,zoom,feature);
          if(!featureDrawn&&geometry.length){featureDrawn=true;onFeatureDrawn();}
        }
      };
    }
    const stopObserving=()=>{for(const [rule,symbolizer] of observedRules)rule.symbolizer=symbolizer;};
    const text=(size,fill='#9daeb5',weight=500)=>new p.CenteredTextSymbolizer({labelProps:names,font:weight+' '+size+'px '+labelFontFamily,fill,stroke:'#172125',width:2.5,maxLineChars:22});
    const rank=(a,b)=>(Number(a.rank)||100)-(Number(b.rank)||100);
    const labelRules=[
      {dataLayer:'place',maxzoom:7,filter:isClass('country'),symbolizer:text(14,'#bdc9ce',600),sort:rank},
      {dataLayer:'place',minzoom:5,filter:isClass('city'),symbolizer:text(13,'#bdc9ce',600),sort:rank},
      {dataLayer:'place',minzoom:7,maxzoom:10,filter:isClass('state','province'),symbolizer:text(11,'#8c9da4'),sort:rank},
      {dataLayer:'place',minzoom:8,filter:isClass('town'),symbolizer:text(12),sort:rank},
      {dataLayer:'place',minzoom:11,filter:isClass('village','suburb'),symbolizer:text(11),sort:rank},
      {dataLayer:'place',minzoom:13,filter:isClass('neighbourhood','quarter','hamlet'),symbolizer:text(11),sort:rank},
      {dataLayer:'transportation_name',minzoom:12,filter:isLine,symbolizer:new p.LineLabelSymbolizer({labelProps:names,font:'500 10px '+labelFontFamily,fill:'#9baab0',stroke:'#1a2429',width:2,repeatDistance:220,maxLabelChars:34})},
      {dataLayer:'water_name',minzoom:8,filter:isLine,symbolizer:new p.LineLabelSymbolizer({labelProps:names,font:'italic 11px '+labelFontFamily,fill:'#7e9aa9',stroke:'#0c161c',width:2,repeatDistance:250,maxLabelChars:28})},
      {dataLayer:'water_name',minzoom:7,filter:(_z,f)=>f.geomType===p.GeomType.Point,symbolizer:text(11,'#7e9aa9')}
    ];
    return {paintRules,labelRules,stopObserving};
  }
  async function addTo(map){
    const [p,source]=await Promise.all([loadLibrary(),loadTileJson()]);
    if(!document.createElement('canvas').getContext('2d'))throw new Error('Canvas map rendering unavailable');
    let rendered=false;
    const {paintRules,labelRules,stopObserving}=makeRules(p,()=>{rendered=true;});
    const layer=p.leafletLayer({
      url:source.tiles[0],
      maxDataZoom:Number(source.maxzoom)||14,
      paintRules,labelRules,
      backgroundColor:'#172125',
      attribution,
      lang:'en',
      noWrap:true,
      maxZoom:20,
      updateWhenIdle:true,
      updateWhenZooming:false,
      keepBuffer:2
    });
    const ready=new Promise((resolve,reject)=>{
      let settled=false;
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);layer.off('tileload',check);layer.off('load',check);stopObserving();error?reject(error):resolve();};
      const check=()=>{if(rendered)finish();};
      const timer=setTimeout(()=>finish(new Error('Map tiles could not be rendered')),20000);
      layer.on('tileload',check);layer.on('load',check);
    });
    layer.addTo(map);
    return {layer,ready};
  }
  window.KOREA_CANVAS_BASEMAP={addTo};
})();
