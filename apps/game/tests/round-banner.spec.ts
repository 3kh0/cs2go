import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("round winner banner follows winning team and resets for the next round", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__game.locked);
  await page.evaluate(() => {
    document.getElementById("pause")!.classList.add("hidden");
    document.getElementById("scoreboard")!.classList.add("hidden");
    document.body.classList.remove("match-menu-open");
    window.__game.endRound("ct", "Bomb defused");
  });
  const banner = page.locator("#round-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("data-winner", "ct");
  await expect(page.locator("#round-banner-title")).toHaveText("ROUND WON");
  await expect(page.locator("#round-banner-reason")).toContainText("Bomb defused");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/round-won-ct.png" });
  await page.evaluate(() => window.__game.startRound());
  await expect(banner).toBeHidden();
  await page.evaluate(() => window.__game.endRound("t", "Bomb detonated"));
  await expect(banner).toHaveAttribute("data-winner", "t");
  await expect(page.locator("#round-banner-title")).toHaveText("ROUND LOST");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/round-won-t.png" });
});
