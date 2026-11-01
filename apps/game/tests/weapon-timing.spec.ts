import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("shipped deploy, reload, burst and zoom clocks drive gameplay", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game?.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.updateBots = () => {};
    g.moveBots = () => {};
    for (const bot of g.bots) {
      bot.health = 0;
      bot.respawn = Infinity;
    }
    g.buy(0);
    const deploy = g.cooldown;
    const original = g.ammo;
    for (let i = 0; i < 127; i++) g.simulate(1 / 128);
    g.fire();
    const blocked = g.ammo === original;
    g.simulate(1 / 128);
    g.fire();
    const ready = g.ammo === original - 1 && g.drawTime === 0;
    g.beginReload();
    const reload = g.reload;
    for (let i = 0; i < 315; i++) g.simulate(1 / 128);
    const pending = g.reload > 0 && g.ammo === original;
    g.simulate(1 / 128);
    const reloaded = g.reload === 0 && g.ammo === original;
    const bursts = [];
    for (const id of [7, 19]) {
      g.buy(id);
      g.cooldown = g.drawTime = 0;
      g.glockBurst = g.famasBurst = true;
      const initial = g.ammo;
      g.fire();
      const timestamps = [0];
      let previous = g.ammo;
      for (let tick = 1; tick <= 80; tick++) {
        g.simulate(1 / 128);
        if (g.ammo !== previous) {
          timestamps.push(tick / 128);
          previous = g.ammo;
        }
      }
      bursts.push({ timestamps, consumed: initial - g.ammo, ready: g.cooldown === 0 });
    }
    g.buy(3);
    g.setScope(1);
    const zoomDuration = g.scopeDuration;
    const from = g.camera.fov;
    g.simulate(0.025);
    const middle = g.camera.fov;
    g.simulate(0.025);
    const end = g.camera.fov;
    g.setScope(2);
    g.simulate(0.05);
    const second = g.camera.fov;
    return {
      deploy,
      blocked,
      ready,
      reload,
      pending,
      reloaded,
      bursts,
      zoomDuration,
      from,
      middle,
      end,
      second,
    };
  });
  expect(result.deploy).toBe(1);
  expect(result.blocked && result.ready && result.pending && result.reloaded).toBe(true);
  expect(result.reload).toBeCloseTo(2.466667, 6);
  for (const [i, burst] of result.bursts.entries()) {
    expect(burst.consumed).toBe(3);
    expect(burst.ready).toBe(true);
    const spacing = i === 0 ? 0.05 : 0.075;
    expect(burst.timestamps[1]).toBeGreaterThanOrEqual(spacing);
    expect(burst.timestamps[1]).toBeLessThan(spacing + 1 / 128);
    expect(burst.timestamps[2]).toBeCloseTo(2 * burst.timestamps[1], 6);
  }
  expect(result.zoomDuration).toBe(0.05);
  expect(result.middle).toBeCloseTo((result.from + 40) / 2);
  expect(result.end).toBe(40);
  expect(result.second).toBe(10);
  expect(errors).toEqual([]);
});
