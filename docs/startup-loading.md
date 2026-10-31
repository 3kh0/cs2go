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
