import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

for (const map of ["dust2", "mirage"] as const)
  test(`Deathmatch ${map} distributes grounded respawns and runs bot FFA during the deathcam`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
    await expect(page.locator("#startup")).toHaveCount(0);
    await page.locator("#home-play").click();
    await page.locator('[data-mode="deathmatch"]').click();
    await page.locator(`[data-map="${map}"]`).click();
    await page.locator("#play").click();
    await page.locator('#team-select [data-team="ct"]').click();
    await page.waitForFunction((id) => window.__game.locked && window.__game.mapId === id, map);
    const initial = await page.evaluate(() => {
      const game = window.__game;
      return {
        time: game.time,
        primary: game.primary,
        positions: [game.position.toArray(), ...game.bots.map((b) => b.group.position.toArray())],
      };
    });
    expect(initial.time).toBeGreaterThan(580);
    expect(initial.primary).not.toBeNull();
    expect(
      new Set(initial.positions.map(([x, , z]) => `${Math.round(x / 4)}:${Math.round(z / 4)}`))
        .size,
    ).toBeGreaterThan(4);
    const result = await page.evaluate(async () => {
      const g = window.__game;
      // This fixture pauses only the renderer's simulation callback and advances
      // the actual fixed-step simulation synchronously at its normal128Hz.
      const simulate = g.simulate.bind(g);
      g.simulate = () => {};
      const path = "/src/deathmatch-spawns.ts";
      const { deathmatchSpawnPool } = (await import(
        path
      )) as typeof import("../src/deathmatch-spawns");
      const points = deathmatchSpawnPool(g.world.navigation, g.world.collision!);
      for (const bot of g.bots) {
        bot.health = 0;
        bot.respawn = Infinity;
        bot.group.visible = false;
      }
      const lives: number[][] = [];
      const supports: { grounded: boolean; feet: number; floor: number; blocked: boolean }[] = [];
      let grounded = true;
      g.primary = 3;
      for (let life = 0; life < 6; life++) {
        g.dead = 0.025;
        g.health = 0;
        for (let tick = 0; tick < 20; tick++) simulate(1 / 128);
        lives.push(g.position.toArray());
        supports.push({
          grounded: g.grounded,
          feet: g.position.y,
          floor: g.world.collision!.floor(
            g.position.x,
            g.position.z,
            g.position.y + 0.1,
            g.position.y - 0.3,
          ),
          blocked: g.world.collision!.blocked(
            g.position.x,
            g.position.z,
            g.position.y + 0.025,
            0.4064,
            1.8288,
          ),
        });
        grounded &&=
          g.grounded &&
          Number.isFinite(
            g.world.collision!.support(
              g.position.x,
              g.position.z,
              g.position.y + 0.1,
              g.position.y - 0.3,
              0.4064,
            ),
          );
        if (
          g.world.collision!.blocked(
            g.position.x,
            g.position.z,
            g.position.y + 0.025,
            0.4064,
            1.8288,
          )
        )
          grounded = false;
      }
      const retainedWeapon = g.primary;
      const protectedAfterRespawn = g.invulnerable > 9;
      g.keys.add("KeyW");
      simulate(1 / 128);
      g.keys.delete("KeyW");
      const protectionCancelledByMovement = g.invulnerable === 0;
      for (let tick = 0; tick < 256; tick++) simulate(1 / 128);
      const fullMagazine = g.ammo;
      g.ammo = 0;
      g.reserve = 7;
      g.cooldown = g.drawTime = 0;
      g.beginReload();
      for (let tick = 0; tick < 128 * 5; tick++) simulate(1 / 128);
      const reloadedWithoutReserveLoss = g.ammo === fullMagazine && g.reserve === 7;
      // Use a real short, clear map lane; both bots deliberately share a faction.
      let lane: [typeof g.position, typeof g.position] | undefined;
      for (const point of points) {
        for (const next of points) {
          const distance = point.distanceTo(next);
          if (distance < 3 || distance > 7 || Math.abs(point.y - next.y) > 0.2) continue;
          const from = point.clone(),
            to = next.clone();
          from.y += 1.45;
          to.y += 1.2;
          if (g.visible(from, to)) {
            lane = [point, next];
            break;
          }
        }
        if (lane) break;
      }
      if (!lane) throw new Error("No clear native-map FFA lane");
      const shooter = g.bots[0],
        victim = g.bots[1];
      g.spawnBot(shooter, 0);
      g.spawnBot(victim, 1);
      shooter.team = victim.team = "t";
      shooter.group.position.copy(lane[0]);
      victim.group.position.copy(lane[1]);
      shooter.health = victim.health = 100;
      shooter.group.visible = victim.group.visible = true;
      shooter.spawnProtection = victim.spawnProtection = 0;
      shooter.rig.weaponIndex = 1;
      shooter.ammo = 25;
      shooter.reserve = 90;
      shooter.speed = shooter.reaction = shooter.shot = shooter.reloadTime = 0;
      shooter.facing = Math.atan2(
        victim.group.position.x - shooter.group.position.x,
        victim.group.position.z - shooter.group.position.z,
      );
      shooter.aim.copy(victim.group.position).y += 1.2;
      g.dead = 1.5;
      g.health = 0;
      const target = g.perceiveBot(shooter, 1 / 16);
      // Freeze locomotion only after proving perception, to isolate shot alignment.
      shooter.moving = false;
      shooter.reaction = 0;
      for (let shot = 0; shot < 8 && victim.health === 100; shot++) {
        shooter.shot = shooter.reaction = 0;
        g.botCombat(shooter, target, 1 / 16);
      }
      const healthAfterShot = victim.health;
      victim.health = 0;
      victim.respawn = 0.1;
      shooter.health = 0;
      shooter.respawn = Infinity;
      for (let tick = 0; tick < 32; tick++) simulate(1 / 128);
      const botRespawnedDuringDeath = victim.health === 100 && g.dead > 0;
      const scoreBefore = g.deathmatchScore;
      const botScoreBefore = shooter.deathmatchScore;
      g.rewardKill("player", g.team, 3);
      g.rewardKill(shooter, shooter.team, g.knife);
      const scoreAccrued =
        g.deathmatchScore - scoreBefore === 8 && shooter.deathmatchScore - botScoreBefore === 25;
      g.dead = 0;
      g.health = 100;
      g.kills = 21;
      for (let tick = 0; tick < 2; tick++) simulate(1 / 128);
      const stillPlayingAfterTwenty = g.active;
      g.deathmatchScore = 9999;
      g.time = 1 / 128;
      simulate(1 / 128);
      g.updateUI();
      return {
        lives,
        supports,
        grounded,
        retainedWeapon,
        protectedAfterRespawn,
        protectionCancelledByMovement,
        reloadedWithoutReserveLoss,
        target: target?.id,
        healthAfterShot,
        botRespawnedDuringDeath,
        stillPlayingAfterTwenty,
        scoreAccrued,
        finished: !g.active,
      };
    });
    console.log(`Deathmatch ${map} result: ${JSON.stringify(result)}`);
    expect(
      new Set(result.lives.map(([x, , z]) => `${Math.round(x)}:${Math.round(z)}`)).size,
    ).toBeGreaterThan(3);
    expect(result.grounded).toBe(true);
    expect(result.retainedWeapon).toBe(3);
    expect(result.protectedAfterRespawn).toBe(true);
    expect(result.protectionCancelledByMovement).toBe(true);
    expect(result.reloadedWithoutReserveLoss).toBe(true);
    expect(result.target).toBe(1);
    expect(result.healthAfterShot).toBeLessThan(100);
    expect(result.botRespawnedDuringDeath).toBe(true);
    expect(result.stillPlayingAfterTwenty).toBe(true);
    expect(result.scoreAccrued).toBe(true);
    expect(result.finished).toBe(true);
    await expect(page.locator("#result-title")).toHaveText("VICTORY.");
    expect(errors).toEqual([]);
  });
