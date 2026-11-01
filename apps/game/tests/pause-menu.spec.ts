import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("native pause navbar fits the full casual scoreboard and keeps match/settings live", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 100;
    g.bots.forEach((bot, i) => bot.group.position.set(200 + i, 500, 200));
    document.exitPointerLock();
  });
  await expect(page.locator("#pause")).toBeVisible();
  await expect(page.locator(".pause-toolbar button")).toHaveText([
    "↶RESUME GAME",
    "INVENTORY",
    "SETTINGS",
    "DISCONNECT",
  ]);
  await expect(page.locator(".score-team.t .score-row")).toHaveCount(10);
  for (const height of [900, 720]) {
    await page.setViewportSize({ width: height === 900 ? 1440 : 1280, height });
    await page.waitForTimeout(150);
    const nav = (await page.locator(".pause-toolbar").boundingBox())!;
    const board = (await page.locator("#scoreboard").boundingBox())!;
    const finalRow = (await page.locator(".score-team.t .score-row").last().boundingBox())!;
    expect(nav.y).toBeCloseTo((height * 96) / 1080, 0);
    expect(board.y).toBeGreaterThanOrEqual(nav.y + nav.height);
    expect(finalRow.y + finalRow.height).toBeLessThan(height);
    await page.screenshot({ path: `artifacts/pause-casual-${height}.png` });
  }
  const before = await page.evaluate(() => window.__game.freezeTime);
  await expect.poll(() => page.evaluate(() => window.__game.freezeTime)).toBeLessThan(before);
  await page.locator("#pause-settings").click();
  await expect(page.locator("#settings")).toBeVisible();
  expect((await page.locator("#settings").boundingBox())!.y).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings")).toBeHidden();
  await page.locator("#resume").click();
  await page.waitForFunction(() => window.__game.locked);
  await expect(page.locator("#pause")).toBeHidden();
  expect(errors).toEqual([]);
});
