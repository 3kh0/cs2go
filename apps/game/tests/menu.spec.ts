import { test, expect } from "@playwright/test";

test("casual lobby showcases the map and starts a full match", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator("#play")).toHaveText("PLAY CASUAL↗");
  await expect(page.locator("#menu")).not.toContainText(/DEATHMATCH|PRACTICE/);
  const initial = await page.evaluate(() => window.__game.camera.position.toArray());
  await page.screenshot({ path: "artifacts/casual-menu.png" });
  await page.waitForTimeout(3000);
  const moved = await page.evaluate(() => window.__game.camera.position.toArray());
  expect(Math.hypot(...moved.map((value, i) => value - initial[i]!))).toBeGreaterThan(0.1);
  await page.screenshot({ path: "artifacts/casual-menu-pan.png" });
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  await page.locator("#agent-team").selectOption("t");
  await page.locator("#close-settings").click();
  await page.locator("#play").click();
  await expect(page.getByRole("dialog", { name: "Choose your team" })).toBeVisible();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "artifacts/team-selector.png" });
  await page.locator("#team-back").click();
  await expect(page.locator("#team-select")).toHaveCount(0);
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="t"]').click();
  await page.waitForFunction(() => window.__game.locked);
  expect(
    await page.evaluate(() => ({
      mode: window.__game.mode,
      team: window.__game.team,
      bots: window.__game.bots.length,
    })),
  ).toEqual({ mode: "casual", team: "t", bots: 19 });
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
  await page.locator("#leave").click();
  await expect(page.locator("#menu")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  const still = await page.evaluate(() => window.__game.camera.position.toArray());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__game.camera.position.toArray())).toEqual(still);
  expect(errors).toEqual([]);
});
