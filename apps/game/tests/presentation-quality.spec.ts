import { expect, test } from "@playwright/test";
import type { Mesh, MeshStandardMaterial } from "three";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("texture quality follows cached weapon switches and newly applied skin maps", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  // Wait for the UI gate as well as the loaded scene.
  await expect(page.locator("#play")).toBeEnabled({ timeout: 90000 });
  await expect(page.locator("#startup")).toBeHidden();
  const fullWidth = await page.evaluate(() => {
    const g = window.__game;
    const gun = g.viewGun(0);
    let width = 0;
    gun.traverse((object) => {
      const material = (object as Mesh).material as MeshStandardMaterial | undefined;
      if (material?.name === "ak47" && material.map)
        width = Math.max(width, (material.map.image as { width: number }).width);
    });
    g.primary = 3;
    g.equip(3);
    g.settings.textureQuality = "low";
    g.saveSettings();
    g.primary = 0;
    g.equip(0);
    return width;
  });
  expect(fullWidth).toBeGreaterThan(1);
  const mapWidths = () =>
    page.evaluate(() => {
      let defaultWidth = 0,
        bakedWidth = 0;
      window.__game.gun.traverse((object) => {
        const material = (object as Mesh).material as MeshStandardMaterial | undefined;
        if (material?.name !== "ak47" || !material.map) return;
        const width = (material.map.image as { width: number }).width;
        if ("isDataTexture" in material.map) bakedWidth = Math.max(bakedWidth, width);
        else defaultWidth = Math.max(defaultWidth, width);
      });
      return { defaultWidth, bakedWidth };
    });
  await expect
    .poll(async () => (await mapWidths()).defaultWidth)
    .toBe(Math.max(1, Math.floor(fullWidth / 4)));
  await page.locator("#skins-button").click();
  await page.locator('[data-skin-weapon="0"]').click();
  await page.locator("#skin-search").fill("Case Hardened");
  await page.locator('[data-skin="7_44"]').click();
  await page.locator("#apply-skin").click();
  await expect(page.locator("#skin-status")).toContainText("Applied", { timeout: 45000 });
  // Existing weapon instances intentionally keep their original finish. Create
  // a new player weapon, as a purchase would, before checking its painted maps.
  await page.evaluate(() => {
    window.__game.groundInventory.newPlayerWeapon(0);
    window.__game.equip(0);
  });
  await expect.poll(async () => (await mapWidths()).bakedWidth).toBe(256);
  await page.evaluate(() => {
    window.__game.settings.textureQuality = "high";
    window.__game.saveSettings();
  });
  await expect.poll(async () => (await mapWidths()).bakedWidth).toBe(1024);
  expect(errors).toEqual([]);
});
