# Deployment

Vercel serves `apps/game`, R2 serves pinned asset releases, and the Bun multiplayer server deploys separately. Ordinary local builds retain local/offline assets.

## Configuration

| Location                  | Configuration                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------- |
| GitHub secrets            | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `VERCEL_TOKEN`                          |
| GitHub variables          | `R2_ACCOUNT_ID`, `R2_BUCKET`, `ASSET_CDN_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| Vercel server environment | `STEAM_ORIGIN`, `STEAM_SESSION_SECRET`; see [steam-login.md](steam-login.md)        |
| Public frontend build     | `ASSET_CDN_URL`                                                                     |

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

Include assets, provenance and the manifest together. The **Publish assets and deploy game** GitHub workflow runs on pushes to main or manual dispatch. Asset changes verify/sync before deploying; code-only changes skip that job and sparse-check out code without the multi-gigabyte asset payload. Documentation and importer-only pushes skip deployment. Manual dispatch also checks assets.

The asset job initially checks out only the manifest and publisher tools with a blobless Git fetch. Before downloading the public tree or restoring the compression cache, a read-only probe requires both the exact published manifest and an immutable `verified/<Git asset-tree SHA>.json` receipt. The publisher creates this receipt only after CI verifies that entire `packages/assets` tree. Changed source files with a stale manifest therefore cannot take the fast path: their tree has no receipt, so normal verification runs and rejects the mismatch. Existing releases without receipts verify once; later runs of that exact asset tree skip checkout, compression and sync work.

Version 2 releases contain an immutable manifest at `releases/<manifest SHA-256>/manifest.json`, plus verification receipts. Each logical filename has an `object` reference into the shared `objects/` pool. Object keys include the stored SHA-256, media extension and optional HTTP encoding suffix (for example `objects/<hash>.gz.br`). Renamed files and unchanged files across releases reuse the same object; extensions and encodings distinguish payloads that need different response headers. Releases no longer contain asset copies. Only successful transfers and metadata checks publish the completion marker and update `latest.json`.

App builds verify the exact pinned completion marker, then embed its logical-to-object mapping for synchronous loaders, CSS, HTML and startup preloads. Clients never follow latest at runtime or wait for a separate manifest request. The service worker resolves the same URLs back to logical filenames for revision verification, cache budgets and offline startup. Local/development builds retain their local paths and files.

Sync inventories the shared pool with paginated listings, deduplicates object transfers and verifies existing objects' hash metadata, length and HTTP encoding. Missing objects upload once. During the first transition from a version 1 snapshot, matching payloads are copied server-side into the shared pool once; subsequent releases reuse them without copying. Old snapshots remain untouched so existing deployments, open tabs and rollbacks retain their URLs. The transition temporarily adds one shared copy of existing payloads until old snapshots are explicitly retired. No automatic deletion/lifecycle policy is applied: never expire `objects/` by upload age, since a current manifest may still reference an old object. Any later cleanup must protect deployed/retained manifests and their referenced objects.

Sync runs up to 32 concurrent copy/metadata transfers with a matching connection pool; at most four payload uploads hold file buffers at once. Adaptive SDK retries and bounded numeric-429 retries remain enabled. Progress counts unique completed objects and reports throughput; the request summary separates copy/HEAD latency, SDK retries and outer throttle retries. The old snapshot pipeline's [run 41362948290](https://github.com/3kh0/cs2go/actions/runs/41362948290/job/125017052173) copied 8,787 unchanged files for eight uploads. The shared pool removes that repeated copy workload; real R2 timing still requires a deployed asset-changing run.

Payload uploads, completion markers and verification receipts use `If-None-Match: *`. Server-side copies use R2's destination `cf-copy-destination-if-none-match: *` condition, currently documented as beta in [R2 conditional operations](https://developers.cloudflare.com/r2/api/s3/extensions/#conditional-operations-in-copyobject-for-the-destination-object). Conflicting immutable objects fail publication; identical concurrent writes are verified and reused. `latest.json` is intentionally mutable and changes after a new release completes, with identical bytes left untouched. Re-running an already complete historical release never moves latest backwards. The copy header and request signing are tested offline; validating the next real upload still requires a normal authorized workflow run.

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

Vercel builds reject a missing CDN origin or incomplete release. Local builds use local assets. The worker verifies revision hashes, bounds core/cosmetic caches to 448/64 MiB and fetches fresh HTML online. Menu updates refresh automatically; live matches defer refresh until returning to the menu. Offline startup requires a prior complete cache fill, and unvisited skins/music may still require networking.

Startup never waits for service-worker registration to resolve. All required assets, decoding and GPU warm-up finish before Play. The homepage shares map resources with gameplay. Use the cache/loading tools listed in [assets.md](assets.md) for local measurements; historical workstation timings are not production performance guarantees.

Multiplayer container configuration is in [multiplayer.md](multiplayer.md).

## Bun container packages

The deploy workflow also publishes two independent repository-linked GHCR packages:

| Image                       | Purpose                                                 | Container port |
| --------------------------- | ------------------------------------------------------- | -------------- |
| `ghcr.io/3kh0/cs2go/client` | Built browser client, served by Bun with `/api/steam`   | `3000`         |
| `ghcr.io/3kh0/cs2go/server` | Authoritative Bun match server and three map-data files | `3001`         |

Both publish `latest` and `sha-<full Git commit>` tags for Linux amd64 (NA1/NA2). Prefer an immutable SHA tag or digest when deploying. They share the small Bun base, but contain separate application layers and use separate build caches. They appear in the GitHub repository's Packages section through their OCI source labels and workflow publication token.

Pushes to main build only affected images: `apps/game` changes build the client; `apps/server` changes build the server; protocol/simulation, workspace dependency and workflow changes build both. Changes to the three server map files also build the server. Client builds wait for any required R2 asset publication, while server builds run independently of R2 and Vercel. A manual workflow dispatch builds both. Vercel deployment continues independently alongside the client image.

Image jobs use blobless sparse checkouts. The server downloads only code, workspace manifests and its three map inputs. The client downloads code and the asset manifest, verifies the pinned R2 release and never includes the multi-gigabyte art tree. Each image must pass a non-root, read-only container smoke test before being pushed. GitHub Actions caches dependency/build layers separately for each image.

GHCR publication uses the job's `GITHUB_TOKEN` with `packages: write`; no separate GHCR push token is required. Configure Actions secrets `DHI_USERNAME` and `DHI_TOKEN` for pulling the hardened base images. `ASSET_CDN_URL` remains the public repository variable for client builds. Steam secrets are runtime-only.

In Coolify, create a **Docker Image** application using the corresponding GHCR image and tag, set its exposed port from the table, and configure `/healthz`. No Git source or build commands are needed. For the client, set `STEAM_ORIGIN` to its canonical public HTTPS URL and `STEAM_SESSION_SECRET` to a stable random secret of at least 32 characters. Existing Steam login, public inventory sync, service-worker update behavior and immutable asset cache headers remain available. For match servers, set `ALLOWED_ORIGINS` to the exact public client origins; see [multiplayer](multiplayer.md).

Both repository packages are Public and support unauthenticated pulls from Coolify. Publishing images does not redeploy Coolify or change DNS automatically.

Local image validation:

```sh
docker build -t cs2go-server .
python3 scripts/smoke-container.py server cs2go-server
docker build -f apps/game/Dockerfile --build-arg ASSET_CDN_URL=https://a.cs2go.3kh0.net -t cs2go-client .
python3 scripts/smoke-container.py client cs2go-client
```
