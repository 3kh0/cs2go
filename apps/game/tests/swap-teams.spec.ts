import { expect, test, type Page } from "@playwright/test";
import { joinLobby } from "./multiplayer-helpers";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}
test.use({ actionTimeout: 15000 });
async function pause(page: Page) {
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
}

test("online lobby metadata is a scoreboard footer and team selection changes the authoritative player", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await joinLobby(page, `teams-${Date.now()}`, "ct");
  await pause(page);
  const pin = await page.locator("#match-room").inputValue();
  await expect(page.locator("#scoreboard-lobby")).toContainText(`LOBBY ID ${pin}`);
  await expect(page.locator("#pause-lobby")).toHaveCount(0);
  const footer = await page.locator("#scoreboard-lobby").boundingBox();
  const rows = await page.locator("#scoreboard-rows").boundingBox();
  expect(footer!.y).toBeGreaterThanOrEqual(rows!.y + rows!.height);
  expect(footer!.height).toBeLessThan(26);
  expect(footer!.x).toBeCloseTo(rows!.x, 0);
  await expect(page.locator("#match-invite")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/scoreboard-lobby-footer.png" });
  const buttons = page.locator(".pause-toolbar > button");
  await expect(buttons.nth(2)).toHaveText("⇄SWAP TEAMS");
  const id = await page.evaluate(() => window.__game.network!.connection.id);
  await page.locator("#pause-teams").click();
  await expect(page.locator("#team-select")).toBeVisible({ timeout: 100000 });
  await expect(page.locator("#pause")).toBeHidden();
  await page.locator("#team-back").click();
  await expect(page.locator("#pause")).toBeVisible();
  await expect(page.locator("#pause-teams")).toBeFocused();
  await page.locator("#pause-teams").click();
  await page.locator('#team-select [data-team="t"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__game.network!.connection.local!.team))
    .toBe("t");
  expect(await page.evaluate(() => window.__game.network!.connection.id)).toBe(id);
  expect(await page.locator("#match-room").inputValue()).toBe(pin);
  // A side change during an active round cannot grant a fresh life.
  await request.post("http://127.0.0.1:3004", { data: { room: pin, op: "live" } });
  await pause(page);
  await page.locator("#pause-teams").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__game.network!.connection.local!.team))
    .toBe("ct");
  expect(await page.evaluate(() => window.__game.network!.connection.local!.health)).toBe(0);
  expect(await page.evaluate(() => window.__game.network!.connection.local!.waiting)).toBe(true);
  expect(errors).toEqual([]);
});

test("offline scoreboard has no lobby line and swap teams preserves the match", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await expect(page.locator("#team-select")).toBeVisible({ timeout: 100000 });
  await page.locator('#team-select [data-team="ct"]').click();
  await page.evaluate(() => {
    const g = window.__game;
    g.kills = 4;
    g.teamScores.ct = 2;
  });
  await pause(page);
  await expect(page.locator("#scoreboard-lobby")).toBeHidden();
  await page.locator("#pause-teams").click();
  await page.locator('#team-select [data-team="t"]').click();
  expect(
    await page.evaluate(() => ({
      team: window.__game.team,
      kills: window.__game.kills,
      score: window.__game.teamScores.ct,
      waiting: window.__game.dead > 0,
    })),
  ).toEqual({ team: "t", kills: 4, score: 2, waiting: true });
  expect(
    await page.evaluate(() => ({
      t: window.__game.bots.filter((bot) => bot.team === "t").length + 1,
      ct: window.__game.bots.filter((bot) => bot.team === "ct").length,
    })),
  ).toEqual({ t: 10, ct: 10 });
  await page.evaluate(() => {
    window.__game.round = 2;
    window.__game.startRound();
  });
  expect(await page.evaluate(() => window.__game.health)).toBe(100);
  expect(
    await page.evaluate(() =>
      window.__game.bots.every((bot) => Number.isFinite(bot.group.position.x)),
    ),
  ).toBe(true);
  await pause(page);
  await expect(page.locator("#scoreboard-lobby")).toBeHidden();
  await page.screenshot({ path: "artifacts/offline-scoreboard-swap.png" });
  expect(errors).toEqual([]);
});
