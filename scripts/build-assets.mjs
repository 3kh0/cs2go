import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import {
  files,
  prepare,
  releaseId,
  objectKey,
  root as assetRoot,
} from "../packages/assets/pipeline.mjs";

const hash = (data) => createHash("sha256").update(data).digest("hex");
export function assetBase(origin, release) {
  if (!origin) return "";
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    throw new Error("ASSET_CDN_URL must be a public HTTPS bucket/custom-domain URL.");
  return `${url.href.replace(/\/$/, "")}/releases/${release}`;
}
// CSS and markup need the same base as programmatic loaders, before Vite hashes chunks.
export function assetUrls(origin, manifest) {
  const bucket = assetBase(origin, manifest.release).replace(`/releases/${manifest.release}`, "");
  if (manifest.version !== 2 || manifest.release !== releaseId(manifest.files))
    throw new Error("Invalid shared-object asset manifest");
  return Object.fromEntries(
    Object.entries(manifest.files).map(([path, entry]) => {
      if (entry.object !== objectKey(path, entry)) throw new Error(`Invalid asset object: ${path}`);
      return [`/${path}`, `${bucket}/${entry.object}`];
    }),
  );
}
export function rewriteAssetUrls(source, urls) {
  return source.replace(
    /\/(?:audio|effects|fonts|icons|licenses|maps|models|skins|ui)\/[\w./%-]+|\/icon\.svg/g,
    (path) => {
      if (!Object.hasOwn(urls, path)) throw new Error(`Asset missing from manifest: ${path}`);
      return urls[path];
    },
  );
}
export function startupHints(base, urls) {
  if (!base) return [];
  return [
    {
      tag: "link",
      attrs: { rel: "preconnect", href: new URL(base).origin, crossorigin: "anonymous" },
      injectTo: "head-prepend",
    },
    {
      tag: "link",
      attrs: {
        rel: "preload",
        as: "fetch",
        href: urls["/models/maps/dust2.glb.gz"],
        crossorigin: "anonymous",
        fetchpriority: "high",
      },
      injectTo: "head-prepend",
    },
  ];
}
export function buildAssets() {
  let output,
    manifest,
    base,
    urls = {};
  return {
    name: "cs2go-assets",
    enforce: "pre",
    apply: "build",
    async config() {
      if (process.env.ASSET_CDN_URL) {
        manifest = JSON.parse(await readFile(join(assetRoot, "manifest.json"), "utf8"));
        base = assetBase(process.env.ASSET_CDN_URL, manifest.release);
        urls = assetUrls(process.env.ASSET_CDN_URL, manifest);
      } else base = "";
      return {
        publicDir: base ? false : join(assetRoot, "public"),
        define: { "import.meta.env.VITE_ASSET_URLS": JSON.stringify(JSON.stringify(urls)) },
      };
    },
    transform(code, id) {
      if (!base) return;
      if (id.endsWith(".css")) return rewriteAssetUrls(code, urls);
      if (id.endsWith(".ts"))
        return code.replace(
          /src="(\/(?:audio|effects|fonts|icons|licenses|maps|models|skins|ui)\/[^"$\s]+)"/g,
          (match) => rewriteAssetUrls(match, urls),
        );
    },
    transformIndexHtml(html) {
      return { html: base ? rewriteAssetUrls(html, urls) : html, tags: startupHints(base, urls) };
    },
    async configResolved(config) {
      const started = performance.now();
      output = resolve(config.root, config.build.outDir);
      if (process.env.VERCEL && !process.env.ASSET_CDN_URL)
        throw new Error(
          "Set ASSET_CDN_URL before deploying; Vercel builds must not copy the asset tree.",
        );
      if (process.env.ASSET_CDN_URL) {
        manifest = JSON.parse(await readFile(join(assetRoot, "manifest.json"), "utf8"));
        urls = assetUrls(process.env.ASSET_CDN_URL, manifest);
        base = assetBase(process.env.ASSET_CDN_URL, manifest.release);
        // Published last by the sync job. Never deploy a shell pointing at a partial release.
        config.logger.info("[assets] Checking published R2 release before bundling...");
        const response = await fetch(`${base}/manifest.json`, {
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok || (await response.text()) !== JSON.stringify(manifest, null, 2) + "\n")
          throw new Error(
            "R2 release is not ready. Run the asset sync workflow before deploying this commit.",
          );
      } else {
        base = "";
        let progress;
        const report = () =>
          config.logger.info(
            `[assets] ${progress ? `${progress.completed}/${progress.total} checked` : "Scanning local asset tree"} - ${((performance.now() - started) / 1000).toFixed(1)}s (hashes, gzip and Brotli quality 11)`,
          );
        report();
        const heartbeat = setInterval(report, 2000);
        try {
          manifest = await prepare(assetRoot, undefined, (value) => {
            progress = value;
          });
        } finally {
          clearInterval(heartbeat);
        }
      }
      config.logger.info(
        `[assets] Ready: ${Object.keys(manifest.files).length} assets in ${((performance.now() - started) / 1000).toFixed(1)}s - starting Vite bundling`,
      );
    },
    async closeBundle() {
      const revisions = {},
        sizes = {},
        decoded = {},
        shell = ["/"];
      for (const [path, entry] of Object.entries(manifest.files)) {
        const url = `/${path}`;
        revisions[url] = entry.sha256;
        sizes[url] = entry.bytes;
        if (entry.decodedSha256) decoded[url] = entry.decodedSha256;
        if (!base && entry.input) {
          const destination = join(output, path);
          await mkdir(resolve(destination, ".."), { recursive: true });
          await writeFile(
            destination,
            await readFile(join(assetRoot, ".cache", `${entry.inputSha256}.glb.gz`)),
          );
        }
        if (url.startsWith("/fonts/") || url === "/icon.svg") shell.push(url);
      }
      for (const file of await files(output)) {
        const url = "/" + relative(output, file).replaceAll("\\", "/");
        if (url === "/sw.js" || url.endsWith(".glb") || Object.hasOwn(revisions, url)) continue;
        const bytes = await readFile(file);
        const key = url === "/index.html" ? "/" : url;
        revisions[key] = hash(bytes);
        sizes[key] = bytes.length;
        if (/^\/assets\/.*\.(?:js|css|wasm)$/.test(url)) shell.push(url);
      }
      const worker = await readFile(new URL("./service-worker.js", import.meta.url), "utf8");
      const metadata = JSON.stringify({ revisions, sizes, decoded, urls });
      await writeFile(
        join(output, "sw.js"),
        `const ASSET_REVISIONS=${JSON.stringify(revisions)};\nconst ASSET_DECODED_REVISIONS=${JSON.stringify(decoded)};\nconst ASSET_SIZES=${JSON.stringify(sizes)};\nconst ASSET_URLS=${JSON.stringify(urls)};\nconst BUILD_ID=${JSON.stringify(hash(metadata + worker))};\nconst SHELL_URLS=${JSON.stringify(shell)};\n${worker}`,
      );
      console.log(
        `Assets: ${base || "local"}; ${Object.keys(revisions).length} revisioned entries.`,
      );
    },
  };
}
