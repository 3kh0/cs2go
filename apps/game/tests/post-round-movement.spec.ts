import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("survivors move and use weapons after rounds, stay locked at halftime, and enter the next freeze", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  const results = await page.evaluate(() => {
    const g = window.__game;
    const run = (mode: "casual" | "competitive", round: number) => {
      g.start(mode);
      // Use the flat practice floor to isolate actual fixed-step input and physics.
      g.useWorld(false);
      g.round = round;
      g.freezeTime = 0;
      g.invulnerable = 100;
      g.position.set(0, 0, 0);
      g.velocity.x = g.velocity.z = g.vertical = 0;
      g.grounded = true;
      g.eye = 1.65;
      g.yaw = 0;
      g.bots.forEach((bot, i) => {
        bot.group.position.set(30 + i, 0, 30);
        bot.moving = false;
        bot.velocity.set(0, 0);
      });
      g.keys.clear();
      g.primary = 0;
      g.equip(0);
      g.ammo = 30;
      g.reserve = 90;
      g.cooldown = g.drawTime = 0;
      // Ending while defusing previously left a second combat lock behind.
      g.bomb!.defuser = "player";
      g.firing = true;
      g.endRound("ct", "Bomb defused");
      const startPause = g.roundPause,
        score = g.teamScores.ct;
      g.keys.add("KeyW");
      g.keys.add("ControlLeft");
      g.jumpQueued = true;
      for (let i = 0; i < 64; i++) g.simulate(1 / 128);
      const height = g.position.y;
      const shots = 30 - g.ammo;
      g.firing = false;
      g.beginReload();
      const reloading = g.reload > 0;
      g.reload = 0;
      g.equip(g.knife);
      g.cooldown = 0;
      g.fireKnife();
      const knifeSwing = g.knifeTime > 0;
      for (let i = 0; i < 24; i++) g.simulate(1 / 128);
      const knifeResolved = !g.knifePending;
      g.utility.inventory.flash = 1;
      g.utility.select("flash");
      g.utility.pressThrow(0);
      const pinPulled = g.utility.handling.phase !== "idle";
      g.utility.throwSelected();
      const projectile = g.utility.projectiles[0];
      const thrown = !!projectile;
      const before = projectile?.position.clone();
      for (let i = 0; i < 24; i++) g.simulate(1 / 128);
      const projectileMoved = !!projectile && projectile.position.distanceTo(before!) > 0.1;
      const result = {
        mode,
        round,
        shots,
        reloading,
        knifeSwing,
        knifeResolved,
        pinPulled,
        thrown,
        projectileMoved,
        defuserCleared: g.bomb!.defuser === null,
        distance: Math.hypot(g.position.x, g.position.z),
        height,
        eye: g.eye,
        pauseElapsed: startPause - g.roundPause,
        scoreUnchanged: g.teamScores.ct === score,
      };
      g.keys.clear();
      return result;
    };
    const rounds = [
      run("casual", 1),
      run("competitive", 1),
      run("casual", 12),
      run("competitive", 12),
    ];
    const team = g.team;
    g.roundPause = 1 / 256;
    g.simulate(1 / 128);
    const transition = { round: g.round, swapped: g.team !== team, freeze: g.freezeTime };
    const spawn = g.position.clone();
    for (const bot of g.bots) bot.buyTime = 0;
    const drawing = g.bots[0];
    drawing.rig.drawTime = 0.55;
    drawing.anim = 0;
    g.keys.add("KeyW");
    g.jumpQueued = true;
    for (let i = 0; i < 64; i++) g.simulate(1 / 128);
    const frozenDistance = g.position.distanceTo(spawn);
    g.animateBots();
    const frozenBotDraw = drawing.rig.drawTime;
    g.keys.clear();
    g.menu();
    return { rounds, transition, frozenDistance, frozenBotDraw };
  });
  for (const result of results.rounds) {
    if (result.mode === "competitive" && result.round === 12) {
      expect(result.distance).toBe(0);
      expect(result.height).toBe(0);
      expect(result.shots).toBe(0);
      expect(result.knifeSwing).toBe(false);
      expect(result.pinPulled).toBe(false);
      expect(result.thrown).toBe(false);
    } else {
      expect(result.distance).toBeGreaterThan(0.3);
      expect(result.height).toBeGreaterThan(0);
      expect(result.eye).toBeLessThan(1.65);
      expect(result.shots).toBeGreaterThan(1);
      expect(result.reloading).toBe(true);
      expect(result.knifeSwing).toBe(true);
      expect(result.knifeResolved).toBe(true);
      expect(result.pinPulled).toBe(true);
      expect(result.thrown).toBe(true);
      expect(result.projectileMoved).toBe(true);
    }
    expect(result.pauseElapsed).toBeCloseTo(0.875, 5);
    expect(result.defuserCleared).toBe(true);
    expect(result.scoreUnchanged).toBe(true);
  }
  expect(results.transition).toEqual({ round: 13, swapped: true, freeze: 15 });
  expect(results.frozenDistance).toBe(0);
  expect(results.frozenBotDraw).toBeLessThan(0.051);
  expect(errors).toEqual([]);
});

test("post-round corpses keep falling for survivors and dead spectators", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  const results = await page.evaluate(() => {
    const g = window.__game;
    const run = (dead: boolean, halftime: boolean) => {
      g.start(halftime ? "competitive" : "casual");
      g.useWorld(false);
      g.round = halftime ? 12 : 1;
      g.freezeTime = 0;
      g.invulnerable = 100;
      g.bots.forEach((b) => {
        b.health = 0;
        b.respawn = Infinity;
        b.group.visible = false;
      });
      const corpse = g.bots[0];
      corpse.group.visible = true;
      corpse.group.position.set(0, 8, 0);
      corpse.vertical = 0;
      corpse.group.updateMatrixWorld(true);
      g.dead = dead ? Infinity : 0;
      g.endRound("ct", "Time expired");
      const score = g.teamScores.ct,
        animation = corpse.anim;
      g.simulate(1 / 128);
      const initial = corpse.rig.ragdoll?.points[0].position.y ?? 8;
      for (let i = 0; i < 64; i++) g.simulate(1 / 128);
      return {
        dead,
        halftime,
        drop: initial - (corpse.rig.ragdoll?.points[0].position.y ?? 8),
        elapsed: corpse.anim - animation,
        scoreUnchanged: g.teamScores.ct === score,
      };
    };
    const results = [run(false, false), run(true, false), run(false, true), run(true, true)];
    g.menu();
    return results;
  });
  for (const result of results) {
    expect(result.scoreUnchanged).toBe(true);
    if (result.halftime) {
      expect(result.drop).toBe(0);
      expect(result.elapsed).toBe(0);
    } else {
      expect(result.drop).toBeGreaterThan(0.2);
      expect(result.elapsed).toBeGreaterThan(0.5);
    }
  }
});
