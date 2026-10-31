import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const base = process.env.CACHE_URL || "http://127.0.0.1:5188";
const sw = await readFile("apps/game/dist/sw.js", "utf8");
const revisions = JSON.parse(sw.match(/^const ASSET_REVISIONS=(.*);$/m)[1]);
const shell = JSON.parse(sw.match(/^const SHELL_URLS=(.*);$/m)[1]);
const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => {
  errors.push(error.message);
  console.error("Page error", error.message);
});
page.on("requestfailed", (request) =>
  console.error("Request failed", request.url(), request.failure()?.errorText),
);
await page.addInitScript(() => performance.setResourceTimingBufferSize(5000));
try {
  await page.goto(base);
  await page.waitForFunction(
    () => {
      const p = document.querySelector("#play");
      if (p?.textContent.includes("UNAVAILABLE")) throw new Error(p.textContent);
      return p && !p.disabled && p.textContent.includes("PLAY");
    },
    {},
    { timeout: 40000 },
  );
  const first = await page.evaluate(() => ({
    readyMs: performance.now(),
    cacheEntries: performance.getEntriesByType("resource").length,
  }));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  console.log("Cold Play ready", first);
  const requested = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname),
  );
  const expected = [...new Set(requested)].filter(
    (path) => revisions[path] && !shell.includes(path),
  );
  async function waitForCached() {
    await page.waitForFunction(
      async (paths) => {
        const cache = await caches.open("cs2go-assets-v1");
        const keys = new Set((await cache.keys()).map((key) => new URL(key.url).pathname));
        return paths.every((path) => keys.has(path));
      },
      expected,
      { timeout: 40000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.waitForFunction(
      async (paths) => {
        const cache = await caches.open("cs2go-assets-v1");
        const keys = new Set((await cache.keys()).map((key) => new URL(key.url).pathname));
        return paths.every((path) => keys.has(path));
      },
      expected,
      { timeout: 40000 },
    );
  }
  await waitForCached();
  first.storage = await page.evaluate(async () => {
    const cache = await caches.open("cs2go-assets-v1");
    let bytes = 0,
      count = 0;
    for (const key of await cache.keys()) {
      bytes += Number((await cache.match(key)).headers.get("x-cs2go-cache-size"));
      count++;
    }
    return { bytes, count };
  });
  console.log("Cold cache", first.storage);
  console.log("Reloading", await page.evaluate(() => navigator.onLine));
  await page.reload();
  await page.waitForFunction(
    () => {
      const p = document.querySelector("#play");
      if (p?.textContent.includes("UNAVAILABLE")) throw new Error(p.textContent);
      return p && !p.disabled && p.textContent.includes("PLAY");
    },
    {},
    { timeout: 40000 },
  );
  console.log("Warm Play ready");
  const warm = await page.evaluate(async () => {
    const cache = await caches.open("cs2go-assets-v1");
    let bytes = 0,
      count = 0;
    for (const key of await cache.keys()) {
      bytes += Number((await cache.match(key)).headers.get("x-cs2go-cache-size"));
      count++;
    }
    return { readyMs: performance.now(), bytes, count };
  });
  console.log("Warm cache", warm);
  await waitForCached();
  await context.setOffline(true);
  console.log("Reloading", await page.evaluate(() => navigator.onLine));
  await page.reload();
  await page.waitForFunction(
    () => {
      const p = document.querySelector("#play");
      if (p?.textContent.includes("UNAVAILABLE")) throw new Error(p.textContent);
      return p && !p.disabled && p.textContent.includes("PLAY");
    },
    {},
    { timeout: 40000 },
  );
  const offline = await page.evaluate(() => ({
    readyMs: performance.now(),
    productionHookPresent: "__game" in window,
    controller: !!navigator.serviceWorker.controller,
  }));
  if (errors.length || offline.productionHookPresent)
    throw new Error(JSON.stringify({ errors, offline }));
  const result = { first, warm, offline, cachedRequired: expected.length, errors };
  console.log(JSON.stringify(result));
  await writeFile("artifacts/asset-cache-verification.json", JSON.stringify(result, null, 2));
} catch (error) {
  const diagnosis = await page.evaluate(async () => ({
    button: document.querySelector("#play")?.textContent,
    disabled: document.querySelector("#play")?.disabled,
    controller: !!navigator.serviceWorker.controller,
    requested: performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname),
    cached: (await (await caches.open("cs2go-assets-v1")).keys()).map(
      (r) => new URL(r.url).pathname,
    ),
  }));
  diagnosis.missing = [...new Set(diagnosis.requested)].filter(
    (path) => revisions[path] && !shell.includes(path) && !diagnosis.cached.includes(path),
  );
  console.error(JSON.stringify(diagnosis));
  throw error;
} finally {
  await browser.close();
}
