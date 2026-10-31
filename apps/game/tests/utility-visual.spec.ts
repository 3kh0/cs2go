import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("smoke reads as a full cloud from outside on native Dust II", async ({ page, baseURL }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toBeHidden({ timeout: 10000 });
  const setup = await page.evaluate(() => {
    const g = window.__game;
    g.start("competitive");
    // Keep native Dust II, but isolate the visual fixture from round elimination.
    g.mode = "practice";
    g.freezeTime = 0;
    g.keys.clear();
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    const point = g.dust!.navigation.site(0);
    point.y = g.dust!.collision.floor(point.x, point.z, point.y + 3, point.y - 8) + 0.08;
    let found = false;
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      const candidate = point.clone();
      candidate.x += Math.sin(angle) * 11;
      candidate.z += Math.cos(angle) * 11;
      candidate.y = g.dust!.collision.floor(candidate.x, candidate.z, point.y + 3, point.y - 8);
      if (
        !Number.isFinite(candidate.y) ||
        g.isBlocked(candidate.x, candidate.z, candidate.y, 0.3, 1.65)
      )
        continue;
      const eye = candidate.clone();
      eye.y += 1.65;
      const target = point.clone();
      target.y += 1.3;
      if (!g.visible(eye, target)) continue;
      g.position.copy(candidate);
      g.velocity.x = g.velocity.z = g.vertical = 0;
      g.grounded = true;
      const delta = target.sub(eye);
      g.yaw = Math.atan2(-delta.x, -delta.z);
      g.pitch = Math.atan2(delta.y, Math.hypot(delta.x, delta.z));
      g.updateAimCamera();
      found = true;
      break;
    }
    g.utility.launch("smoke", "player", g.team, point, point.clone().set(0, 0, 0), g.selected);
    const projectile = g.utility.projectiles.pop()!;
    g.utility.detonate(projectile);
    g.utility.removeProjectile(projectile);
    g.utility.effects[0].age = 2;
    g.utility.renderEffects();
    return { found, cells: g.utility.effects[0].cells.length };
  });
  expect(setup.found).toBe(true);
  expect(setup.cells).toBeGreaterThan(20);
  await page.waitForTimeout(250);
  await expect(page.locator("#startup")).toBeHidden();
  await expect(page.locator("#hud")).toBeVisible();
  await page.screenshot({ path: "artifacts/utility-smoke-dust2.png" });
  const shot = await page.evaluate(() => {
    const g = window.__game,
      effect = g.utility.effects[0];
    const from = g.position.clone();
    from.y += g.eye;
    const direction = effect.position.clone();
    direction.y += 1.3;
    direction.sub(from).normalize();
    const to = from.clone().addScaledVector(direction, 25);
    const blocked = !g.utility.clearSight(from, to);
    g.utility.bullet(from, to);
    g.utility.renderEffects();
    return { blocked, opened: g.utility.clearSight(from, to) };
  });
  expect(shot).toEqual({ blocked: true, opened: true });
  await page.screenshot({ path: "artifacts/utility-smoke-shot.png" });
  const cloud = await page.evaluate(() => {
    const g = window.__game,
      effect = g.utility.effects[0];
    effect.holes.length = 0;
    g.utility.renderEffects();
    const eye = effect.position.clone();
    eye.y += 1.3;
    const target = eye.clone();
    target.z -= 10;
    const blocked = !g.utility.clearSight(eye, target);
    g.position.copy(effect.position);
    g.position.y -= 0.08;
    g.updateAimCamera();
    return { blocked, count: effect.smoke!.batch.count, cells: effect.cells.length };
  });
  expect(cloud.blocked).toBe(true);
  expect(cloud.count).toBe(cloud.cells);
  await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/utility-smoke-inside.png" });
  const clear = await page.evaluate(() => {
    const g = window.__game,
      effect = g.utility.effects[0];
    effect.cleared = 2;
    g.utility.renderEffects();
    const eye = effect.position.clone();
    eye.y += 1.3;
    const target = eye.clone();
    target.z -= 10;
    return g.utility.clearSight(eye, target);
  });
  expect(clear).toBe(true);
  await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/utility-smoke-blast.png" });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
