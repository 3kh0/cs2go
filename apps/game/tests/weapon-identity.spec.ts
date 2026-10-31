import { test, expect } from "@playwright/test";
import type { Group } from "three";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 15000 });
}

test("weapon finish survives ground, bot carry, death and pickup without repainting bot guns", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await ready(page);
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.freezeTime = 0;
    g.bots.forEach((b) => {
      b.health = 0;
      b.group.visible = false;
    });
  });
  await page.evaluate(async () => {
    const path: string = "/src/skins.ts";
    const { setSkin } = (await import(path)) as typeof import("../src/skins");
    await setSkin(0, { id: "7_44", wear: 0.12, seed: 661 });
    window.__game.buy(0);
  });
  await expect(page.locator("#gun-name")).toHaveText("AK-47 | Case Hardened");
  await expect(
    page.locator('#inventory [data-weapon-index="0"] .inventory-finish img'),
  ).toHaveAttribute("src", /7_44/);
  const first = await page.evaluate(() => {
    const g = window.__game;
    const source = (root: Group) => {
      let result = "";
      root.traverse((o) => {
        const mesh = o as import("three").Mesh;
        if (!mesh.geometry) return;
        const m = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).find(
          (m) => m.name === "ak47",
        ) as import("three").MeshStandardMaterial;
        if (m?.map) result = m.map.source.uuid;
      });
      return result;
    };
    g.ammo = 11;
    g.reserve = 60;
    const identity = g.groundInventory.playerWeapon(0);
    const held = source(g.gun);
    g.groundInventory.drop(0, true);
    const drop = g.groundInventory.drops.at(-1)!;
    const ground = source(drop.mesh);
    const bot = g.bots[0];
    bot.health = 100;
    bot.group.visible = true;
    bot.group.position.set(-17, 0, 15);
    bot.target = null;
    bot.reloadTime = 0;
    drop.mesh.position.set(-17, 0.06, 15);
    drop.age = 2;
    g.position.set(100, 0, 100);
    g.groundInventory.update(0.2);
    return {
      serial: identity.serial,
      skin: identity.skin,
      held,
      ground,
      bot: source(bot.rig.weapon),
      botSerial: bot.rig.weaponInstance.serial,
    };
  });
  expect(first.skin).toEqual({ id: "7_44", wear: 0.12, seed: 661 });
  expect(first.ground).toBe(first.held);
  expect(first.bot).toBe(first.held);
  expect(first.botSerial).toBe(first.serial);
  await page.evaluate(() => {
    const g = window.__game,
      b = g.bots[0];
    g.position.set(-17, 0, 19.5);
    g.yaw = 0;
    g.pitch = -0.07;
    g.updateAimCamera();
    g.view.visible = false;
    b.group.rotation.y = 0;
    b.rig.drawTime = 0;
    b.anim = 0.2;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "artifacts/weapon-instance-bot-carry.png" });

  await page.evaluate(async () => {
    const path: string = "/src/skins.ts";
    const { setSkin } = (await import(path)) as typeof import("../src/skins");
    await setSkin(0, { id: "7_44", wear: 0.42, seed: 100 });
  });
  const carried = await page.evaluate(() => {
    const bot = window.__game.bots[0];
    let source = "";
    bot.rig.weapon.traverse((o) => {
      const m = (o as import("three").Mesh).material as import("three").MeshStandardMaterial;
      if (m?.name === "ak47") source = m.map!.source.uuid;
    });
    return source;
  });
  expect(carried).toBe(first.held);
  const returned = await page.evaluate(() => {
    const g = window.__game,
      bot = g.bots[0];
    bot.health = 0;
    g.groundInventory.update(0.01);
    bot.group.visible = false;
    g.view.visible = true;
    const drop = g.groundInventory.drops.find((d) => d.id === 0)!;
    g.groundInventory.drops
      .filter((d) => d !== drop)
      .forEach((d) => d.mesh.position.set(1000, 0, 1000));
    drop.age = 2;
    drop.mesh.position.set(-17, 0.06, 15);
    g.position.set(-17, 0, 15);
    const picked = g.groundInventory.pickup(true);
    return {
      picked,
      instance: g.groundInventory.playerWeapon(0),
      ammo: g.ammo,
      reserve: g.reserve,
    };
  });
  expect(returned.picked).toBe(true);
  expect(returned.instance.serial).toBe(first.serial);
  expect(returned.instance.skin).toEqual(first.skin);
  expect(returned.ammo).toBe(11);
  expect(returned.reserve).toBe(60);
  const plain = await page.evaluate(async () => {
    const soldierPath: string = "/src/soldier.ts",
      instancePath: string = "/src/weapon-instance.ts";
    const { setSoldierWeapon } = (await import(soldierPath)) as typeof import("../src/soldier");
    const { createWeaponInstance } = (await import(
      instancePath
    )) as typeof import("../src/weapon-instance");
    const g = window.__game,
      bot = g.bots[0];
    setSoldierWeapon(bot.rig, 0, true, createWeaponInstance(0, "bot:0"));
    bot.health = 100;
    const d = g.groundInventory.spawn(0, 24, 90, g.position, 0, 0)!;
    d.age = 2;
    d.mesh.position.copy(g.position).y = 0.06;
    const picked = g.groundInventory.pickup(true);
    g.updateUI();
    let painted = false;
    g.gun.traverse((o) => {
      const m = (o as import("three").Mesh).material as import("three").MeshStandardMaterial;
      if (m?.name === "ak47")
        painted ||= (m.map as import("three").DataTexture)?.isDataTexture === true;
    });
    g.drawTime = 0;
    g.weaponTime = 1;
    g.pitch = -0.45;
    g.updateAimCamera();
    return {
      picked,
      painted,
      instance: g.groundInventory.playerWeapon(0),
      ownDrop: g.groundInventory.drops.find((d) => d.id === 0 && d.instance.creator === "player")
        ?.instance,
    };
  });
  expect(plain.picked).toBe(true);
  expect(plain.painted).toBe(false);
  expect(plain.instance.skin.id).toBe("");
  expect(plain.ownDrop?.serial).toBe(first.serial);
  await expect(page.locator("#gun-name")).toHaveText("AK-47");
  await expect(page.locator('#inventory [data-weapon-index="0"] .inventory-finish')).toHaveCount(0);
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.__game.animationTime += 0.2;
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/weapon-instance-held.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.view.visible = false;
    const drop = g.groundInventory.drops.find(
      (d) => d.id === 0 && d.instance.creator === "player",
    )!;
    drop.mesh.position.set(-17, 0.06, 12);
    drop.mesh.rotation.y = Math.PI / 2;
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/weapon-instance-ground.png" });
  expect(errors).toEqual([]);
});

test("compact killfeed uses firearm and fire glyphs, modifiers and local emphasis", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const g = window.__game;
    g.start("practice");
    g.simulate = () => {};
    g.feed(g.bots[0].name, g.bots[1].name, false, -1, false, false, "Incendiary");
    g.feed(g.bots[1].name, g.bots[0].name, true, 2);
    g.feed("YOU", g.bots[2].name, true, 0, false, true);
  });
  await expect(page.locator("#killfeed .feed")).toHaveCount(3);
  await expect(page.locator(".feed-fire")).toHaveCount(1);
  await expect(page.locator("#killfeed .feed").first()).not.toContainText("Incendiary");
  await expect(page.locator(".feed-local")).toHaveCount(1);
  await expect(page.locator('#killfeed img[alt="HEADSHOT"]')).toHaveCount(2);
  await expect(page.locator('#killfeed img[alt="PENETRATION"]')).toHaveCount(1);
  const font = await page
    .locator(".feed")
    .first()
    .evaluate((el) => ({
      family: getComputedStyle(el).fontFamily,
      size: parseFloat(getComputedStyle(el).fontSize),
      height: el.getBoundingClientRect().height,
    }));
  expect(font.family).not.toContain("Condensed");
  expect(font.size).toBeLessThan(18);
  expect(font.height).toBeLessThan(32);
  await page.screenshot({ path: "artifacts/cs2-killfeed.png" });
});

test("HD paint is visible on a dropped world gun and survives clearing the current loadout finish", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await ready(page);
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(async () => {
    const g = window.__game;
    g.simulate = () => {};
    g.freezeTime = 0;
    g.bots.forEach((b) => {
      b.health = 0;
      b.group.visible = false;
    });
    const path: string = "/src/skins.ts";
    const { setSkin } = (await import(path)) as typeof import("../src/skins");
    await setSkin(0, { id: "7_1466", wear: 0.04, seed: 321 });
    g.buy(0);
  });
  await page.waitForFunction(() => window.__game.gun.getObjectByName("skin-hd")?.visible === true);
  const identity = await page.evaluate(() => {
    const g = window.__game;
    const serial = g.groundInventory.playerWeapon(0).serial;
    g.groundInventory.drop(0);
    const d = g.groundInventory.drops.at(-1)!;
    d.mesh.position.set(-17, 0.06, 13);
    d.mesh.rotation.y = Math.PI / 2;
    g.position.set(-17, 0, 17);
    g.pitch = -0.45;
    g.yaw = 0;
    g.updateAimCamera();
    g.view.visible = false;
    return serial;
  });
  await page.waitForFunction(
    () =>
      window.__game.groundInventory.drops.at(-1)?.mesh.getObjectByName("skin-hd")?.visible === true,
  );
  await page.evaluate(async () => {
    const path: string = "/src/skins.ts";
    const { setSkin } = (await import(path)) as typeof import("../src/skins");
    await setSkin(0, { id: "", wear: 0.01, seed: 1 });
  });
  const appearance = await page.evaluate(() => {
    const d = window.__game.groundInventory.drops.at(-1)!;
    let painted = 0;
    d.mesh.traverse((o) => {
      const mesh = o as import("three").Mesh;
      if (!mesh.material) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        if (
          ((m as import("three").MeshStandardMaterial).map as import("three").DataTexture)
            ?.isDataTexture
        )
          painted++;
    });
    return {
      serial: d.instance.serial,
      skin: d.instance.skin,
      hd: d.mesh.getObjectByName("skin-hd")?.visible,
      painted,
    };
  });
  expect(appearance.serial).toBe(identity);
  expect(appearance.skin).toEqual({ id: "7_1466", wear: 0.04, seed: 321 });
  expect(appearance.hd).toBe(true);
  expect(appearance.painted).toBeGreaterThan(0);
  await page.screenshot({ path: "artifacts/weapon-instance-hd-ground.png" });
  await page.evaluate(() => {
    const g = window.__game,
      d = g.groundInventory.drops.at(-1)!;
    d.age = 2;
    d.mesh.position.copy(g.position).y = 0.06;
    g.groundInventory.pickup(true);
  });
  expect(await page.evaluate(() => window.__game.groundInventory.playerWeapon(0).serial)).toBe(
    identity,
  );
  await expect(page.locator("#gun-name")).toHaveText("AK-47 | Consequence of the Jinn");
  expect(errors).toEqual([]);
});
