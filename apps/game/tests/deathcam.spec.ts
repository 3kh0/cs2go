import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("deathcam shows the killer's actual damage exchange and clears on respawn", async ({
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
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.active && window.__game.locked);
  const death = await page.evaluate(async () => {
    const g = window.__game;
    const simulate = g.simulate.bind(g);
    // Keep setup imports from advancing actors; the same held world clock
    // supports stable captures after the actual lethal bot bullet below.
    g.simulate = () => {};
    let captureHeld = false;
    try {
      const spawnModule = "/src/deathmatch-spawns.ts";
      const recoilModule = "/src/recoil.ts";
      const accuracyModule = "/src/accuracy.ts";
      const soldierModule = "/src/soldier.ts";
      const { deathmatchSpawnPool } = (await import(
        spawnModule
      )) as typeof import("../src/deathmatch-spawns");
      const { createAimPunch, createWeaponRecoil } = (await import(
        recoilModule
      )) as typeof import("../src/recoil");
      const { createWeaponAccuracy } = (await import(
        accuracyModule
      )) as typeof import("../src/accuracy");
      const { setSoldierWeapon } = (await import(soldierModule)) as typeof import("../src/soldier");
      const points = deathmatchSpawnPool(g.world.navigation, g.world.collision!);
      let lane: [typeof g.position, typeof g.position] | undefined;
      for (const victim of points) {
        for (const shooter of points) {
          const distance = shooter.distanceTo(victim);
          if (distance < 2 || distance > 5 || Math.abs(shooter.y - victim.y) > 0.15) continue;
          const from = shooter.clone(),
            to = victim.clone();
          from.y += 1.45;
          to.y += 1.2;
          if (g.visible(from, to)) {
            lane = [victim, shooter];
            break;
          }
        }
        if (lane) break;
      }
      if (!lane) throw new Error("No supported clear native-map deathcam firing lane");
      const killer = g.bots[0],
        other = g.bots[1];
      for (const bot of g.bots) {
        bot.health = 0;
        bot.shot = 100;
        bot.respawn = Infinity;
        bot.spawnProtection = 0;
        bot.group.visible = false;
      }
      g.position.copy(lane[0]);
      g.velocity.x = g.velocity.z = g.vertical = 0;
      g.keys.clear();
      g.grounded = true;
      g.dead = g.invulnerable = 0;
      g.health = 100;
      g.armor = killer.armor = other.armor = 0;
      g.utility.blind.clear();
      g.deathDamage.reset();
      killer.health = other.health = 100;
      killer.group.position.copy(lane[1]);
      killer.group.visible = true;
      killer.moving = false;
      killer.speed = killer.reaction = killer.shot = killer.reloadTime = 0;
      killer.ammo = 30;
      setSoldierWeapon(killer.rig, 0);
      killer.aim.copy(g.position).y += 1.2;
      killer.facing = Math.atan2(
        g.position.x - killer.group.position.x,
        g.position.z - killer.group.position.z,
      );
      g.damageActor(other, 19, { height: 1.1 }, 0, g.team);
      g.damageActor(killer, 42, { height: 1.1 }, 0, g.team);
      other.health = 0;
      g.yaw = Math.atan2(
        g.position.x - killer.group.position.x,
        g.position.z - killer.group.position.z,
      );
      g.pitch = 0;
      g.updateAimCamera();
      const target = {
        id: "player" as const,
        position: g.position,
        distance: lane[0].distanceTo(lane[1]),
        score: 1,
      };
      for (let shot = 0; shot < 6 && g.health > 0; shot++) {
        killer.shot = killer.reaction = killer.burst = 0;
        killer.aimPunch = createAimPunch();
        killer.weaponRecoil = createWeaponRecoil();
        killer.weaponAccuracy = createWeaponAccuracy();
        g.botCombat(killer, target, 1 / 16);
      }
      killer.shot = 100;
      // The shot above owns the real health/death/card transition. Freeze only
      // its capture clock so screenshot latency cannot consume the respawn or
      // three-second card window. Keep the actual 2.5-second dead state intact.
      if (g.health <= 0) {
        g.scene.userData.deathcamCapture = {
          simulate,
          deadline: g.deathBannerUntil,
          start: performance.now(),
        };
        g.deathBannerUntil = Infinity;
        captureHeld = true;
      }
      return { health: g.health, dead: g.dead, exchange: g.deathDamage.exchange("bot:0") };
    } finally {
      if (!captureHeld) g.simulate = simulate;
    }
  });
  expect(death.health).toBe(0);
  expect(death.dead).toBe(2.5);
  expect(death.exchange.taken.damage).toBeGreaterThanOrEqual(100);
  expect(death.exchange.taken.hits).toBeGreaterThan(0);
  await expect(page.locator("#death-banner")).toBeVisible();
  await expect(page.locator("#death-damage-taken")).toHaveText(
    `Damage taken: ${death.exchange.taken.damage} in ${death.exchange.taken.hits} ${death.exchange.taken.hits === 1 ? "hit" : "hits"}`,
  );
  await expect(page.locator("#death-damage-given")).toHaveText("Damage given: 42 in 1 hit");
  await expect(page.locator("#death-fade")).toBeVisible();
  const duration = await page
    .locator("#death-fade")
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).animationDuration));
  expect(duration).toBe(2);
  expect(duration).toBeLessThan(death.dead);
  await expect
    .poll(() =>
      page
        .locator("#death-fade")
        .evaluate((node) => Number(node.getAnimations()[0]?.currentTime ?? 0)),
    )
    .toBeGreaterThanOrEqual(650);
  await page.locator("#death-fade").evaluate((node) => {
    const animation = node.getAnimations()[0];
    animation.pause();
    animation.currentTime = 650;
  });
  const early = await page.locator("#death-fade").evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      opacity: Number(style.opacity),
      red: Number(style.backgroundColor.match(/[\d.]+/g)![0]),
    };
  });
  expect(early.opacity).toBeGreaterThan(0.9);
  expect(early.red).toBeGreaterThan(20);
  await page.screenshot({ path: "artifacts/deathmatch-damage-deathcam.png" });
  // Let the actual CSS clock reach its endpoint. Pause there only to capture
  // stable pixels; the endpoint must precede the real gameplay respawn delay.
  await page.locator("#death-fade").evaluate((node) => node.getAnimations()[0].play());
  await expect
    .poll(() =>
      page
        .locator("#death-fade")
        .evaluate((node) => Number(node.getAnimations()[0]?.currentTime ?? 0)),
    )
    .toBeGreaterThanOrEqual(duration * 1000);
  await page.locator("#death-fade").evaluate((node) => node.getAnimations()[0].pause());
  const late = await page.locator("#death-fade").evaluate((node) => {
    const style = getComputedStyle(node);
    const color = style.backgroundColor.match(/[\d.]+/g)!.map(Number);
    return { opacity: Number(style.opacity), rgb: color.slice(0, 3), alpha: color[3] ?? 1 };
  });
  expect(late.opacity).toBeGreaterThan(0.99);
  expect(Math.max(...late.rgb)).toBeLessThan(8);
  expect(late.alpha).toBeGreaterThan(0.8);
  await expect(page.locator("#death-fade")).toBeVisible();
  await page.screenshot({ path: "artifacts/deathmatch-damage-deathcam-late.png" });
  await page.evaluate(() => {
    const g = window.__game;
    const capture = g.scene.userData.deathcamCapture as {
      simulate: Game["simulate"];
      deadline: number;
      start: number;
    };
    g.deathBannerUntil = capture.deadline + performance.now() - capture.start;
    g.simulate = capture.simulate;
    delete g.scene.userData.deathcamCapture;
  });
  await page.waitForFunction(() => window.__game.dead === 0, {}, { timeout: 8_000 });
  await expect(page.locator("#death-banner")).toBeHidden();
  await expect(page.locator("#death-fade")).toBeHidden();
  expect(await page.evaluate(() => window.__game.deathDamage.exchange("bot:0"))).toEqual({
    taken: { damage: 0, hits: 0 },
    given: { damage: 0, hits: 0 },
  });
  expect(errors).toEqual([]);
});
