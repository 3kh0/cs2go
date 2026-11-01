import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("menu, saved settings, and offline assets", async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") external.push(request.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CASUAL", exact: true })).toBeVisible();
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Controls", exact: true }).click();
  await page.locator("#sensitivity").fill("1.7");
  await page.getByRole("tab", { name: "Video", exact: true }).click();
  await page.locator("#quality").selectOption("low");
  await page.locator("#close-settings").click();
  await page.reload();
  await page.locator("#settings-button").click();
  await expect(page.locator("#sensitivity")).toHaveValue("1.7");
  await expect(page.locator("#quality")).toHaveValue("low");
  await page.locator("#close-settings").click();
  await page.screenshot({ path: "artifacts/menu.png" });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("real pointer lock, movement, jump, crouch, pause, and loadout", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.keyboard.down("w");
  await page.waitForTimeout(600);
  await page.keyboard.up("w");
  await expect.poll(() => page.evaluate(() => window.__game.position.z)).toBeLessThan(15);
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => window.__game.position.y)).toBeGreaterThan(0.2);
  await page.waitForTimeout(900);
  await expect.poll(() => page.evaluate(() => window.__game.grounded)).toBe(true);
  await page.keyboard.down("c");
  await expect.poll(() => page.evaluate(() => window.__game.eye)).toBeLessThan(1.2);
  await page.keyboard.up("c");
  await page.keyboard.press("b");
  await page.locator('[data-weapon="1"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await expect(page.locator("#gun-name")).toHaveText("M4A1-S");
  await page.keyboard.press("b");
  await expect(page.locator("#loadout")).toBeVisible();
  await page.locator('[data-weapon="2"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await expect(page.locator("#gun-name")).toHaveText("USP-S");
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
  const time = await page.evaluate(() => window.__game.animationTime);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__game.animationTime)).toBeGreaterThan(time);
  await page.locator("#resume").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.screenshot({ path: "artifacts/gameplay.png" });
  expect(errors).toEqual([]);
});
test("hitscan headshots, wall occlusion, spare-magazine reload, and target respawns", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.evaluate(() => {
    const g = window.__game;
    g.buy(0);
    g.drawTime = 0;
    g.bots.slice(1).forEach((b) => {
      b.health = 0;
      b.respawn = 99;
      b.group.visible = false;
    });
    g.yaw = 0;
    g.pitch = Math.atan2(1.6 - 1.65, 13);
    g.cooldown = 0;
  });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator("#score")).toHaveText("1");
  await expect(page.locator("#killfeed .feed").last()).toHaveAttribute("aria-label", /HEADSHOT/);
  const discarded = await page.evaluate(() => window.__game.ammo);
  const ammunition = await page.evaluate(() => window.__game.ammo + window.__game.reserve);
  await page.keyboard.press("r");
  await expect.poll(() => page.evaluate(() => window.__game.ammo), { timeout: 4000 }).toBe(30);
  expect(await page.evaluate(() => window.__game.ammo + window.__game.reserve)).toBe(
    ammunition - discarded,
  );
  await expect.poll(() => page.evaluate(() => window.__game.bots[0].health)).toBe(100);
  await page.evaluate(() => {
    const g = window.__game;
    g.bots[0].group.position.set(-9, 0, 14);
    g.yaw = -Math.atan2(8, 3);
    g.pitch = 0;
    g.cooldown = 0;
  });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.bots[0].health)).toBe(100);
});
test("bots navigate, damage the player, and respawn resets health and ammunition", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("deathmatch");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      return g.findPath(g.bots[0].group.position, g.position).length;
    }),
  ).toBeGreaterThan(0);
  await page.evaluate(() => {
    const g = window.__game;
    g.invulnerable = 0;
    g.health = 1;
    g.armor = 0;
    g.bots.forEach((b, i) => {
      b.group.position.set(-17 + i * 0.5, 0, 13);
      b.reaction = 0;
      b.shot = 0;
    });
  });
  await expect.poll(() => page.evaluate(() => window.__game.deaths), { timeout: 5000 }).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__game.dead), { timeout: 5000 }).toBe(0);
  expect(await page.evaluate(() => window.__game.health)).toBe(100);
  expect(await page.evaluate(() => window.__game.ammo)).toBe(12);
  await page.evaluate(() => {
    window.__game.kills = 20;
    window.__game.finish();
  });
  await expect(page.locator("#result-title")).toHaveText("VICTORY.");
  await page.locator("#result-menu").click();
  await expect(page.locator("#menu")).toBeVisible();
});

test("supplied AWP mesh, two zoom levels, bolt lockout, body damage, reload, and scope reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.keyboard.press("b");
  await page.locator('[data-weapon="3"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await expect(page.locator("#gun-name")).toHaveText("AWP");
  await expect(page.locator("#ammo")).toHaveText("5");
  await expect(page.locator("#crosshair")).toHaveClass("hidden");
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      let vertices = 0;
      g.gun.getObjectByName("weapon-model")!.traverse((object) => {
        if ((object as import("three").SkinnedMesh).isSkinnedMesh)
          vertices += (object as import("three").Mesh).geometry.attributes.position.count;
      });
      return vertices;
    }),
  ).toBeGreaterThan(10000);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect(page.locator("#scope")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__game.camera.fov)).toBe(40);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect.poll(() => page.evaluate(() => window.__game.camera.fov)).toBe(10);
  await page.evaluate(() => {
    const g = window.__game;
    g.yaw = 0;
    g.pitch = Math.atan2(1.2 - g.eye, 13);
    g.bots.slice(1).forEach((b) => {
      b.health = 0;
      b.respawn = 99;
      b.group.visible = false;
    });
  });
  await page.waitForFunction(() => window.__game.cooldown === 0);
  await page.waitForTimeout(220);
  await page.screenshot({ path: "artifacts/awp-scope.png" });
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator("#score")).toHaveText("1");
  await expect(page.locator("#scope")).toBeHidden();
  await expect(page.locator("#ammo")).toHaveText("4");
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.ammo)).toBe(4);
  expect(
    await page.evaluate(() => window.__game.gun.getObjectByName("bolt_action") !== undefined),
  ).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__game.scopeLevel), { timeout: 3000 }).toBe(2);
  await page.keyboard.press("r");
  await expect(page.locator("#scope")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__game.ammo), { timeout: 5000 }).toBe(5);
  expect(await page.evaluate(() => window.__game.reserve)).toBe(5);
  // A third right click returns to the original unscoped FOV.
  for (let i = 0; i < 3; i++) {
    await page.mouse.down({ button: "right" });
    await page.mouse.up({ button: "right" });
  }
  await expect(page.locator("#scope")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__game.camera.fov)).toBe(90);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.keyboard.press("Digit2");
  await expect(page.locator("#scope")).toBeHidden();
  await expect(page.locator("#crosshair i").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("skinned agent gait, head tracking, and corpse poses", async ({ page }) => {
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("deathmatch");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.evaluate(() => {
    const g = window.__game;
    g.invulnerable = 99;
    g.bots[0].group.position.set(-17, 0, -17);
    g.bots[0].nav = 0;
  });
  await expect
    .poll(() => page.evaluate(() => window.__game.bots[0].rig.stride))
    .toBeGreaterThan(0.2);
  const hipPose = await page.evaluate(() => window.__game.bots[0].rig.hips[0].quaternion.toArray());
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(() => window.__game.bots[0].rig.hips[0].quaternion.toArray()),
  ).not.toEqual(hipPose);
  expect(
    await page.evaluate(() => {
      const b = window.__game.bots[0];
      let skinned = 0;
      b.group.traverse((o) => {
        if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinned++;
      });
      return skinned;
    }),
  ).toBeGreaterThan(0);
  await page.evaluate(() => {
    const b = window.__game.bots[0];
    b.health = 0;
    b.respawn = Infinity;
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const ragdoll = window.__game.bots[0].rig.ragdoll;
        if (!ragdoll) return 0;
        return (
          Math.max(...ragdoll.points.map((point) => point.start.y)) -
          Math.max(...ragdoll.points.map((point) => point.position.y))
        );
      }),
    )
    .toBeGreaterThan(0.5);
  expect(
    await page.evaluate(() => {
      const rig = window.__game.bots[0].rig;
      return rig.ragdoll!.points.some(
        (point) => point.bone.quaternion.angleTo(point.localRotation) > 0.2,
      );
    }),
  ).toBe(true);
});

test("supplied weapon audio decodes, plays, and follows reload and AWP timing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const result = await page.evaluate(() => {
    const game = window.__game;
    const bank = game.weaponAudio;
    const decoded = [...bank.buffers.values()].every(
      (buffer) => buffer.duration > 0 && buffer.numberOfChannels === 1,
    );
    const events: string[] = [];
    const play = bank.play.bind(bank);
    bank.play = (...args) => {
      play(...args);
      events.push(bank.lastClip);
    };
    for (let weapon = 0; weapon < 4; weapon++) {
      game.buy(weapon);
      game.sound("shot");
    }
    const shots = events.filter((name) =>
      ["ak47-1", "m4a1-1-single", "usp1", "awp1"].includes(name),
    );
    const voices = bank.voices.size;
    game.sound("scope");
    const scope = bank.lastClip;
    events.length = 0;
    game.ammo = 4;
    game.beginReload();
    for (let tick = 0; tick < 520; tick++) game.simulate(1 / 128);
    const reload = [...events];
    events.length = 0;
    game.boltTime = 1.45 / 0.9;
    for (let tick = 0; tick < 220; tick++) game.simulate(1 / 128);
    const bolt = [...events];
    events.length = 0;
    game.ammo = 4;
    game.beginReload();
    game.buy(0);
    for (let tick = 0; tick < 520; tick++) game.simulate(1 / 128);
    const cancelled = [...events];
    events.length = 0;
    game.buy(1);
    const drawBeforeReload = game.drawTime;
    game.beginReload(); // A full magazine must not snap an unfinished draw to idle.
    const rejectedReloadPreservesDraw = game.drawTime === drawBeforeReload;
    game.equip(4); // No delayed M4 action sounds may survive this switch.
    for (let tick = 0; tick < 90; tick++) game.simulate(1 / 128);
    const interruptedDraw = [...events];
    game.buy(0);
    game.settings.volume = 0;
    const count = bank.voices.size;
    game.sound("shot");
    return {
      decoded,
      clips: bank.buffers.size,
      shots,
      voices,
      scope,
      reload,
      bolt,
      cancelled,
      interruptedDraw,
      rejectedReloadPreservesDraw,
      muted: bank.voices.size === count,
      audioState: game.audio?.state,
      longestClip: Math.max(...[...bank.buffers.values()].map((buffer) => buffer.duration)),
    };
  });
  expect(result.decoded).toBe(true);
  expect(result.clips).toBe(209); // 193 firearm clips plus 16 suppressor/unsuppressed cues.
  expect(result.shots).toEqual(["ak47-1", "m4a1-1-single", "usp1", "awp1"]);
  expect(result.voices).toBeGreaterThanOrEqual(4);
  expect(result.scope).toBe("zoom");
  const nativeScopes = await page.evaluate(() => {
    const game = window.__game;
    return [21, 22, 23, 24, 25].map((weapon) => {
      game.weaponAudio.play(game.audio!, "scope", weapon, 100);
      return game.weaponAudio.lastClip;
    });
  });
  expect(nativeScopes).toEqual([
    "aug_zoom",
    "sg556_zoom",
    "ssg08_zoom",
    "scar20_zoom",
    "g3sg1_zoom",
  ]);
  expect(result.reload).toEqual(["awp_clipout", "awp_clipin", "awp_boltback", "awp_boltforward"]);
  expect(result.bolt).toEqual(["awp_boltback", "awp_boltforward"]);
  // Switching before the native clipout marker prevents that sound entirely.
  expect(result.cancelled).toEqual(["ak47_draw", "ak47_boltpull"]);
  expect(result.interruptedDraw).toEqual(["m4a1_draw"]);
  expect(result.rejectedReloadPreservesDraw).toBe(true);
  expect(result.muted).toBe(true);
  expect(result.audioState).toBe("running");
  await expect
    .poll(() => page.evaluate(() => window.__game.weaponAudio.voices.size), {
      timeout: result.longestClip * 1000 + 2000,
    })
    .toBe(0);
  expect(errors).toEqual([]);
});

test("wheel cycles and wraps; AWP hits aligned enemies once each with penetration metadata", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.mouse.wheel(0, -120);
  await expect(page.locator("#gun-name")).toHaveText("Bayonet");
  await page.waitForTimeout(120);
  await page.mouse.wheel(0, 120);
  await expect(page.locator("#gun-name")).toHaveText("USP-S");
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.buy(3);
    g.drawTime = g.cooldown = 0;
    g.weaponAccuracy[g.selected] = { penalty: 0, mode: 1 }; // Settled accuracy fixture.
    g.setScope(1);
    g.weaponAccuracy[g.selected] = { penalty: 0, mode: 1 }; // Settled accuracy fixture.
    g.yaw = g.pitch = 0;
    g.bots.forEach((b, i) => {
      b.health = i < 2 ? 100 : 0;
      b.respawn = 99;
      b.group.visible = i < 2;
      b.group.position.set(-17, 0, i ? 0 : 4);
      b.group.rotation.set(0, 0, 0);
    });
    g.fire();
    return { kills: g.kills, ammo: g.ammo, health: g.bots.slice(0, 2).map((b) => b.health) };
  });
  expect(result.kills).toBe(2);
  expect(result.ammo).toBe(4);
  expect(result.health.every((h) => h <= 0)).toBe(true);
  await expect(page.locator("#killfeed .feed")).toHaveCount(2);
  await expect(
    page.locator("#killfeed .feed").last().locator('img[alt="PENETRATION"]'),
  ).toBeVisible();
  await expect(page.locator("#killfeed .feed").last().locator('img[alt="HEADSHOT"]')).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: "artifacts/killfeed-collateral.png" });
  const body = await page.evaluate(() => {
    const g = window.__game;
    g.kills = 0;
    g.cooldown = g.boltTime = 0;
    g.setScope(1);
    g.weaponAccuracy[g.selected] = { penalty: 0, mode: 1 }; // Settled accuracy fixture.
    g.yaw = 0;
    g.pitch = Math.atan2(1.2 - g.eye, 13);
    g.bots.slice(0, 2).forEach((b, i) => {
      // Reset the complete articulated death pose before testing a new shot.
      g.spawnBot(b, i);
      b.group.rotation.set(0, 0, 0);
      // Keep both torso centers on the same descending ray.
      b.group.position.set(-17, i ? -4 * Math.tan(-g.pitch) : 0, i ? 0 : 4);
    });
    g.fire();
    return g.bots.slice(0, 2).map((b) => b.health);
  });
  expect(body[0]).toBeLessThanOrEqual(0);
  expect(body[1]).toBeGreaterThan(0);
  expect(body[1]).toBeLessThan(100);
});

test("local music/effects, live volume controls, and settings persistence", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__game.assetsReady);
  await page.locator("#settings-button").click();
  await expect.poll(() => page.evaluate(() => window.__game.soundscape.music.paused)).toBe(false);
  expect(await page.evaluate(() => window.__game.soundscape.currentMusic)).toBe("menu");
  await page.getByRole("tab", { name: "Audio", exact: true }).click();
  await page.locator("#volume").fill("80");
  await page.locator("#musicVolume").fill("50");
  await page.locator("#effectsVolume").fill("30");
  expect(await page.evaluate(() => window.__game.soundscape.music.volume)).toBeCloseTo(0.4);
  await expect
    .poll(() => page.evaluate(() => window.__game.soundscape.effects!.gain.value))
    .toBeCloseTo(0.3);
  await page.locator("#volume").fill("0");
  expect(await page.evaluate(() => window.__game.soundscape.music.volume)).toBe(0);
  await page.reload();
  await page.locator("#settings-button").click();
  await expect(page.locator("#volume")).toHaveValue("0");
  await expect(page.locator("#musicVolume")).toHaveValue("50");
  await expect(page.locator("#effectsVolume")).toHaveValue("30");
  expect(errors).toEqual([]);
});

test("native weapon parts follow reload and bolt clips and return to their seats", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const result = await page.evaluate(async () => {
    const path = "/src/physics.ts";
    const { weapons } = (await import(path)) as typeof import("../src/physics");
    const g = window.__game;
    // Sample twice across the transition window, then examine geometry in the
    // receiver's local frame so whole-weapon movement cannot fake part travel.
    const sample = () => {
      g.animationTime += 1;
      g.animateWeapon();
      g.animationTime += 1;
      g.animateWeapon();
    };
    const magazines = [];
    for (let index = 0; index < 4; index++) {
      g.buy(index);
      g.drawTime = g.reload = g.boltTime = g.shotTime = 0;
      sample();
      const model = g.gun.getObjectByName("weapon-model")!;
      const receiver = model.getObjectByName("weapon_offset")!;
      const mag = model.getObjectByName("clip")!;
      const position = () =>
        receiver.worldToLocal(mag.getWorldPosition(g.position.clone())).multiplyScalar(0.0254);
      const rest = position();
      g.reload = 0.75 * weapons[index].reload;
      sample();
      const removed = position().distanceTo(rest);
      g.reload = 0.6 * weapons[index].reload;
      sample();
      const wristDistance = mag
        .getWorldPosition(g.position.clone())
        .distanceTo(g.gun.getObjectByName("left-hand")!.getWorldPosition(g.position.clone()));
      g.reload = 0.01;
      sample();
      const seated = position().distanceTo(rest);
      g.reload = 0;
      sample();
      magazines.push({ removed, seated, wristDistance, reset: position().distanceTo(rest) });
    }
    const model = g.gun.getObjectByName("weapon-model")!;
    const receiver = model.getObjectByName("weapon_offset")!;
    const bolt = model.getObjectByName("bolt_action")!;
    const position = () =>
      receiver.worldToLocal(bolt.getWorldPosition(g.position.clone())).multiplyScalar(0.0254);
    const rest = position(),
      rotation = bolt.quaternion.clone();
    let travel = 0,
      turn = 0,
      contact = Infinity;
    for (let frame = 1; frame < 60; frame++) {
      g.boltTime = (1 - frame / 60) * weapons[3].delay;
      sample();
      travel = Math.max(travel, position().distanceTo(rest));
      turn = Math.max(turn, bolt.quaternion.angleTo(rotation));
      contact = Math.min(
        contact,
        bolt
          .getWorldPosition(g.position.clone())
          .distanceTo(g.gun.getObjectByName("right-hand")!.getWorldPosition(g.position.clone())),
      );
    }
    g.boltTime = 0;
    sample();
    return { magazines, travel, turn, contact, reset: position().distanceTo(rest) };
  });
  for (const mag of result.magazines) {
    expect(mag.removed).toBeGreaterThan(0.2);
    expect(mag.wristDistance).toBeLessThan(0.2);
    expect(mag.seated).toBeLessThan(0.002);
    expect(mag.reset).toBeLessThan(0.0001);
  }
  expect(result.travel).toBeGreaterThan(0.04);
  expect(result.travel).toBeLessThan(0.14);
  expect(result.turn).toBeGreaterThan(0.5);
  expect(result.contact).toBeLessThan(0.15);
  expect(result.reset).toBeLessThan(0.0001);
});

test("thin wood transmits a bullet but thick masonry stops it", async ({ page }) => {
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const result = await page.evaluate(async () => {
    // Reuse an existing BoxGeometry and material so the test exercises the
    // production raycast and world-material path without another Three module.
    const g = window.__game;
    g.buy(3);
    g.drawTime = g.cooldown = 0;
    g.yaw = g.pitch = 0;
    g.setScope(1);
    g.weaponAccuracy[g.selected] = { penalty: 0, mode: 1 }; // Settled accuracy fixture.
    g.bots.slice(1).forEach((b) => {
      b.health = 0;
      b.respawn = 99;
      b.group.visible = false;
    });
    const cover = g.world.solids[0].clone();
    cover.position.set(-17, 1.3, 8);
    cover.scale.set(2, 3, 0.08);
    cover.userData.bulletMaterial = "wood";
    g.world.solids.push(cover);
    g.scene.add(cover);
    g.fire();
    const thin = g.bots[0].health;
    g.bots[0].health = 100;
    g.bots[0].group.rotation.set(0, 0, 0);
    cover.scale.z = 1;
    cover.userData.bulletMaterial = "concrete";
    g.cooldown = g.boltTime = 0;
    g.pitch = g.yaw = 0;
    g.setScope(1);
    g.weaponAccuracy[g.selected] = { penalty: 0, mode: 1 }; // Settled accuracy fixture.
    g.fire();
    return { thin, thick: g.bots[0].health };
  });
  expect(result.thin).toBeLessThanOrEqual(0);
  expect(result.thick).toBe(100);
});

test("agent side selection, independent rigs, and live menu animation", async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") external.push(request.url());
  });
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  await page.locator("#agent-team").selectOption("t");
  await page.locator("#close-settings").click();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("deathmatch");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  expect(await page.evaluate(() => window.__game.bots.map((b) => b.group.name))).toEqual(
    Array(5).fill("IDF"),
  );
  expect(
    await page.evaluate(() => window.__game.bots[0].rig.head === window.__game.bots[1].rig.head),
  ).toBe(false);
  await page.evaluate(() => {
    const g = window.__game;
    g.invulnerable = 99;
    g.bots[0].group.position.set(-17, 0, -17);
    g.bots[0].nav = 0;
  });
  await expect.poll(() => page.evaluate(() => window.__game.bots[0].speed)).toBeGreaterThan(1);
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
  const pose = await page.evaluate(() => window.__game.animationTime);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__game.animationTime)).toBeGreaterThan(pose);
  await page.locator("#leave").click();
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  await page.locator("#agent-team").selectOption("ct");
  await page.locator("#close-settings").click();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  expect(await page.evaluate(() => window.__game.bots.map((b) => b.group.name))).toEqual(
    Array(5).fill("Ground Rebel | Elite Crew"),
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("Dust II ledges release the player and A ramp's wall stays solid", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const { routes, seams } = await page.evaluate(() => {
    const g = window.__game,
      c = g.world.collision!;
    // Keep the actual map and player simulation, with deterministic ticks and
    // no combat. These starts are on the raised edge beside A ramp.
    g.locked = false;
    g.mode = "practice";
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    const routes = [
      [32.5, -68.7, (3 * Math.PI) / 2],
      [32.5, -69.3, (5 * Math.PI) / 4],
      [40, -64, (3 * Math.PI) / 2],
      [36, -58, 0],
    ].map(([x, z, yaw]) => {
      g.position.set(x, c.floor(x, z, 4, -1), z);
      g.velocity.x = g.velocity.z = g.vertical = g.dead = 0;
      g.grounded = true;
      g.eye = 1.65;
      g.yaw = yaw;
      g.keys.clear();
      g.keys.add("KeyW");
      let overlaps = 0;
      for (let i = 0; i < 256; i++) {
        g.simulate(1 / 128);
        if (c.blocked(g.position.x, g.position.z, g.position.y, 0.3, g.eye)) overlaps++;
      }
      const end = g.position.toArray();
      // Reverse away from contact; checking only for overlap would miss a
      // controller that avoids penetration by freezing the player in place.
      g.keys.clear();
      g.keys.add("KeyS");
      for (let i = 0; i < 128; i++) g.simulate(1 / 128);
      return { end, overlaps, escape: Math.hypot(g.position.x - end[0], g.position.z - end[2]) };
    });
    // Long A, Long Doors and Tunnel Stairs have narrow gaps beside their
    // decorative edges. Gravity must settle beside them, not trap the hull.
    const seams = [
      [32.9565, -0.04, -29.2735],
      [33.0835, -0.22, -23.8125],
      [-27.88, -1.03, -27.8765],
    ].map(([x, y, z]) => {
      g.position.set(x, y, z);
      g.velocity.x = g.velocity.z = g.vertical = 0;
      g.grounded = false;
      g.keys.clear();
      for (let i = 0; i < 256; i++) g.simulate(1 / 128);
      return {
        drop: y - g.position.y,
        grounded: g.grounded,
        blocked: c.blocked(g.position.x, g.position.z, g.position.y),
      };
    });
    return { routes, seams };
  });
  for (const route of routes) {
    expect(route.overlaps).toBe(0);
    expect(route.escape).toBeGreaterThan(1);
    expect(route.end[1]).toBeGreaterThan(0);
  }
  expect(routes[0].end[0]).toBeGreaterThan(38);
  expect(routes[1].end[0]).toBeGreaterThan(37);
  // The restored clip brush stops the hull before the decorative wall.
  expect(routes[2].end[0]).toBeGreaterThan(40.7);
  expect(routes[2].end[0]).toBeLessThan(40.9);
  expect(routes[3].end[2]).toBeLessThan(-68);
  expect(routes[3].end[1]).toBeGreaterThan(2);
  for (const seam of seams) {
    expect(seam.drop).toBeLessThan(0.3);
    expect(seam.grounded).toBe(true);
    expect(seam.blocked).toBe(false);
  }
  expect(errors).toEqual([]);
});
test("releasing crouch under cover waits for enough room to stand", async ({ page }) => {
  await page.goto("/");
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    g.world.walls.push({ x: 100, z: 100, w: 4, d: 4, y: 1.45, h: 4 });
    g.position.set(100, 0, 100);
    g.velocity.x = g.velocity.z = g.vertical = 0;
    g.eye = 1.1;
    g.keys.clear();
    for (let i = 0; i < 128; i++) g.simulate(1 / 128);
    const underCover = g.eye;
    g.yaw = 0;
    g.keys.add("KeyW");
    for (let i = 0; i < 256; i++) g.simulate(1 / 128);
    return { underCover, standing: g.eye, z: g.position.z };
  });
  expect(result.underCover).toBeLessThanOrEqual(1.3);
  expect(result.standing).toBeCloseTo(1.6256);
  expect(result.z).toBeLessThan(97);
});
test("CT ramp traversal and the local callout radar", async ({ page }) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== "http://127.0.0.1:5173") external.push(r.url());
  });
  await page.goto("/");
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const routes = await page.evaluate(() => {
    const g = window.__game,
      c = g.world.collision!;
    g.locked = false;
    g.mode = "practice";
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    const routes = [-53, -54, -55, -56, -57].map((z) => {
      g.position.set(14, c.floor(14, z, -2, -4), z);
      g.velocity.x = g.velocity.z = g.vertical = 0;
      g.grounded = true;
      g.eye = 1.65;
      g.yaw = -Math.PI / 2;
      g.keys.clear();
      g.keys.add("KeyW");
      let blocked = 0;
      for (let i = 0; i < 384; i++) {
        g.simulate(1 / 128);
        if (c.blocked(g.position.x, g.position.z, g.position.y)) blocked++;
      }
      const top = g.position.toArray();
      g.keys.clear();
      g.keys.add("KeyS");
      for (let i = 0; i < 384; i++) g.simulate(1 / 128);
      return { top, bottom: g.position.toArray(), blocked };
    });
    g.keys.clear();
    g.position.set(9, c.floor(9, -57, -2, -4), -57);
    g.velocity.x = g.velocity.z = g.vertical = 0;
    g.invulnerable = 1000;
    g.locked = true;
    return routes;
  });
  for (const route of routes) {
    expect(route.blocked).toBe(0);
    expect(route.top[0]).toBeGreaterThan(31);
    expect(route.top[1]).toBeGreaterThan(-0.1);
    expect(route.bottom[0]).toBeLessThan(17);
    expect(route.bottom[1]).toBeLessThan(-2);
  }
  await page.keyboard.down("m");
  await expect(page.locator(".radar-wrap")).toHaveClass(/expanded/);
  expect(await page.evaluate(() => window.__game.locked)).toBe(true);
  // Independently check the artwork: both site coordinates must land inside
  // its red bombsite regions, not merely agree with our marker projection.
  expect(
    await page.evaluate(() => {
      const g = window.__game,
        canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 948;
      const ctx = canvas.getContext("2d")!;
      g.drawMapLayer(ctx, canvas.width, canvas.height, true);
      const { px, pz } = g.mapProjection(canvas.width, canvas.height);
      return g.world.navigation!.data.sites.map(([x, , z]) => {
        const [r, green, b] = ctx.getImageData(Math.round(px(x)), Math.round(pz(z)), 1, 1).data;
        return r > green * 2 && r > b * 2;
      });
    }),
  ).toEqual([true, true]);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = window.__game,
          canvas = document.querySelector<HTMLCanvasElement>("#radar")!;
        const { px, pz } = g.mapProjection(canvas.width, canvas.height);
        return [
          ...canvas
            .getContext("2d")!
            .getImageData(Math.round(px(g.position.x)), Math.round(pz(g.position.z)), 1, 1).data,
        ];
      }),
    )
    .toEqual([255, 255, 255, 255]);
  await page.screenshot({ path: "artifacts/callout-radar-expanded.png" });
  await page.keyboard.up("m");
  await expect(page.locator(".radar-wrap")).not.toHaveClass(/expanded/);
  await page.screenshot({ path: "artifacts/callout-radar-hud.png" });
  await page.keyboard.down("m");
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator(".radar-wrap")).not.toHaveClass(/expanded/);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("Dust II casual lobby has balanced teams, textured view arms, and navigation over real floors", async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== "http://127.0.0.1:5173") external.push(r.url());
  });
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      return [
        g.bots.filter((b) => b.team === g.team).length,
        g.bots.filter((b) => b.team !== g.team).length,
      ];
    }),
  ).toEqual([9, 10]);
  const original = await page.evaluate(() => window.__game.bots[0].group.position.toArray());
  await expect
    .poll(() =>
      page.evaluate(
        (original) =>
          window.__game.bots[0].group.position.distanceTo(
            window.__game.position.clone().fromArray(original),
          ),
        original,
      ),
    )
    .toBeGreaterThan(1);
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      return (
        Number.isFinite(g.position.y) && g.bots.every((b) => Number.isFinite(b.group.position.y))
      );
    }),
  ).toBe(true);
  expect(
    await page.evaluate(() => {
      let skinned = 0;
      window.__game.gun.getObjectByName("agent-view-arms")!.traverse((o) => {
        if ("isSkinnedMesh" in o && o.isSkinnedMesh) skinned++;
      });
      return skinned;
    }),
  ).toBeGreaterThan(0);
  await page.keyboard.down("Tab");
  await expect(page.locator("#scoreboard .score-row")).toHaveCount(20);
  await page.keyboard.up("Tab");
  await page.screenshot({ path: "artifacts/dust2-casual.png" });
  await page.evaluate(() => document.exitPointerLock());
  const time = await page.evaluate(() => window.__game.animationTime);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__game.animationTime)).toBeGreaterThan(time);
  const closest = await page.evaluate(() => {
    const g = window.__game,
      ally = g.bots.find((b) => b.team === g.team)!;
    ally.group.position.copy(g.position);
    ally.group.position.x += 0.6;
    ally.navArea = g.dust!.navigation.nearest(ally.group.position);
    ally.velocity.set(0, 0);
    ally.moving = true;
    ally.tracking = false;
    const goal = g.position.clone();
    goal.x -= 2;
    ally.path = [goal];
    let closest = 0.6;
    for (let i = 0; i < 128; i++) {
      g.moveBots(1 / 128);
      closest = Math.min(
        closest,
        Math.hypot(ally.group.position.x - g.position.x, ally.group.position.z - g.position.z),
      );
    }
    return closest;
  });
  expect(closest).toBeGreaterThan(0.59);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("casual bomb interaction, defuse cancellation, elimination and round reset", async ({
  page,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") external.push(request.url());
  });
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  await page.locator("#agent-team").selectOption("t");
  await page.locator("#close-settings").click();
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const dropped = await page.evaluate(() => {
    const g = window.__game;
    // This staged fixture advances the bomb clock explicitly. Releasing pointer
    // lock now keeps the live match running, so suspend its automatic steps here.
    g.simulate = () => {};
    g.locked = false;
    g.dropBomb("player");
    const visible = g.bombMesh.visible;
    const imported = g.bombMesh.getObjectByName("CS2 C4") !== undefined;
    g.updateRound(1 / 128);
    return { visible, imported, pickedUp: g.bomb!.carrier === "player" && !g.bombMesh.visible };
  });
  expect(dropped).toEqual({ visible: true, imported: true, pickedUp: true });
  await page.evaluate(() => {
    const g = window.__game;
    g.position.fromArray(g.dust!.navigation.data.sites[1]);
    g.grounded = true;
    g.keys.add("KeyE");
    g.updateRound(0.3);
  });
  await expect.poll(() => page.evaluate(() => window.__game.bombView.visible)).toBe(true);
  expect(await page.evaluate(() => window.__game.gun.visible)).toBe(false);
  await page.screenshot({ path: "artifacts/plant-start.png" });
  for (const [name, progress] of [
    ["keypad", 1.5],
    ["place", 3.05],
  ] as const) {
    await page.evaluate((progress) => {
      const g = window.__game;
      g.updateRound(progress - g.bomb!.plantProgress);
    }, progress);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `artifacts/plant-${name}.png` });
  }
  const frozen = await page.evaluate(() => window.__game.bomb!.plantProgress);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__game.bomb!.plantProgress)).toBe(frozen);
  await page.keyboard.up("e");
  await page.evaluate(() => window.__game.updateRound(1 / 128));
  await expect.poll(() => page.evaluate(() => window.__game.bombView.visible)).toBe(false);
  expect(await page.evaluate(() => window.__game.gun.visible)).toBe(true);
  expect(await page.evaluate(() => window.__game.bomb!.planted)).toBe(false);
  const attacks = await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    g.position.fromArray(g.dust!.navigation.data.sites[1]);
    g.position.y = g.dust!.collision.floor(g.position.x, g.position.z, g.position.y + 0.5);
    const tryAttacks = () => {
      g.locked = true;
      const guns = [0, 1, 2, 3].map((index) => {
        const mode = g.mode;
        g.mode = "practice";
        g.buy(index);
        g.mode = mode;
        g.cooldown = g.drawTime = 0;
        const ammo = g.ammo;
        g.fire();
        return g.ammo === ammo - 1;
      });
      const knife = [false, true].map((stab) => {
        g.equip(4);
        g.cooldown = g.drawTime = 0;
        if (stab) g.fireKnife(true);
        else g.fire();
        return g.knifePending && g.knifeTime > 0;
      });
      g.locked = false;
      return [...guns, ...knife];
    };
    g.keys.add("KeyE");
    g.updateRound(1 / 128);
    const duringPlant = tryAttacks();
    for (let i = 0; i < 420; i++) g.updateRound(1 / 128);
    const afterPlant = tryAttacks();
    g.keys.delete("KeyE");
    return { duringPlant, afterPlant };
  });
  expect(attacks.duringPlant).toEqual([false, false, false, false, false, false]);
  expect(attacks.afterPlant).toEqual([true, true, true, true, true, true]);
  expect(await page.evaluate(() => window.__game.bomb!.planted)).toBe(true);
  expect(await page.evaluate(() => window.__game.bombMesh.visible)).toBe(true);
  await page.evaluate(() => {
    const g = window.__game,
      bomb = g.bomb!,
      ct = g.bots.find((b) => b.team === "ct")!;
    ct.group.position.copy(bomb.position);
    ct.tracking = false;
    g.bots.filter((b) => b.team === "ct" && b !== ct).forEach((b) => (b.group.position.x += 80));
    g.updateRound(2);
    ct.group.position.x += 4;
    g.updateRound(0.1);
  });
  expect(await page.evaluate(() => window.__game.bomb!.progress)).toBe(0);
  await page.evaluate(() => {
    const g = window.__game,
      ct = g.bots.find((b) => b.team === "ct")!;
    ct.group.position.copy(g.bomb!.position);
    g.updateRound(10.1);
  });
  expect(await page.evaluate(() => window.__game.teamScores.ct)).toBe(1);
  await page.evaluate(() => {
    const g = window.__game;
    g.updateRound(g.rules.roundEndTime + 0.1);
    g.freezeTime = 0;
  });
  expect(
    await page.evaluate(() => [
      window.__game.round,
      window.__game.bomb!.planted,
      window.__game.bots.every((b) => b.health === 100),
    ]),
  ).toEqual([2, false, true]);
  await page.evaluate(() => {
    const g = window.__game;
    g.bots.filter((b) => b.team === "ct").forEach((b) => (b.health = 0));
    g.updateRound(0.01);
  });
  expect(await page.evaluate(() => window.__game.teamScores.t)).toBe(1);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("spectator clicks cycle living teammates, wrap, and recover when the target dies", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const names = await page.evaluate(() => {
    const g = window.__game;
    g.dead = Infinity;
    g.health = 0;
    g.roundPause = 1000; // Freeze combat while exercising real pointer-locked clicks.
    const allies = g.bots.filter((b) => b.team === g.team);
    allies.slice(3).forEach((b) => (b.health = 0));
    g.spectate();
    return allies.slice(0, 3).map((b) => b.name);
  });
  const target = () => page.evaluate(() => window.__game.spectated?.name);
  expect(await target()).toBe(names[0]);
  await page.mouse.click(720, 450);
  await expect.poll(target).toBe(names[1]);
  await page.mouse.click(720, 450, { button: "right" });
  await expect.poll(target).toBe(names[0]);
  await page.mouse.click(720, 450, { button: "right" });
  await expect.poll(target).toBe(names[2]);
  await page.evaluate(() => (window.__game.spectated!.health = 0));
  await expect.poll(target).toBe(names[0]);
  await page.evaluate(() => {
    const g = window.__game;
    g.bots.filter((b) => b.team === g.team && b !== g.spectated).forEach((b) => (b.health = 0));
  });
  await page.mouse.click(720, 450);
  expect(await target()).toBe(names[0]);
  expect(await page.evaluate(() => [window.__game.firing, window.__game.scopeLevel])).toEqual([
    false,
    0,
  ]);
  await page.evaluate(() => (window.__game.spectated!.health = 0));
  await expect.poll(target).toBeUndefined();
  await page.mouse.click(720, 450);
  expect(await target()).toBeUndefined();
  await page.evaluate(() => window.__game.startRound());
  expect(await target()).toBeUndefined();
  expect(await page.evaluate(() => window.__game.dead)).toBe(0);
});

test("spectator chase avoids walls and corpses settle without losing visibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.evaluate(() => {
    const g = window.__game;
    g.dead = Infinity;
    g.health = 0;
    g.roundPause = 1000; // Keep the followed bot stationary during screenshot capture.
    g.spectatorMode = "third";
    g.spectate();
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = window.__game;
        return g.camera.position.distanceTo(g.spectatorFocus);
      }),
    )
    .toBeGreaterThan(0.9);
  await page.screenshot({ path: "artifacts/spectator-chase.png" });
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    const ally = g.spectated!;
    // Both factions' native spawn slot 1 has a real wall within the chase
    // camera's reach. A bot that has run into the open is not an occlusion fixture.
    ally.group.position.fromArray(g.dust!.navigation.data.spawns[ally.team][1]);
    ally.group.position.y = g.world.collision!.floor(
      ally.group.position.x,
      ally.group.position.z,
      ally.group.position.y + 0.5,
    );
    ally.velocity.set(0, 0);
    // Use the real map's closest wall in any heading to exercise camera compression.
    let shortest = Infinity;
    let heading = 0;
    for (let i = 0; i < 32; i++) {
      ally.group.rotation.y = (i * Math.PI) / 16;
      g.spectate();
      const distance = g.camera.position.distanceTo(g.spectatorFocus);
      if (distance < shortest) {
        shortest = distance;
        heading = ally.group.rotation.y;
      }
    }
    ally.group.rotation.y = heading;
    g.spectate();
    const wallHit = g.world.collision!.intersections(g.spectatorRay, 3.1)[0];
    const next = g.bots.find((b) => b.team === g.team && b !== ally && b.health > 0)!;
    ally.health = 0;
    g.spectate();
    return {
      shortest,
      wallDistance: wallHit?.distance,
      next: g.spectated === next,
      visible: ally.group.visible,
    };
  });
  expect(result.wallDistance).toBeDefined();
  expect(result.shortest).toBeLessThan(result.wallDistance!);
  expect(result.next).toBe(true);
  expect(result.visible).toBe(true);
  await page.screenshot({ path: "artifacts/spectator-wall.png" });
  const collapse = await page.evaluate(async () => {
    const modulePath = "/src/soldier.ts";
    const { animateSoldier, resetSoldier, stepSoldierRagdoll } = (await import(
      modulePath
    )) as typeof import("../src/soldier");
    const g = window.__game;
    return (["t", "ct"] as const).map((team) => {
      const rig = g.bots.find((b) => b.team === team)!.rig;
      resetSoldier(rig);
      rig.group.position.set(0, 3, 0);
      rig.group.userData.groundY = 3;
      const initial = rig.ragdollBones.map((b) => b.position.toArray());
      const world = { walls: [] };
      for (let i = 0; i < 128 * 8; i++) stepSoldierRagdoll(rig, 0, 1 / 128, world);
      animateSoldier(rig, 0, 0, false);
      const ragdoll = rig.ragdoll!;
      const lowest = Math.min(...ragdoll.points.map((p) => p.position.y - p.radius));
      const highest = Math.max(...ragdoll.points.map((p) => p.position.y));
      const sleeping = ragdoll.sleeping;
      const positions = ragdoll.points.map((p) => p.position.toArray());
      for (let i = 0; i < 128; i++) stepSoldierRagdoll(rig, 0, 1 / 128, world);
      const stable =
        JSON.stringify(positions) ===
        JSON.stringify(ragdoll.points.map((p) => p.position.toArray()));
      resetSoldier(rig);
      return {
        sleeping,
        stable,
        lowest,
        highest,
        restored:
          JSON.stringify(initial) ===
          JSON.stringify(rig.ragdollBones.map((b) => b.position.toArray())),
        dying: rig.dying,
      };
    });
  });
  for (const corpse of collapse) {
    expect(corpse.sleeping && corpse.stable && corpse.restored).toBe(true);
    expect(corpse.lowest).toBeGreaterThanOrEqual(-0.001);
    expect(corpse.highest).toBeLessThan(0.7);
    expect(corpse.dying).toBe(false);
  }
  expect(errors).toEqual([]);
});

test("spectator wheel modes provide first person, mouse orbit, and independent paused-safe flight", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.evaluate(() => {
    const g = window.__game;
    g.dead = Infinity;
    g.health = 0;
    g.roundPause = 1000;
    g.spectate();
  });
  const mode = () => page.evaluate(() => window.__game.spectatorMode);
  const camera = () => page.evaluate(() => window.__game.camera.position.toArray());
  const wheel = async (delta: number) => {
    await page.waitForFunction(() => performance.now() - window.__game.wheelTime > 110);
    await page.mouse.wheel(0, delta);
  };
  expect(await mode()).toBe("first");
  expect(
    await page.evaluate(
      () => window.__game.camera.position.y - window.__game.spectated!.group.position.y,
    ),
  ).toBeCloseTo(1.6);
  await wheel(120);
  await expect.poll(mode).toBe("third");
  const beforeOrbit = await camera();
  const followed = await page.evaluate(() => window.__game.spectated!.name);
  await page.mouse.move(930, 520);
  await expect.poll(camera).not.toEqual(beforeOrbit);
  expect(await page.evaluate(() => window.__game.spectated!.name)).toBe(followed);
  await wheel(120);
  await expect.poll(mode).toBe("free");
  const body = await page.evaluate(() => window.__game.position.toArray());
  const start = await camera();
  await page.keyboard.down("Space");
  await page.waitForFunction((y) => window.__game.camera.position.y > y + 0.6, start[1]);
  await page.keyboard.up("Space");
  const raised = await camera();
  await page.keyboard.down("Control");
  await page.waitForFunction((y) => window.__game.camera.position.y < y - 0.6, raised[1]);
  await page.keyboard.up("Control");
  const beforeForward = await camera();
  await page.keyboard.down("w");
  await page.waitForFunction((p) => {
    const c = window.__game.camera.position;
    return Math.hypot(c.x - p[0], c.y - p[1], c.z - p[2]) > 1;
  }, beforeForward);
  await page.keyboard.up("w");
  expect(await page.evaluate(() => window.__game.position.toArray())).toEqual(body);
  // Losing pointer lock clears flight input and freezes the view.
  await page.keyboard.down("w");
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__game.locked);
  const paused = await camera();
  await page.waitForTimeout(150);
  expect(await camera()).toEqual(paused);
  await page.keyboard.up("w");
  await page.locator("#resume").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await wheel(-120);
  await expect.poll(mode).toBe("third");
  await wheel(-120);
  await expect.poll(mode).toBe("first");
  await wheel(-120);
  await expect.poll(mode).toBe("free");
  await page.evaluate(() => window.__game.startRound());
  expect(await mode()).toBe("first");
  expect(await page.evaluate(() => window.__game.dead)).toBe(0);
  expect(errors).toEqual([]);
});

test("Tab scoreboard groups teams, tracks alive players and records match progress", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.evaluate(() => {
    window.__game.invulnerable = 99;
  });
  await page.keyboard.down("Tab");
  await expect(page.locator("#scoreboard")).toBeVisible();
  await expect(page.locator(".score-team.ct .score-row")).toHaveCount(10);
  await expect(page.locator(".score-team.t .score-row")).toHaveCount(10);
  await expect(page.locator(".score-team.ct .team-alive")).toHaveText("Alive: 10/10");
  await expect(page.locator(".score-team.t .team-alive")).toHaveText("Alive: 10/10");
  await expect(page.locator(".score-row.you")).toHaveCount(1);
  await expect(page.locator(".score-bomb")).toHaveCount(1);
  await page.evaluate(() => {
    const g = window.__game;
    for (const team of ["t", "ct"] as const) {
      const b = g.bots.find((b) => b.team === team)!;
      b.health = 0;
      b.deaths++;
    }
    g.endRound("ct", "Bomb defused");
  });
  await expect(page.locator(".score-team.ct .team-alive")).toHaveText("Alive: 9/10");
  await expect(page.locator(".score-team.t .team-alive")).toHaveText("Alive: 9/10");
  await expect(page.locator(".score-row.dead")).toHaveCount(2);
  await expect(page.locator(".score-team.ct .team-score")).toHaveText("1");
  await expect(page.locator(".round-slot.ct")).toHaveCount(1);
  await expect(page.locator(".round-slot.ct")).toHaveAttribute(
    "aria-label",
    "Round 1: CT won - Bomb defused",
  );
  await page.screenshot({ path: "artifacts/scoreboard-casual.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: "artifacts/scoreboard-720p.png" });
  const fits = await page.locator("#scoreboard").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight && node.scrollHeight === node.clientHeight;
  });
  expect(fits).toBe(true);
  await page.keyboard.up("Tab");
  await expect(page.locator("#scoreboard")).toBeHidden();
  await page.evaluate(() => {
    window.__game.start("casual");
    window.__game.scoreboard();
  });
  expect(await page.evaluate(() => window.__game.roundHistory.length)).toBe(0);
  await expect(page.locator(".round-slot.ct")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Bayonet default inventory, free primary purchases, slot switching and respawn reset", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== new URL(baseURL!).origin) external.push(r.url());
  });
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await expect(page.locator("#inventory .inventory-weapon")).toHaveCount(2);
  await expect(page.locator("#inventory .active")).toHaveAttribute("aria-label", "USP-S, equipped");
  expect(
    await page.evaluate(() =>
      window.__game.bots.every((b) => b.rig.weaponIndex === (b.team === "t" ? 7 : 2)),
    ),
  ).toBe(true);
  await page.keyboard.press("Digit1");
  await expect(page.locator("#gun-name")).toHaveText("USP-S");
  await page.keyboard.press("Digit3");
  await expect(page.locator("#gun-name")).toHaveText("Bayonet");
  await expect(page.locator("#inventory .active .inventory-key")).toHaveText("3");
  await expect.poll(() => page.evaluate(() => window.__game.drawTime)).toBe(0);
  await page.screenshot({ path: "artifacts/bayonet-viewmodel.png" });
  await page.keyboard.press("r");
  expect(await page.evaluate(() => window.__game.reload)).toBe(0);
  for (const [index, name] of [
    [0, "AK-47"],
    [1, "M4A1-S"],
    [3, "AWP"],
  ] as const) {
    await page.keyboard.press("b");
    await expect(page.locator("#loadout")).toBeVisible();
    await page.locator(`[data-weapon="${index}"]`).click();
    await page.waitForFunction(() => window.__game.locked);
    await page.evaluate(() => {
      window.__game.freezeTime = 0;
    });
    await expect(page.locator("#inventory .inventory-weapon")).toHaveCount(3);
    await expect(page.locator("#inventory .active")).toHaveAttribute(
      "aria-label",
      `${name}, equipped`,
    );
    await expect(page.locator("#inventory .active .inventory-key")).toHaveText("1");
  }
  expect(await page.evaluate(() => window.__game.inventory())).toEqual([3, 2, 4]);
  await page.evaluate(() => {
    const g = window.__game;
    g.ammo = 3;
    g.buy(3);
  });
  expect(await page.evaluate(() => window.__game.ammo)).toBe(3);
  await page.keyboard.press("Digit2");
  await expect(page.locator("#gun-name")).toHaveText("USP-S");
  await page.keyboard.press("Digit1");
  await expect(page.locator("#gun-name")).toHaveText("AWP");
  await page.screenshot({ path: "artifacts/inventory-awp.png" });
  await page.evaluate(() => window.__game.spawnPlayer());
  await expect(page.locator("#inventory .inventory-weapon")).toHaveCount(2);
  expect(await page.evaluate(() => [window.__game.ammo, window.__game.reserve])).toEqual([12, 24]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("Bayonet slash and stab hit once, respect reach and cover, and cancel on switch", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.keyboard.press("Digit3");
  await expect.poll(() => page.evaluate(() => window.__game.drawTime)).toBe(0);
  await page.evaluate(() => {
    const g = window.__game;
    g.yaw = 0;
    g.pitch = Math.atan2(1.2 - g.eye, 1.1);
    g.bots.forEach((b, i) => {
      b.health = i === 0 ? 100 : 0;
      b.armor = 0;
      b.group.visible = i === 0;
      b.respawn = 99;
    });
    g.bots[0].group.position.set(-17, 0, 15.9);
    g.bots[0].group.rotation.set(0, Math.PI, 0);
  });
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__game.bots[0].health)).toBe(60);
  await page.waitForTimeout(550);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect.poll(() => page.evaluate(() => window.__game.bots[0].health)).toBe(0);
  await expect(page.locator('#killfeed img[alt="Bayonet"]')).toBeVisible();
  const result = await page.evaluate(() => {
    const g = window.__game,
      b = g.bots[0];
    const step = () => {
      for (let n = 0; n < 40; n++) g.simulate(1 / 128);
    };
    b.health = 100;
    b.group.visible = true;
    b.group.position.set(-17, 0, 13);
    g.cooldown = 0;
    g.fireKnife();
    step();
    const outOfReach = b.health;
    b.group.position.set(-17, 0, 15.9);
    g.cooldown = 0;
    g.fireKnife();
    g.equip(2);
    step();
    const cancelled = b.health;
    g.equip(4);
    g.cooldown = 0;
    g.position.set(-1, 0, 7);
    g.yaw = 0;
    g.pitch = 0;
    b.group.position.set(-1, 0, 5.2);
    g.fireKnife();
    step();
    const covered = b.health;
    return { outOfReach, cancelled, covered, ammo: g.ammo, pending: g.knifePending };
  });
  expect(result).toEqual({
    outOfReach: 100,
    cancelled: 100,
    covered: 100,
    ammo: 0,
    pending: false,
  });
});

test("both teams keep native wrists on weapon contacts and reset poses", async ({ page }) => {
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const result = await page.evaluate(() => {
    const g = window.__game;
    let wristError = 0,
      resetError = 0;
    for (const team of ["ct", "t"] as const) {
      g.team = team;
      for (let index = 0; index < 5; index++) {
        if (index === 4) g.equip(index);
        else g.buy(index);
        const drawDuration = g.drawTime;
        const rest = g.gun.position.clone();
        let first = true;
        for (const phase of ["idle", "draw", "reload", "bolt", "slash", "stab", "idle"] as const) {
          for (let frame = 0; frame <= 20; frame++) {
            const p = frame / 20;
            g.drawTime = phase === "draw" ? (1 - p) * drawDuration : 0;
            g.reload =
              phase === "reload" && index < 4 ? (1 - p) * ([2.4, 2.2, 1.7, 3.4][index] / 0.9) : 0;
            g.boltTime = phase === "bolt" && index === 3 ? (1 - p) * 1.45 : 0;
            g.knifeStab = phase === "stab";
            g.knifeDuration = (g.knifeStab ? 0.85 : 0.5) / 0.9;
            g.knifeTime =
              index === 4 && (phase === "slash" || phase === "stab")
                ? (1 - p) * g.knifeDuration
                : 0;
            g.kick = 0;
            g.animateWeapon();
            g.gun.updateMatrixWorld(true);
            for (const side of ["L", "R"]) {
              const bone = g.gun.getObjectByName(`hand_${side}`)!;
              const marker = g.gun.getObjectByName(side === "L" ? "left-hand" : "right-hand")!;
              wristError = Math.max(
                wristError,
                bone
                  .getWorldPosition(g.position.clone())
                  .distanceTo(marker.getWorldPosition(g.position.clone())),
              );
            }
            if (first) rest.copy(g.gun.position);
            if (phase === "idle")
              resetError = Math.max(resetError, rest.distanceTo(g.gun.position));
            first = false;
          }
        }
      }
    }
    const lens = g.viewCamera.fov;
    g.settings.fov = 110;
    g.saveSettings();
    return {
      wristError,
      resetError,
      lensStable: g.viewCamera.fov === lens && g.camera.fov === 110,
    };
  });
  expect(result.wristError).toBeLessThan(0.001);
  expect(result.resetError).toBeLessThan(0.0001);
  expect(result.lensStable).toBe(true);
});

test("native Bayonet clips animate fingers, return to idle, and inspection cancels coherently", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== new URL(baseURL!).origin) external.push(r.url());
  });
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const samples = await page.evaluate(() => {
    const g = window.__game;
    g.equip(4);
    const drawDuration = g.drawTime;
    g.locked = false;
    g.drawTime = 0;
    g.weaponTime = 0;
    g.animateWeapon();
    g.gun.updateMatrixWorld(true);
    const model = g.gun.getObjectByName("weapon-model")!;
    const finger = g.gun.getObjectByName("finger_middle_1_R")!;
    const idlePosition = model.position.clone(),
      idleRotation = model.quaternion.clone();
    const closed = finger.quaternion.clone().normalize();
    let opening = 0,
      maxStep = 0,
      maxPositionStep = 0;
    const previous = model.quaternion.clone(),
      previousPosition = model.position.clone();
    for (let frame = 0; frame <= 120; frame++) {
      g.drawTime = (1 - frame / 120) * drawDuration;
      g.animateWeapon();
      g.gun.updateMatrixWorld(true);
      opening = Math.max(opening, closed.angleTo(finger.quaternion.clone().normalize()));
      if (frame > 0) {
        maxStep = Math.max(maxStep, previous.angleTo(model.quaternion));
        maxPositionStep = Math.max(maxPositionStep, previousPosition.distanceTo(model.position));
      }
      previous.copy(model.quaternion);
      previousPosition.copy(model.position);
    }
    const reset = idlePosition.distanceTo(model.position) + idleRotation.angleTo(model.quaternion);
    g.drawTime = 0.00001;
    g.animateWeapon();
    const join = idlePosition.distanceTo(model.position) + idleRotation.angleTo(model.quaternion);
    g.drawTime = 0;
    g.inspectTime = 3;
    g.animateWeapon();
    g.gun.updateMatrixWorld(true);
    const inspected = model.matrixWorld.clone();
    g.animateWeapon();
    g.gun.updateMatrixWorld(true);
    const frozen = inspected.equals(model.matrixWorld);
    g.locked = true;
    g.inspectTime = 0;
    g.cooldown = 0;
    return { opening, maxStep, maxPositionStep, reset, join, frozen };
  });
  expect(samples.opening).toBeGreaterThan(0.3);
  expect(samples.maxStep).toBeLessThan(0.4);
  expect(samples.maxPositionStep).toBeLessThan(0.04);
  expect(samples.reset).toBeLessThan(0.001);
  expect(samples.join).toBeLessThan(0.025);
  expect(samples.frozen).toBe(true);
  await page.keyboard.press("f");
  expect(await page.evaluate(() => window.__game.inspectTime)).toBeGreaterThan(5);
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.inspectTime)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__game.cooldown)).toBe(0);
  const first = await page.evaluate(() => window.__game.knifeAlternate);
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.knifeAlternate)).toBe(!first);
  await expect.poll(() => page.evaluate(() => window.__game.cooldown)).toBe(0);
  await page.keyboard.press("f");
  await page.keyboard.press("Digit2");
  expect(await page.evaluate(() => window.__game.inspectTime)).toBe(0);
  await page.keyboard.press("Digit3");
  await page.keyboard.press("f");
  expect(await page.evaluate(() => window.__game.inspectDraw)).toBe(true);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__game.locked);
  const paused = await page.evaluate(() => window.__game.animationTime);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__game.animationTime)).toBeGreaterThan(paused);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("firearm inspection cancels for shots, reloads, scopes, and switching without pose drift", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.bringToFront();
  // Legacy modes remain useful as isolated gameplay fixtures, outside the lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const samples = await page.evaluate(() => {
    const g = window.__game;
    const inspect = () => document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    const samples = [];
    for (let i = 0; i < 4; i++) {
      g.buy(i);
      g.drawTime = g.cooldown = 0;
      g.animateWeapon();
      g.animationTime += 0.1;
      g.animateWeapon();
      const hand = g.gun.getObjectByName("hand_R")!;
      const position = () => hand.getWorldPosition(g.position.clone());
      const idle = position();
      inspect();
      const duration = g.inspectTime;
      g.inspectTime *= 0.6;
      g.animationTime += 0.1;
      g.animateWeapon();
      g.animationTime += 0.1;
      g.animateWeapon();
      const motion = position().distanceTo(idle);
      const ammo = g.ammo;
      g.fire();
      const fired = g.ammo === ammo - 1 && g.inspectTime === 0;
      // Repeated renders during an interrupted transition must be identical.
      g.animateWeapon();
      g.animationTime += 0.04;
      g.animateWeapon();
      const paused = position();
      for (let frame = 0; frame < 10; frame++) g.animateWeapon();
      const drift = position().distanceTo(paused);
      g.shotTime = g.boltTime = g.cooldown = 0;
      inspect();
      g.beginReload();
      const reloaded = g.reload > 0 && g.inspectTime === 0;
      g.reload = 0;
      inspect();
      g.equip(4);
      const switched = g.inspectTime === 0;
      samples.push({ duration, motion, fired, drift, reloaded, switched });
    }
    g.buy(3);
    g.drawTime = g.cooldown = g.boltTime = 0;
    inspect();
    g.cycleScope();
    return { samples, scope: g.scopeLevel === 1 && g.inspectTime === 0 };
  });
  for (const sample of samples.samples) {
    expect(sample.duration).toBeGreaterThan(2);
    expect(sample.motion).toBeGreaterThan(0.02);
    expect(sample.fired).toBe(true);
    expect(sample.drift).toBeLessThan(0.000001);
    expect(sample.reloaded).toBe(true);
    expect(sample.switched).toBe(true);
  }
  expect(samples.scope).toBe(true);
  expect(errors).toEqual([]);
});

test("source agent poses animate both factions and crouch lowers the body", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#play").click();
  await page.locator('[data-team="t"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    g.useWorld();
    g.scopeLevel = 1;
    g.world.root.traverse((object) => {
      if ("isMesh" in object) object.visible = false;
    });
    g.camera.fov = 50;
    g.camera.updateProjectionMatrix();
    g.camera.position.set(0, 1.4, 4.5);
    g.camera.lookAt(0, 0.9, 0);
    g.bots.forEach((b) => {
      b.group.visible = false;
      b.anim = 0;
    });
    for (const [i, team] of (["t", "ct"] as const).entries()) {
      const b = g.bots.find((b) => b.team === team)!;
      b.group.visible = b.rig.model.visible = true;
      b.group.position.set(i * 2 - 1, 0, 0);
      b.group.rotation.set(0, 0, 0);
    }
  });
  const heights: number[][] = [];
  for (const pose of ["idle", "walk", "run", "crouch", "air", "shoot", "plant"]) {
    heights.push(
      await page.evaluate(async (pose) => {
        const { animateSoldier, resetSoldier } = (await import(
          "/src/soldier.ts" as string
        )) as typeof import("../src/soldier");
        const g = window.__game;
        return (["t", "ct"] as const).map((team) => {
          const rig = g.bots.find((b) => b.team === team)!.rig;
          resetSoldier(rig);
          rig.crouch = pose === "crouch" ? 1 : 0;
          rig.airborne = pose === "air";
          rig.plant = pose === "plant" ? 0.5 : 0;
          rig.moveX = pose === "walk" ? 1 : 0;
          rig.moveZ = pose === "run" ? 1 : 0;
          for (let i = 0; i < 32; i++)
            animateSoldier(rig, pose === "run" ? 3.6 : pose === "walk" ? 1.5 : 0, 1 / 60, true);
          if (pose === "shoot") {
            rig.shotTime = 0.2;
            animateSoldier(rig, 0, 0, true);
          }
          rig.group.updateMatrixWorld(true);
          for (const action of rig.activeActions)
            if (!Number.isFinite(action.time))
              throw new Error(`Invalid animation time: ${action.getClip().name}`);
          return rig.head.getWorldPosition(g.position.clone()).y;
        });
      }, pose),
    );
    await page.waitForTimeout(80);
    await page.screenshot({ path: `artifacts/agents-${pose}.png` });
  }
  for (let i = 0; i < 2; i++) {
    expect(heights[3][i]).toBeLessThan(heights[0][i] - 0.25);
    for (const pose of heights) expect(pose[i]).toBeGreaterThan(0.4);
  }
  expect(
    await page.evaluate(async () => {
      const { animateSoldier } = (await import(
        "/src/soldier.ts" as string
      )) as typeof import("../src/soldier");
      return (["t", "ct"] as const).every((team) => {
        const rig = window.__game.bots.find((b) => b.team === team)!.rig;
        animateSoldier(rig, 0, 1 / 60, false);
        return !rig.carriedBomb.visible;
      });
    }),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("default Butterfly and Karambit share knife slot and play source actions", async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== "http://127.0.0.1:5173") external.push(r.url());
  });
  await page.goto("/");
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  for (const [index, name] of [
    [5, "Butterfly Knife"],
    [6, "Karambit"],
  ] as const) {
    await page.evaluate(() => document.exitPointerLock());
    await page.locator("#pause-skins").click();
    await page.locator(`[data-skin-weapon="${index}"]`).click();
    await page.locator("#equip-knife").click();
    await page.locator("#close-skins").click();
    await page.locator("#resume").click();
    await page.waitForFunction(() => window.__game.locked);
    await page.evaluate(() => {
      window.__game.freezeTime = 0;
    });
    await expect(page.locator("#gun-name")).toHaveText(name);
    expect(await page.evaluate(() => window.__game.inventory())).toEqual([2, index]);
    await expect.poll(() => page.evaluate(() => window.__game.cooldown)).toBe(0);
    await page.mouse.click(700, 400);
    await expect.poll(() => page.evaluate(() => window.__game.knifeTime)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.__game.cooldown)).toBe(0);
    await page.mouse.click(700, 400, { button: "right" });
    expect(await page.evaluate(() => window.__game.knifeStab)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__game.cooldown)).toBe(0);
    await page.keyboard.press("f");
    await expect.poll(() => page.evaluate(() => window.__game.inspectTime)).toBeGreaterThan(0);
    // Sample source poses with simulation frozen for visual review.
    await page.evaluate(() => {
      window.__game.locked = false;
    });
    for (const phase of ["idle", "draw", "slash", "stab", "inspect0", "inspect1", "inspect2"]) {
      const finite = await page.evaluate((phase) => {
        const g = window.__game;
        g.drawTime = g.knifeTime = g.inspectTime = 0;
        if (phase === "draw") {
          g.equip(g.selected);
          g.drawTime *= 0.55;
        }
        if (phase === "slash" || phase === "stab") {
          g.knifeStab = phase === "stab";
          g.knifeTime = g.knifeDuration * 0.55;
        }
        if (phase.startsWith("inspect")) {
          g.inspectVariant = Number(phase.at(-1));
          g.inspectTime = g.inspectDuration() * 0.55;
        }
        g.animateWeapon();
        g.gun.updateMatrixWorld(true);
        let finite = true;
        g.gun.traverse((o) => {
          finite &&= o.matrixWorld.elements.every(Number.isFinite);
        });
        return finite;
      }, phase);
      expect(finite).toBe(true);
      await page.screenshot({ path: `artifacts/knife-${index}-${phase}.png` });
    }
    await page.evaluate(() => {
      const g = window.__game;
      g.locked = true;
      g.equip(2);
    });
    expect(await page.evaluate(() => window.__game.inspectTime)).toBe(0);
    await expect.poll(() => page.evaluate(() => window.__game.cooldown)).toBe(0);
    await page.mouse.click(700, 400);
    expect(await page.evaluate(() => window.__game.ammo)).toBe(11);
    await page.keyboard.press("3");
    expect(await page.evaluate(() => window.__game.selected)).toBe(index);
    await page.evaluate(() => window.__game.spawnPlayer());
    expect(await page.evaluate(() => window.__game.inventory())).toEqual([2, index]);
  }
  await page.evaluate(() => document.exitPointerLock());
  await page.locator("#pause-skins").click();
  await page.locator('[data-skin-weapon="4"]').click();
  await page.locator("#equip-knife").click();
  await expect(page.locator("#gun-name")).toHaveText("Bayonet");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("R F reverses knife inspections without skipping draw or attack lockouts", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const draws = await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    return [0, 1, 2, 3, 4, 5, 6].map((index) => {
      g.buy(index);
      const duration = g.drawTime;
      for (let i = 0; i < Math.floor(duration * 128 * 0.7); i++) g.simulate(1 / 128);
      g.locked = true;
      const ammo = g.ammo;
      g.fire();
      g.locked = false;
      const blocked = g.ammo === ammo && g.knifeTime === 0;
      const remaining = g.drawTime;
      for (let i = 0; i < Math.ceil(duration * 128); i++) g.simulate(1 / 128);
      return { duration, blocked, remaining, finished: g.drawTime === 0 };
    });
  });
  for (const draw of draws) {
    expect(draw.duration).toBeGreaterThan(0.3);
    expect(draw.duration).toBeLessThan(3);
    expect(draw.blocked).toBe(true);
    expect(draw.remaining).toBeGreaterThan(0);
    expect(draw.finished).toBe(true);
  }
  await page.evaluate(() => {
    window.__game.locked = true;
  });
  for (const index of [4, 5, 6, 2]) {
    await page.evaluate((index) => {
      const g = window.__game;
      g.buy(index);
      g.drawTime = g.cooldown = g.boltTime = 0;
    }, index);
    const variants = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("f");
      expect(await page.evaluate(() => window.__game.inspectTime)).toBeGreaterThan(0);
      variants.push(await page.evaluate(() => window.__game.inspectVariant));
      await page.keyboard.press("r");
      expect(await page.evaluate(() => window.__game.reload)).toBe(0);
      await expect.poll(() => page.evaluate(() => window.__game.inspectTime)).toBe(0);
    }
    expect(new Set(variants).size).toBe(3);
  }
  await page.evaluate(() => {
    const g = window.__game;
    g.buy(6);
    g.cooldown = g.drawTime = 0;
    g.fireKnife(true);
  });
  await page.keyboard.press("r");
  await page.keyboard.press("f");
  expect(await page.evaluate(() => window.__game.inspectTime)).toBe(0);
  expect(await page.evaluate(() => window.__game.knifeTime)).toBeGreaterThan(0);
});

test("Karambit wrist roll deforms the forearm smoothly through inspection", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.buy(6);
    g.locked = false;
    g.drawTime = 0;
    const wrist = g.gun.getObjectByName("arm_lower_R_twist1")!;
    const rest = wrist.quaternion.clone(),
      previous = rest.clone();
    let motion = 0,
      maxStep = 0;
    for (let i = 0; i <= 240; i++) {
      g.inspectTime = g.inspectDuration() * (1 - i / 241);
      g.animateWeapon();
      motion = Math.max(motion, rest.angleTo(wrist.quaternion));
      if (i > 0) maxStep = Math.max(maxStep, previous.angleTo(wrist.quaternion));
      previous.copy(wrist.quaternion);
    }
    g.inspectTime = g.inspectDuration() * 0.55;
    g.animateWeapon();
    const paused = wrist.quaternion.clone();
    for (let i = 0; i < 20; i++) g.animateWeapon();
    return { motion, maxStep, drift: paused.angleTo(wrist.quaternion) };
  });
  expect(result.motion).toBeGreaterThan(0.5);
  expect(result.maxStep).toBeLessThan(0.2);
  expect(result.drift).toBeLessThan(0.000001);
  await page.screenshot({ path: "artifacts/karambit-wrist-fixed.png" });
});

test("inspect rewind preserves the pose on R and F and returns to idle", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  const results = await page.evaluate(() => {
    const g = window.__game;
    const press = (code: string) => document.dispatchEvent(new KeyboardEvent("keydown", { code }));
    return [4, 5, 6, 2].map((index) => {
      g.buy(index);
      g.drawTime = g.cooldown = 0;
      g.locked = true;
      press("KeyF");
      g.inspectTime = g.inspectDuration() * 0.6;
      g.animationTime += 0.1;
      g.animateWeapon();
      g.animationTime += 0.1;
      g.animateWeapon();
      const hand = g.gun.getObjectByName("hand_R")!;
      const pose = () => {
        g.gun.updateMatrixWorld(true);
        return hand.matrixWorld.clone();
      };
      const before = pose(),
        time = g.inspectTime;
      press("KeyR");
      g.animateWeapon();
      const afterR = pose();
      g.simulate(0.1);
      g.animateWeapon();
      const reversed = g.inspectTime > time;
      const rewind = pose();
      press("KeyF");
      g.animateWeapon();
      const afterF = pose();
      const resumedTime = g.inspectTime;
      g.simulate(0.05);
      g.animateWeapon();
      const resumed = g.inspectTime < resumedTime && !g.inspectRewinding;
      press("KeyR");
      const frozenTime = g.inspectTime;
      g.animateWeapon();
      g.animateWeapon();
      const frozen = g.inspectTime === frozenTime;
      for (let i = 0; i < 1600 && g.inspectTime > 0; i++) g.simulate(1 / 128);
      const error = (a: typeof before, b: typeof before) =>
        Math.max(...a.elements.map((v, i) => Math.abs(v - b.elements[i])));
      return {
        jumpR: error(before, afterR),
        jumpF: error(rewind, afterF),
        reversed,
        resumed,
        frozen,
        finished: g.inspectTime === 0 && !g.inspectRewinding,
      };
    });
  });
  for (const r of results) {
    expect(r.jumpR).toBeLessThan(0.000001);
    expect(r.jumpF).toBeLessThan(0.000001);
    expect(r.reversed).toBe(true);
    expect(r.resumed).toBe(true);
    expect(r.frozen).toBe(true);
    expect(r.finished).toBe(true);
  }
});

test("ragdolls fall from the air, articulate both factions, and land on map surfaces", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="t"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.evaluate(async () => {
    const path = "/src/soldier.ts";
    const { resetSoldier } = (await import(path)) as typeof import("../src/soldier");
    const g = window.__game;
    // This fixture advances ragdoll physics directly between screenshots.
    g.simulate = () => {};
    g.locked = false;
    g.useWorld();
    g.scopeLevel = 1;
    g.camera.fov = 48;
    g.camera.updateProjectionMatrix();
    g.camera.position.set(0, 3.5, 14);
    g.camera.lookAt(0, 0.7, 11);
    for (const b of g.bots) {
      b.group.visible = false;
      b.anim = 0;
    }
    for (const [i, team] of (["t", "ct"] as const).entries()) {
      const b = g.bots.find((b) => b.team === team)!;
      resetSoldier(b.rig);
      b.group.visible = b.rig.model.visible = true;
      b.group.position.set(i * 2.5 - 1.25, 1.5, 10);
      b.group.rotation.set(0, i ? -0.5 : 0.5, 0);
      b.rig.moveX = i ? 0.7 : -0.7;
    }
  });
  for (const [label, steps] of [
    ["air", 24],
    ["impact", 48],
    ["settled", 640],
  ] as const) {
    const heights = await page.evaluate(async (steps) => {
      const path = "/src/soldier.ts";
      const { stepSoldierRagdoll, animateSoldier } = (await import(
        path
      )) as typeof import("../src/soldier");
      const g = window.__game;
      return (["t", "ct"] as const).map((team) => {
        const b = g.bots.find((b) => b.team === team)!;
        for (let i = 0; i < steps; i++) stepSoldierRagdoll(b.rig, -1, 1 / 128, g.world);
        animateSoldier(b.rig, 0, 0, false);
        return Math.max(...b.rig.ragdoll!.points.map((p) => p.position.y));
      });
    }, steps);
    await page.screenshot({ path: `artifacts/ragdoll-${label}.png` });
    if (label === "settled") for (const height of heights) expect(height).toBeLessThan(0.7);
  }
  const drops = await page.evaluate(async () => {
    const path = "/src/soldier.ts";
    const { resetSoldier, stepSoldierRagdoll } = (await import(
      path
    )) as typeof import("../src/soldier");
    const g = window.__game;
    const rig = g.bots.find((b) => b.team === "ct")!.rig;
    resetSoldier(rig);
    rig.group.position.set(2.2, 4.7, -5);
    rig.group.rotation.set(0, 0, 0);
    rig.group.userData.groundY = 4.7;
    rig.moveX = 3;
    for (let i = 0; i < 1024; i++) stepSoldierRagdoll(rig, 0, 1 / 128, g.world);
    const ledge = Math.max(...rig.ragdoll!.points.map((p) => p.position.y));
    resetSoldier(rig);
    rig.group.position.set(0, 12, 10);
    rig.moveX = rig.moveZ = 0;
    const fixturePath = "/tests/flat-collision-fixture.ts";
    const { flatCollisionFixture } = (await import(
      fixturePath
    )) as typeof import("./flat-collision-fixture");
    flatCollisionFixture(g);
    const collision = g.world.collision;
    for (let i = 0; i < 1024; i++) stepSoldierRagdoll(rig, 0, 1 / 128, { collision, walls: [] });
    return {
      ledge,
      high: Math.max(...rig.ragdoll!.points.map((p) => p.position.y)),
      low: Math.min(...rig.ragdoll!.points.map((p) => p.position.y)),
    };
  });
  expect(drops.ledge).toBeLessThan(0.8);
  expect(drops.high).toBeLessThan(0.8);
  expect(drops.low).toBeGreaterThan(0);
  // Repeat on the actual imported Dust II triangles, above a spawn surface.
  const contacts = await page.evaluate(async () => {
    const path = "/src/soldier.ts";
    const { resetSoldier, stepSoldierRagdoll } = (await import(
      path
    )) as typeof import("../src/soldier");
    const g = window.__game;
    g.useWorld();
    return (["t", "ct"] as const).map((team) => {
      const rig = g.bots.find((b) => b.team === team)!.rig;
      resetSoldier(rig);
      rig.group.position.copy(g.position);
      const floor = g.world.collision!.floor(g.position.x, g.position.z, g.position.y + 1, -100);
      if (!Number.isFinite(floor))
        throw new Error("Native ragdoll fixture requires a supported spawn");
      rig.group.position.y = floor + 2;
      rig.moveX = rig.moveZ = 0;
      for (let i = 0; i < 768; i++) stepSoldierRagdoll(rig, 0, 1 / 128, g.world);
      return {
        highest: Math.max(...rig.ragdoll!.points.map((p) => p.position.y)) - floor,
        lowest: Math.min(...rig.ragdoll!.points.map((p) => p.position.y)) - floor,
      };
    });
  });
  for (const contact of contacts) {
    expect(contact.highest).toBeLessThan(0.8);
    expect(contact.lowest).toBeGreaterThan(-0.1);
  }
  expect(errors).toEqual([]);
});
