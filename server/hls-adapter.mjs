import { handleHls } from '../worker/hls.mjs';

// Preserve the original pathname and query. The relay owns the allowlist,
// manifest rewriting, deadlines and byte limits; this adapter only connects
// the hosting runtime's cancellation signal to its upstream fetches.
export function serveHls(request, { catalog, fetchImpl = fetch } = {}) {
  return handleHls(request, {
    catalog,
    fetchImpl(url, options = {}) {
      const signals = [request.signal, options.signal].filter(Boolean);
      return fetchImpl(url, { ...options, signal: AbortSignal.any(signals) });
    }
  });
}
