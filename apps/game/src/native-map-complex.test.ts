import { expect, test, vi } from "vitest";
import * as T from "three";
import { loadNativeMapComplex } from "./native-map-complex";
import { loadSourceMaterialBundle } from "./source-layers";
import { loadSourceSurfaceLookup } from "./source-surface";
vi.mock("./source-layers", () => ({ loadSourceMaterialBundle: vi.fn() }));
vi.mock("./source-surface", () => ({
  loadSourceSurfaceLookup: vi.fn(),
  applySourceSurface: vi.fn(),
}));
test("a failed shared lookup releases native complex payloads that map ownership never received", async () => {
  const texture = new T.Texture(),
    dispose = vi.spyOn(texture, "dispose");
  vi.mocked(loadSourceMaterialBundle).mockResolvedValue({
    materials: {},
    textures: new Map([
      ["native", texture],
      ["alias", texture],
    ]),
  });
  vi.mocked(loadSourceSurfaceLookup).mockRejectedValue(new Error("lookup unavailable"));
  await expect(loadNativeMapComplex({} as T.WebGLRenderer, "/native/source.json")).rejects.toThrow(
    "lookup unavailable",
  );
  expect(dispose).toHaveBeenCalledTimes(1);
});
test("successful complex loading leaves the shared BRDF lookup outside texture ownership", async () => {
  const texture = new T.Texture(),
    shared = new T.DataTexture();
  vi.mocked(loadSourceMaterialBundle).mockResolvedValue({
    materials: {},
    textures: new Map([["native", texture]]),
  });
  vi.mocked(loadSourceSurfaceLookup).mockResolvedValue(shared);
  const result = await loadNativeMapComplex({} as T.WebGLRenderer, "/native/source.json");
  expect(result.lookup).toBe(shared);
  expect([...result.textures.values()]).toEqual([texture]);
});

test("same-named native resources select by retained linear factor and reject ambiguity", async () => {
  const { selectNativeComplexMaterial } = await import("./native-map-complex");
  const { nativeComplexSource } = await import("../tests/native-complex-source-fixture");
  const material = new T.MeshStandardMaterial();
  material.name = "metal_door_001";
  material.color.setRGB(0.16, 0.17, 0.18);
  const a = {
      ...nativeComplexSource,
      nativeResource: "a.vmat",
      exportedName: material.name,
      exportedVariants: [{ baseColorFactor: [0.16, 0.17, 0.18, 1] }],
    },
    b = {
      ...nativeComplexSource,
      nativeResource: "b.vmat",
      exportedName: material.name,
      exportedVariants: [{ baseColorFactor: [0.6, 0.7, 0.8, 1] }],
    };
  expect(selectNativeComplexMaterial(material, { a, b })).toBe(a);
  material.color.setRGB(0.6, 0.7, 0.8);
  expect(selectNativeComplexMaterial(material, { a, b })).toBe(b);
  material.color.setRGB(0.1, 0.2, 0.3);
  expect(() => selectNativeComplexMaterial(material, { a, b })).toThrow("Ambiguous");
  material.color.setRGB(0.16, 0.17, 0.18);
  expect(() =>
    selectNativeComplexMaterial(material, { a, b: { ...b, exportedVariants: a.exportedVariants } }),
  ).toThrow("Ambiguous");
  material.dispose();
});

test("source-byte tint correction follows old factor selection and cannot silently miss an instance", async () => {
  const { applyNativeMapComplex } = await import("./native-map-complex");
  const { nativeComplexSource } = await import("../tests/native-complex-source-fixture");
  const geometry = new T.PlaneGeometry(1, 1);
  geometry.computeTangents();
  const material = new T.MeshStandardMaterial();
  material.name = "corrected";
  material.color.setRGB(0.3, 0.6, 0.9);
  const root = new T.Mesh(geometry, material),
    texture = new T.DataTexture();
  const source = {
    ...nativeComplexSource,
    exportedVariants: [
      { baseColorFactor: [0.3, 0.6, 0.9, 1], nativeCombinedVSFactor: [0.2, 0.4, 0.8, 1] },
    ],
  };
  const bundle = {
    materials: { corrected: source },
    textures: new Map(Object.keys(nativeComplexSource.textures).map((id) => [id, texture])),
    lookup: texture,
  };
  applyNativeMapComplex(root, bundle);
  expect(material.color.toArray()).toEqual([0.2, 0.4, 0.8]);
  material.color.setRGB(0.5, 0.5, 0.5);
  expect(() => applyNativeMapComplex(root, bundle)).toThrow("tint instance identity missing");
  geometry.dispose();
  material.dispose();
  texture.dispose();
});

test("audited packed slots distinguish identical glTF approximations with different native masks", async () => {
  const { selectNativeComplexMaterial } = await import("./native-map-complex");
  const { nativeComplexSource } = await import("../tests/native-complex-source-fixture");
  const material = new T.MeshStandardMaterial();
  material.name = "same";
  material.color.setRGB(0.3, 0.4, 0.5);
  const base = { ...nativeComplexSource, exportedName: "same" },
    a = {
      ...base,
      nativeResource: "a",
      exportedVariants: [{ packedMaterialIndex: 263, baseColorFactor: [0.3, 0.4, 0.5, 1] }],
    },
    b = {
      ...base,
      nativeResource: "b",
      exportedVariants: [{ packedMaterialIndex: 273, baseColorFactor: [0.3, 0.4, 0.5, 1] }],
    };
  expect(() => selectNativeComplexMaterial(material, { a, b })).toThrow("Ambiguous");
  material.userData.nativeGltfMaterialIndex = 263;
  expect(selectNativeComplexMaterial(material, { a, b })).toBe(a);
  material.userData.nativeGltfMaterialIndex = 273;
  expect(selectNativeComplexMaterial(material, { a, b })).toBe(b);
  material.userData.nativeGltfMaterialIndex = 274;
  expect(() => selectNativeComplexMaterial(material, { a, b })).toThrow("Ambiguous");
  material.dispose();
});

test("silo secondary routing requires sealed resource identity and preserves atlas independence", async () => {
  const { nativeSiloSource } = await import("../tests/native-complex-secondary-source-fixture");
  const { validateNativeComplexMaterial, applyNativeMapComplex } =
    await import("./native-map-complex");
  expect(() => validateNativeComplexMaterial(nativeSiloSource)).not.toThrow();
  expect(() =>
    validateNativeComplexMaterial({ ...nativeSiloSource, secondarySourceSha256: "wrong" }),
  ).toThrow("secondary");
  expect(() =>
    validateNativeComplexMaterial({ ...nativeSiloSource, secondarySelection: undefined }),
  ).toThrow();
  const geometry = new T.PlaneGeometry();
  geometry.computeTangents();
  const atlas = geometry.getAttribute("uv").clone(),
    secondary = geometry.getAttribute("uv").clone();
  geometry.setAttribute("uv1", atlas);
  geometry.setAttribute("uv2", secondary);
  const material = new T.MeshStandardMaterial();
  material.name = "silo";
  const second = geometry.clone(),
    root = new T.Group();
  root.add(new T.Mesh(geometry, material), new T.Mesh(second, material));
  const texture = new T.DataTexture();
  const view = applyNativeMapComplex(root, {
    materials: { silo: nativeSiloSource },
    textures: new Map(Object.values(nativeSiloSource.textures).map((k) => [k, texture])),
    lookup: texture,
  });
  expect(geometry.getAttribute("nativeComplexSecondaryUv")).toBe(secondary);
  expect(second.getAttribute("nativeComplexSecondaryUv")).toBe(second.getAttribute("uv2"));
  expect(geometry.getAttribute("uv1")).toBe(atlas);
  view.dispose();
});
