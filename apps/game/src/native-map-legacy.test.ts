import { expect, test } from "vitest";
import { validateNativeLegacy, type NativeLegacyMaterial } from "./native-map-legacy";
const source = (): NativeLegacyMaterial => ({
  shader: "csgo_vertexlitgeneric.vfx",
  nativeResource: "source.vmat",
  IntParams: { F_SPECULAR_DIRECT: 1, F_SPECULAR_INDIRECT: 1 },
  FloatParams: {},
  VectorParams: {},
  textures: {},
  resolvedMaterialInputs: {
    g_flReflectance: 0.04,
    g_bUseSecondaryUvForAmbientOcclusion: 0,
    g_flAmbientOcclusionScale: 0,
    g_flInverseBlendTint: 1,
  },
});
test("opaque response cannot silently consume missing native wind controls or masked tint", () => {
  for (const flag of ["F_VERTEX_ANIMATION", "F_TINT_MASK", "F_DETAILTEXTURE", "F_ALPHA_TEST"]) {
    const material = source();
    material.IntParams[flag] = 1;
    expect(() => validateNativeLegacy(material)).toThrow(
      `Unsupported native legacy feature: ${flag}`,
    );
  }
});
test("resolved inputs and source vertex transforms are mandatory before native response activation", () => {
  const material = source();
  expect(() => validateNativeLegacy(material)).not.toThrow();
  delete material.resolvedMaterialInputs.g_flReflectance;
  expect(() => validateNativeLegacy(material)).toThrow("g_flReflectance");
  const transformed = source();
  transformed.VectorParams.g_vNormalTexCoordScale = [2, 1];
  expect(() => validateNativeLegacy(transformed)).toThrow("g_vNormalTexCoordScale");
});

test("identical exported colors retain different native material slots and aliases avoid unrelated piece indices", async () => {
  const T = await import("three"),
    { selectNativeLegacyMaterial } = await import("./native-map-legacy");
  const first = source(),
    second = source();
  first.exportedName = second.exportedName = "same-export-name";
  first.nativeResource = "first.vmat";
  second.nativeResource = "second.vmat";
  first.exportedVariants = [{ packedMaterialIndex: 263, baseColorFactor: [1, 1, 1, 1] }];
  second.exportedVariants = [{ packedMaterialIndex: 273, baseColorFactor: [1, 1, 1, 1] }];
  const material = new T.MeshStandardMaterial();
  material.name = "same-export-name";
  const definitions = { first, second };
  material.userData.nativeGltfMaterialIndex = 273;
  expect(selectNativeLegacyMaterial(material, definitions)).toBe(second);
  delete material.userData.nativeGltfMaterialIndex;
  expect(() => selectNativeLegacyMaterial(material, definitions)).toThrow("Ambiguous");
  material.name = "source-piece-alias";
  material.userData.nativeGltfMaterialIndex = 0;
  expect(selectNativeLegacyMaterial(material, { "source-piece-alias": first })).toBe(first);
  material.dispose();
});
