import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("bomb pulses accelerate and stop on round completion", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="t"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.position.set(1100 * 0.0254, 140 * 0.0254, -2500 * 0.0254);
    g.grounded = true;
    g.bomb!.carrier = "player";
    g.keys.add("KeyE");
    g.soundscape.playMusic("start");
    g.updateRound(4);
    g.keys.clear();
    const plantedMusic = g.bomb!.planted && g.soundscape.currentMusic === "bomb";
    g.bots.forEach((b, i) => b.group.position.set(100 + i, 500, 100));
    const calls: number[] = [];
    let defuseEdges = 0;
    const play = g.soundscape.play.bind(g.soundscape);
    g.soundscape.play = (...args) => {
      if (args[0] === "bomb-beep" || args[0] === "bomb-beep-fast") calls.push(g.bomb!.timer);
      if (args[0] === "bomb-defuse-start") defuseEdges++;
    };
    const ct = g.bots.find((bot) => bot.team === "ct")!;
    ct.tracking = false;
    ct.group.position.copy(g.bomb!.position);
    g.updateRound(1 / 128);
    g.updateRound(1 / 128);
    ct.group.position.x += 4;
    g.updateRound(1 / 128);
    ct.group.position.copy(g.bomb!.position);
    g.updateRound(1 / 128);
    ct.group.position.set(500, 500, 500);
    g.updateRound(1 / 128);
    for (let i = 0; i < 39 * 128; i++) g.updateRound(1 / 128);
    const early = calls.filter((t) => t > 30);
    const late = calls.filter((t) => t < 10);
    const earlyInterval = early[0] - early[1];
    const lateInterval = late.at(-2)! - late.at(-1)!;
    const warning = g.soundscape.currentMusic;
    g.endRound("ct", "Bomb defused");
    const count = calls.length;
    for (let i = 0; i < 128; i++) g.updateRound(1 / 128);
    g.soundscape.play = play;
    return {
      defuseEdges,
      earlyInterval,
      lateInterval,
      stopped: calls.length === count,
      plantedMusic,
      warning,
    };
  });
  expect(result.defuseEdges).toBe(2);
  expect(result.earlyInterval).toBeGreaterThan(0.85);
  expect(result.lateInterval).toBeLessThan(0.2);
  expect(result.stopped).toBe(true);
  expect(result.plantedMusic).toBe(true);
  expect(result.warning).toBe("bomb-countdown");
  expect(errors).toEqual([]);
});
