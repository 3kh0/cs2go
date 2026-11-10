import { expect, test } from "vitest";
import * as T from "three";
import { applyNativeMapWater } from "./native-map-water";
import { nativeWaterSource } from "../tests/native-water-source-fixture";
/** A nonrectangular native water footprint distinguishes exact triangle
 * contact from a visually plausible but incorrect bounding-box splash. */
test("water contacts and projectile crossings require the actual surface and actor posture", () => {
  const root = new T.Group(),
    geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute([-1, 0, -1, -1, 0, 1, 1, 0, -1], 3),
  );
  geometry.setAttribute("normal", new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  const material = new T.MeshStandardMaterial();
  material.name = "nuke_water";
  root.add(new T.Mesh(geometry, material));
  const textures = new Map(
    ["g_tDebris", "g_tDebrisNormal", "g_tFoam", "g_tWavesNormalHeight"].map((name) => [
      name,
      new T.Texture(),
    ]),
  );
  const native = applyNativeMapWater(root, {
    materials: { nuke_water: nativeWaterSource },
    textures,
  });
  expect(native.contact("above", new T.Vector3(-0.5, 0.01, -0.5), 0)).toBe(false);
  expect(native.contact("below", new T.Vector3(-0.5, -2, -0.5), 0)).toBe(false);
  expect(native.contact("outside", new T.Vector3(0.5, -0.5, 0.5), 0)).toBe(false);
  expect(native.contact("inside", new T.Vector3(-0.5, -0.5, -0.5), 0)).toBe(true);
  expect(native.contact("inside", new T.Vector3(-0.5, -0.5, -0.5), 1)).toBe(false);
  expect(native.crossing(new T.Vector3(0.5, 1, 0.5), new T.Vector3(0.5, -1, 0.5), 1)).toBe(false);
  expect(native.crossing(new T.Vector3(-0.5, 1, -0.5), new T.Vector3(-0.5, -1, -0.5), 1)).toBe(
    true,
  );
  for (const texture of native.textures) texture.dispose();
  geometry.dispose();
  material.dispose();
});
