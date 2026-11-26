// Generate the normal visitor payload from the preserved source and English
// display layer. Diagnostic data and QA provenance remain in their own files.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const PUBLIC_CAMERA_FIELDS = Object.freeze([
  'id', 'name', 'region', 'location', 'category', 'categoryLabel',
  'kind', 'lat', 'lng', 'provider', 'providerType', 'sourceUrl',
  'streamUrl', 'embedUrl', 'videoId', 'proxy', 'videoMode',
  'sessionLimitSeconds', 'sessionLimitReason', 'searchAliases',
]);

export function createPublicCatalog(webDirectory) {
  const web = path.resolve(webDirectory);
  const context = vm.createContext({window: {}, location: {search: ''}, URLSearchParams});
  vm.runInContext(fs.readFileSync(path.join(web, 'cameras.js'), 'utf8'), context,
    {filename: 'cameras.js', timeout: 2000});
  const original = context.window.KOREA_CAMERAS;
  if (!Array.isArray(original) || original.length !== 400) {
    throw new Error('The normal public catalog must contain the selected 400 cameras.');
  }
  const before = JSON.stringify(original);
  vm.runInContext(fs.readFileSync(path.join(web, 'catalog-en.js'), 'utf8'), context,
    {filename: 'catalog-en.js', timeout: 2000});
  if (JSON.stringify(context.window.KOREA_CAMERAS) !== before) {
    throw new Error('English localization must not mutate the original catalog.');
  }
  const display = context.window.KOREA_DISPLAY_CAMERAS;
  if (!Array.isArray(display) || display.length !== original.length) {
    throw new Error('English display coverage does not match the selected catalog.');
  }
  const ids = new Set();
  const rows = display.map((camera, index) => {
    if (camera.id !== original[index].id || ids.has(camera.id)) {
      throw new Error('Public camera identities must retain their unique selection order.');
    }
    ids.add(camera.id);
    return Object.fromEntries(PUBLIC_CAMERA_FIELDS
      .filter(field => Object.hasOwn(camera, field))
      .map(field => [field, camera[field]]));
  });
  // Materialize plain JSON values outside the source VM. This helper performs
  // no source writes and is shared by the build and development server.
  return JSON.parse(JSON.stringify(rows));
}

export function serializePublicCatalog(webDirectory) {
  return JSON.stringify(createPublicCatalog(webDirectory)) + '\n';
}
