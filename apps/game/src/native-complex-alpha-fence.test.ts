import { expect, test } from "vitest";
import { nativeComplexRareSources } from "../tests/native-complex-rare-source-fixture";
import { nativeOpaqueAlphaMaterials } from "./native-complex-alpha-fence";
import { validateNativeComplexMaterial, type NativeComplexMaterial } from "./native-map-complex";
const resource =
  "materials/models/props/de_nuke/hr_nuke/chainlink_fence_001/chainlink_fence_wire_001.vmat";
function source(path: keyof typeof nativeOpaqueAlphaMaterials): NativeComplexMaterial {
  const native = nativeOpaqueAlphaMaterials[path];
  return {
    ...nativeComplexRareSources.mountains,
    nativeResource: path,
    IntParams: { F_ALPHA_TEST: 1 },
    advancedSelection: {
      contract: "opaque-alpha-build26445667",
      group: "opaque-alpha",
      sourceSha256: native.sha256,
    },
    resolvedMaterialInputs: {
      ...nativeComplexRareSources.mountains.resolvedMaterialInputs,
      ...Object.fromEntries(
        Object.entries(native.scalars).map(([key, value]) => [key, [value, value, value, value]]),
      ),
    },
  };
}
test("source-bound opaque alpha family admits the replayed VMATs with authored coverage", () => {
  for (const key of Object.keys(
    nativeOpaqueAlphaMaterials,
  ) as (keyof typeof nativeOpaqueAlphaMaterials)[])
    expect(() => validateNativeComplexMaterial(source(key))).not.toThrow();
  expect(nativeOpaqueAlphaMaterials[resource].scalars).toEqual({
    g_flAlphaTestReference: 0.439,
    g_flAntiAliasedEdgeStrength: 1,
    g_flMetalness: 1,
    g_flModelTintAmount: 0,
  });
});
test("fence admission rejects source substitution and tuned coverage or metalness", () => {
  const original = source(resource);
  expect(() =>
    validateNativeComplexMaterial({ ...original, nativeResource: "materials/unknown.vmat" }),
  ).toThrow("identity");
  expect(() =>
    validateNativeComplexMaterial({
      ...original,
      advancedSelection: { ...original.advancedSelection!, sourceSha256: "wrong" },
    }),
  ).toThrow("identity");
  for (const name of Object.keys(nativeOpaqueAlphaMaterials[resource].scalars)) {
    const previous = original.resolvedMaterialInputs[name] as number[];
    expect(() =>
      validateNativeComplexMaterial({
        ...original,
        resolvedMaterialInputs: {
          ...original.resolvedMaterialInputs,
          [name]: [previous[0] + 0.1, 0, 0, 0],
        },
      }),
    ).toThrow("source scalar");
  }
  expect(() =>
    validateNativeComplexMaterial({
      ...original,
      IntParams: { ...original.IntParams, F_TRANSLUCENT: 1 },
    }),
  ).toThrow("selection changed");
  expect(() =>
    validateNativeComplexMaterial({ ...original, advancedSelection: undefined }),
  ).toThrow("Unsupported native complex feature");
});
