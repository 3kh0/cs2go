# App builds and R2 asset releases

CS2GO is a Bun/Turborepo workspace:

- `apps/game`: Vite app, Steam API, unit and browser tests. Vercel deploys this workspace.
- `packages/assets/public`: original runtime assets and provenance. Importers in `scripts/` write here.
- `packages/assets/manifest.json`: checked-in SHA-256 manifest, decoded gzip hashes, maximum-quality Brotli transport hashes/sizes and immutable release ID. This small file is the app build's only dependency on the asset collection.

The asset collection is about 3.3 GiB. Moving directories alone does not make Git cloning faster. The deployment workflow uses **sparse checkout**: code-only deploys never check out the asset payload. It builds on GitHub and uploads Vercel's prebuilt output. The workspace `vercel.json` disables automatic Git deployments to avoid duplicate full-repository builds.

## Configuration

The R2 bucket is `cs2go`, account `1084af893db6194b4efdf2d48c729bc6`, public custom domain `https://a.cs2go.3kh0.net`. The S3 endpoint is `https://1084af893db6194b4efdf2d48c729bc6.r2.cloudflarestorage.com`; this authenticated API endpoint is not a browser asset URL.

GitHub repository secrets:

- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`: bucket-scoped Object Read & Write S3 credentials.
- `VERCEL_TOKEN`: token authorized to deploy the existing project.

GitHub repository variables:

- `R2_ACCOUNT_ID`, `R2_BUCKET`, `ASSET_CDN_URL`: account, bucket and public URL above.
- `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`: existing Vercel team/user and project IDs.

The Cloudflare API token is not needed by this S3 pipeline. Credentials never enter the app bundle, task cache or manifest.

In the Vercel project, set Root Directory to `apps/game` and enable source files outside the root directory. Set production `ASSET_CDN_URL=https://a.cs2go.3kh0.net`; retain the existing server-only `STEAM_ORIGIN` and `STEAM_SESSION_SECRET`. The workspace's `vercel.json` supplies install/build/output settings. Keep the same project so existing domains and Steam configuration remain attached.

Activate the R2 custom domain and apply `packages/assets/cors.json` in the bucket CORS settings. These are public game files: wildcard origin permits production, previews and local browser verification without cookies. Only GET/HEAD are allowed. Enable caching for the custom domain as described in [Cloudflare's public-bucket documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/). The sync job sets `Content-Encoding: br` only for manifest entries with a Brotli transport. Browser HTTP decoding produces the manifest's logical bytes; `.gz` logical files remain gzip and are then explicitly decompressed by the game. Do not replace this header with `gzip`, strip it, or add a second manual decompression layer.

## Updating assets

From the repository root:

```sh
# Run the relevant importer first, then regenerate the release manifest.
bun run assets:prepare
bun run assets:verify
bun run test:tools
# Commit changed assets, importer/provenance and packages/assets/manifest.json together.
```

Push to `main` or run **Publish assets and deploy game** manually after configuring the variables/secrets. Asset changes run the asset job first. Code-only changes skip it. Manual dispatch always verifies and syncs assets, which also seeds a new bucket.

The asset job independently hashes every input and verifies the checked-in manifest. Generated GLBs use the neutral gzip OS header (255), so macOS and Linux produce matching wire hashes. GLB gzip compression is cached by input SHA-256; existing compressed assets retain their logical bytes. Every runtime asset format is also tested with Brotli quality **11** (the maximum), including gzip/KTX2/audio/image inputs. The transport is kept only when smaller, so already compressed media never becomes larger on the wire. Brotli work runs at most six assets at a time and caches `.cache/<logical-sha256>.q11.br`, making cold passes CPU-bound but subsequent verification/resume incremental. Corrupt cache files are regenerated after lossless round-trip/hash validation. When a release was already published locally, CI can seed the exact immutable Brotli payloads from R2 before verification (`python packages/assets/sync.py seed`); it checks the complete release marker and each wire hash/size, then the normal pipeline verifies decompression and logical hashes. An unpublished release simply falls back to cold encoding. Verification reuses a committed no-transport decision only when its freshly regenerated logical hash is unchanged; it still regenerates every size/gzip/source field and compares the complete manifest. Preparation always tries quality 11 for every candidate, and changed/new content is encoded again even during verification. There is no timestamp in the release identity. The S3 sync compares the stored transport SHA-256, wire size and `Content-Encoding`, not multipart ETags or mtimes. Logical SHA-256 hashes remain unchanged for the browser/service-worker integrity checks; transport fields are part of the immutable release identity. It uploads changed payloads, copies unchanged objects server-side from the previous successful release, and skips already completed objects when retrying. A paginated destination inventory avoids a missing-object HEAD for every new key; copied content is checked once at its destination for SHA-256 metadata and size, rather than repeating the same metadata read at its source. Transfers use four workers, SDK adaptive retries and explicit bounded backoff for R2 numeric `429`/SlowDown responses, including retries during completion-marker writes. Persistent throttling leaves the release incomplete so the next run can resume; authentication and hash mismatches fail immediately.

Every release lives at `releases/<manifest SHA-256>/...`. Only after every transfer succeeds does the job publish that release's `manifest.json` completion marker. Failed transfers never publish a ready marker or update `latest.json`. App builds fetch and compare the marker before emitting code. Old releases are retained for open tabs and rollbacks; the app never reads `latest.json` at runtime.

**Storage tradeoff:** releases are complete immutable snapshots. R2 server-side copies avoid re-uploading unchanged bytes, but each distinct release consumes a full snapshot's storage. No automatic deletion runs. Retire old releases only after deciding your rollback/offline support window; do not apply a short bucket-wide lifecycle policy to live releases.

## App builds and local play

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run test
bun run test:tools
bun run --cwd apps/game test:browser -- tests/home-menu.spec.ts
bun run build
```

Local development and an ordinary local production build use local assets, retaining offline/local play. Local files retain their logical format; maximum-quality Brotli transport is served by R2 after syncing the generated manifest. The first cold quality-11 pass can take tens of minutes for the multi-gigabyte tree; it is never repeated during a code-only CDN build. After changing asset bytes, regenerate the manifest before a cached build. For a small production build against an already published release:

```sh
ASSET_CDN_URL=https://a.cs2go.3kh0.net bun run build
```

The CDN mode disables Vite's public-directory copy and never walks, compresses or hashes the public tree. Turborepo caches the app output using app/build-tool inputs, the manifest and CDN origin. The browser loads models, audio, skin JSON/textures, icons, fonts and UI assets directly from the pinned R2 release; authenticated Steam requests stay on the app origin. The service worker verifies CDN response bytes and keeps its bounded core/skin caches. Online navigation fetches fresh HTML. Completed updates activate without closing tabs, refreshing the menu automatically and deferring live-match refreshes until returning to the menu. CORS must permit readable responses; opaque responses cannot be hash-verified.

Vercel builds fail clearly if the CDN URL is missing or the release is incomplete. Build timing depends on the runner and cache state; local measurements do not establish a hosted Vercel speedup.

References: [Turborepo task inputs/outputs and environment configuration](https://turborepo.com/docs/reference/configuration), [Vercel monorepo root configuration](https://vercel.com/docs/monorepos/monorepo-faq), [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/), [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).
