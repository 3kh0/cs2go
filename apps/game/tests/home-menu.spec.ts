import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("native homepage presents both agents, local navigation and a working match round trip", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).origin !== new URL(baseURL!).origin
    )
      external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await expect(page.locator(".home-nav button")).toHaveText([
    "INVENTORY",
    "LOADOUT",
    "PLAY",
    "STORE",
    "NEWS",
  ]);
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-clip", /^ct_main_menu_/);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
    "Stratum2",
  );
  expect(await page.evaluate(() => document.fonts.check('700 16px "Stratum2 Monodigit"'))).toBe(
    true,
  );
  const animationTime = () =>
    page.evaluate(() => {
      const scene = window.__game.homeScene as unknown as {
        previews: Map<string, { mixer: { time: number } }>;
      };
      return scene.previews.get(window.__game.team)!.mixer.time;
    });
  const before = await animationTime();
  await expect.poll(animationTime).toBeGreaterThan(before + 0.1);
  await page.screenshot({ path: "artifacts/home-ct-1440.png" });
  await page.getByRole("button", { name: "Show Terrorist", exact: true }).click();
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-clip", /^t_main_menu_/);
  await page.screenshot({ path: "artifacts/home-t-1440.png" });
  await page.locator("#inventory-button").click();
  await expect(page.locator("#loadout-editor")).toBeVisible();
  await page.locator("#close-loadout-editor").click();
  await page.locator("#skins-button").click();
  await expect(page.locator("#skin-menu")).toBeVisible();
  await page.locator("#close-skins").click();
  await page.locator("#store-button").click();
  await expect(page.locator("#home-panel-title")).toHaveText("Store unavailable");
  await expect(page.locator("#home-panel-content p")).toHaveText(
    "The Store is not available in this version.",
  );
  await page.screenshot({ path: "artifacts/home-store-unavailable.png" });
  await page.locator("#home-panel-close").click();
  await expect(page.locator("#store-button")).toBeFocused();
  await page.locator("#news-button").click();
  await expect(page.locator("#home-panel-title")).toHaveText("News unavailable");
  await page.keyboard.press("Escape");
  await expect(page.locator("#home-panel")).toBeHidden();
  await expect(page.locator("#news-button")).toBeFocused();
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-background").selectOption("close");
  await expect(page.locator("#home-scenery")).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: "artifacts/home-t-close-1280.png" });
  const nav = await page.locator(".home-nav").boundingBox();
  const tools = await page.locator(".home-tools").boundingBox();
  expect(nav!.x).toBeGreaterThan(tools!.x + tools!.width);
  expect(nav!.x + nav!.width).toBeLessThan(1280 - 52);
  await page.locator("#home-play").click();
  await expect(page.locator("#menu")).toHaveAttribute("data-page", "play");
  await page.screenshot({ path: "artifacts/home-play-1280.png" });
  await page.locator('[data-mode="competitive"]').click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page
    .waitForFunction(() => window.__game.locked, undefined, { timeout: 15_000 })
    .catch(async (error) => {
      throw new Error(
        `${error} state=${JSON.stringify(await page.evaluate(() => ({ active: window.__game.active, ready: window.__game.assetsReady, locked: window.__game.locked, pointer: !!document.pointerLockElement })))}, errors=${JSON.stringify(errors)}`,
      );
    });
  await expect(page.locator("#menu")).toBeHidden();
  await page.waitForTimeout(250);
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
  await page.locator("#leave").click();
  await expect(page.locator("#menu")).toBeVisible();
  await expect(page.locator("#menu")).toHaveAttribute("data-page", "home");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-clip", /^ct_main_menu_/);
  expect(
    await page.evaluate(
      () =>
        (window.__game.homeScene as unknown as { previews: Map<string, unknown> }).previews.size,
    ),
  ).toBe(2);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("reduced motion holds the native homepage idle without advancing its clock", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-clip", /^ct_main_menu_/);
  const clock = () =>
    page.evaluate(
      () =>
        (
          window.__game.homeScene as unknown as {
            previews: Map<string, { mixer: { time: number } }>;
          }
        ).previews.get("ct")!.mixer.time,
    );
  const before = await clock();
  await page.waitForTimeout(200);
  expect(await clock()).toBe(before);
  await page.screenshot({ path: "artifacts/home-reduced-motion.png" });
});
