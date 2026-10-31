import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("Nova inserts sound once per shell and Karambit contact changes its recovery pose", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(async () => {
    const g = window.__game;
    g.useWorld(false);
    g.freezeTime = 0;
    g.roundPause = 100;
    g.invulnerable = 100;
    g.position.set(0, 0, 0);
    g.yaw = g.pitch = 0;
    g.eye = 1.65;
    g.bots.forEach((b, i) => b.group.position.set(30 + i, 0, 30));
    g.primary = 10;
    g.equip(10);
    const original = g.sound.bind(g);
    let insertions = 0;
    g.sound = (...args) => {
      if (args[0] === "reloadIn") insertions++;
      return original(...args);
    };
    function reload(shells: number) {
      g.ammo = 8 - shells;
      g.reserve = shells;
      g.reload = g.cooldown = 0;
      insertions = 0;
      g.beginReload();
      for (let i = 0; i < 2000 && g.reload; i++) g.simulate(1 / 128);
      return { insertions, ammo: g.ammo, reserve: g.reserve, finished: g.reload === 0 };
    }
    const one = reload(1),
      three = reload(3);
    g.ammo = 5;
    g.reserve = 3;
    g.cooldown = 0;
    insertions = 0;
    g.beginReload();
    for (let i = 0; i < 16; i++) g.simulate(1 / 128);
    g.fire();
    for (let i = 0; i < 128; i++) g.simulate(1 / 128);
    const cancelled = { insertions, reloading: g.reload > 0 };
    g.sound = original;
    g.secondary = 8;
    g.equip(8);
    g.cooldown = g.drawTime = 0;
    g.ammo = 1;
    g.reserve = 14;
    g.fire();
    const lastRound = g.lastShot && g.ammo === 0;
    g.ammo = 2;
    g.simulate(1 / 128);
    const shotLatched = g.lastShot;
    g.ammo = 0;
    g.beginReload();
    const emptyStart = g.emptyReload;
    g.ammo = 2;
    g.simulate(1 / 128);
    const emptyLatched = g.emptyReload;
    g.equip(10);
    const switchedClears = !g.lastShot && !g.emptyReload;
    const source = await (await fetch("/src/soldier.ts")).text();
    const T = await import(/* @vite-ignore */ source.match(/from "([^"]*three\.js[^"]*)"/)![1]);
    const wall = new T.Mesh(new T.BoxGeometry(1, 3, 0.1), new T.MeshBasicMaterial());
    wall.position.set(0, 1.5, -0.6);
    g.scene.add(wall);
    g.world.solids.push(wall);
    g.knife = 6;
    g.equip(6);
    g.cooldown = g.drawTime = 0;
    g.fireKnife();
    for (let i = 0; i < 20; i++) g.simulate(1 / 128);
    const contact = g.knifeContact;
    g.knifeTime = g.knifeDuration * 0.5;
    g.animateWeapon();
    g.gun.updateMatrixWorld(true);
    const hand = g.gun.getObjectByName("agent-view-arms")!.getObjectByName("hand_R")!;
    const hit = hand.getWorldPosition(new T.Vector3());
    g.knifeContact = false;
    g.animateWeapon();
    g.gun.updateMatrixWorld(true);
    const poseDifference = hit.distanceTo(hand.getWorldPosition(new T.Vector3()));
    g.knifeContact = true;
    g.cooldown = 0;
    g.fireKnife();
    const newSwingClearsContact = !g.knifeContact;
    g.scene.remove(wall);
    g.world.solids.splice(g.world.solids.indexOf(wall), 1);
    wall.geometry.dispose();
    wall.material.dispose();
    g.menu();
    return {
      one,
      three,
      cancelled,
      contact,
      poseDifference,
      newSwingClearsContact,
      lastRound,
      shotLatched,
      emptyStart,
      emptyLatched,
      switchedClears,
    };
  });
  expect(result.one).toEqual({ insertions: 1, ammo: 8, reserve: 0, finished: true });
  expect(result.three).toEqual({ insertions: 3, ammo: 8, reserve: 0, finished: true });
  expect(result.cancelled).toEqual({ insertions: 0, reloading: false });
  expect(result.lastRound).toBe(true);
  expect(result.shotLatched).toBe(true);
  expect(result.emptyStart).toBe(true);
  expect(result.emptyLatched).toBe(true);
  expect(result.switchedClears).toBe(true);
  expect(result.contact).toBe(true);
  expect(result.poseDifference).toBeGreaterThan(0.005);
  expect(result.newSwingClearsContact).toBe(true);
  expect(errors).toEqual([]);
});
