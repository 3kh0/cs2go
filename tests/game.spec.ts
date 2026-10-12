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
  await expect(page.getByRole("heading", { name: "ONE MORE ROUND." })).toBeVisible();
  await page.locator("#settings-button").click();
  await page.locator("#sensitivity").fill("1.7");
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
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
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
  await expect(page.locator("#gun-name")).toHaveText("M4A1-S");
  await page.keyboard.press("b");
  await expect(page.locator("#loadout")).toBeVisible();
  await page.locator('[data-weapon="2"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await expect(page.locator("#gun-name")).toHaveText("USP-S");
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
  const time = await page.evaluate(() => window.__game.time);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__game.time)).toBe(time);
  await page.locator("#resume").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.screenshot({ path: "artifacts/gameplay.png" });
  expect(errors).toEqual([]);
});
test("hitscan headshots, wall occlusion, reload conservation, and target respawns", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
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
  await page.keyboard.press("r");
  await expect(page.locator("#reload-label")).toHaveText("RELOADING…");
  await expect.poll(() => page.evaluate(() => window.__game.ammo), { timeout: 4000 }).toBe(30);
  expect(await page.evaluate(() => window.__game.reserve)).toBe(89);
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
  await page.getByRole("button", { name: "DEATHMATCH", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
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
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.keyboard.press("b");
  await page.locator('[data-weapon="3"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await expect(page.locator("#gun-name")).toHaveText("AWP");
  await expect(page.locator("#ammo")).toHaveText("10");
  await expect(page.locator("#crosshair")).toHaveClass("hidden");
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      const mesh = g.gun.getObjectByName("receiver") as import("three").Mesh;
      return mesh.geometry.attributes.position.count;
    }),
  ).toBeGreaterThan(10000);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect(page.locator("#scope")).toBeVisible();
  expect(await page.evaluate(() => window.__game.camera.fov)).toBe(40);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  expect(await page.evaluate(() => window.__game.camera.fov)).toBe(10);
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
  await expect(page.locator("#ammo")).toHaveText("9");
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.ammo)).toBe(9);
  expect(await page.evaluate(() => window.__game.gun.getObjectByName("bolt") !== undefined)).toBe(
    true,
  );
  await expect.poll(() => page.evaluate(() => window.__game.scopeLevel), { timeout: 3000 }).toBe(2);
  await page.keyboard.press("r");
  await expect(page.locator("#scope")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__game.ammo), { timeout: 5000 }).toBe(10);
  expect(await page.evaluate(() => window.__game.reserve)).toBe(29);
  // A third right click returns to the original unscoped FOV.
  for (let i = 0; i < 3; i++) {
    await page.mouse.down({ button: "right" });
    await page.mouse.up({ button: "right" });
  }
  await expect(page.locator("#scope")).toBeHidden();
  expect(await page.evaluate(() => window.__game.camera.fov)).toBe(90);
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
  await page.getByRole("button", { name: "DEATHMATCH", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
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
    b.respawn = 3;
  });
  await expect
    .poll(() => page.evaluate(() => window.__game.bots[0].group.rotation.x))
    .toBeGreaterThan(1);
});

test("supplied weapon audio decodes, plays, and follows reload and AWP timing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
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
    game.ammo = 9;
    game.beginReload();
    for (let tick = 0; tick < 450; tick++) game.simulate(1 / 128);
    const reload = [...events];
    events.length = 0;
    game.boltTime = 1.45;
    for (let tick = 0; tick < 190; tick++) game.simulate(1 / 128);
    const bolt = [...events];
    events.length = 0;
    game.ammo = 9;
    game.beginReload();
    game.buy(0);
    for (let tick = 0; tick < 450; tick++) game.simulate(1 / 128);
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
    };
  });
  expect(result.decoded).toBe(true);
  expect(result.clips).toBe(23);
  expect(result.shots).toEqual(["ak47-1", "m4a1-1-single", "usp1", "awp1"]);
  expect(result.voices).toBeGreaterThanOrEqual(4);
  expect(result.scope).toBe("zoom");
  expect(result.reload).toEqual(["awp_clipout", "awp_clipin", "awp_boltback", "awp_boltforward"]);
  expect(result.bolt).toEqual(["awp_boltback", "awp_boltforward"]);
  expect(result.cancelled).toEqual(["awp_clipout", "ak47_draw", "ak47_boltpull"]);
  expect(result.interruptedDraw).toEqual(["m4a1_draw"]);
  expect(result.rejectedReloadPreservesDraw).toBe(true);
  expect(result.muted).toBe(true);
  expect(result.audioState).toBe("running");
  await expect.poll(() => page.evaluate(() => window.__game.weaponAudio.voices.size)).toBe(0);
  expect(errors).toEqual([]);
});

test("wheel cycles and wraps; AWP hits aligned enemies once each with penetration metadata", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.mouse.wheel(0, -120);
  await expect(page.locator("#gun-name")).toHaveText("M9 Bayonet");
  await page.waitForTimeout(120);
  await page.mouse.wheel(0, 120);
  await expect(page.locator("#gun-name")).toHaveText("USP-S");
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.buy(3);
    g.drawTime = g.cooldown = 0;
    g.scopeSettle = 0;
    g.setScope(1);
    g.scopeSettle = 0;
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
  expect(result.ammo).toBe(9);
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
    g.scopeSettle = 0;
    g.yaw = 0;
    g.pitch = Math.atan2(1.2 - g.eye, 13);
    g.bots.slice(0, 2).forEach((b, i) => {
      b.health = 100;
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

test("weapon tracks keep bolt shaft connected, hands follow magazines, and reset on cancel", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    const animateGun = (_gun: unknown, pose: { reload: number; draw: number; bolt: number }) => {
      g.reload = pose.reload ? (1 - pose.reload) * [2.4, 2.2, 1.7, 3.4][g.selected] : 0;
      g.drawTime = pose.draw * 0.55;
      g.boltTime = pose.bolt ? (1 - pose.bolt) * 1.45 : 0;
      g.kick = 0;
      g.animateWeapon();
    };
    const pose = { reload: 0, draw: 0, bolt: 0, recoil: 0, bob: 0, sway: 0 };
    const samples = [];
    for (let i = 0; i < 4; i++) {
      g.buy(i);
      const mag = g.gun.getObjectByName("magazine")!;
      const left = g.gun.getObjectByName("left-hand")!;
      animateGun(g.gun, pose);
      const rest = mag.position.clone();
      animateGun(g.gun, { ...pose, reload: 0.26 });
      const removed = rest.distanceTo(mag.position);
      const contactDistance = left.position.distanceTo(mag.position);
      animateGun(g.gun, { ...pose, reload: 0.5 });
      const inserted = rest.distanceTo(mag.position);
      animateGun(g.gun, pose);
      const reset = rest.distanceTo(mag.position);
      samples.push({ removed, contactDistance, inserted, reset });
    }
    const bolt = g.gun.getObjectByName("bolt")!;
    const shaft = g.gun.getObjectByName("bolt-shaft")!;
    animateGun(g.gun, pose);
    const rest = bolt.position.clone();
    const hand = g.gun.getObjectByName("right-hand")!;
    animateGun(g.gun, { ...pose, bolt: 0.55 });
    const travel = bolt.position.distanceTo(rest),
      rotation = bolt.rotation.z;
    // The wrist sits behind the action; its palm contact follows the knob.
    const palm = hand.position
      .clone()
      .set(0, 0, -0.065)
      .applyQuaternion(hand.quaternion)
      .add(hand.position);
    const handDistance = palm.distanceTo(bolt.position);
    animateGun(g.gun, { ...pose, draw: 1 });
    const drawY = g.gun.position.y;
    animateGun(g.gun, pose);
    return {
      samples,
      travel,
      rotation,
      handDistance,
      drawY,
      shaftParent: shaft.parent === bolt,
      restored: bolt.position.distanceTo(rest),
    };
  });
  for (const sample of result.samples) {
    expect(sample.removed).toBeGreaterThan(0.18);
    expect(sample.contactDistance).toBeLessThan(0.07);
    expect(sample.inserted).toBe(0);
    expect(sample.reset).toBe(0);
  }
  expect(result.shaftParent).toBe(true);
  expect(result.travel).toBeCloseTo(0.07);
  expect(result.rotation).toBeCloseTo(1.08);
  expect(result.handDistance).toBeLessThan(0.07);
  expect(result.drawY).toBeLessThan(-0.5);
  expect(result.restored).toBe(0);
});

test("thin wood transmits a bullet but thick masonry stops it", async ({ page }) => {
  await page.goto("/");
  await page.bringToFront();
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(async () => {
    // Reuse an existing BoxGeometry and material so the test exercises the
    // production raycast and world-material path without another Three module.
    const g = window.__game;
    g.buy(3);
    g.drawTime = g.cooldown = 0;
    g.yaw = g.pitch = 0;
    g.setScope(1);
    g.scopeSettle = 0;
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
    g.scopeSettle = 0;
    g.fire();
    return { thin, thick: g.bots[0].health };
  });
  expect(result.thin).toBeLessThanOrEqual(0);
  expect(result.thick).toBe(100);
});

test("agent side selection, independent rigs, and paused animation", async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") external.push(request.url());
  });
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#agent-team").selectOption("t");
  await page.getByRole("button", { name: "DEATHMATCH", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
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
  const pose = await page.evaluate(() => window.__game.bots[0].rig.hips[0].quaternion.toArray());
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__game.bots[0].rig.hips[0].quaternion.toArray())).toEqual(
    pose,
  );
  await page.locator("#leave").click();
  await page.locator("#agent-team").selectOption("ct");
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
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
  await page.waitForFunction(() => window.__game.locked);
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
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    g.world.walls.push({ x: 100, z: 100, w: 4, d: 4, y: 1.3, h: 4 });
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
  expect(result.standing).toBeCloseTo(1.65);
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
  await page.waitForFunction(() => window.__game.locked);
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
  await page.waitForFunction(() => window.__game.locked);
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
  const time = await page.evaluate(() => window.__game.time);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__game.time)).toBe(time);
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
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#agent-team").selectOption("t");
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    g.position.fromArray(g.dust!.navigation.data.sites[1]);
    g.position.y = g.dust!.collision.floor(g.position.x, g.position.z, g.position.y + 0.5);
    g.keys.add("KeyE");
    for (let i = 0; i < 420; i++) g.updateRound(1 / 128);
    g.keys.delete("KeyE");
  });
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
    g.updateRound(5.1);
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
});

test("spectator chase avoids walls and corpses settle without losing visibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.bringToFront();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.dead = Infinity;
    g.health = 0;
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
    const { animateSoldier, resetSoldier } = (await import(
      modulePath
    )) as typeof import("../src/soldier");
    const g = window.__game;
    const rigs = [
      g.bots.find((b) => b.team === "t")!.rig,
      g.bots.find((b) => b.team === "ct")!.rig,
    ];
    return rigs.map((rig) => {
      resetSoldier(rig);
      const initial = rig.joints.map((j) => j.bone.quaternion.toArray());
      for (let i = 0; i < 384; i++) animateSoldier(rig, 0, 1 / 128, false);
      const settled = rig.joints.map((j) => j.bone.quaternion.toArray());
      const position = rig.group.position.toArray();
      const floor = rig.group.userData.groundY as number;
      const lowest = Math.min(...rig.contacts.map((b) => b.getWorldPosition(rig.grip).y));
      for (let i = 0; i < 128; i++) animateSoldier(rig, 0, 1 / 128, false);
      const sleeping =
        JSON.stringify(settled) ===
        JSON.stringify(rig.joints.map((j) => j.bone.quaternion.toArray()));
      const stable = JSON.stringify(position) === JSON.stringify(rig.group.position.toArray());
      const changed = JSON.stringify(initial) !== JSON.stringify(settled);
      resetSoldier(rig);
      return {
        sleeping,
        stable,
        changed,
        lowest,
        floor,
        pitch: rig.group.rotation.x,
        dying: rig.dying,
      };
    });
  });
  for (const corpse of collapse) {
    expect(corpse.sleeping && corpse.stable && corpse.changed).toBe(true);
    expect(corpse.lowest).toBeGreaterThanOrEqual(corpse.floor + 0.069);
    expect(corpse.pitch).toBe(0);
    expect(corpse.dying).toBe(false);
  }
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
  await page.waitForFunction(() => window.__game.locked);
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
    "Round 1: CT won · Bomb defused",
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

test("M9 default inventory, free primary purchases, slot switching and respawn reset", async ({
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
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await expect(page.locator("#inventory .inventory-weapon")).toHaveCount(2);
  await expect(page.locator("#inventory .active")).toHaveAttribute("aria-label", "USP-S, equipped");
  expect(await page.evaluate(() => window.__game.bots.every((b) => b.rig.weaponIndex === 2))).toBe(
    true,
  );
  await page.keyboard.press("Digit1");
  await expect(page.locator("#gun-name")).toHaveText("USP-S");
  await page.keyboard.press("Digit3");
  await expect(page.locator("#gun-name")).toHaveText("M9 Bayonet");
  await expect(page.locator("#inventory .active .inventory-key")).toHaveText("3");
  await page.waitForTimeout(650);
  await page.screenshot({ path: "artifacts/m9-viewmodel.png" });
  await page.keyboard.press("r");
  expect(await page.evaluate(() => window.__game.reload)).toBe(0);
  for (const [index, name] of [
    [0, "AK-47"],
    [1, "M4A1-S"],
    [3, "AWP"],
  ] as const) {
    await page.keyboard.press("b");
    await expect(page.getByRole("heading", { name: "BUY MENU" })).toBeVisible();
    await page.locator(`[data-weapon="${index}"]`).click();
    await page.waitForFunction(() => window.__game.locked);
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
    g.ammo = 7;
    g.buy(3);
  });
  expect(await page.evaluate(() => window.__game.ammo)).toBe(7);
  await page.keyboard.press("Digit2");
  await expect(page.locator("#gun-name")).toHaveText("USP-S");
  await page.keyboard.press("Digit1");
  await expect(page.locator("#gun-name")).toHaveText("AWP");
  await page.screenshot({ path: "artifacts/inventory-awp.png" });
  await page.evaluate(() => window.__game.spawnPlayer());
  await expect(page.locator("#inventory .inventory-weapon")).toHaveCount(2);
  expect(await page.evaluate(() => [window.__game.ammo, window.__game.reserve])).toEqual([12, 48]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("M9 slash and stab hit once, respect reach and cover, and cancel on switch", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.keyboard.press("Digit3");
  await page.waitForTimeout(650);
  await page.evaluate(() => {
    const g = window.__game;
    g.yaw = 0;
    g.pitch = Math.atan2(1.2 - g.eye, 1.1);
    g.bots.forEach((b, i) => {
      b.health = i === 0 ? 100 : 0;
      b.group.visible = i === 0;
      b.respawn = 99;
    });
    g.bots[0].group.position.set(-17, 0, 15.9);
    g.bots[0].group.rotation.set(0, Math.PI, 0);
  });
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__game.bots[0].health)).toBe(65);
  await page.waitForTimeout(550);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect.poll(() => page.evaluate(() => window.__game.bots[0].health)).toBe(0);
  await expect(page.locator('#killfeed img[alt="M9 Bayonet"]')).toBeVisible();
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

test("both view rigs keep wrists on contacts and the M9 attached after its catch", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    let wristError = 0,
      gripError = 0,
      resetError = 0;
    for (const team of ["ct", "t"] as const) {
      g.team = team;
      for (let index = 0; index < 5; index++) {
        if (index === 4) g.equip(index);
        else g.buy(index);
        const model = g.gun.getObjectByName("weapon-model")!;
        const right = g.gun.getObjectByName(team === "t" ? "hand_R" : "ValveBipedBip01_R_Hand")!;
        const grip = model.matrixWorld.clone();
        const rest = g.gun.position.clone();
        let first = true;
        for (const phase of ["idle", "draw", "reload", "bolt", "slash", "stab", "idle"] as const) {
          for (let frame = 0; frame <= 20; frame++) {
            const p = frame / 20;
            g.drawTime = phase === "draw" ? (1 - p) * 0.55 : 0;
            g.reload = phase === "reload" && index < 4 ? (1 - p) * [2.4, 2.2, 1.7, 3.4][index] : 0;
            g.boltTime = phase === "bolt" && index === 3 ? (1 - p) * 1.45 : 0;
            g.knifeStab = phase === "stab";
            g.knifeDuration = g.knifeStab ? 0.85 : 0.5;
            g.knifeTime =
              index === 4 && (phase === "slash" || phase === "stab")
                ? (1 - p) * g.knifeDuration
                : 0;
            g.kick = 0;
            g.animateWeapon();
            g.gun.updateMatrixWorld(true);
            for (const side of ["L", "R"]) {
              const bone = g.gun.getObjectByName(
                team === "t" ? `hand_${side}` : `ValveBipedBip01_${side}_Hand`,
              )!;
              const marker = g.gun.getObjectByName(side === "L" ? "left-hand" : "right-hand")!;
              wristError = Math.max(
                wristError,
                bone
                  .getWorldPosition(g.position.clone())
                  .distanceTo(marker.getWorldPosition(g.position.clone())),
              );
            }
            if (index === 4 && (phase !== "draw" || p >= 0.82)) {
              const relative = right.matrixWorld.clone().invert().multiply(model.matrixWorld);
              if (first) grip.copy(relative);
              gripError = Math.max(
                gripError,
                ...relative.elements.map((value, i) => Math.abs(value - grip.elements[i])),
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
      gripError,
      resetError,
      lensStable: g.viewCamera.fov === lens && g.camera.fov === 110,
    };
  });
  expect(result.wristError).toBeLessThan(0.001);
  // Imported skeleton transforms have small floating-point/quantization errors.
  expect(result.gripError).toBeLessThan(0.001);
  expect(result.resetError).toBeLessThan(0.0001);
  expect(result.lensStable).toBe(true);
});

test("Bayonet draw rolls around the fingers, catches continuously and resets on switching", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  await page.getByRole("button", { name: "PRACTICE", exact: true }).click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const results = await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    return (["ct", "t"] as const).map((team) => {
      g.team = team;
      g.equip(4);
      g.drawTime = 0;
      g.animateWeapon();
      g.gun.updateMatrixWorld(true);
      const model = g.gun.getObjectByName("weapon-model")!;
      const hand = g.gun.getObjectByName("right-hand")!;
      const finger = g.gun.getObjectByName(
        team === "t" ? "finger_middle_1_R" : "ValveBipedBip01_R_Finger21",
      )!;
      const closed = finger.quaternion.clone();
      const pivot = g.position.clone().set(0, 0, -0.035);
      const contact = model.localToWorld(pivot.clone());
      hand.worldToLocal(contact);
      const ready = model.matrixWorld.clone();
      let contactError = 0,
        opening = 0,
        sweep = 0,
        lastAngle = 0,
        maxStep = 0;
      const previous = model.quaternion.clone();
      for (let frame = 0; frame <= 120; frame++) {
        const p = frame / 120;
        g.drawTime = (1 - p) * 0.55;
        g.animateWeapon();
        g.gun.updateMatrixWorld(true);
        contactError = Math.max(
          contactError,
          model.localToWorld(pivot.clone()).distanceTo(hand.localToWorld(contact.clone())),
        );
        opening = Math.max(opening, closed.angleTo(finger.quaternion));
        const blade = pivot.clone().set(0, 0, -1).applyQuaternion(model.quaternion);
        const angle = Math.atan2(blade.y, blade.x);
        if (frame > 0) {
          sweep += Math.atan2(Math.sin(angle - lastAngle), Math.cos(angle - lastAngle));
          maxStep = Math.max(maxStep, previous.angleTo(model.quaternion));
        }
        previous.copy(model.quaternion);
        lastAngle = angle;
      }
      const resetError = Math.max(
        ...ready.elements.map((v, i) => Math.abs(v - model.matrixWorld.elements[i])),
      );
      const closedError = closed.angleTo(finger.quaternion);
      g.drawTime = 0.3;
      g.animateWeapon();
      g.equip(2);
      g.equip(4);
      const restarted = g.drawTime === 0.55 && g.knifeTime === 0 && !g.knifePending;
      return { contactError, opening, sweep, maxStep, resetError, closedError, restarted };
    });
  });
  for (const result of results) {
    expect(result.contactError).toBeLessThan(0.001);
    expect(result.opening).toBeGreaterThan(0.3);
    expect(result.sweep).toBeLessThan(-5);
    expect(result.maxStep).toBeLessThan(0.35);
    expect(result.resetError).toBeLessThan(0.0001);
    expect(result.closedError).toBeLessThan(0.0001);
    expect(result.restarted).toBe(true);
  }
});
