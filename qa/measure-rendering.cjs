'use strict';

// Reproducible offline operation counts. The baseline comes from the committed
// pre-optimization app; both runs use the same 400-camera English catalog and
// deterministic DOM/Leaflet fixtures. No browser timing or FPS is reported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {createHarness, englishCameraSource, flushMicrotasks} = require('./helpers/player-harness.cjs');

const root = path.resolve(__dirname, '..');
const baselineCommit = '8d41c8b79245cc78ca3a57029b15d00c76b84513';
const baselineTree = 'a81d7f47f116e1b6409ba7afd09cbf06b09b8025';
// Publication preserved these blob/tree objects while assigning a new commit
// ID. Read immutable blobs so the measurement also works in public clones.
const baselineBlobs = Object.freeze({
  'web/app.js': 'e54bb91720c3051bfe43e7912120a6d78f53622b',
  'web/index.html': '8820ef298a8f682ebcce6d3205d27608784aafe9',
  'web/cameras.js': '6c61e776172e10cddacdd9d068cb48fdbde7997f',
  'web/catalog-en.js': 'e8a8b26287616d0942470ff34e32a2c2190e24db',
});
const fromGit = relative => {
  assert.ok(Object.hasOwn(baselineBlobs, relative), 'Missing baseline blob for ' + relative);
  return execFileSync('git', ['cat-file', 'blob', baselineBlobs[relative]],
    {cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const baselineApp = fromGit('web/app.js'), baselineHtml = fromGit('web/index.html');
const currentApp = read('web/app.js');
const ids = h => h.get('camera-list').children.map(row => row.dataset.camera);

const scenarios = [
  {
    name: 'select_one_camera',
    description: 'Open the first camera at a fixed map zoom of 12.',
    act(h) { h.chooseCamera(h.context.KOREA_DISPLAY_CAMERAS[0].id); }
  },
  {
    name: 'save_one_camera',
    description: 'Save one camera while browsing the full catalog.',
    act(h) {
      const id = h.context.KOREA_DISPLAY_CAMERAS[0].id;
      h.fire('camera-list', 'click', {target: h.document.querySelector('[data-save="' + id + '"]')});
    }
  },
  {
    name: 'search_input_burst',
    description: 'Type B, Bus and Busan before the next animation frame.',
    act(h) {
      for (const query of ['B', 'Bus', 'Busan']) {
        h.get('search').value = query; h.fire('search', 'input');
      }
    }
  },
  {
    name: 'equivalent_search',
    description: 'Change Busan to whitespace/case-equivalent text after filtering.',
    prepare(h) { h.get('search').value = 'Busan'; h.fire('search', 'input'); h.flushAnimationFrames(); },
    act(h) { h.get('search').value = '  bUSAN  '; h.fire('search', 'input'); }
  },
  {
    name: 'resize_burst',
    description: 'Deliver three different nonzero map sizes before the next frame.',
    act(h) { h.resize(1100, 800); h.resize(1000, 800); h.resize(900, 760); }
  }
];

async function measure(config, scenario) {
  const h = createHarness({cameraSource: englishCameraSource, withMap: true, mapZoom: 12, ...config});
  await flushMicrotasks();
  h.flushAnimationFrames();
  scenario.prepare?.(h);
  const initialRows = new Set(h.get('camera-list').children);
  const group = h.mapFixture.groups[0], initialMarkers = new Set(group.getLayers());
  h.resetOperations(); h.mapFixture.resetOperations();
  scenario.act(h);
  h.flushAnimationFrames();
  await flushMicrotasks();
  const dom = h.snapshotOperations(), map = h.mapFixture.snapshotOperations();
  return {
    counts: {
      createdRowElements: dom.createdByTag.ARTICLE || 0,
      rowInsertions: dom.rowInsertions,
      rowRemovals: dom.rowRemovals,
      wholesaleListReplacements: dom.listReplacements,
      attributeWrites: dom.attributeWrites,
      markerCreates: map.markerCreates,
      markerRemovals: map.markerRemovals,
      markerLayerClears: map.clearLayers,
      mapInvalidations: map.invalidations,
      visibleRows: h.get('camera-list').children.length,
      retainedVisibleRowNodes: h.get('camera-list').children.filter(row => initialRows.has(row)).length,
      visibleMarkers: group.getLayers().length,
      retainedVisibleMarkerObjects: group.getLayers().filter(marker => initialMarkers.has(marker)).length,
    },
    finalIds: ids(h),
    raw: {dom, map}
  };
}

(async () => {
  const {createSeoAssets} = await import('../server/seo-pages.mjs');
  const generated = createSeoAssets(path.join(root, 'web'));
  const inputs = {};
  for (const relative of ['web/cameras.js', 'web/catalog-en.js']) {
    const before = sha(fromGit(relative)), after = sha(read(relative));
    assert.equal(after, before, 'The measured catalog must match the baseline: ' + relative);
    inputs[relative] = after;
  }
  const results = [];
  for (const scenario of scenarios) {
    const baseline = await measure({appCode: baselineApp, htmlSource: baselineHtml, useRegionMenu:false}, scenario);
    const current = await measure({appCode: currentApp, htmlSource: generated.pages.get('/'), withSeo:true}, scenario);
    assert.deepEqual(current.finalIds, baseline.finalIds, scenario.name + ' must produce the same camera IDs/order');
    results.push({scenario: scenario.name, description: scenario.description,
      finalCameraIdsSha256: sha(JSON.stringify(current.finalIds)),
      baseline: baseline.counts, current: current.counts,
      raw: {baseline: baseline.raw, current: current.raw}});
  }
  const report = {
    generatedAt: new Date().toISOString(),
    measurement: 'Simulated DOM and Leaflet operation counts, not browser performance timings',
    limitations: ['No layout, painting, FPS, Core Web Vitals, GPU work, real media delivery, or network latency is measured.',
      'The map uses deterministic Web Mercator projection and a fixed initial zoom of 12.',
      'Both runs use the same English production catalog; the current initial DOM is the generated home page.',
      'Counters are reset after startup and scenario preparation. Legitimate viewer/media changes remain included.'],
    baselineCommit, baselineTree, baselineBlobs,
    baselineAppSha256: sha(baselineApp), currentAppSha256: sha(currentApp),
    cameraCount: 400, unchangedCatalogSources: inputs,
    harnessSha256: Object.fromEntries(['qa/helpers/player-harness.cjs', 'qa/helpers/instrumented-dom.cjs', 'qa/helpers/leaflet-stub.cjs']
      .map(relative => [relative, sha(read(relative))])),
    results
  };
  const destination = path.join(__dirname, 'performance', 'rendering-operation-report.json');
  fs.mkdirSync(path.dirname(destination), {recursive:true});
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({report: path.relative(root, destination), baselineAppSha256: report.baselineAppSha256,
    currentAppSha256: report.currentAppSha256,
    results: results.map(({scenario, baseline, current}) => ({scenario, baseline, current}))}, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
