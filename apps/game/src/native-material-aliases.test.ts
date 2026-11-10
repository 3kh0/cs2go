import { expect, test } from "vitest";
import { bindNativeMaterialAliases, type NativeMaterialAlias } from "./native-material-aliases";
const source = {
  shader: "csgo_environment.vfx",
  nativeResource: "materials/native/prop.vmat",
  IntParams: { F_ALPHA_TEST: 1 },
  FloatParams: { g_flAlphaTestReference: 0.3 },
  textures: { g_tColor: "exact-original-texture" },
};
const alias: NativeMaterialAlias = {
  sourceName: "native-prop",
  shader: source.shader,
  nativeResource: source.nativeResource,
  definition: source,
  names: ["piece-owner-one", "piece-owner-two"],
};
test("validated source piece names reuse the same exact native definition and texture IDs", () => {
  const materials: Record<string, typeof source> = { "native-prop": source };
  expect(bindNativeMaterialAliases(materials, [alias])).toBe(2);
  expect(materials["piece-owner-one"]).toBe(source);
  expect(materials["piece-owner-two"].textures).toBe(source.textures);
});
test("mismatched shader, resource or original definition fails atomically instead of applying a guessed family", () => {
  for (const changed of [
    { shader: "csgo_complex.vfx" },
    { nativeResource: "materials/native/other.vmat" },
    { definition: { ...source, FloatParams: { g_flAlphaTestReference: 0.7 } } },
  ]) {
    const materials: Record<string, typeof source> = { "native-prop": source };
    expect(() =>
      bindNativeMaterialAliases(materials, [alias, { ...alias, ...changed, names: ["invalid"] }]),
    ).toThrow("source changed");
    expect(materials["piece-owner-one"]).toBeUndefined();
  }
});
test("key ordering does not change source equality; conflicting active names and missing bundles reject", () => {
  const definition = {
    textures: source.textures,
    FloatParams: source.FloatParams,
    IntParams: source.IntParams,
    nativeResource: source.nativeResource,
    shader: source.shader,
  };
  const materials: Record<string, typeof source> = { "native-prop": source };
  expect(bindNativeMaterialAliases(materials, [{ ...alias, definition }])).toBe(2);
  expect(() => bindNativeMaterialAliases(undefined, [alias])).toThrow("original material bundle");
  materials["piece-owner-one"] = { ...source, nativeResource: "materials/unrelated.vmat" };
  expect(() => bindNativeMaterialAliases(materials, [alias])).toThrow("Conflicting");
});
