# Source and evidence audit

This repository contains the maintained application, its regression tests, and a compact copy of the evidence supporting the selected 400-camera catalog. The original Sites source remains the archive for complete collection runs, captured frames, research, and historical Git revisions.

## What the evidence establishes

The preserved release records describe **400 selected cameras and 800 bounded playback observations**, collected from **25 November 2026, 18:07:03 KST through 26 November 2026, 12:15:26 KST**. They include 232 carried observations for 116 cameras and 568 newer observations for 284 cameras. These counts and original timestamps are preserved in [release-summary.json](../qa/400/release-summary.json).

Those measurements are historical. They do not establish current availability, continuous uptime, or a new playback audit on Vercel. A source can become unavailable after observation. Existing player hashes, source URLs, observation timestamps, and archive-relative evidence paths retain their original meanings.

The English display layer in `web/catalog-en.js` leaves the technical source catalog unchanged. Korean text in historical source records is retained as evidence; the application presents English labels.

## Included evidence

| Location | Purpose |
| --- | --- |
| `qa/400/selected-catalog.json` | Exact selected 400 source records; also used by the current English catalog tests. |
| `qa/400/selected-evidence.json` | Per-camera results, original observation references, and hash bindings. |
| `qa/400/release-summary.json` | Counts, observation intervals, regional distribution, and the scope of the original release. |
| `qa/400/distinctness-audit.json` and `distinctness-review.json` | Recorded checks for duplicate sources, aliases, coordinates, and reviewed frames. |
| `qa/400/player-equivalence.json` | The original comparison supporting the specifically identified carried observations. |
| `qa/400/QA_REPORT.md`, `publication-manifest.json`, and `production-release-v25.json` | Historical publication checks and their original limitations. |
| `qa/design/*transition-report.json`, `ENGLISH_RELEASE_QA.json`, and `DETAILED_MAP_RELEASE_QA.json` | Recorded presentation and playback-preservation checks during the English, compact, and detailed-map releases. |
| `web/verification.html`, `verification.css`, and `verification-data.json` | Public presentation of the preserved evidence. |
| `qa/design/map-geography-provenance.json` and `web/vendor/*provenance.json` | Basemap and packaged-library provenance. Licenses remain alongside vendor assets. |

Copied evidence files are byte-identical to the source archive. The separate archive copies of `verification-data.json` and `SOURCE_INVENTORY.json` are omitted because the public verification data is already included. Full audit candidate sets, raw runs, checkpoints, captured media, research proposals, generated build output, and the old Git object database are not copied into this repository.

The source archive recorded 3,233 tracked files, including about 1.25 GB under `qa/`. The retained application, current tests, fixtures, and selected evidence occupy about 20 MB before generated deployment output.

## Current tests and archival checks

The current `npm test` command selects the seven `qa/*.test.cjs` suites, including the new Vercel adapter checks. Their fixture dependencies are:

- `qa/fixtures/player-catalog.json` for player regression tests.
- `qa/400/selected-catalog.json` for English catalog integrity tests.
- `qa/400/research/muju-public-popup-catalog-v21/01.redacted.html` through `11.redacted.html` for the Muju relay tests.
- Generated deployment output for the artifact test; build before testing.

These suites do not require the old Git history or the full collection archive. Their results exercise application behavior and packaging; they do not recreate the historical 800 network observations.

The archive's `qa/design/verify-english-transition.cjs` and `verify-compact-transition.cjs` depend on pinned historical Git revisions and thousands of unchanged evidence files. The original `qa/400/check-release.cjs`, `prepare-publication.py`, and `recompute-selected.py` additionally consume raw runs, earlier catalogs, reviewed frames, and original player revisions. The legacy `qa/check-package.cjs` is tied to the earlier 200-camera release. These archival gates are not portable CI commands for this reduced source tree.

Archive references use the original Sites source and release commit `55fee021d0b9ebbd8991adc7b5ced0ef492337b2`; the English release baseline is `417c8ec8b842e6235b4f28241652690954eb239d`. References to files omitted here remain references to that archive. They must not be silently rewritten as new measurement results.

## Publication scan

On 26 November 2026, the tracked source was checked for private keys, common API and cloud credentials, bearer literals, URL userinfo, and long secret assignments. The text scan covered 1,690 tracked text files, about 1.05 GB. No real credential was identified in the matches. URL-credential and authorization matches were synthetic rejection or redaction fixtures in tests. Four Google-key-like matches were copies of the same random substring in an image data URI.

The selected catalog, selected evidence, public verification data, and map configuration contained no credential-bearing query keys or URL userinfo. A follow-up scan of the curated tree found only the expected URL-rejection fixtures in `qa/hls-relay.test.cjs` and `qa/muju-relay.test.cjs`, with no private-key, API-token, bearer-literal, long-secret-assignment, or absolute workspace-path matches. This was a working-tree pattern review, not a scan of every historical Git object. The new repository starts with the curated source tree rather than importing that history.

Provider source links and required map and vendor credits remain present. The archive's captured camera media is not distributed in this repository.
