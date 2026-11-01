import { expect, test } from "@playwright/test";
import { knifeDefinitions } from "@cs2go/protocol";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("Inventory knife selection reaches the authoritative private match", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/?server=ws://127.0.0.1:3002/ws&room=knives-${Date.now()}`);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => !!window.__game.network?.connection.local);
  await page.bringToFront();
  if (!(await page.evaluate(() => window.__game.locked))) await page.locator("#game").click();
  await page.waitForFunction(() => window.__game.locked);
  // Headless Chromium's synthetic Escape does not release native pointer lock.
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
  await page.locator("#pause-skins").click();
  await page.locator('[data-skin-weapon="55"]').click();
  await page.locator("#equip-knife").click();
  await expect
    .poll(() => page.evaluate(() => window.__game.network!.connection.local!.weapon))
    .toBe(55);
  await expect
    .poll(() =>
      page.evaluate(() => ({ knife: window.__game.knife, weapon: window.__game.selected })),
    )
    .toEqual({ knife: 55, weapon: 55 });
  await expect(page.locator("#gun-name")).toHaveText("Kukri Knife");
  await page.locator("#close-skins").click();
  expect(errors).toEqual([]);
});

test("all CS2 knives equip through inventory and render their native action variants", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [],
    failed: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
    const url = new URL(response.url());
    if (/^https?:$/.test(url.protocol) && url.hostname !== "127.0.0.1")
      external.push(response.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#skins-button").click();
  for (const knife of knifeDefinitions) {
    await page.locator(`[data-skin-weapon="${knife.id}"]`).click();
    await page.locator("#equip-knife").click();
    await expect(page.locator("#skin-status")).toHaveText(`${knife.name} equipped.`);
    expect(await page.evaluate(() => window.__game.knife)).toBe(knife.id);
    expect(
      await page.locator("#skin-image").evaluate(async (element) => {
        const image = element as HTMLImageElement;
        await image.decode();
        return image.naturalWidth;
      }),
    ).toBeGreaterThan(0);
  }
  await page.screenshot({ path: "artifacts/all-knives-inventory.png" });
  await page.locator("#close-skins").click();
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.bots.forEach((bot) => {
      bot.health = 0;
      bot.respawn = Infinity;
      bot.group.visible = false;
    });
    // Freeze only the test's fixed-step clock while capturing exact action phases.
    Object.defineProperty(g, "simulationRunning", { configurable: true, get: () => false });
  });
  for (const knife of knifeDefinitions) {
    const result = await page.evaluate(async ({ id }) => {
      const path = (file: string) =>
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .reverse()
          .find((name) => new URL(name).pathname === `/src/${file}.ts`)!;
      const { animateGun, createWorldGun, disposeWorldGun, weaponDrawDuration } = (await import(
        path("weapons")
      )) as typeof import("../src/weapons");
      const g = window.__game;
      if (!g.buy(id)) throw new Error(`Cannot equip knife ${id}`);
      g.weaponCooldowns.fill(0);
      g.cooldown = g.drawTime = g.inspectTime = g.knifeTime = 0;
      const poses = [
        { draw: 0 },
        { draw: 0.5 },
        { draw: 0.95 },
        ...[false, true].flatMap((stab) =>
          [false, true].flatMap((knifeContact) =>
            [false, true].map((alternate) => ({
              knifeActive: true,
              knife: 0.45,
              stab,
              knifeContact,
              alternate,
            })),
          ),
        ),
        ...[0, 1, 2].map((inspectVariant) => ({
          inspectActive: true,
          inspect: 0.45,
          inspectVariant,
        })),
        { time: 4 },
      ];
      const joints: number[][] = [];
      for (const pose of poses) {
        animateGun(g.gun, { reload: 0, draw: 0, bolt: 0, recoil: 0, sway: 0, bob: 0, ...pose });
        g.gun.updateMatrixWorld(true);
        const hand = g.gun.getObjectByName("hand_R")!;
        joints.push(hand.matrixWorld.elements.slice());
        g.gun.traverse((node) => {
          if (!node.matrixWorld.elements.every(Number.isFinite))
            throw new Error(`Invalid ${id} transform at ${node.name}`);
        });
      }
      const model = g.gun.getObjectByName("weapon-model")!;
      let vertices = 0,
        textured = true;
      model.traverse((node) => {
        const mesh = node as import("three").Mesh;
        if (!mesh.isMesh) return;
        vertices += mesh.geometry.getAttribute("position").count;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        textured &&= materials.every(
          (material) => !!(material as import("three").MeshStandardMaterial).map,
        );
      });
      const world = createWorldGun(id);
      const grip = world.userData.buyGrip as number[] | undefined;
      const validGrip = id === 4 || (grip?.length === 16 && grip.every(Number.isFinite));
      disposeWorldGun(world);
      // Exercise the normal simulation after every appended ID, including shared accuracy/recoil arrays.
      for (let i = 0; i < 16; i++) g.simulate(1 / 128);
      g.drawTime = g.knifeTime = g.inspectTime = 0;
      g.weaponTime = 0;
      g.animateWeapon();
      g.updateUI();
      return {
        vertices,
        textured,
        validGrip,
        draw: weaponDrawDuration(id),
        inspect: g.inspectDuration(),
        animated: joints.some((joint) =>
          joint.some((value, i) => Math.abs(value - joints[0][i]) > 0.001),
        ),
        inventory: g.inventory(),
      };
    }, knife);
    expect(result.vertices, knife.name).toBeGreaterThan(100);
    expect(result.textured, knife.name).toBe(true);
    expect(result.validGrip, knife.name).toBe(true);
    expect(result.animated, knife.name).toBe(true);
    expect(result.draw, knife.name).toBeGreaterThan(0);
    expect(result.inspect, knife.name).toBeGreaterThan(0);
    expect(
      result.inventory.filter((id) => knifeDefinitions.some((definition) => definition.id === id)),
    ).toEqual([knife.id]);
    await expect(page.locator("#gun-name")).toHaveText(knife.name);
    await page.screenshot({ path: `artifacts/all-knives-${knife.icon}.png` });
    await page.keyboard.press("b");
    await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-item", String(knife.id));
    await expect(page.locator("#buy-preview-name")).toHaveText(knife.name);
    await page.screenshot({ path: `artifacts/all-knives-world-${knife.icon}.png` });
    await page.locator("#close-loadout").click();
    await page.waitForFunction(() => window.__game.locked);
  }
  // Real keyboard inspect cancellation and slot/wheel ownership use the new final entry.
  await page.evaluate(() => {
    const g = window.__game;
    g.cooldown = g.drawTime = g.knifeTime = 0;
  });
  await page.keyboard.press("f");
  expect(await page.evaluate(() => window.__game.inspectTime)).toBeGreaterThan(0);
  await page.keyboard.press("2");
  expect(await page.evaluate(() => window.__game.inspectTime)).toBe(0);
  await page.keyboard.press("3");
  expect(await page.evaluate(() => window.__game.selected)).toBe(55);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(external).toEqual([]);
});
