import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    releaseMatchPreparation(): void;
  }
}

test("match preparation stays silent until the map and team selector are ready", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toBeHidden();
  await page.evaluate(() => {
    const game = window.__game;
    const prepare = game.prepareMatch.bind(game);
    game.prepareMatch = async (...args) => {
      await new Promise<void>((resolve) => {
        Object.assign(window, { releaseMatchPreparation: resolve });
      });
      return prepare(...args);
    };
  });
  await page.locator("#home-play").click();
  await page.locator('.match-maps [data-map="inferno"]').click();
  await page.locator("#play").click();
  await expect(page.locator("#match-loading")).toBeVisible();
  expect(await page.evaluate(() => window.__game.soundscape.currentMusic)).toBeNull();
  await page.screenshot({ path: "artifacts/match-loading-lighter.png" });
  await page.evaluate(() => {
    window.releaseMatchPreparation();
  });
  await expect(page.locator("#team-select")).toBeVisible({ timeout: 120_000 });
  await expect(page.locator("#match-loading")).toHaveCount(0);
  expect(await page.evaluate(() => window.__game.soundscape.currentMusic)).toBe("selection");
  await page.locator('#team-select [data-team="ct"]').click();
  expect(await page.evaluate(() => window.__game.soundscape.currentMusic)).toBe("start");
  expect(errors).toEqual([]);
});
