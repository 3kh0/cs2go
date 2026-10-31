import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("native road paint follows the asphalt instead of floating through props", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  const samples = await page.evaluate(async () => {
    const modulePath = "/node_modules/.vite/deps/three.js";
    const T = (await import(modulePath)) as typeof import("three");
    const root = window.__game.dust!.root;
    root.updateMatrixWorld(true);
    return [-73, -74, -75].map((z) => {
      const ray = new T.Raycaster(new T.Vector3(33.9, 8, z), new T.Vector3(0, -1, 0), 0, 10);
      const hits = ray.intersectObject(root, true);
      const height = (name: string) =>
        hits.find((hit) => {
          const material = (hit.object as import("three").Mesh).material;
          return !Array.isArray(material) && material?.name === name;
        })?.point.y;
      const paint = height("hr_dust_decal_road_striping");
      const asphalt = height("hr_dust_blend_asphalt_07");
      return {
        z,
        paint,
        asphalt,
        gap: paint !== undefined && asphalt !== undefined ? paint - asphalt : null,
      };
    });
  });
  for (const sample of samples) {
    expect(sample.paint, `paint at z=${sample.z}`).toBeDefined();
    expect(sample.asphalt, `road at z=${sample.z}`).toBeDefined();
    expect(sample.gap).toBeGreaterThan(0);
    expect(sample.gap).toBeLessThan(0.025);
  }
});

test("native lantern AO scale preserves its textured body", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  const materials = await page.evaluate(() => {
    const values: { name: string; ao: boolean; strength: number }[] = [];
    window.__game.dust!.root.traverse((object) => {
      const mesh = object as import("three").Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (material.name !== "street_lantern_02_color") continue;
        const standard = material as import("three").MeshStandardMaterial;
        values.push({
          name: material.name,
          ao: !!standard.aoMap,
          strength: standard.aoMapIntensity,
        });
      }
    });
    return values;
  });
  expect(materials.length).toBeGreaterThan(0);
  // Valve's material explicitly disables this AO texture. Exporting it at the
  // glTF default strength of one turned the whole lamp into a black silhouette.
  for (const material of materials) {
    expect(material.ao).toBe(true);
    expect(material.strength).toBe(0);
  }
});
