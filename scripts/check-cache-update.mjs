import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const worker = await readFile("scripts/service-worker.js", "utf8");
const source = (await readFile("apps/game/src/asset-cache.ts", "utf8")).replaceAll(
  "import.meta.env.PROD",
  "true",
);
const client = new Bun.Transpiler({ loader: "ts" }).transformSync(source);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
let version = 1;
const hits = new Map();
const scriptPath = () => `/assets/app-v${version === 4 ? 3 : version}.js`;
const stylePath = () => `/assets/style-v${version}.css`;
const body = (path) => {
  if (path === "/")
    return `<!doctype html><link rel="stylesheet" href="${stylePath()}"><body>version-${version}<script type="module" src="${scriptPath()}"></script></body>`;
  if (path === "/client.js") return client;
  if (path.endsWith(".css")) return `body { color: rgb(${version}, 20, 30); }`;
  if (/^\/assets\/app-v\d+\.js$/.test(path))
    return `import {startAssetCache,setAssetCacheMatchActive} from '/client.js';window.setMatchActive=setAssetCacheMatchActive;await startAssetCache();window.ready=true;`;
  return path === "/same.bin" ? "same" : `changed-${version}`;
};
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  hits.set(path, (hits.get(path) || 0) + 1);
  res.setHeader("Cache-Control", "no-store");
  if (path === "/sw.js") {
    const paths = ["/", "/client.js", scriptPath(), stylePath(), "/same.bin", "/changed.bin"];
    const revisions = Object.fromEntries(paths.map((path) => [path, hash(body(path))]));
    const sizes = Object.fromEntries(paths.map((path) => [path, Buffer.byteLength(body(path))]));
    res.setHeader("Content-Type", "text/javascript");
    res.end(
      `const ASSET_REVISIONS=${JSON.stringify(revisions)};const ASSET_SIZES=${JSON.stringify(sizes)};const BUILD_ID='v${version}';const SHELL_URLS=${JSON.stringify(paths.slice(0, 4))};\n${worker}`,
    );
  } else if (path.startsWith("/assets/") && path !== scriptPath() && path !== stylePath()) {
    res.writeHead(404).end();
  } else {
    res.setHeader(
      "Content-Type",
      path === "/"
        ? "text/html"
        : path.endsWith(".css")
          ? "text/css"
          : path.endsWith(".js")
            ? "text/javascript"
            : "application/octet-stream",
    );
    res.end(body(path));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
context.on("weberror", (e) => errors.push(e.error().message));
const read = (p) =>
  p.evaluate(async () =>
    Promise.all(["/same.bin", "/changed.bin"].map((path) => fetch(path).then((r) => r.text()))),
  );
const update = (p) =>
  p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
const expectVersion = (p, v) =>
  p.waitForFunction((v) => document.body.textContent.includes(`version-${v}`) && window.ready, v);
try {
  await page.goto(url);
  await expectVersion(page, 1);
  if (JSON.stringify(await read(page)) !== JSON.stringify(["same", "changed-1"]))
    throw Error("v1 assets");
  await page.waitForFunction(
    async () => (await (await caches.open("cs2go-assets-v1")).keys()).length === 2,
  );
  const sameHits = hits.get("/same.bin");
  version = 2;
  await update(page);
  await expectVersion(page, 2);
  if (JSON.stringify(await read(page)) !== JSON.stringify(["same", "changed-2"]))
    throw Error("v2 assets");
  if (hits.get("/same.bin") !== sameHits) throw Error("Unchanged asset downloaded again");
  const oldHits = hits.get("/assets/app-v1.js");
  if (!(await page.evaluate(() => fetch("/assets/app-v1.js").then((r) => r.ok))))
    throw Error("Old lazy chunk unavailable");
  if (hits.get("/assets/app-v1.js") !== oldHits) throw Error("Old code hit removed network path");
  // An idle tab updates while the other tab keeps its live match and old code.
  await page.evaluate(() => window.setMatchActive(true));
  const idle = await context.newPage();
  await idle.goto(url);
  await expectVersion(idle, 2);
  version = 3;
  await update(idle);
  await expectVersion(idle, 3);
  if (!(await page.locator("body").textContent()).includes("version-2"))
    throw Error("Live match was reloaded");
  await page.evaluate(() => window.setMatchActive(false));
  await expectVersion(page, 3);
  // Stylesheet-only changes must refresh too, even when the module URL is unchanged.
  version = 4;
  await update(page);
  await expectVersion(page, 4);
  if ((await page.evaluate(() => getComputedStyle(document.body).color)) !== "rgb(4, 20, 30)")
    throw Error("Old stylesheet remained active");
  if (JSON.stringify(await read(page)) !== JSON.stringify(["same", "changed-4"]))
    throw Error("v4 assets");
  await page.waitForFunction(async () => {
    const cache = await caches.open("cs2go-assets-v1");
    for (const req of await cache.keys())
      if (
        req.url.includes("/changed.bin") &&
        (await (await cache.match(req)).text()) === "changed-4"
      )
        return true;
    return false;
  });
  await context.setOffline(true);
  await page.reload();
  await expectVersion(page, 4);
  if (JSON.stringify(await read(page)) !== JSON.stringify(["same", "changed-4"]))
    throw Error("Offline assets");
  if (errors.length) throw Error(JSON.stringify(errors));
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/cache-update-result.json",
    JSON.stringify(
      {
        automaticMenuRefresh: true,
        liveMatchDeferred: true,
        twoTabs: true,
        stylesheetOnlyUpdate: true,
        oldCodeRetained: true,
        offlineShell: true,
        unchangedAssetReused: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: automatic updates, two tabs, deferred match refresh, retained old code, reused assets, offline shell.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
