import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("key rebinding persists, rejects conflicts and drives gameplay; fullscreen toggles", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Controls", exact: true }).click();
  const jump = page.locator('[data-binding="Space"]');
  await jump.click();
  await page.keyboard.press("w");
  await expect(page.locator("#control-status")).toContainText("already bound");
  await page.keyboard.press("j");
  await expect(jump).toHaveText("J");
  await jump.click();
  await page.getByRole("tab", { name: "Video", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Audio", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(jump).toHaveText("J");
  await page.getByRole("tab", { name: "Video", exact: true }).click();
  await page.locator("#fullscreen-toggle").click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.getByRole("tab", { name: "Video", exact: true }).click();
  await page.locator("#fullscreen-toggle").click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Controls", exact: true }).click();
  await expect(jump).toHaveText("J");
  await page.locator("#close-settings").click();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.bots.forEach((b) => (b.tracking = false));
  });
  await page.keyboard.down("j");
  await expect.poll(() => page.evaluate(() => window.__game.vertical)).toBeGreaterThan(0);
  await page.keyboard.up("j");
  await page.evaluate(() => document.exitPointerLock());
  await page.locator("#pause-settings").click();
  await page.getByRole("tab", { name: "Controls", exact: true }).click();
  await page.locator("#reset-bindings").click();
  await expect(jump).toHaveText("Space");
  expect(errors).toEqual([]);
});
