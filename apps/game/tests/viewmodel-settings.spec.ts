import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("viewmodel controls preview native projection, preserve world FOV, resize, persist and reset", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#settings-button").click();
  await page.locator("#fov").fill("110");
  await page.getByRole("tab", { name: "Viewmodel", exact: true }).click();
  await expect(page.locator("#viewmodelFov")).toHaveValue("60");
  await page.locator("#viewmodelFov").fill("68");
  await page.locator("#viewmodelOffsetX").fill("1.3");
  await page.locator("#viewmodelOffsetY").fill("-0.7");
  await page.locator("#viewmodelOffsetZ").fill("-1.8");
  await page.getByRole("button", { name: "4:3", exact: true }).click();
  await page.locator("#viewmodel-preview-weapon").selectOption("44");
  const state = await page.evaluate(() => {
    const g = window.__game;
    return {
      world: g.camera.fov,
      view: g.viewCamera.fov,
      aspect: g.viewCamera.aspect,
      position: g.viewCamera.position.toArray(),
      selected: g.selected,
      previewing: g.previewingViewmodel,
    };
  });
  expect(state.world).toBe(110);
  expect(state.view).toBeCloseTo(53.667998865, 8);
  expect(state.aspect).toBeCloseTo(1440 / 900 / (4 / 3), 8);
  expect(state.position).toEqual([-1.3 * 0.0254, 1.8 * 0.0254, -0.7 * 0.0254]);
  expect(state.previewing).toBe(true);
  await page.screenshot({ path: "artifacts/viewmodel-settings-4-3.png", animations: "disabled" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect
    .poll(() => page.evaluate(() => window.__game.viewCamera.aspect))
    .toBeCloseTo(4 / 3, 8);
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Viewmodel", exact: true }).click();
  await expect(page.locator("#viewmodelFov")).toHaveValue("68");
  await expect(page.getByRole("button", { name: "4:3", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#reset-viewmodel").click();
  await expect(page.locator("#viewmodelFov")).toHaveValue("60");
  await expect(page.locator("#viewmodelOffsetX")).toHaveValue("1");
  await expect(page.locator("#viewmodelOffsetY")).toHaveValue("1");
  await expect(page.locator("#viewmodelOffsetZ")).toHaveValue("-1");
  await expect(page.getByRole("button", { name: "16:9", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await page.evaluate(() => window.__game.settings.fov)).toBe(110);
  expect(await page.evaluate(() => window.__game.selected)).toBe(state.selected);
  expect(errors).toEqual([]);
});
