import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("expanded armory equips, preserves slots, bursts, and reloads shells without duplicating ammo", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") external.push(request.url());
  });
  await page.goto("/");
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  for (const [index, name] of [
    [7, "Glock-18"],
    [8, "Desert Eagle"],
    [9, "M4A4"],
    [10, "Nova"],
    [11, "MP9"],
  ] as const) {
    await page.keyboard.press("b");
    await page.locator(`[data-weapon="${index}"]`).click();
    await page.waitForFunction(() => window.__game.locked);
    await expect(page.locator("#gun-name")).toHaveText(name);
    const state = await page.evaluate(() => {
      const g = window.__game;
      g.drawTime = g.cooldown = 0;
      const ammo = g.ammo;
      g.fire();
      return {
        ammo,
        after: g.ammo,
        slot: g.inventory(),
        knife: g.knife,
        vertices: g.gun.getObjectByName("weapon-model")?.children.length,
      };
    });
    expect(state.after).toBe(state.ammo - 1);
    expect(state.slot).toContain(index);
    expect(state.knife).toBe(4);
    expect(state.vertices).toBeGreaterThan(0);
  }
  const result = await page.evaluate(() => {
    const g = window.__game;
    // A fresh spawn has recovered aim punch. An unrelated previous ray must
    // not redirect the first newly aimed shot.
    g.spawnPlayer();
    g.buy(3);
    g.bots.forEach((bot, i) => {
      bot.health = i === 0 ? 100 : 0;
      bot.respawn = 99;
    });
    const target = g.bots[0];
    target.group.position.set(-17, 0, 11);
    target.group.visible = true;
    target.group.rotation.set(0, 0, 0);
    g.position.set(-17, 0, 17);
    g.yaw = 0;
    g.pitch = -0.04;
    g.setScope(1);
    g.weaponAccuracy[g.selected] = { penalty: 0, mode: 1 }; // Settled accuracy fixture.
    g.drawTime = g.cooldown = 0;
    g.ray.ray.direction.set(1, 0, 0);
    g.fire();
    const firstAimHealth = target.health;
    g.buy(7);
    g.drawTime = g.cooldown = 0;
    g.ammo = 20;
    g.glockBurst = true;
    g.fire();
    for (let i = 0; i < 30; i++) g.simulate(1 / 128);
    const burst = { ammo: g.ammo, remaining: g.burstRemaining };
    g.buy(10);
    g.drawTime = g.cooldown = 0;
    g.ammo = 1;
    g.reserve = 4;
    g.beginReload();
    for (let i = 0; i < 110; i++) g.simulate(1 / 128);
    const shell = { ammo: g.ammo, reserve: g.reserve, reloading: g.reload > 0 };
    g.fire();
    const interrupt = { ammo: g.ammo, reserve: g.reserve, reload: g.reload };
    for (let i = 0; i < 140; i++) g.simulate(1 / 128);
    g.buy(8);
    const slots = g.inventory();
    g.equip(10);
    const preserved = { ammo: g.ammo, reserve: g.reserve };
    g.locked = false;
    return { firstAimHealth, burst, shell, interrupt, slots, preserved };
  });
  expect(result.firstAimHealth).toBeLessThanOrEqual(0);
  expect(result.burst).toEqual({ ammo: 17, remaining: 0 });
  expect(result.shell).toEqual({ ammo: 2, reserve: 3, reloading: true });
  expect(result.interrupt).toEqual({ ammo: 1, reserve: 3, reload: 0 });
  expect(result.slots).toEqual([10, 8, 4]);
  expect(result.preserved).toEqual({ ammo: 1, reserve: 3 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
