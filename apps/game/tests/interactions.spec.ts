import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("suppressor native action, cancellation, sounds, pickup state and dynamic player support", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:5173"))
      external.push(r.url());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.updateBots = () => {};
    g.moveBots = () => {};
    for (const b of g.bots) {
      b.health = 0;
      b.respawn = Infinity;
    }
    g.buy(1);
    g.cooldown = g.drawTime = 0;
  });
  await page.mouse.click(700, 450, { button: "right" });
  await page.waitForFunction(() => window.__game.suppressors[1].progress > 0.35);
  await page.screenshot({ path: "artifacts/suppressor-removal.png" });
  await page.waitForFunction(() => !window.__game.suppressors[1].action);
  await page.screenshot({ path: "artifacts/suppressor-detached.png" });
  const results = await page.evaluate(() => {
    const g = window.__game;
    const detached = !g.isSuppressed(1);
    g.cooldown = 0;
    g.fire();
    const shot = g.weaponAudio.lastClip;
    g.cooldown = 0;
    g.toggleSuppressor();
    g.simulate(0.05);
    g.equip(g.secondary);
    const cancelled = !g.suppressors[1].action && !g.isSuppressed(1);
    g.equip(1);
    g.groundInventory.drop();
    const drop = g.groundInventory.drops.at(-1)!;
    const dropState = drop.suppressed;
    drop.mesh.position.copy(g.position).y += 0.3;
    drop.age = 2;
    const picked = g.groundInventory.pickup(true);
    const pickupState = g.isSuppressed(1);
    g.cooldown = g.drawTime = 0;
    g.toggleSuppressor();
    for (let i = 0; i < 800; i++) g.simulate(1 / 128);
    const attached = g.isSuppressed(1);
    g.cooldown = 0;
    g.fire();
    const suppressedShot = g.weaponAudio.lastClip;
    const bot = g.bots[0];
    bot.health = 100;
    bot.group.visible = true;
    bot.group.position.set(-17, 0, 17);
    bot.rig.crouch = 0;
    g.position.set(-17, 1.85, 17);
    g.velocity = { x: 0, z: 0 };
    g.vertical = -1;
    g.grounded = false;
    g.keys.clear();
    g.eye = 1.65;
    g.dead = 0;
    for (let i = 0; i < 64; i++) g.simulate(1 / 128);
    const landed = { y: g.position.y, grounded: g.grounded };
    g.jumpQueued = true;
    g.simulate(1 / 128);
    const jumped = g.vertical > 0 && !g.grounded;
    g.position.set(-17, 1.65, 17);
    g.vertical = 0;
    g.grounded = true;
    bot.health = 0;
    for (let i = 0; i < 64; i++) g.simulate(1 / 128);
    const fell = g.position.y < 1;
    return {
      detached,
      shot,
      cancelled,
      dropState,
      picked,
      pickupState,
      attached,
      suppressedShot,
      landed,
      jumped,
      fell,
    };
  });
  expect(results.detached).toBe(true);
  expect(results.shot).toBe("suppressor-1-single");
  expect(results.cancelled).toBe(true);
  expect(results.dropState).toBe(false);
  expect(results.picked).toBe(true);
  expect(results.pickupState).toBe(false);
  expect(results.attached).toBe(true);
  expect(results.suppressedShot).toBe("m4a1-1-single");
  expect(results.landed.y).toBeCloseTo(1.65, 3);
  expect(results.landed.grounded).toBe(true);
  expect(results.jumped).toBe(true);
  expect(results.fell).toBe(true);
  await page.screenshot({ path: "artifacts/suppressor-attached.png" });
  const usp = await page.evaluate(() => {
    const g = window.__game;
    g.buy(2);
    g.cooldown = g.drawTime = 0;
    g.toggleSuppressor();
    for (let i = 0; i < 800; i++) g.simulate(1 / 128);
    g.animateWeapon();
    g.cooldown = 0;
    g.fire();
    const result = { detached: !g.isSuppressed(2), shot: g.weaponAudio.lastClip };
    g.pitch = 0;
    g.yaw = 0;
    g.updateAimCamera();
    return result;
  });
  expect(usp).toEqual({ detached: true, shot: "suppressor-2-single" });
  await page.screenshot({ path: "artifacts/usp-detached.png" });
  const ball = await page.evaluate(() => {
    const g = window.__game;
    g.useWorld();
    const ball = g.dust!.ball;
    if (!ball.mesh) return null;
    ball.reset();
    const before = ball.mesh.position.clone();
    const kicker = before.clone();
    kicker.x -= 0.3;
    kicker.y -= ball.radius;
    ball.touch(kicker, 3, 0, 1 / 128);
    for (let i = 0; i < 64; i++) ball.update(1 / 128);
    const travelled = ball.mesh.position.distanceTo(before);
    const ray = g.ray.ray;
    ray.origin.copy(before);
    ray.origin.x -= ball.radius * 2;
    ray.direction.set(1, 0, 0);
    const ghostHits = g.dust!.collision.intersections(ray, ball.radius * 4).length;
    g.position.copy(before);
    g.position.y -= ball.radius;
    g.position.z += 2;
    g.yaw = 0;
    g.pitch = -0.65;
    g.updateAimCamera();
    g.simulate = () => {};
    return { travelled, ghostHits, radius: ball.radius, position: before.toArray() };
  });
  expect(ball).not.toBeNull();
  expect(ball!.travelled).toBeGreaterThan(0.05);
  expect(ball!.ghostHits).toBe(0);
  await page.screenshot({ path: "artifacts/native-soccer-ball.png" });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
