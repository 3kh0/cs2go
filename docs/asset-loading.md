# Asset loading and cache verification

Production GLBs use lossless gzip siblings emitted by `scripts/build-assets.mjs`.
The 264 generated files total 111.50 MiB versus 134.75 MiB for their original
GLBs; all decompress byte-identically. Source files remain in `packages/assets/public/`.
The 226 startup Opus clips are packed into one 2,167,194-byte request, without
re-encoding. Models fetch ahead through six bounded jobs, with two parsers and
two Basis workers. Map jobs have priority; lighting and agent animation requests
start alongside models. All core assets and GPU warm-up still finish before Play.
The splash shows the current filename and a percentage of completed loading
stages, followed by graphics preparation. This is stage progress, not a byte or
time estimate; the loading text disappears when the existing intro begins.

The production service worker caches requested, revision-verified content;
it does not preload the 2.79 GiB skin library. Its core budget is 384 MiB and
optional skin budget is 64 MiB, measured from actual stored response bodies.
The preview server can decode gzip before Cache Storage receives it, so the
verified startup cache occupies 233.24 MiB even though transfer bytes are smaller.
Cached responses avoid duplicate reads and body clones. Skin editing also reuses
up to 16 MiB of decoded normals, cancels superseded queued bakes, and preserves
thumbnail elements.

Online navigations fetch fresh HTML without the HTTP cache; the verified shell is
used offline or on server errors. Completed worker installs activate immediately.
The client compares its hashed scripts/styles with the new shell and automatically
refreshes an outdated menu. Live matches and their results defer that refresh until
the main menu. Visible pages check for updates on focus and every minute. Up to 64
previous hashed code files remain cached for running older clients; old HTML shells
are removed. Unchanged asset content is retained and changed revisions are discarded. Bytes that do not match the worker's revision cannot poison its cache.
Cache denial/quota failures fall back to networking. Offline startup requires a
previous complete cache fill; new skins and streamed music may need networking.
The worker is disabled in development and requires HTTPS or localhost.

## Measurements

Chromium, production preview on localhost, 1440×900, October 12, 2026. Cold runs
use fresh browser contexts with the HTTP cache disabled. Times end when Play is
enabled; the preserved approximately three-second intro follows that point.

| Measurement                             |                  Before |                   After |
| --------------------------------------- | ----------------------: | ----------------------: |
| Cold ready, three-run median            |                 5.109 s |                 4.845 s |
| Cold ready, individual runs             | 5.433 / 5.109 / 5.076 s | 5.225 / 4.845 / 4.823 s |
| Page resource entries at readiness      |                 552–553 |                     335 |
| Warm reload, one cache verification run |            not measured |                 4.530 s |
| Offline reload, same verification run   |            not measured |                 4.640 s |

These local measurements are not an internet benchmark or a guarantee on other
hardware. Service-worker installation and its own requests are not represented
by page resource-entry counts. `transferSize` reported to the page also excludes
worker-side transfers, so it must not be interpreted as total network traffic.
The measured loading revision reduced 218 audio fetches to one and removed
23.24 MiB of GLB payload. The October 13 native CS2 audio update expanded that
same single audio request to 226 clips; the timing table predates that update. GPU compilation and model decoding remain necessary on every boot.

## Reproduce

Build and serve production with `bun run build` and
`bun run preview --host 127.0.0.1 --port 5188`, then run:

```sh
node scripts/benchmark-loading.mjs
node scripts/check-asset-cache.mjs
bun scripts/check-cache-update.mjs
```

`CACHE_URL` overrides the preview URL. Results go to ignored `artifacts/`.
The first script measures three cold contexts. The second checks complete core
cache coverage, online and offline reloads, browser errors, and absence of
production development hooks. The third starts an isolated loopback server and
checks automatic menu updates across two open tabs, deferred match refresh, old-code
retention, unchanged-asset reuse, changed-asset replacement and offline fallback. Unit tests cover queue priorities, byte-for-
byte audio packing, decoding concurrency/retries, and consumed-response caching.

Regenerate the audio pack after source imports with
`python3 scripts/pack-audio.py`. GLB compression and cache revision generation run
automatically on every production build. Cache lifecycle follows the
[Service Worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
and [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache).
