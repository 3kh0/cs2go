# Startup loading

Startup registers the service worker alongside game initialization. It does not wait for installation or controller acquisition before fetching assets. A slow, blocked or failed worker therefore cannot add a fixed delay to the loading screen. All existing models, audio and GPU warm-up still complete before Play becomes available.

[Cloudflare documents](https://developers.cloudflare.com/r2/buckets/cors/) that R2 adds CORS response headers only when the request carries an Origin header.

The worker fetches cross-origin shell assets with a fresh HTTP-cache request, avoiding unreadable responses first cached by a no-CORS favicon/image load. Network assets also retry once with a fresh readable CORS request if an HTTP-cache response cannot be read. Successful bodies retain revision/hash verification; authenticated APIs still bypass caching and updates still wait until a match ends.

## Reproducing the production checks

```sh
ASSET_CDN_URL=https://a.cs2go.3kh0.net bun run build
bun run --cwd apps/game test:startup
```

The separate production Playwright suite tests a registration that never resolves, real installation/control, repeat startup, and offline loading after verified cache writes. Development does not register the worker, so the existing development intro suite remains separate.

An unthrottled Chromium measurement on the development Mac, using a fresh browser context, the same published R2 release and reduced motion to exclude the title animation, showed:

| Measurement                         |  Before |   After |
| ----------------------------------- | ------: | ------: |
| First game-asset request            |  8.20 s |  0.16 s |
| Cold usable menu                    | 19.96 s | 10.59 s |
| Repeat usable menu                  | 30.66 s |  7.23 s |
| Service worker controlling the page |      No |     Yes |

These are observations, not a network-independent performance guarantee. The repeat baseline still suffered failed worker installation; it was not a functioning offline-cache baseline. Detailed local profiles are in ignored `artifacts/startup-baseline.json` and `artifacts/startup-after.json`. The intro sequence remains unchanged for users without reduced motion.

## Streaming and shared scenery

Production HTML preconnects to the pinned asset origin and preloads the exact CORS URL for the critical Dust II model at high priority. The model loader reuses that request. Local/offline development adds no CDN hints.

Gzip model data is decompressed as response chunks arrive, including when the gzip signature spans chunks. Responses already decompressed by HTTP Content-Encoding remain supported. The startup audio bank resolves individual clips as they arrive, allowing bounded audio decoding to overlap the remaining download. Decode slots are occupied only by ready clips; malformed/truncated streams reject and failed bank loads can retry.

The homepage now clones the game map's scene graph while sharing its geometry, materials, textures and native lighting. This removes the separate panorama map download and GPU upload. The native game map's surface details and lighting therefore also appear in the panorama. Separate scene graphs preserve menu/match visibility. Original local panorama assets remain available as source inputs.

A subsequent Chromium test used fresh browser contexts, blocked service workers, reduced motion, 80 ms added latency and a 5 MiB/s download limit against the same R2 release:

| Measurement           | Earlier loader | Streaming + shared scenery |
| --------------------- | -------------: | -------------------------: |
| CDN transfer bytes    |       173.6 MB |                   153.3 MB |
| Error-free ready menu |        36.79 s |          33.19 s / 32.82 s |
| Main map fetches      |              1 |                          1 |

The earlier loader also had a 62.61 s run with an initialization error. Streaming alone measured 45.02 s / 36.63 s; it did not establish a reliable speedup on this connection. Removing the duplicate map provides the measurable byte saving. One shared-map run timed out while another browser suite was running; the two reported shared-map runs were repeated without concurrent browser tests and had no page errors. These small samples are observations, not a universal latency guarantee. CDP reported HTTP/2; this change does not assume HTTP/3 or add host sharding. Detailed local request logs are in ignored `artifacts/streaming-before.json`, `artifacts/streaming-after.json` and `artifacts/shared-map-after.json`.

The production startup test checks that only one Dust II model is requested, including preload reuse, and still verifies repeated/offline startup. Unit tests exercise incremental gzip output, cancellation, malformed gzip, streamed audio byte integrity, early clip readiness and failed-stream retries. Play remains disabled until required assets, objective viewmodels and GPU warm-up finish.
