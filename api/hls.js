import { hlsCatalog } from '../server/catalog.mjs';
import { serveHls } from '../server/hls-adapter.mjs';

export default {
  fetch(request) {
    // Return the relay's Response directly. Media segments must stay streamed,
    // including segments larger than the platform's buffered-response limit.
    return serveHls(request, { catalog: hlsCatalog });
  }
};
