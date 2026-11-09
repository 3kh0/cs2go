import { expect, test } from "@playwright/test";

test("health and armor HUD retain the native damage gradient and helmet state", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator("#startup")).toBeHidden();
  await page.evaluate(() => {
    const game = window.__game;
    game.health = 67;
    game.armor = 94;
    game.helmet = true;
    game.updateUI();
    document.getElementById("hud")!.classList.remove("hidden");
    document.getElementById("menu")!.classList.add("hidden");
  });
  await expect(page.locator("#health")).toHaveText("67");
  await expect(page.locator("#armor")).toHaveText("94");
  await expect(page.locator(".armor-helmet")).toBeVisible();
  await expect(page.locator(".armor-vest")).toBeHidden();
  const damaged = await page.locator(".health-track").evaluate((track) => {
    const fill = track.querySelector("i")!;
    return {
      available: track.clientWidth,
      remaining: fill.getBoundingClientRect().width,
      missing: getComputedStyle(track).backgroundImage,
      iconsLoaded: [...document.querySelectorAll<HTMLImageElement>(".armor img")].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    };
  });
  expect(damaged.remaining / damaged.available).toBeCloseTo(0.67, 2);
  expect(damaged.missing).toContain("linear-gradient");
  expect(damaged.missing).toContain("255, 0, 0");
  expect(damaged.iconsLoaded).toBe(true);
  const bounds = (await page.locator(".vitals").boundingBox())!;
  const clip = {
    x: bounds.x - 8,
    y: bounds.y - 8,
    width: bounds.width + 16,
    height: bounds.height + 24,
  };
  await page.screenshot({ path: "artifacts/hud-vitals-damaged.png", clip });
  await page.evaluate(() => document.documentElement.style.setProperty("--hud-accent", "#fff"));
  await page.screenshot({ path: "artifacts/hud-vitals-native-white.png", clip });
  await page.evaluate(() => document.documentElement.style.removeProperty("--hud-accent"));
  await page.evaluate(() => {
    window.__game.helmet = false;
    window.__game.updateUI();
  });
  await expect(page.locator(".armor-vest")).toBeVisible();
  await expect(page.locator(".armor-helmet")).toBeHidden();
  await page.evaluate(() => {
    window.__game.armor = 0;
    window.__game.health = 100;
    window.__game.updateUI();
  });
  await expect(page.locator("#armor-state")).toBeHidden();
  await expect(page.locator("#health-fill")).toHaveCSS("width", "63px");
  expect(errors).toEqual([]);
});
