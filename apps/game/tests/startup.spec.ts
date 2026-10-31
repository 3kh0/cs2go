import { test, expect } from "@playwright/test";

test("startup badge stays visible until all assets finish loading", async ({ page, baseURL }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
  });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/dust2-sky.hdr", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator("#startup")).toBeVisible();
  expect(await page.locator("#app").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  await page.waitForTimeout(4800);
  await expect(page.locator("#startup")).toBeVisible();
  await expect(page.locator("#play")).toBeDisabled();
  await expect(page.locator(".startup-label")).toHaveText(
    /\.(?:glb|bin|hdr|json|ogg|png|webp)(?:\.gz)?$/,
  );
  const progress = page.getByRole("progressbar", { name: "Loading progress" });
  await expect(progress).toHaveText(/\d+%/);
  await expect
    .poll(async () => Number(await progress.getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  expect(Number(await progress.getAttribute("aria-valuenow"))).toBeLessThan(100);
  await page.keyboard.press("Escape");
  await expect(page.locator("#startup")).toBeVisible();
  await expect(page.locator("#startup progress, #skip-intro")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/startup.png" });
  await expect(page.locator(".startup-title")).toHaveCount(0);
  release();
  await expect(page.locator(".startup-title")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".startup-loading")).toBeHidden();
  await expect(page.locator("#play")).toBeEnabled();
  expect(await page.locator("#app").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "artifacts/startup-intro.png" });
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 15000 });
  expect(await page.locator("#app").evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 15000 });
  await page.bringToFront();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  expect(await page.evaluate(() => window.__game.active)).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("startup finishes automatically and respects reduced motion", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#startup")).toBeVisible();
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator("#play")).toBeEnabled();
  expect(await page.evaluate(() => window.__game.active)).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 15000 });
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  expect(await page.locator("#app").evaluate((el) => (el as HTMLElement).inert)).toBe(false);
});

test("failed startup assets reveal a usable menu and error instead of a stuck intro", async ({
  page,
}) => {
  await page.route("**/dust2-sky.hdr", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#startup")).toHaveCount(0);
  await expect(page.locator("#play")).toBeDisabled();
  await expect(page.locator("#play")).toContainText("ARMORY UNAVAILABLE");
  await expect(page.locator("#mode-description")).toContainText("Refresh the page to retry");
  await page.locator("#settings-button").click();
  await expect(page.locator("#settings")).toBeVisible();
});
