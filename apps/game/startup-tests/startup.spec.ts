import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Exercise the same startup checks against local assets and a shared-object CDN build.
const worker = readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");
const urls: Record<string, string> = JSON.parse(
  worker.match(/^const ASSET_URLS=(.*);$/m)?.[1] ?? "{}",
);
const logicalPaths = Object.fromEntries(Object.entries(urls).map(([path, url]) => [url, path]));
const mapUrl = urls["/models/maps/dust2.glb.gz"] ?? "/models/maps/dust2.glb.gz";
const cdn = Object.keys(urls).length > 0;

test("cold startup begins asset loading even if service-worker registration never finishes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, "register", {
      value: () => new Promise(() => {}),
    });
  });
  const maps: string[] = [];
  const errors: string[] = [];
  const misrouted: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().endsWith(mapUrl)) maps.push(request.url());
    const url = new URL(request.url());
    if (
      cdn &&
      url.origin === new URL(page.url()).origin &&
      /^\/(?:audio|effects|fonts|icons|licenses|maps|models|skins|ui)\//.test(url.pathname)
    )
      misrouted.push(url.href);
  });
  const documentResponse = page
    .waitForResponse((response) => response.request().isNavigationRequest())
    .then(() => Date.now());
  const firstAsset = page
    .waitForRequest((request) =>
      /\/(?:models\/|audio\/startup\.bin)/.test(logicalPaths[request.url()] ?? request.url()),
    )
    .then(() => Date.now());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // The old startup gate waited a fixed eight seconds before any game fetch.
  // Exclude initial browser connection/DNS delay, and record the request itself
  // rather than time spent waiting for DOMContentLoaded after the request starts.
  expect((await firstAsset) - (await documentResponse)).toBeLessThan(4000);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  // The menu and match share one map; the early preload is reused by the loader.
  expect(maps).toHaveLength(1);
  expect(maps[0]).toContain(mapUrl);
  expect(await page.evaluate(() => "__game" in window)).toBe(false);
  // A development SPA fallback can return HTML with status 200 for a broken
  // image URL. Check decoding and routing, rather than HTTP status alone.
  const brokenImages = () =>
    page.locator("img[src]").evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const image = node as HTMLImageElement;
          return image.getAttribute("src") && (!image.complete || !image.naturalWidth);
        })
        .map((node) => (node as HTMLImageElement).src),
    );
  await expect.poll(brokenImages, { timeout: 15000 }).toEqual([]);
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await expect(page.locator("#team-select")).toBeVisible({ timeout: 45000 });
  await expect.poll(brokenImages, { timeout: 15000 }).toEqual([]);
  expect(misrouted).toEqual([]);
  expect(errors).toEqual([]);
});

test("cold cache installs, repeated startup reuses it, and the ready menu survives offline", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => performance.setResourceTimingBufferSize(5000));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, {}, { timeout: 30000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  // The entry point imports the app asynchronously. Absence of #startup can
  // mean the app has not mounted yet; wait for actual asset readiness before
  // collecting requests and cutting the network.
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 120000 });
  const used = await page.evaluate(
    (paths) =>
      performance
        .getEntriesByType("resource")
        .map((entry) => paths[entry.name] ?? new URL(entry.name).pathname)
        .filter((path) => /^\/(?:audio|models|effects|maps|icons|fonts|ui)\//.test(path)),
    logicalPaths,
  );
  expect(used).toContain("/models/maps/dust2.glb.gz");
  await page.waitForFunction(
    async (used) => {
      const stored = new Set<string>();
      for (const name of await caches.keys())
        if (name.startsWith("cs2go-")) {
          for (const request of await (await caches.open(name)).keys())
            stored.add(new URL(request.url).pathname);
        }
      return used.every((path) => stored.has(path));
    },
    used,
    { timeout: 30000 },
  );
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.screenshot({ path: "../../artifacts/startup-offline.png" });
  expect(errors).toEqual([]);
});
