import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("seeded recoil drives bullets and camera independently of mouse aim, survives switching and resets on spawn", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.bots.forEach((bot) => {
      bot.health = 0;
      bot.respawn = Infinity;
      bot.group.visible = false;
    });
    const setup = () => {
      g.spawnPlayer();
      g.buy(0);
      g.drawTime = g.cooldown = 0;
      g.weaponCooldowns.fill(0);
      g.yaw = 0;
      g.pitch = 0;
      g.firing = false;
    };
    const advance = (count: number) => {
      for (let i = 0; i < count; i++) g.simulate(1 / 128);
    };
    const spray = () => {
      const points: number[][] = [];
      for (let i = 0; i < 20; i++) {
        g.fire();
        points.push([g.aimPunch.pitch, g.aimPunch.yaw]);
        advance(13);
      }
      return points;
    };
    setup();
    const first = spray();
    const index = g.weaponRecoil[0].index;
    const punch = { ...g.aimPunch };
    g.buy(2);
    g.buy(0);
    const switchPreserved = g.weaponRecoil[0].index === index && g.aimPunch.pitch === punch.pitch;
    setup();
    const second = spray();
    const rawAim = [g.pitch, g.yaw];
    const random = Math.random;
    let bulletPitch = 0;
    let shotPunch = 0;
    try {
      // Remove spread only in this isolated assertion: recoil and spread are distinct.
      Math.random = () => 0;
      shotPunch = g.aimPunch.pitch;
      g.fire();
      const direction = g.ray.ray.direction;
      bulletPitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
    } finally {
      Math.random = random;
    }
    const cameraPitch = g.camera.rotation.x;
    const rawAfterShot = [g.pitch, g.yaw];
    advance(128 * 4);
    const recovered = Math.hypot(g.aimPunch.pitch, g.aimPunch.yaw);
    const retainedIndex = g.weaponRecoil[0].index;
    setup();
    const reset = { ...g.aimPunch, index: g.weaponRecoil[0].index };
    // Leave a short visible spray on the wall for the screenshot.
    spray();
    return {
      first,
      second,
      switchPreserved,
      rawAim,
      rawAfterShot,
      shotPunch,
      bulletPitch,
      cameraPitch,
      recovered,
      retainedIndex,
      reset,
    };
  });
  expect(result.first).toEqual(result.second);
  expect(result.first[0]).toEqual([0, 0]);
  expect(result.first[10]![0]).toBeGreaterThan(0);
  expect(result.switchPreserved).toBe(true);
  expect(result.rawAim).toEqual([0, 0]);
  expect(result.rawAfterShot).toEqual([0, 0]);
  expect(result.bulletPitch).toBeCloseTo(result.shotPunch, 6);
  expect(result.cameraPitch).toBeGreaterThan(0);
  expect(result.cameraPitch).toBeLessThan(result.bulletPitch);
  expect(result.recovered).toBeLessThan(0.00001);
  expect(result.retainedIndex).toBeLessThan(0.00001);
  expect(result.reset).toEqual({ pitch: 0, yaw: 0, pitchVelocity: 0, yawVelocity: 0, index: 0 });
  await page.screenshot({ path: "artifacts/recoil-integrated.png" });
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__game.locked);
  const paused = await page.evaluate(() => window.__game.animationTime);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__game.animationTime)).toBeGreaterThan(paused);
  expect(errors).toEqual([]);
});
