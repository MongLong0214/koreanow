# Korea, now.

A compact, English-language map for exploring **400 public cameras across South Korea**.

**Website:** [koreanow.site](https://koreanow.site)

The map stays at the center of the experience: search a place, filter a region, select a camera, and watch. The search bar always shows the collection total; a filtered view shows both the matching count and the total, such as `8 / 400 videos`. Favorites are stored in the visitor's browser.

## Run locally

Use Node.js 24. No application dependencies, account credentials, or map API key are required.

```bash
npm run dev -- --port 5173
```

Open `http://localhost:5173`. The local server serves the static interface and the same HLS relay used by the Vercel function.

```bash
npm run check
```

This builds the static output and runs the source, catalog, player, relay, and deployment checks. Tests use local fixtures; they do not claim that all external cameras are currently online.

## Deploy to Vercel

Import this GitHub repository into Vercel using these settings. The checked-in `vercel.json` already provides the build, output, function, and route configuration.

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Node.js | 24.x |
| Build command | `npm run build` |
| Output directory | `dist` |
| Function region | Seoul (`icn1`) |
| Environment variables | None required |

Once the repository is connected, pushes to `main` deploy to production and pull requests receive preview deployments. GitHub Actions runs the checks separately. Add the owned domain in **Project Settings → Domains**; use the DNS values Vercel returns for that project.

The site has no ChatGPT Sites runtime dependency. Static files are served by Vercel's CDN. The single Node.js function at `api/hls.js` handles the existing `/api/hls/*` routes and streams approved media responses without collecting entire video segments in memory.

## Project structure

| Path | Purpose |
| --- | --- |
| `web/index.html`, `web/styles.css` | Page structure and responsive visual design |
| `web/app.js` | Map, search, filters, favorites, sharing, and player lifecycle |
| `web/bootstrap.js`, `web/resource-loader.js` | Validated public catalog startup and shared lazy script loading |
| `web/seo.js`, `server/seo-pages.mjs` | Shared route metadata and static collection-page generation |
| `web/catalog-en.js` | English camera names and search aliases |
| `web/cameras.js` | Camera source catalog, selected collection, and diagnostic candidates |
| `web/map-basemap.js`, `web/map-style-dark.json` | Detailed dark map and Canvas compatibility renderer |
| `web/map-geography.js` | Country-outline fallback |
| `web/social/` | Social preview PNG and editable vector source |
| `web/vendor/` | Pinned libraries, fonts, licenses, and provenance |
| `api/hls.js` | Vercel function entry point |
| `server/` | Shared catalog loading and request adapter |
| `worker/hls.mjs` | Provider allowlists and streaming relay implementation |
| `scripts/` | Local development server and static build |
| `qa/` | Regression tests, small fixtures, and selected historical evidence |
| `docs/SOURCE_AUDIT.md` | Public-source export scope and evidence limitations |

### Map and language

The basemap uses [OpenFreeMap](https://openfreemap.org/) vector tiles based on OpenStreetMap, with roads, railway, building footprints, parks, waterways, and geographic labels. MapLibre GL is the primary renderer; a Canvas2D renderer supports browsers without working graphics acceleration. If both detailed renderers fail, the map shows the outline fallback and a short status message.

Interface text and available map labels are English. The English camera catalog is a separate presentation layer so original IDs, provider URLs, coordinates, and evidence stay intact. Provider-controlled footage and embedded official players can contain Korean text. Search accepts original Korean place names as well as English labels.

### Social previews

Open Graph and X card metadata are included directly in `web/index.html`, so link crawlers do not need to run JavaScript. Both use the public 1200 × 630 PNG in `web/social/`; its editable SVG source is stored beside it. When replacing the image, give it a new versioned filename and update both image tags. Keep the metadata and image copy aligned with the selected camera collection.

### Rendering and loading

The application uses native DOM APIs and event delegation. Camera rows are keyed by ID; filtering reuses the surviving nodes, selection updates only the previous and current rows, and favorites update only the affected controls. Marker reconciliation retains unaffected Leaflet markers. Search text is normalized once, filtered collections are cached, and projected coordinates are reused until the map zoom changes. Search and map-resize work are coalesced with animation frames.

The build produces `catalog.json` with only the 400 selected, localized camera records and the fields the interface and players need. The full source catalog and English dictionary remain unchanged for maintenance, evidence, and `?qa-candidates=1`. HLS.js loads when an HLS camera is opened, and the country-outline geometry loads only if both detailed map renderers fail.

The build also renders the initial camera rows into HTML. The client adopts those exact nodes rather than replacing them. If catalog startup fails, the rendered camera links remain available and open the original sources.

### Search indexing

The home page and 17 regional collections are generated as complete HTML pages. Each has its own title, description, heading, canonical URL, social metadata, and structured data. The compact region control contains ordinary links, so regional navigation also works without JavaScript. Camera links point to their original sources; normal in-app clicks open the player.

`/sitemap.xml` lists only these 18 canonical collection URLs, and `/robots.txt` declares the sitemap. Unknown routes return a real 404. Diagnostic queries and the historical verification pages are marked `noindex`. Avoid adding a catch-all rewrite to the home page: it would turn missing URLs into misleading 200 responses.

Structured data describes the website and the actual camera collections. It does not claim video rich-result eligibility, invent publication dates or thumbnails, or mark the collection pages as individual watch pages. The `#cam=` fragment remains a sharing and interface-state feature.

For search-engine monitoring, verify `koreanow.site` in Google Search Console and submit `https://koreanow.site/sitemap.xml`. Indexing and ranking depend on the search engine; a successful build or deployment does not verify either.

### Video behavior

The selected collection contains **368 HLS streams and 32 official KBS players**. Only the selected camera connects. Switching, closing, or filtering out a camera cleans up the previous player's requests. Public providers can interrupt streams or impose viewing limits; session limits and reconnect actions remain visible. Failed video is never replaced by a still photograph.

The relay accepts only approved catalog entries and provider paths. It is not a general URL proxy. Client disconnects cancel upstream requests, and provider deadlines remain in effect. Review source changes carefully before extending allowlists.

### Update a camera

1. Update its source entry in `web/cameras.js` without reusing an existing ID for a different camera.
2. Update the corresponding English presentation in `web/catalog-en.js`.
3. Check coordinates, the official source, actual moving footage, and the provider's session behavior.
4. Update the selected catalog and evidence when changing the published collection; keep old observations and timestamps clearly historical.
5. Run `npm run check`, review the map and playback locally, and push the change.

The `400 videos` label is derived from the selected collection; it is not a hard-coded claim about instantaneous stream availability. The larger candidate set is diagnostic data enabled with `?qa-candidates=1` and does not increase the normal collection count.

## Historical verification

The original selection records **400 distinct cameras, all 17 regions, and 800 independent playback observations**. The observation window was **November 25, 2026, 18:07:03 to November 26, 2026, 12:15:26 KST**. The migration preserves those observations and does not relabel them as new Vercel playback checks or continuous uptime monitoring.

The public evidence view remains available at `/verification.html`, with its original data in `web/verification-data.json`. Selected audit records and small test fixtures are included in this repository. Raw historical frame captures and checks tied to the former repository's commit history remain in the preserved original project; see [the source audit](docs/SOURCE_AUDIT.md) for the exact export boundary.

## Third-party material

Pinned dependency licenses and map provenance are stored alongside their files in `web/vendor/`. Keep required map attribution visible. Public video streams and map data retain their providers' rights and terms; publishing this source does not transfer ownership of that material. No additional license grant is implied for the project's own code.

## Operational notes

Map tiles and public video providers are external services. Availability can vary by network, region, and time. The Vercel function carries relayed media traffic, so monitor function usage and data transfer in the Vercel dashboard as traffic grows. The application does not require a paid database or authentication service.
