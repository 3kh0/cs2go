import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("weapon dispersion applies after the first shot and recovers while holstered", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__game);
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.bots.forEach((bot) => {
      bot.health = 0;
      bot.respawn = Infinity;
    });
    g.buy(0);
    g.cooldown = g.drawTime = 0;
    g.velocity = { x: 0, z: 0 };
    g.grounded = true;
    g.eye = 1.65;
    const samples: number[] = [];
    const originalSet = g.ray.set.bind(g.ray);
    const originalRandom = Math.random;
    g.ray.set = function (origin, direction) {
      const local = direction.clone().applyQuaternion(g.camera.quaternion.clone().invert());
      samples.push(Math.hypot(local.x, local.y) / -local.z);
      return originalSet(origin, direction);
    };
    Math.random = () => 0.5;
    try {
      g.fire();
      const firstPenalty = g.weaponAccuracy[0].penalty;
      g.cooldown = 0;
      g.fire();
      const sprayPenalty = g.weaponAccuracy[0].penalty;
      g.equip(g.secondary);
      const preserved = g.weaponAccuracy[0].penalty;
      const pistolPenalty = g.weaponAccuracy[g.secondary].penalty;
      g.simulate(1 / 128);
      const recovered = g.weaponAccuracy[0].penalty;
      return { samples, firstPenalty, sprayPenalty, preserved, pistolPenalty, recovered };
    } finally {
      Math.random = originalRandom;
      g.ray.set = originalSet;
    }
  });
  expect(result.samples[0]).toBeCloseTo((0.00641 + 0.0006) * 0.5, 5);
  expect(result.samples[1]).toBeGreaterThan(result.samples[0]);
  expect(result.firstPenalty).toBeCloseTo(0.0078);
  expect(result.sprayPenalty).toBeCloseTo(0.0156);
  expect(result.preserved).toBe(result.sprayPenalty);
  expect(result.pistolPenalty).toBe(0);
  expect(result.recovered).toBeGreaterThan(0);
  expect(result.recovered).toBeLessThan(result.preserved);
  expect(errors).toEqual([]);
});

test("jump and landing retain an accuracy penalty that recovers, and scope changes its baseline", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.waitForFunction(() => !!window.__game);
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    g.buy(0);
    g.cooldown = g.drawTime = 0;
    g.position.set(0, 0, 0);
    g.velocity = { x: 0, z: 0 };
    g.vertical = 0;
    g.grounded = true;
    g.simulate(1 / 128);
    const resting = g.weaponAccuracy[0].baseline!;
    g.jumpQueued = true;
    g.simulate(1 / 128);
    const jumped = !g.grounded && g.vertical > 0;
    let peak = 0;
    for (let i = 0; i < 256 && !g.grounded; i++) {
      g.simulate(1 / 128);
      peak = Math.max(peak, g.weaponAccuracy[0].baseline! + g.weaponAccuracy[0].penalty);
    }
    const landed = g.grounded;
    const landing = g.weaponAccuracy[0].baseline! + g.weaponAccuracy[0].penalty;
    for (let i = 0; i < 128; i++) g.simulate(1 / 128);
    const recovered = g.weaponAccuracy[0].baseline! + g.weaponAccuracy[0].penalty;
    g.buy(3);
    g.simulate(1 / 128);
    const unscoped = g.weaponAccuracy[3].baseline!;
    g.setScope(1);
    g.simulate(1 / 128);
    const scoped = g.weaponAccuracy[3].baseline!;
    return {
      resting,
      jumped,
      peak,
      landed,
      landing,
      recovered,
      unscoped,
      scoped,
      mode: g.weaponAccuracy[3].mode,
    };
  });
  expect(result.jumped).toBe(true);
  expect(result.landed).toBe(true);
  expect(result.peak).toBeGreaterThan(result.resting);
  expect(result.landing).toBeGreaterThan(result.resting);
  expect(result.recovered).toBeLessThan(result.landing);
  expect(result.scoped).toBeLessThan(result.unscoped);
  expect(result.mode).toBe(1);
});
