import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("suppressed player and bot shots deal damage without emitting tracers", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible())
    await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const game = window.__game;
    const random = Math.random;
    Math.random = () => 0; // Centered dispersion: this fixture tests suppression, not aiming.
    game.simulate = () => {};
    game.bots.forEach((bot) => {
      bot.health = 0;
      bot.group.visible = false;
    });
    const target = game.bots[0];
    target.health = 10000;
    target.group.visible = true;
    target.group.position.set(-17, 0, 9);
    target.group.updateMatrixWorld(true);
    game.position.set(-17, 0, 17);
    game.eye = 1.3;
    game.velocity.x = game.velocity.z = 0;
    game.grounded = true;
    const resetTracers = () =>
      game.tracers.forEach((tracer) => {
        tracer.life = 0;
        tracer.mesh.visible = false;
      });
    const live = () =>
      game.tracers.filter((tracer) => tracer.life > 0 && tracer.mesh.visible).length;
    const player = [1, 2, 0, 9].map((weapon) => {
      resetTracers();
      game.buy(weapon);
      game.drawTime = game.cooldown = game.shots = game.pitch = game.yaw = 0;
      const health = target.health,
        ammo = game.ammo;
      game.fire();
      return { weapon, tracers: live(), damage: health - target.health, spent: ammo - game.ammo };
    });
    game.mode = "deathmatch";
    game.eye = 1.65;
    game.health = 10000;
    game.armor = game.invulnerable = game.dead = 0;
    game.position.set(-17, 0, 9);
    target.group.position.set(-17, 0, 17);
    target.aim.copy(game.position);
    target.aim.y += 1.2;
    const freshAim = structuredClone(target.aimPunch);
    const freshRecoil = structuredClone(target.weaponRecoil);
    const freshAccuracy = structuredClone(target.weaponAccuracy);
    const bot = [1, 2, 0, 9].map((weapon) => {
      target.aimPunch = structuredClone(freshAim);
      target.weaponRecoil = structuredClone(freshRecoil);
      target.weaponAccuracy = structuredClone(freshAccuracy);
      resetTracers();
      target.rig.weaponIndex = weapon;
      target.shot = target.reloadTime = target.reaction = target.speed = target.burst = 0;
      target.ammo = 2;
      const health = game.health;
      game.botCombat(
        target,
        { id: "player", position: game.position, distance: 8, score: 8 },
        1 / 16,
      );
      return { weapon, tracers: live(), damage: health - game.health, spent: 2 - target.ammo };
    });
    Math.random = random;
    return { player, bot };
  });
  for (const shot of [...result.player, ...result.bot]) {
    expect(shot.spent).toBe(1);
    expect(shot.damage, JSON.stringify(result)).toBeGreaterThan(0);
    expect(shot.tracers).toBe(shot.weapon === 1 || shot.weapon === 2 ? 0 : 1);
  }
});
