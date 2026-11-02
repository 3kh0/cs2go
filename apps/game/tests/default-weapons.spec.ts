import { expect, test } from "@playwright/test";
import type * as T from "three";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("finished firearm defaults use HD materials and survive legacy paint changes", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [],
    failed: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.health = 1e6;
    window.__game.freezeTime = 1000;
  });
  await page.keyboard.press("b");
  for (const index of [3, 8]) {
    await page.locator(`#loadout [data-weapon="${index}"]`).hover();
    await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-item", String(index));
    const sample = await page.evaluate(() => {
      const item = (window.__game.buyPreview as unknown as { item: T.Group }).item;
      const hd = item.getObjectByName("skin-hd")!;
      let material: T.MeshStandardMaterial | undefined;
      hd.traverse((object) => {
        const mesh = object as T.Mesh;
        if (mesh.isMesh && !material)
          material = (
            Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
          ) as T.MeshStandardMaterial;
      });
      const image = material!.map!.image as CanvasImageSource & { width: number; height: number };
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let green = 0,
        bright = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 1] > pixels[i] * 0.9 && pixels[i + 1] > pixels[i + 2] * 1.2) green++;
        if (pixels[i] > 130 && pixels[i + 1] > 130 && pixels[i + 2] > 130) bright++;
      }
      return {
        visible: hd.visible,
        name: material!.name,
        green,
        bright,
        normal: !!material!.normalMap,
      };
    });
    expect(sample.visible).toBe(true);
    expect(sample.normal).toBe(true);
    expect(sample.name).toBe(index === 3 ? "weapon_snip_awp" : "weapon_pist_deagle");
    expect(index === 3 ? sample.green : sample.bright).toBeGreaterThan(10_000);
    await page.screenshot({ path: `artifacts/default-weapons/buy-${index}.png` });
  }
  await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .reverse()
      .find((url) => new URL(url).pathname === "/src/skins.ts")!;
    const skins = (await import(path)) as typeof import("../src/skins");
    const catalog = await skins.skinCatalog();
    const legacy = catalog.find((skin) => skin.weapon === 3 && skin.body === "legacy")!;
    await skins.setSkin(3, { id: legacy.id, wear: 0.02, seed: 1 });
  });
  await page.locator('#loadout [data-weapon="3"]').hover();
  await page.waitForFunction(() => {
    const item = (window.__game.buyPreview as unknown as { item: T.Group }).item;
    return (
      item.getObjectByName("skin-legacy")?.visible === true &&
      item.getObjectByName("skin-hd")?.visible === false
    );
  });
  await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .reverse()
      .find((url) => new URL(url).pathname === "/src/skins.ts")!;
    const skins = (await import(path)) as typeof import("../src/skins");
    await skins.setSkin(3, { id: "", wear: 0.01, seed: 1 });
  });
  await page.waitForFunction(() => {
    const item = (window.__game.buyPreview as unknown as { item: T.Group }).item;
    return (
      item.getObjectByName("skin-hd")?.visible === true &&
      item.getObjectByName("skin-legacy")?.visible === false
    );
  });
  await page.locator("#close-loadout").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const game = window.__game;
    game.position.fromArray(game.dust!.navigation.data.spawns.t[0]);
    game.yaw = game.pitch = 0;
    game.freezeTime = 0;
    game.bots.forEach((bot) => {
      bot.group.visible = false;
    });
  });
  for (const index of [3, 8]) {
    await page.evaluate((index) => window.__game.buy(index), index);
    await page.waitForFunction(() => window.__game.drawTime === 0);
    expect(await page.evaluate(() => window.__game.gun.getObjectByName("skin-hd")?.visible)).toBe(
      true,
    );
    await page.keyboard.press("f");
    await page.waitForTimeout(700);
    await page.screenshot({ path: `artifacts/default-weapons/held-${index}.png` });
  }
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
