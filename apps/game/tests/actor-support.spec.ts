import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("boosts follow carrier stance, drop support at the edge, and catch diagonal landings", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.updateBots = () => {};
    g.moveBots = () => {};
    g.bots.forEach((bot) => {
      bot.health = 0;
      bot.respawn = Infinity;
    });
    const carrier = g.bots[0];
    carrier.health = 100;
    carrier.group.visible = true;
    carrier.group.position.set(0, 0, 0);
    carrier.rig.crouch = 1;
    g.position.set(0, 1.3716, 0);
    g.velocity = { x: 0, z: 0 };
    g.vertical = 0;
    g.grounded = true;
    g.simulate(1 / 128);
    const seated = { y: g.position.y, grounded: g.grounded };
    carrier.rig.crouch = 0.91;
    g.simulate(1 / 128);
    const raised = { y: g.position.y, grounded: g.grounded };
    g.position.x = 0.8;
    g.velocity.x = 5.4;
    g.simulate(1 / 128);
    const departed = { x: g.position.x, grounded: g.grounded };
    carrier.rig.crouch = 0;
    g.position.set(-0.7, 1.98, 0);
    g.velocity = { x: 38.4, z: 0 };
    g.vertical = -38.4;
    g.grounded = false;
    g.simulate(1 / 128);
    const diagonal = { x: g.position.x, y: g.position.y, grounded: g.grounded };
    // An obstructed uncrouch must never lift the rider through a static ceiling.
    g.position.set(0, 1.8288, 0);
    g.velocity = { x: 0, z: 0 };
    g.vertical = 0;
    g.grounded = true;
    g.simulate(1 / 128);
    carrier.group.position.y += 0.1;
    const ceiling = g.position.y + g.hullHeight + 0.04;
    const originalBlocked = g.isBlocked.bind(g);
    g.isBlocked = (x, z, feet, radius, height) =>
      feet + (height ?? 1.65) > ceiling || originalBlocked(x, z, feet, radius, height);
    g.simulate(1 / 128);
    const ceilingSafe = g.position.y + g.eye <= ceiling;
    g.isBlocked = originalBlocked;
    return { seated, raised, departed, diagonal, ceilingSafe };
  });
  expect(result.seated.y).toBeCloseTo(1.3716);
  expect(result.seated.grounded).toBe(true);
  expect(result.raised.y).toBeCloseTo(1.412748);
  expect(result.raised.grounded).toBe(true);
  expect(result.departed.x).toBeGreaterThan(0.8128);
  expect(result.departed.grounded).toBe(false);
  expect(result.diagonal.x).toBeCloseTo(-0.4);
  expect(result.diagonal.y).toBeCloseTo(1.8288);
  expect(result.diagonal.grounded).toBe(true);
  expect(result.ceilingSafe).toBe(true);
});
