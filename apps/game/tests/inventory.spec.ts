import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("world guns preserve ammunition, drops vacate slots, refunds and loadouts constrain purchases", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toBeHidden({ timeout: 10000 });
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.start("practice");
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    g.buy(0);
    g.ammo = 11;
    g.reserve = 60;
    const dropped = g.groundInventory.drop();
    const emptyPrimary = g.primary === null;
    const d = g.groundInventory.drops.at(-1)!;
    d.mesh.position.copy(g.position).y += 0.2;
    d.age = 2;
    const pickedUp = g.groundInventory.pickup(true);
    const ammo = g.ammo,
      reserve = g.reserve;
    g.equip(g.secondary);
    g.ammo = 3;
    g.reserve = 12;
    const droppedSidearm = g.groundInventory.drop();
    const absent = !g.inventory().includes(g.secondary);
    const sidearm = g.groundInventory.drops.at(-1)!;
    sidearm.mesh.position.copy(g.position).y += 0.2;
    sidearm.age = 2;
    g.groundInventory.pickup(true);
    const sidearmAmmo = g.ammo;
    g.mode = "competitive";
    g.money = 10000;
    g.buyRemaining = 30;
    g.roundPause = 0;
    // Place the Dust II inventory fixture at a native
    // buy-zone spawn to exercise actual buy-zone eligibility.
    g.position.fromArray(g.dust!.navigation.data.spawns[g.team][0]);
    const id = g.team === "ct" ? 1 : 0;
    g.groundInventory.drop(g.primary ?? g.selected);
    const before = g.money;
    const bought = g.buy(id);
    const eligible = g.groundInventory.canRefund(id);
    const refunded = g.groundInventory.refund(id);
    const moneyRestored = before === g.money;
    g.groundInventory.loadouts[g.team] = g.groundInventory.loadouts[g.team].filter((i) => i !== id);
    const denied = !g.buy(id);
    // The next round snapshots selection. Editing it during that round cannot
    // bypass its five-slot purchase restriction.
    g.groundInventory.roundLoadout = [...g.groundInventory.loadouts[g.team]];
    g.groundInventory.loadouts[g.team].push(id);
    const snapshotDenied = !g.buy(id);
    g.groundInventory.roundLoadout = [...g.groundInventory.loadouts[g.team]];
    const nextRoundAllowed = g.groundInventory.allowed(id);
    if (!snapshotDenied || !nextRoundAllowed)
      throw new Error("Live loadout changes bypassed round slots");
    g.armor = 0;
    g.helmet = false;
    g.defuseKit = false;
    const cash = g.money;
    g.buyEquipment("kevlar");
    g.buyEquipment("helmet");
    const cannotRefundVestBeforeHelmet = !g.groundInventory.canRefundEquipment("kevlar");
    const helmetRefund = g.groundInventory.refundEquipment("helmet");
    const vestRefund = g.groundInventory.refundEquipment("kevlar");
    const armorRestored = g.armor === 0 && !g.helmet && g.money === cash;
    g.buyEquipment("kevlar");
    g.damageActor("player", 10, { height: 1.2 }, 0, g.team === "ct" ? "t" : "ct");
    const damagedArmorCannotRefund = !g.groundInventory.refundEquipment("kevlar");
    g.team = "ct";
    g.position.fromArray(g.dust!.navigation.data.spawns.ct[0]);
    g.buyEquipment("kit");
    const kitRefund = g.groundInventory.refundEquipment("kit");
    g.buyEquipment("kit");
    g.groundInventory.invalidateEquipment(true);
    const usedKitCannotRefund = !g.groundInventory.refundEquipment("kit");

    g.mode = "practice";
    return {
      dropped,
      emptyPrimary,
      pickedUp,
      ammo,
      reserve,
      droppedSidearm,
      absent,
      sidearmAmmo,
      bought,
      eligible,
      refunded,
      moneyRestored,
      denied,
      cannotRefundVestBeforeHelmet,
      helmetRefund,
      vestRefund,
      armorRestored,
      damagedArmorCannotRefund,
      kitRefund,
      usedKitCannotRefund,
    };
  });
  expect(result).toEqual({
    dropped: true,
    emptyPrimary: true,
    pickedUp: true,
    ammo: 11,
    reserve: 60,
    droppedSidearm: true,
    absent: true,
    sidearmAmmo: 3,
    bought: true,
    eligible: true,
    refunded: true,
    moneyRestored: true,
    denied: true,
    cannotRefundVestBeforeHelmet: true,
    helmetRefund: true,
    vestRefund: true,
    armorRestored: true,
    damagedArmorCannotRefund: true,
    kitRefund: true,
    usedKitCannotRefund: true,
  });
  await page.evaluate(() => {
    const g = window.__game;
    g.start("practice");
    g.groundInventory.clearDrops();
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    g.position.set(-17, 0, 17);
    g.yaw = 0;
    g.pitch = -0.55;
    g.buy(0);
    g.groundInventory.drop();
    const drop = g.groundInventory.drops.at(-1)!;
    drop.mesh.position.set(-17, 0.8, 14.8);
    drop.velocity.set(0, 0, 0);
    g.updateAimCamera();
  });
  await page.waitForTimeout(1200);
  await expect(page.locator("#startup")).toBeHidden();
  await expect(page.locator("#hud")).toBeVisible();
  await page.screenshot({ path: "artifacts/inventory-dropped-gun.png" });
  await page.evaluate(() => window.__game.groundInventory.showLoadout());
  await expect(page.locator("#loadout-editor")).toBeVisible();
  await expect(page.locator("#startup")).toBeHidden();
  await page.screenshot({ path: "artifacts/inventory-loadout-editor.png" });
  expect(errors).toEqual([]);
});

test("G tosses the held gun into view, then settles it with ammunition intact", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.bots.forEach((bot) => {
      bot.health = 0;
      bot.respawn = Infinity;
    });
    g.groundInventory.reset();
    g.groundInventory.clearDrops();
    g.position.set(-17, 0, 17);
    g.yaw = 0;
    g.pitch = -0.15;
    g.velocity.x = g.velocity.z = 0;
    g.buy(0);
    g.ammo = 11;
    g.reserve = 60;
    // Advance this visual fixture manually after exercising the real key handler.
    g.simulate = () => {};
    g.updateAimCamera();
  });
  await page.evaluate(() => {
    const g = window.__game;
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyG" }));
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyG" }));
    g.updateAimCamera();
  });
  const release = await page.evaluate(() => {
    const g = window.__game,
      drop = g.groundInventory.drops.at(-1)!;
    return {
      y: drop.mesh.position.y,
      z: drop.mesh.position.z,
      primary: g.primary,
      selected: g.selected,
      ammo: drop.ammo,
      reserve: drop.reserve,
    };
  });
  expect(release.y).toBeGreaterThan(1);
  expect(release.primary).toBeNull();
  expect(release.selected).not.toBe(0);
  expect([release.ammo, release.reserve]).toEqual([11, 60]);
  await page.screenshot({ path: "artifacts/weapon-toss-release.png" });
  const airborne = await page.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 20; i++) g.groundInventory.update(1 / 128);
    g.updateAimCamera();
    const drop = g.groundInventory.drops.at(-1)!;
    return { z: drop.mesh.position.z, turn: drop.mesh.rotation.x, sleeping: drop.sleeping };
  });
  expect(airborne.z).toBeLessThan(release.z - 0.5);
  expect(airborne.turn).toBeGreaterThan(0.5);
  expect(airborne.sleeping).toBe(false);
  await page.screenshot({ path: "artifacts/weapon-toss-airborne.png" });
  const settled = await page.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 128; i++) g.groundInventory.update(1 / 128);
    g.updateAimCamera();
    const drop = g.groundInventory.drops.at(-1)!;
    return { sleeping: drop.sleeping, speed: drop.velocity.length() };
  });
  expect(settled).toEqual({ sleeping: true, speed: 0 });
  expect(errors).toEqual([]);
});
