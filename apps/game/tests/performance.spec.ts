import { test, expect } from "@playwright/test";

test("render budgets survive resizing and quality changes without external assets", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  const pixels = () =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
      return canvas.width * canvas.height;
    });
  expect(await page.evaluate(() => window.__game.settings.resolutionLimit)).toBe(1080);
  expect(await page.evaluate(() => window.__game.renderer.shadowMap.enabled)).toBe(true);
  await page.setViewportSize({ width: 3840, height: 2160 });
  await expect.poll(pixels).toBe(1920 * 1080);
  await page.locator("#settings-button").click();
  await expect(page.locator("#quality")).toHaveValue("balanced");
  await expect(page.getByLabel("VSync", { exact: true })).toBeDisabled();
  await page.locator("#quality").selectOption("performance");
  await expect(page.locator("#shadowDetail")).toHaveValue("low");
  expect(await page.evaluate(() => window.__game.renderer.shadowMap.type)).toBe(0);
  expect(
    await page.evaluate(() => {
      const sizes: number[] = [];
      for (const root of [window.__game.scene, window.__game.homeScene.graphicsRoot])
        root.traverse((object) => {
          const light = object as unknown as {
            castShadow: boolean;
            shadow?: { mapSize: { x: number } };
          };
          if (light.castShadow && light.shadow) sizes.push(light.shadow.mapSize.x);
        });
      return sizes;
    }),
  ).toEqual([1024, 1024]);
  await expect.poll(pixels).toBe(1280 * 720);
  await page.locator("#shadowDetail").selectOption("off");
  expect(await page.evaluate(() => window.__game.renderer.shadowMap.enabled)).toBe(false);
  await expect(page.locator("#quality")).toHaveValue("custom");
  await expect(page.locator("#shadowFilter")).toBeDisabled();
  await page.locator("#quality").selectOption("quality");
  expect(await page.evaluate(() => window.__game.renderer.shadowMap.enabled)).toBe(true);
  await expect(page.locator("#graphics-reload")).toBeVisible();
  await page.locator("#antialias").selectOption("off");
  await expect(page.locator("#graphics-reload")).toBeHidden();
  await expect.poll(pixels).toBe(2560 * 1440);
  // High retains the idle render limit as well as its framebuffer budget.
  const draws = await page.evaluate(async () => {
    const renderer = window.__game.renderer;
    const before = renderer.info.render.frame;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return renderer.info.render.frame - before;
  });
  expect(draws).toBeGreaterThan(0);
  expect(draws).toBeLessThanOrEqual(35);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#settings-video").evaluate((panel) => (panel.scrollTop = 0));
  await page.screenshot({ path: "artifacts/graphics-settings-display.png" });
  await page.locator("#shadowDetail").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/graphics-settings-detail.png" });
  await page.locator("#close-settings").click();
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/high-default-menu.png" });
  await page.locator("#settings-button").click();
  await page.locator("#antialias").selectOption("msaa");
  await page.locator("#graphics-reload").click();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  expect(await page.evaluate(() => window.__game.antialiasAtStartup)).toBe(true);
  expect(
    await page.evaluate(
      () => window.__game.renderer.getContext().getContextAttributes()?.antialias,
    ),
  ).toBe(true);
  await page.locator("#settings-button").click();
  await expect(page.locator("#graphics-reload")).toBeHidden();
  await expect(page.locator("#shadowDetail")).toHaveValue("high");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
