# Assets

`public/` holds every runtime asset, including the READMEs inside it, which are published too. `manifest.json` pins the exact bytes of each file, and its `release` hash names the R2 release that production clients load.

After changing anything under `public/`, run `bun run assets:prepare` and commit the updated `manifest.json` in the same push.

| Command                  | Purpose                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run assets:prepare` | Regenerates `manifest.json`, including Brotli transport encodings.                                                                      |
| `bun run assets:check`   | Compares source paths and raw hashes with the manifest. It does no compression, so it finishes in seconds. `bun run check` includes it. |
| `bun run assets:verify`  | Rebuilds every wire encoding and requires an identical manifest. The na1 sync service runs it before publishing.                        |

## Publication

The na1 user service `cs2go-assets-sync` (`scripts/sync-assets-server.sh`, every 2 minutes) verifies the `main` tip and publishes it to R2. It then writes `releases/<release>/verified/<asset tree>.json`.

The deploy workflow first runs `pipeline.mjs check --since <previous push>`. It checks every path in the commit's tree and hashes the blobs this push changed, so a stale manifest fails within seconds. The workflow then waits for the verification receipt.

When a sync attempt fails, na1 writes `releases/<release>/failed/<asset tree>.json` with the consecutive failure count and the first error line, and deletes it after a successful run. The workflow stops after three consecutive failures if at least one was recorded after the wait began.

The service only verifies the current `main` tip. If two pushes change assets before na1 picks up the first, the earlier run's release is never published, and its wait times out after the later release deploys.
