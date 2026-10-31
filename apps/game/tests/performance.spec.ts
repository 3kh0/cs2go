import { test, expect } from "@playwright/test";

test("render budgets survive resizing and quality changes without external assets", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 45000 });
  const pixels = () =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
      return canvas.width * canvas.height;
    });
  expect(await page.evaluate(() => window.__game.settings.quality)).toBe("high");
  expect(await page.evaluate(() => window.__game.renderer.shadowMap.enabled)).toBe(true);
  await page.setViewportSize({ width: 3840, height: 2160 });
  await expect.poll(pixels).toBe(2560 * 1440);
  await page.evaluate(() => {
    window.__game.settings.quality = "low";
    window.__game.saveSettings();
  });
  await expect.poll(pixels).toBe(1280 * 720);
  await page.evaluate(() => {
    window.__game.settings.quality = "high";
    window.__game.saveSettings();
  });
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
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/high-default-menu.png" });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
