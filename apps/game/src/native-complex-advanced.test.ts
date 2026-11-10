import { expect, test } from "vitest";
import * as T from "three";
import { nativeComplexRareSources } from "../tests/native-complex-rare-source-fixture";
import { validateNativeComplexMaterial, applyNativeMapComplex } from "./native-map-complex";

test("rare14 admission binds the exact VMAT and cannot broaden common metalness flags", () => {
  for (const source of Object.values(nativeComplexRareSources))
    expect(() => validateNativeComplexMaterial(source)).not.toThrow();
  const source = nativeComplexRareSources.parasol;
  expect(() =>
    validateNativeComplexMaterial({
      ...source,
      advancedSelection: { ...source.advancedSelection!, sourceSha256: "wrong" },
    }),
  ).toThrow("identity");
  expect(() =>
    validateNativeComplexMaterial({
      ...source,
      IntParams: { ...source.IntParams, F_DECAL_TEXTURE: 1 },
    }),
  ).toThrow("selection changed");
  expect(() => validateNativeComplexMaterial({ ...source, advancedSelection: undefined })).toThrow(
    "Unsupported native complex feature",
  );
});

test("alpha COLOR and its separate depth scene preserve matching coverage and lifecycle", () => {
  const source = nativeComplexRareSources.streetlamp,
    material = new T.MeshStandardMaterial();
  material.name = "actual";
  const scene = new T.Scene(),
    geometry = new T.PlaneGeometry();
  geometry.computeTangents();
  const mesh = new T.Mesh(geometry, material);
  scene.add(mesh);
  const textures = new Map(
    Object.values(source.textures).map((id) => [
      id,
      new T.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1),
    ]),
  );
  const view = applyNativeMapComplex(scene, {
    materials: { actual: source },
    textures,
    lookup: new T.DataTexture(),
  });
  expect(material.depthFunc).toBe(T.EqualDepth);
  expect(material.depthWrite).toBe(false);
  expect(material.alphaTest).toBe(0);
  expect(view.depthScene.children).toHaveLength(1);
  mesh.position.x = 4;
  mesh.visible = false;
  view.syncDepth();
  const depth = view.depthScene.children[0] as T.Mesh;
  expect(depth.visible).toBe(false);
  expect(depth.matrix.elements[12]).toBe(4);
  mesh.visible = true;
  view.syncDepth();
  expect(depth.visible).toBe(true);
  expect(depth.geometry).toBe(geometry);
  expect(mesh.customDepthMaterial).toBeDefined();
  view.dispose();
  expect(view.depthScene.children).toHaveLength(0);
  textures.forEach((t) => t.dispose());
  geometry.dispose();
  material.dispose();
});
