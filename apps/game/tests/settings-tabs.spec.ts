import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("tabbed settings apply crosshair and video detail, persist and keep the match live", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
  });
  // Keep this long asset/interaction test stable during local development edits.
  await page.routeWebSocket("**", (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      if (typeof message === "string" && /"type":"(?:update|full-reload)"/.test(message)) return;
      socket.send(message);
    });
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#settings-button").click();
  await expect(page.getByRole("tab")).toHaveCount(6);
  await page.locator("#quality").selectOption("performance");
  await page.locator("#texture-quality").selectOption("high");
  await page.locator("#fps-cap").selectOption("30");
  await page.locator("#resolutionScale").fill("75");
  const source = await page.evaluate(() => {
    let map: { image: { width: number } } | undefined;
    window.__game.scene.traverse((object) => {
      const mesh = object as unknown as { material?: { map?: typeof map } };
      if (!map && mesh.material?.map?.image.width) map = mesh.material.map;
    });
    return map?.image.width;
  });
  expect(source).toBeGreaterThan(1);
  await page.locator("#texture-quality").selectOption("low");
  const width = () =>
    page.evaluate(() => {
      let width = 0;
      window.__game.scene.traverse((object) => {
        const mesh = object as unknown as { material?: { map?: { image: { width: number } } } };
        if (!width && mesh.material?.map?.image.width) width = mesh.material.map.image.width;
      });
      return width;
    });
  expect(await width()).toBe(Math.max(1, Math.floor(source! / 4)));
  await page.locator("#texture-quality").selectOption("high");
  expect(await width()).toBe(source);
  await page.screenshot({ path: "artifacts/settings-video.png" });
  await page.getByRole("tab", { name: "Crosshair", exact: true }).click();
  await page.locator("#crosshairColor").fill("#ff00ff");
  await page.locator("#crosshairLength").fill("12");
  await page.locator("#crosshairGap").fill("8");
  await page.locator("#crosshairDynamic").uncheck();
  await page.locator("#crosshairDot").uncheck();
  await expect(page.locator("#crosshair-preview i").first()).toHaveCSS(
    "background-color",
    "rgb(255, 0, 255)",
  );
  await expect(page.locator("#crosshair-preview i").first()).toHaveCSS("width", "12px");
  await expect(page.locator("#crosshair-preview b")).toBeHidden();
  await page.screenshot({ path: "artifacts/settings-crosshair.png" });
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  expect(
    await page.evaluate(() => ({
      fps: window.__game.settings.fpsCap,
      scale: window.__game.settings.resolutionScale,
      color: window.__game.settings.crosshairColor,
    })),
  ).toEqual({ fps: 30, scale: 75, color: "#ff00ff" });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("deathmatch");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
  await expect(page.locator("#pause")).toHaveCSS("backdrop-filter", "none");
  await expect(page.locator("#scoreboard")).toBeVisible();
  const before = await page.evaluate(() => ({
    time: window.__game.time,
    tick: window.__game.tick,
  }));
  await expect
    .poll(() => page.evaluate(() => window.__game.time), { timeout: 15000 })
    .toBeLessThan(before.time - 0.2);
  const after = await page.evaluate(() => ({
    time: window.__game.time,
    tick: window.__game.tick,
    fps: window.__game.fps,
  }));
  expect(after.time).toBeLessThan(before.time - 0.2);
  expect(after.tick - before.tick).toBeGreaterThan(25);
  expect(after.fps).toBeLessThanOrEqual(33);
  await page.screenshot({ path: "artifacts/live-match-menu.png" });
  await page.locator("#pause-settings").click();
  await expect(page.locator("#settings")).toBeVisible();
  await page.locator("#close-settings").click();
  await page.locator("#resume").click();
  await page.waitForFunction(() => window.__game.locked);
  await expect(page.locator("#scoreboard")).toBeHidden();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
