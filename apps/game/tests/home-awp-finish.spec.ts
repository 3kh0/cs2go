import { expect, test } from "@playwright/test";
import type * as T from "three";
import { selectHomeWeapon } from "./home-controls";

test("home AWP applies paints to its visible material and restores factory green", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname === "/src/skins.ts")!;
    const { setSkin } = (await import(path)) as typeof import("../src/skins");
    await setSkin(3, { id: "9_1206", wear: 0.01, seed: 1 });
  });
  await selectHomeWeapon(page, 3);
  await page.waitForFunction(
    () => document.getElementById("home-agent-stage")?.dataset.showcaseWeapon === "3",
  );
  const result = await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname === "/src/skins.ts")!;
    const { setSkin } = (await import(path)) as typeof import("../src/skins");
    const home = window.__game.homeScene as unknown as {
      previews: Map<string, { weapon: T.Group }>;
    };
    const root = home.previews.get("ct")!.weapon;
    const hd = root.getObjectByName("skin-hd")!;
    let material: T.MeshStandardMaterial | undefined;
    hd.traverse((object) => {
      const mesh = object as T.Mesh;
      if (mesh.isMesh && !material) material = mesh.material as T.MeshStandardMaterial;
    });
    const paintedMap = material!.map!;
    const painted = !!(paintedMap as T.DataTexture).isDataTexture;
    await setSkin(3, { id: "", wear: 0.01, seed: 1 });
    const restored = material!.map !== paintedMap;
    const canvas = document.createElement("canvas");
    const image = material!.map!.image as CanvasImageSource & { width: number; height: number };
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let olive = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i + 1]! > pixels[i]! * 0.9 && pixels[i + 1]! > pixels[i + 2]! * 1.2) olive++;
    return { painted, restored, olive, visible: hd.visible, material: material!.name };
  });
  expect(result.painted).toBe(true);
  expect(result.restored).toBe(true);
  expect(result.olive).toBeGreaterThan(10_000);
  expect(result.visible).toBe(true);
  expect(result.material).toBe("weapon_snip_awp");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "artifacts/home-awp-factory-green.png" });
});
