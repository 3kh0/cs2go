import { expect, test } from "@playwright/test";
import { knifeDefinitions } from "@cs2go/protocol";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("inventory shows full-color defaults and knife finishes paint held and preview models", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [],
    failed: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400) failed.push(response.url());
    if (/^https?:$/.test(url.protocol) && url.hostname !== "127.0.0.1")
      external.push(response.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#skins-button").click();
  for (let id = 0; id < 56; id++) {
    await page.locator(`[data-skin-weapon="${id}"]`).click();
    await expect(page.locator("#skin-image")).toHaveAttribute("src", `/skins/defaults/${id}.webp`);
    const image = await page.locator("#skin-image").evaluate(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set<number>();
      let transparent = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) transparent++;
        else colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
      }
      return { width: image.naturalWidth, colors: colors.size, transparent };
    });
    expect(image.width).toBeGreaterThanOrEqual(256);
    expect(image.colors).toBeGreaterThan(128);
    expect(image.transparent).toBeGreaterThan(0);
  }
  await page.locator('[data-skin-weapon="23"]').click();
  await page.screenshot({ path: "artifacts/inventory-default-ssg08.png" });
  await page.locator('[data-skin-weapon="42"]').click();
  await page.locator("#skin-search").fill("Case Hardened");
  await page.locator('[data-skin="508_44"]').click();
  await page.locator("#skin-float").fill("0.123456");
  await page.locator("#skin-seed").fill("661");
  await page.locator("#apply-skin").click();
  await expect(page.locator("#skin-status")).toContainText("Applied", { timeout: 30_000 });
  await page.locator("#equip-knife").click();
  await page.screenshot({ path: "artifacts/inventory-m9-finishes.png" });
  await page.locator("#close-skins").click();
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
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
    Object.defineProperty(g, "simulationRunning", { configurable: true, get: () => false });
  });
  for (const knife of knifeDefinitions.filter((knife) => knife.id !== 37 && knife.id !== 38)) {
    const result = await page.evaluate(async ({ id, item }) => {
      const source = (name: string) =>
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .reverse()
          .find((url) => new URL(url).pathname === `/src/${name}.ts`)!;
      const skins = (await import(source("skins"))) as typeof import("../src/skins");
      const weapons = (await import(source("weapons"))) as typeof import("../src/weapons");
      const instances = (await import(
        source("weapon-instance")
      )) as typeof import("../src/weapon-instance");
      const catalog = await skins.skinCatalog();
      const skin =
        catalog.find((skin) => skin.weapon === id && skin.paint === 44) ??
        catalog.find((skin) => skin.weapon === id)!;
      const paint = (await (
        await fetch(`/skins/paints/${skin.id}.json`)
      ).json()) as import("../src/skin-paint").Paint;
      await skins.setSkin(id, { id: skin.id, wear: 0.123456, seed: 661 });
      const g = window.__game;
      g.buy(id);
      g.drawTime = g.knifeTime = g.inspectTime = 0;
      g.animateWeapon();
      const expected = paint.targets.map((target) =>
        target.target_vmat
          .split("/")
          .at(-1)!
          .replace(/\.vmat$/, ""),
      );
      function painted(root: import("three").Object3D) {
        const names = new Set<string>();
        root.traverse((object) => {
          const mesh = object as import("three").Mesh;
          if (!mesh.isMesh) return;
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const map = (material as import("three").MeshStandardMaterial).map as
              | import("three").DataTexture
              | null;
            if (map?.isDataTexture && map.image.data?.some((value: number) => value > 0))
              names.add(material.name);
          }
        });
        return expected.every((name) => names.has(name));
      }
      const instance = instances.createWeaponInstance(id, "player", true);
      const world = weapons.createWorldGun(id, true, instance);
      const result = { id, item, skin: skin.id, held: painted(g.gun), world: painted(world) };
      weapons.disposeWorldGun(world);
      return result;
    }, knife);
    expect(result.held, `${knife.name} held material targets`).toBe(true);
    expect(result.world, `${knife.name} world material targets`).toBe(true);
    await page.screenshot({ path: `artifacts/knife-finish-${knife.icon}.png` });
  }
  for (const paint of [415, 416, 568]) {
    const applied = await page.evaluate(async (paint) => {
      const url = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .reverse()
        .find((url) => new URL(url).pathname === "/src/skins.ts")!;
      const { setSkin } = (await import(url)) as typeof import("../src/skins");
      await setSkin(42, { id: `508_${paint}`, wear: 0.01, seed: 661 });
      const g = window.__game;
      g.buy(42);
      g.drawTime = g.knifeTime = g.inspectTime = 0;
      g.animateWeapon();
      return g.groundInventory.playerWeapon(42).skin.id;
    }, paint);
    expect(applied).toBe(`508_${paint}`);
    await page.screenshot({ path: `artifacts/m9-doppler-${paint}.png` });
  }
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(external).toEqual([]);
});
