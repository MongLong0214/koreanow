import fs from 'node:fs';
import vm from 'node:vm';

// The browser catalog remains the single source of truth. Load its fixed public
// routes once per function instance; never retain provider connection tokens.
const source = fs.readFileSync(new URL('../web/cameras.js', import.meta.url), 'utf8');
const primary = { window: {} };
const diagnostic = { window: {}, location: { search: '?qa-candidates=1' }, URLSearchParams };
vm.runInNewContext(source, primary);
vm.runInNewContext(source, diagnostic);

export const cameras = primary.window.KOREA_CAMERAS;
export const diagnosticCameras = diagnostic.window.KOREA_CAMERAS;
export const hlsCatalog = Object.freeze(Object.fromEntries(
  [...cameras, ...diagnosticCameras]
    .filter(camera => camera.kind === 'hls' && camera.proxy)
    .map(camera => [camera.id, Object.freeze({ streamUrl: camera.streamUrl, providerType: camera.providerType })])
));
