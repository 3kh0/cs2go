import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("bot rounds penetrate thin cover and flesh, stop at thick cover, and bound last-seen suppression", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("deathmatch");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(async () => {
    const game = window.__game;
    // This fixture advances perception/combat directly; asynchronous imports
    // must not let the live-menu simulation respawn or move its test actors.
    game.simulate = () => {};
    game.locked = false;
    const shooter = game.bots[0];
    const first = game.bots[1];
    const second = game.bots[2];
    game.mode = "casual";
    game.bomb = null;
    game.dead = Infinity;
    game.bots.forEach((bot) => {
      bot.health = 0;
    });
    shooter.health = 100;
    shooter.team = "t";
    shooter.group.position.set(-17, 0, 17);
    shooter.rig.weaponIndex = 3;
    shooter.speed = shooter.reaction = shooter.reloadTime = 0;
    shooter.aim.set(-17, 1.2, 5);
    shooter.facing = Math.PI;
    const cover = game.world.solids[0].clone();
    cover.position.set(-17, 1.5, 11);
    cover.scale.set(3, 3, 0.12);
    cover.userData.bulletMaterial = "wood";
    cover.updateMatrixWorld(true);
    game.world.solids.push(cover);
    const restoreTargets = () => {
      first.health = second.health = 200;
      first.team = second.team = "ct";
      first.group.position.set(-17, 0, 8);
      second.group.position.set(-17, 0, 5);
      shooter.shot = shooter.burst = 0;
      shooter.ammo = 10;
    };
    const target = { id: 1 as const, position: first.group.position, distance: 9, score: 9 };
    restoreTargets();
    game.botCombat(shooter, target, 1 / 16);
    const thin = [first.health, second.health];
    restoreTargets();
    const buddy = game.bots[3];
    buddy.health = 100;
    buddy.team = shooter.team;
    buddy.group.position.set(-17, 0, 6.5);
    game.botCombat(shooter, target, 1 / 16);
    const protectedByBuddy = { first: first.health, second: second.health, buddy: buddy.health };
    buddy.health = 0;
    restoreTargets();
    cover.scale.z = 3;
    cover.userData.bulletMaterial = "concrete";
    cover.updateMatrixWorld(true);
    game.botCombat(shooter, target, 1 / 16);
    const thick = [first.health, second.health];
    restoreTargets();
    cover.scale.z = 0.01;
    cover.userData.bulletMaterial = "glass";
    cover.updateMatrixWorld(true);
    const extraBarriers = Array.from({ length: 4 }, (_, index) => {
      const pane = cover.clone();
      pane.position.z = 12 + index;
      pane.updateMatrixWorld(true);
      return pane;
    });
    game.world.solids.push(...extraBarriers);
    game.botCombat(shooter, target, 1 / 16);
    const barrierLimit = [first.health, second.health];
    game.world.solids.splice(-extraBarriers.length);
    // Exercise the native triangle collision path too, including exit faces.
    const modulePath = "/src/map-collision.ts";
    const { MapCollision } = (await import(modulePath)) as typeof import("../src/map-collision");
    cover.scale.z = 0.12;
    cover.userData.bulletMaterial = "wood";
    cover.updateMatrixWorld(true);
    const oldCollision = game.world.collision;
    game.world.collision = new MapCollision([cover]);
    restoreTargets();
    game.botCombat(shooter, target, 1 / 16);
    const nativeThin = [first.health, second.health];
    game.world.collision = oldCollision;
    // LOS must exist before suppression is available. Team/hearing reports
    // alone cannot start it, even if an enemy happens to be behind thin wood.
    game.mode = "deathmatch";
    first.health = second.health = 0;
    game.dead = 0;
    game.invulnerable = 99;
    game.position.set(-17, 0, 5);
    game.velocity.x = game.velocity.z = 0;
    game.shotTime = 0;
    shooter.suppressTime = shooter.suppressShots = 0;
    shooter.target = null;
    shooter.alert = 0;
    shooter.ammo = 10;
    shooter.shot = 0;
    const neverSeen = game.perceiveBot(shooter, 1 / 16);
    game.botCombat(shooter, neverSeen, 1 / 16);
    const unseenAmmo = shooter.ammo;
    cover.position.x += 20;
    cover.updateMatrixWorld(true);
    for (let step = 0; step < 10; step++) game.perceiveBot(shooter, 1 / 16);
    const lastSight = shooter.lastSight.clone();
    cover.position.x -= 20;
    cover.updateMatrixWorld(true);
    game.position.x += 0.5;
    shooter.rig.weaponIndex = 0;
    shooter.ammo = 30;
    shooter.shot = shooter.burst = 0;
    let trackedThroughWall = false;
    let aimMoved = false;
    for (let step = 0; step < 32; step++) {
      const contact = game.perceiveBot(shooter, 1 / 16);
      if (contact) trackedThroughWall = true;
      if (shooter.suppressTime > 0 && !shooter.aim.equals(lastSight)) aimMoved = true;
      game.botCombat(shooter, contact, 1 / 16);
    }
    const suppressed = 30 - shooter.ammo;
    const expiredAmmo = shooter.ammo;
    for (let step = 0; step < 16; step++) game.botCombat(shooter, undefined, 1 / 16);
    return {
      thin,
      thick,
      protectedByBuddy,
      barrierLimit,
      nativeThin,
      unseenAmmo,
      suppressed,
      trackedThroughWall,
      aimMoved,
      stopped: shooter.ammo === expiredAmmo,
    };
  });
  for (const damage of [result.thin, result.nativeThin]) {
    expect(damage[0]).toBeLessThan(200);
    expect(damage[1]).toBeLessThan(200);
    expect(damage[1]).toBeGreaterThan(damage[0]);
  }
  expect(result.thick).toEqual([200, 200]);
  expect(result.protectedByBuddy.first).toBeLessThan(200);
  expect(result.protectedByBuddy.second).toBe(200);
  expect(result.protectedByBuddy.buddy).toBe(100);
  expect(result.barrierLimit).toEqual([200, 200]);
  expect(result.unseenAmmo).toBe(10);
  expect(result.suppressed).toBeGreaterThan(0);
  expect(result.suppressed).toBeLessThanOrEqual(3);
  expect(result.trackedThroughWall).toBe(false);
  expect(result.aimMoved).toBe(false);
  expect(result.stopped).toBe(true);
  expect(errors).toEqual([]);
});
