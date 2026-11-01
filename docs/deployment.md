# Deployment

Vercel serves `apps/game`, R2 serves pinned asset releases, and the Bun multiplayer server deploys separately. Ordinary local builds retain local/offline assets.

## Configuration

| Location                  | Configuration                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GitHub secrets            | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `VERCEL_TOKEN`                                                      |
| GitHub variables          | `R2_ACCOUNT_ID`, `R2_BUCKET`, `ASSET_CDN_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; optional `MULTIPLAYER_URL` |
| Vercel server environment | `STEAM_ORIGIN`, `STEAM_SESSION_SECRET`; see [steam-login.md](steam-login.md)                                    |
| Public frontend build     | `ASSET_CDN_URL`, optional `VITE_MULTIPLAYER_URL`                                                                |

The existing bucket is `cs2go`, account `1084af893db6194b4efdf2d48c729bc6`, public domain `https://a.cs2go.3kh0.net`. Its authenticated S3 endpoint is `https://1084af893db6194b4efdf2d48c729bc6.r2.cloudflarestorage.com`; browsers use the public domain.

Use bucket-scoped Object Read & Write credentials. Set the Vercel root to `apps/game`, allow sources outside that root, retain the existing project/domains, and configure the public CDN origin. `apps/game/vercel.json` supplies build settings and disables duplicate automatic Git deployments. Credentials must never enter frontend `VITE_` variables, asset manifests or task caches.

Activate the R2 custom domain, apply `packages/assets/cors.json` and enable caching. These public assets use GET/HEAD with readable CORS responses and no cookies. Regional redirects/rules can masquerade as CORS failures; inspect the actual response before changing bucket policy.

## Publishing

After an intentional asset change:

```sh
bun run assets:prepare
bun run assets:verify
bun run test:tools
```

Include assets, provenance and the manifest together. The **Publish assets and deploy game** GitHub workflow runs on pushes to main or manual dispatch. Asset changes verify/sync before deploying; code-only changes skip that job and sparse-check out code without the multi-gigabyte asset payload. Manual dispatch also verifies/syncs assets.

Each release is a complete immutable snapshot at `releases/<manifest SHA-256>/`. Only successful transfers publish its `manifest.json` completion marker and update `latest.json`. App builds verify the pinned completion marker; clients never follow latest at runtime. Sync is resumable, hashes every payload and uses server-side copies for unchanged objects. Old releases remain available for open tabs and rollback. Copies still consume full snapshot storage; no automatic deletion/lifecycle policy is applied.

The pipeline emits deterministic gzip logical files and retains Brotli quality-11 transport only when smaller. R2 serves that transport with `Content-Encoding: br`; browser HTTP decoding restores logical bytes. Logical `.gz` files then receive the game's own gzip decoding. Do not relabel Brotli as gzip or double-decompress. Compression results cache under `packages/assets/.cache/`; a cold pass can take time, while a code-only CDN build never scans/compresses the asset tree.

## Builds and cache checks

```sh
bun run build
bun run preview
# Build against an already published asset release:
ASSET_CDN_URL=https://a.cs2go.3kh0.net bun run build
# Production startup/offline integration:
bun run --cwd apps/game test:startup
```

Vercel builds reject a missing CDN origin or incomplete release. Local builds use local assets. The worker verifies revision hashes, bounds core/cosmetic caches to 384/64 MiB and fetches fresh HTML online. Menu updates refresh automatically; live matches defer refresh until returning to the menu. Offline startup requires a prior complete cache fill, and unvisited skins/music may still require networking.

Startup never waits for service-worker registration to resolve. All required assets, decoding and GPU warm-up finish before Play. The homepage shares map resources with gameplay. Use the cache/loading tools listed in [assets.md](assets.md) for local measurements; historical workstation timings are not production performance guarantees.

Multiplayer container configuration is in [multiplayer.md](multiplayer.md).
