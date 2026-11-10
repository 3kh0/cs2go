import { expect, test } from "vitest";
import * as T from "three";
import {
  bindNativeComplexDecalUv,
  validateNativeComplexDecal,
  type NativeComplexDecalSource,
} from "./native-complex-decal";

test("crate decals admit only the exact shipped selection and resolved secondary replacement path", () => {
  const source: NativeComplexDecalSource = {
    decalSelection: "nuke-crates-vs10-ps9610",
    decalSourceSha256: "9b0554ebda30643754572c429c1f0bcb5eb917bd6d8b551b47851719029e5041",
    nativeResource: "materials/models/props/de_nuke/hr_nuke/metal_crate_001/metal_crate_001b.vmat",
    IntParams: { F_DECAL_TEXTURE: 1, F_SECONDARY_UV: 1, F_METALNESS_TEXTURE: 1, F_TINT_MASK: 1 },
    textures: { g_tDecal: "original-shared-native-decal" },
    resolvedMaterialInputs: {
      g_nDecalBlendMode: [0, 0, 0, 0],
      g_bUseSecondaryUvForDecal: [1, 1, 1, 1],
      g_bUseSecondaryUvForAmbientOcclusion: [0, 0, 0, 0],
      g_bUseSecondaryUvForTintMask: [0, 0, 0, 0],
    },
  };
  expect(validateNativeComplexDecal(source)).toBe(true);
  expect(validateNativeComplexDecal({ ...source, decalSelection: undefined })).toBe(false);
  expect(() => validateNativeComplexDecal({ ...source, decalSourceSha256: "different" })).toThrow();
  expect(() =>
    validateNativeComplexDecal({ ...source, IntParams: { ...source.IntParams, F_ALPHA_TEST: 1 } }),
  ).toThrow();
  for (const field of ["g_nDecalBlendMode", "g_bUseSecondaryUvForDecal"])
    expect(() =>
      validateNativeComplexDecal({
        ...source,
        resolvedMaterialInputs: { ...source.resolvedMaterialInputs, [field]: [0.5, 0.5, 0.5, 0.5] },
      }),
    ).toThrow();
});

test("secondary decal preserves its original stream and cannot substitute the lightmap atlas", () => {
  const geometry = new T.PlaneGeometry();
  const atlas = new T.Float32BufferAttribute(Array(8).fill(0.25), 2),
    secondary = new T.Float32BufferAttribute(Array(8).fill(0.75), 2);
  geometry.setAttribute("uv1", atlas);
  expect(() => bindNativeComplexDecalUv(geometry)).toThrow("secondary UV");
  geometry.setAttribute("uv2", secondary);
  bindNativeComplexDecalUv(geometry);
  expect(geometry.getAttribute("nativeComplexDecalUv")).toBe(secondary);
  expect(geometry.getAttribute("uv1")).toBe(atlas);
  geometry.dispose();
});
