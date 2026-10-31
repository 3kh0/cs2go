import { expect, test } from "@playwright/test";

test("cold startup begins asset loading even if service-worker registration never finishes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, "register", {
      value: () => new Promise(() => {}),
    });
  });
  const started = Date.now();
  const firstAsset = page.waitForRequest((request) =>
    /\/(?:models\/|audio\/startup\.bin)/.test(request.url()),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await firstAsset;
  // The old startup gate waited a fixed eight seconds before any game fetch.
  expect(Date.now() - started).toBeLessThan(4000);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await expect(page.locator("#startup")).toHaveCount(0);
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
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 120000 });
  const used = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname.replace(/^\/releases\/[a-f0-9]{64}/, ""))
      .filter((path) => /^\/(?:audio|models|effects|maps|icons|fonts|ui)\//.test(path)),
  );
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
