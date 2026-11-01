import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("complete local armory loads real meshes and exercises distinctive firearm actions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const failedAssets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedAssets.push(response.url());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady, undefined, { timeout: 100_000 });
  await page.bringToFront();
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);

  // Run fixed steps in one browser task so RAF cannot race the assertions.
  // Loading, real pointer lock and the audio user gesture above remain genuine.
  const result = await page.evaluate(async () => {
    // Vite's HMR query is part of module identity. Reuse the loaded module
    // so its template cache is the one initialized by the game.
    const moduleUrl = (path: string) => {
      const url = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .reverse()
        .find((name) => new URL(name).pathname === path);
      if (!url) throw new Error(`Loaded module not found: ${path}`);
      return url;
    };
    const weaponModulePath = moduleUrl("/src/weapons.ts");
    const physicsModulePath = moduleUrl("/src/physics.ts");
    const { createWorldGun } = (await import(weaponModulePath)) as typeof import("../src/weapons");
    const { weapons, isKnife } = (await import(
      physicsModulePath
    )) as typeof import("../src/physics");
    const { REVOLVER_COCK_TIME } = (await import(
      moduleUrl("/src/melee.ts")
    )) as typeof import("../src/melee");
    const g = window.__game;
    g.bots.forEach((bot) => {
      bot.health = 0;
      bot.respawn = Infinity;
      bot.group.visible = false;
    });
    g.freezeTime = 0;
    g.keys.clear();
    g.firing = false;
    const assert = (condition: boolean, message: string) => {
      if (!condition) throw new Error(message);
    };
    const advance = (seconds: number) => {
      for (let i = 0; i < Math.ceil(seconds * 128); i++) g.simulate(1 / 128);
    };
    const equip = (id: number) => {
      assert(g.buy(id), `Could not equip ${weapons[id].name}`);
      g.cooldown = g.drawTime = g.reload = g.shotTime = g.boltTime = 0;
      g.weaponCooldowns.fill(0);
      g.firing = false;
      g.yaw = 0;
      g.pitch = 1.3;
      g.ammo = weapons[id].mag;
      g.reserve = weapons[id].reserve;
    };
    const geometry = (object: import("three").Object3D) => {
      let vertices = 0;
      object.traverse((node) => {
        const mesh = node as import("three").Mesh;
        if (mesh.isMesh) vertices += mesh.geometry.getAttribute("position").count;
      });
      return vertices;
    };
    const models = [];
    for (let id = 0; id < weapons.length; id++) {
      equip(id);
      g.animateWeapon(0, 0);
      const model = g.gun.getObjectByName("weapon-model");
      assert(geometry(g.gun) > 100, `${weapons[id].name} lacks loaded geometry`);
      if (!isKnife(id)) {
        assert(!!model && geometry(model) > 100, `${weapons[id].name} lacks native weapon mesh`);
        assert(!!g.gun.getObjectByName("agent-view-arms"), `${weapons[id].name} lacks native arms`);
      }
      const world = isKnife(id) ? undefined : createWorldGun(id);
      if (world) assert(geometry(world) > 100, `${weapons[id].name} lacks carried world geometry`);
      if (world && id >= 7) {
        const legacy = model!.getObjectByName("skin-legacy")!;
        assert(
          geometry(world) === geometry(legacy),
          `${weapons[id].name} carried model includes hidden skin geometry or loses visible vertices`,
        );
      }
      assert(
        g.gun.userData.muzzle.toArray().every(Number.isFinite),
        `${weapons[id].name} has invalid muzzle`,
      );
      models.push({ id, vertices: geometry(g.gun), worldVertices: world ? geometry(world) : 0 });
      if (id >= 12 && !isKnife(id)) {
        g.revolverCharge = id === 17 ? REVOLVER_COCK_TIME : 0;
        const before = g.ammo;
        g.weaponAudio.lastClip = "";
        g.fire();
        assert(g.ammo === before - 1, `${weapons[id].name} did not fire`);
        assert(
          !!g.weaponAudio.lastClip && g.weaponAudio.buffers.has(g.weaponAudio.lastClip),
          `${weapons[id].name} lacks decoded firing audio`,
        );
      }
    }

    equip(23);
    g.cycleScope();
    g.cycleScope();
    assert(g.scopeLevel === 2, "SSG08 second zoom unavailable");
    g.fire();
    assert(g.scopeLevel === 0 && g.boltTime > 0, "SSG08 did not unzoom for bolt cycle");
    const scoutAmmo = g.ammo;
    g.fire();
    assert(g.ammo === scoutAmmo, "SSG08 fired during bolt lockout");
    advance(weapons[23].delay + 0.03);
    assert(g.scopeLevel === 2, "SSG08 failed to restore previous zoom");
    equip(21);
    g.cycleScope();
    assert(g.scopeLevel === 1, "AUG zoom unavailable");
    g.cycleScope();
    assert(g.scopeLevel === 0, "AUG incorrectly has a second zoom");
    equip(24);
    g.cycleScope();
    g.cycleScope();
    g.fire();
    assert(g.scopeLevel === 2 && g.boltTime === 0, "SCAR20 incorrectly unzooms like a bolt rifle");

    equip(19);
    g.famasBurst = true;
    const famasAmmo = g.ammo;
    g.fire();
    advance(0.2);
    assert(
      g.ammo === famasAmmo - 3 && g.burstRemaining === 0,
      "FAMAS did not complete exactly three burst rounds",
    );
    g.famasBurst = false;

    equip(17);
    const revolverAmmo = g.ammo;
    g.firing = true;
    g.fire();
    advance(0.1);
    assert(g.ammo === revolverAmmo, "R8 primary fired before charging");
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    advance(0.25);
    assert(
      g.ammo === revolverAmmo && g.revolverCharge === 0,
      "Released R8 charge fired or failed to cancel",
    );
    g.firing = true;
    g.fire();
    advance(REVOLVER_COCK_TIME + 1 / 128);
    g.firing = false;
    assert(g.ammo === revolverAmmo - 1, "R8 charged primary did not fire");
    g.cooldown = 0;
    g.fire(false, true);
    assert(g.ammo === revolverAmmo - 2 && g.alternateShot, "R8 alternate did not fire immediately");
    assert(
      Math.abs(g.cooldown - 0.4) < 0.00001,
      "R8 alternate cooldown differs from source 0.4 seconds",
    );

    equip(18);
    g.fire();
    const firstHand = g.alternateShot;
    g.cooldown = 0;
    g.fire();
    assert(g.alternateShot !== firstHand, "Dual Berettas did not alternate hands");
    g.animateWeapon(0, 0);
    assert(
      g.gun.userData.muzzle.toArray().every(Number.isFinite),
      "Dual alternate muzzle became invalid",
    );

    for (const id of [32, 34]) {
      equip(id);
      g.ammo = 0;
      g.reserve = 3;
      g.beginReload();
      advance(0.4 + weapons[id].reload * 0.65);
      assert(
        g.ammo === 1 && g.reserve === 2 && g.reload > 0,
        `${weapons[id].name} did not insert one shell at its native marker`,
      );
      g.fire();
      assert(
        g.reload === 0 && g.ammo === 0 && g.reserve === 2,
        `${weapons[id].name} could not interrupt shell reload with a shot`,
      );
    }
    equip(33);
    g.ammo = 2;
    const reserve = g.reserve;
    g.beginReload();
    advance(weapons[33].reload * 0.5);
    assert(g.ammo === 2 && g.reserve === reserve, "MAG7 incorrectly reloads individual shells");
    advance(weapons[33].reload * 0.5 + 0.02);
    assert(
      g.ammo === weapons[33].mag && g.reserve === reserve - weapons[33].mag,
      "MAG7 did not replace its detachable magazine",
    );
    g.firing = false;
    return { models, selected: g.selected, audioCount: g.weaponAudio.buffers.size };
  });
  expect(result.models).toHaveLength(56);
  expect(result.selected).toBe(33);
  expect(result.audioCount).toBeGreaterThan(100);
  expect(failedAssets).toEqual([]);
  expect(errors).toEqual([]);
});
