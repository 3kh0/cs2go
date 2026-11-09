import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("map selection preserves the home scene and cancels a cold map load immediately", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let requested = false;
  let release: () => void = () => {};
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/models/maps/mirage-config.json", async (route) => {
    requested = true;
    await delayed;
    await route.fulfill({ status: 404, body: "Map unavailable" });
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  const dust = page.locator('.match-maps [data-map="dust2"]');
  const mirage = page.locator('.match-maps [data-map="mirage"]');
  await expect(dust).toHaveAttribute("aria-pressed", "true");
  await mirage.click();
  await expect(dust).toHaveAttribute("aria-pressed", "false");
  await expect(mirage).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.__game.mapId)).toBe("dust2");
  await page.locator("#play").click();
  await expect.poll(() => requested).toBe(true);
  await expect(page.locator(".match-loading-map")).toHaveText("Mirage");
  await page.locator("#match-loading button").click();
  await expect(page.locator("#match-loading")).toHaveCount(0, { timeout: 3000 });
  expect(
    await page.evaluate(() => ({
      map: window.__game.mapId,
      active: window.__game.active,
      loading: window.__game.matchLoading,
    })),
  ).toEqual({ map: "dust2", active: false, loading: false });
  release();
  await expect(page.locator("#menu")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a failed map radar keeps the current world intact and retries the image on the next attempt", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let attempts = 0;
  await page.route("**/models/maps/mirage-radar.png", async (route) => {
    if (++attempts === 1) await route.fulfill({ status: 503, body: "Temporarily unavailable" });
    else await route.continue();
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator('.match-maps [data-map="mirage"]').click();
  await page.locator("#play").click();
  await expect(page.locator("#match-loading button")).toHaveText("BACK TO MENU", {
    timeout: 60_000,
  });
  expect(
    await page.evaluate(() => ({
      map: window.__game.mapId,
      world: window.__game.world.id,
      radar: window.__game.radarImage?.src.split("/").at(-1),
      visibleWorlds: window.__game.scene.children
        .filter((object) => object.name.endsWith(" - CS2") && object.visible)
        .map((object) => object.name),
    })),
  ).toEqual({
    map: "dust2",
    world: "dust2",
    radar: "dust2-callouts.png",
    visibleWorlds: ["Dust II - CS2"],
  });
  await page.locator("#match-loading button").click();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await expect(page.locator("#team-select")).toBeVisible({ timeout: 60_000 });
  expect(attempts).toBe(2);
  expect(
    await page.evaluate(() => ({
      map: window.__game.mapId,
      world: window.__game.world.id,
      radar: window.__game.radarImage?.src.split("/").at(-1),
    })),
  ).toEqual({ map: "mirage", world: "mirage", radar: "mirage-radar.png" });
  await page.locator("#team-back").click();
  expect(errors).toEqual([]);
});

test("cancelling radar preparation is immediate and its late result cannot replace another match", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let requested = false;
  let release: () => void = () => {};
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/models/maps/mirage-radar.png", async (route) => {
    requested = true;
    await delayed;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator('.match-maps [data-map="mirage"]').click();
  await page.locator("#play").click();
  await expect.poll(() => requested, { timeout: 60_000 }).toBe(true);
  await page.locator("#match-loading button").click();
  await expect(page.locator("#match-loading")).toHaveCount(0, { timeout: 3000 });
  expect(await page.evaluate(() => window.__game.mapId)).toBe("dust2");
  await page.locator("#home-play").click();
  await page.locator('.match-maps [data-map="dust2"]').click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click({ timeout: 60_000 });
  await page.waitForFunction(() => window.__game.active && window.__game.mapId === "dust2");
  const response = page.waitForResponse((result) => result.url().endsWith("mirage-radar.png"));
  release();
  await response;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await page.evaluate(() => ({
      map: window.__game.mapId,
      world: window.__game.world.id,
      active: window.__game.active,
      radar: window.__game.radarImage?.src.split("/").at(-1),
    })),
  ).toEqual({ map: "dust2", world: "dust2", active: true, radar: "dust2-callouts.png" });
  expect(errors).toEqual([]);
});
