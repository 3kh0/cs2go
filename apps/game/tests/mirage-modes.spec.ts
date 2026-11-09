import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}
async function enter(page: Page, mode: "practice" | "deathmatch") {
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-play").click();
  await page.locator(`[data-mode="${mode}"]`).click();
  await expect(page.locator(`[data-mode="${mode}"]`)).toHaveAttribute("aria-pressed", "true");
  // Online remains limited to the two authoritative bomb-round modes.
  await page.locator('[data-session="multi"]').click();
  await expect(page.locator(`[data-mode="${mode}"]`)).toBeHidden();
  await expect(page.locator(`[data-mode="${mode}"]`)).toBeDisabled();
  await expect(page.locator('[data-mode="casual"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-session="single"]').click();
  await page.locator(`[data-mode="${mode}"]`).click();
  await page.locator('[data-map="mirage"]').click();
  await page.locator("#play").click();
  await expect(page.locator('#team-select [data-team="ct"]')).toBeVisible({ timeout: 120_000 });
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked && window.__game.mapId === "mirage");
  await expect(page.locator("#location")).toHaveText("MIRAGE");
  await expect(page.locator("#bomb-carrier")).toBeHidden();
  await expect(page.locator("#bomb-action")).toBeHidden();
  expect(
    await page.evaluate(() => ({
      mode: window.__game.mode,
      map: window.__game.dust!.id,
      round: window.__game.teamMode,
      bomb: window.__game.bomb,
      network: !!window.__game.network,
      football: !!window.__game.dust!.ball.mesh,
    })),
  ).toEqual({ mode, map: "mirage", round: false, bomb: null, network: false, football: false });
  await page.evaluate(() => {
    // Isolate input and respawn checks from ambient firefights; no geometry,
    // player movement, timer or collision implementation is replaced.
    for (const bot of window.__game.bots) {
      bot.health = 0;
      bot.respawn = Infinity;
      bot.group.visible = false;
    }
  });
}
for (const mode of ["practice", "deathmatch"] as const) {
  test(`Mirage ${mode} uses the real mode picker, native movement, weapon impacts${mode === "deathmatch" ? " and respawns" : ""}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && /\/(models|maps|audio|icons)\//.test(response.url()))
        errors.push(`Asset ${response.status()}: ${response.url()}`);
    });
    await enter(page, mode);
    const before = await page.evaluate(() => {
      const g = window.__game,
        eye = g.position.clone();
      eye.y += g.eye;
      for (let n = 0; n < 32; n++) {
        const yaw = (n * Math.PI) / 16;
        const to = eye.clone();
        to.x -= Math.sin(yaw) * 2;
        to.z -= Math.cos(yaw) * 2;
        if (
          g.dust!.collision.visible(eye, to) &&
          Math.abs(g.dust!.collision.floor(to.x, to.z, g.position.y + 0.5) - g.position.y) < 0.08
        ) {
          g.yaw = yaw;
          break;
        }
      }
      return { x: g.position.x, z: g.position.z, time: g.time };
    });
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyW");
    await expect
      .poll(() =>
        page.evaluate(
          (start) =>
            Math.hypot(window.__game.position.x - start.x, window.__game.position.z - start.z),
          before,
        ),
      )
      .toBeGreaterThan(0.3);
    await page.waitForTimeout(300);
    const support = await page.evaluate(async () => {
      const g = window.__game;
      const path = "/src/physics.ts";
      const { movement } = (await import(path)) as typeof import("../src/physics");
      // The native 32-inch hull stands on the highest supporting face under
      // its footprint; a center-point floor ray is lower on sloped paving.
      const floor = g.dust!.collision.support(
        g.position.x,
        g.position.z,
        g.position.y + 0.1,
        g.position.y - 0.3,
        movement.hullRadius,
      );
      return { grounded: g.grounded, difference: Math.abs(g.position.y - floor) };
    });
    expect(support.grounded).toBe(true);
    expect(support.difference).toBeLessThan(0.01);
    if (mode === "deathmatch")
      await expect
        .poll(() => page.evaluate(() => window.__game.time))
        .toBeLessThan(before.time - 0.3);
    else expect(await page.evaluate(() => window.__game.time)).toBe(before.time);
    await page.evaluate(async () => {
      const path = "/tests/three-fixture.ts";
      const { Ray } = (await import(path)) as typeof import("three");
      const g = window.__game,
        from = g.position.clone();
      from.y += g.eye;
      let nearest = Infinity;
      for (let n = 0; n < 32; n++) {
        const yaw = (n * Math.PI) / 16;
        const direction = from.clone().set(-Math.sin(yaw), 0, -Math.cos(yaw));
        const hit = g.dust!.collision.intersections(new Ray(from, direction), 40)[0];
        if (hit && hit.distance > 0.5 && hit.distance < nearest) {
          nearest = hit.distance;
          g.yaw = yaw;
        }
      }
      if (!Number.isFinite(nearest)) throw new Error("Native Mirage firing lane has no wall");
      g.pitch = 0;
    });
    await page.waitForFunction(() => window.__game.cooldown === 0 && window.__game.drawTime === 0);
    const shot = await page.evaluate(() => ({
      ammo: window.__game.ammo,
      decals: window.__game.decals.count,
    }));
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.__game.ammo)).toBe(shot.ammo - 1);
    await expect
      .poll(() => page.evaluate(() => window.__game.decals.count))
      .toBeGreaterThan(shot.decals);
    if (mode === "deathmatch") {
      const deaths = await page.evaluate(async () => {
        const g = window.__game;
        const path = "/src/recoil.ts";
        const { createAimPunch, createWeaponRecoil } = (await import(
          path
        )) as typeof import("../src/recoil");
        const accuracyPath = "/src/accuracy.ts";
        const { createWeaponAccuracy } = (await import(
          accuracyPath
        )) as typeof import("../src/accuracy");
        const shooter = g.bots[0];
        const aim = g.position.clone();
        aim.y += 1;
        let point: typeof g.position | undefined;
        for (let n = 0; n < 32; n++) {
          const yaw = (n * Math.PI) / 16;
          const feet = g.position.clone();
          feet.x += Math.sin(yaw) * 1.5;
          feet.z += Math.cos(yaw) * 1.5;
          const floor = g.dust!.collision.floor(feet.x, feet.z, feet.y + 0.5);
          if (Math.abs(floor - feet.y) > 0.08) continue;
          feet.y = floor;
          const eye = feet.clone();
          eye.y += 1.45;
          if (g.dust!.collision.visible(eye, aim)) {
            point = feet;
            break;
          }
        }
        if (!point) throw new Error("Native Mirage respawn fixture lacks a clear bot shot");
        shooter.group.position.copy(point);
        shooter.team = "t";
        shooter.health = 100;
        shooter.speed =
          shooter.reaction =
          shooter.shot =
          shooter.reloadTime =
          shooter.burst =
          shooter.vertical =
            0;
        shooter.rig.weaponIndex = 3;
        shooter.weaponAccuracy = createWeaponAccuracy();
        shooter.aimPunch = createAimPunch();
        shooter.weaponRecoil = createWeaponRecoil();
        shooter.ammo = 10;
        shooter.reserve = 30;
        shooter.aim.copy(aim);
        g.invulnerable = g.armor = 0;
        g.health = 1;
        const previous = g.deaths;
        // Exercise the normal bullet/damage/death path, then let the live
        // simulation own the complete 2.5-second respawn countdown.
        g.botCombat(
          shooter,
          { id: "player", position: g.position, distance: 1.5, score: 1.5 },
          1 / 16,
        );
        shooter.health = 0;
        shooter.respawn = Infinity;
        return previous;
      });
      expect(await page.evaluate(() => window.__game.dead)).toBeGreaterThan(0);
      await expect.poll(() => page.evaluate(() => window.__game.deaths)).toBe(deaths + 1);
      await expect.poll(() => page.evaluate(() => window.__game.dead), { timeout: 6000 }).toBe(0);
      expect(
        await page.evaluate(() => ({
          health: window.__game.health,
          ammo: window.__game.ammo,
          map: window.__game.mapId,
          distance: window.__game.position.distanceTo(
            window.__game.position
              .clone()
              .fromArray(window.__game.dust!.navigation.data.spawns.ct[0]),
          ),
        })),
      ).toMatchObject({
        health: 100,
        ammo: shot.ammo,
        map: "mirage",
        distance: expect.any(Number),
      });
      expect(
        await page.evaluate(() => {
          const g = window.__game,
            spawn = g.dust!.navigation.data.spawns.ct[0];
          return Math.hypot(g.position.x - spawn[0], g.position.z - spawn[2]);
        }),
      ).toBeLessThan(0.55);
    }
    await page.screenshot({ path: `artifacts/mirage-${mode}.png` });
    expect(errors).toEqual([]);
  });
}
