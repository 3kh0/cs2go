import { describe, expect, it } from "vitest";
import * as T from "three";
import {
  applyNativeMapFoliage,
  validateNativeFoliageMaterial,
  type NativeFoliageMaterial,
} from "./native-map-foliage";
const source = (): NativeFoliageMaterial => ({
  shader: "csgo_foliage.vfx",
  nativeResource: "synthetic-admission.vmat",
  IntParams: {
    F_VERTEX_ANIMATION: 1,
    F_ALPHA_TEST: 1,
    F_RENDER_BACKFACES: 1,
    F_TRANSMISSIVE_BACKFACE_NDOTL: 1,
  },
  FloatParams: Object.fromEntries(
    [
      "g_flAlphaTestReference",
      "g_flAlphaBoostDistance",
      "g_flAlphaBoostStrength",
      "g_flGrazingAngleMask",
      "g_flVertexAmbientOcclusionAmount",
      "g_flVertexAmbientOcclusionPower",
      "g_flHeightGradientAmount",
      "g_flHeightGradientPower",
      "g_flReflectance",
      "g_fTextureNormalContrast",
      "g_fTextureRoughnessContrast",
      "g_fTextureRoughnessBrightness",
      "g_flSwayAmount",
      "g_flSwaySpeed",
      "g_flSwayNoiseScale",
      "g_flSwayFalloff",
      "g_flFlutterAmount",
      "g_flFlutterSpeed",
      "g_flFlutterNoiseScale",
      "g_flFlutterFalloff",
    ].map((name) => [name, name === "g_flHeightGradientAmount" ? 0 : 1]),
  ),
  VectorParams: {},
  textures: {},
  resolvedMaterialInputs: {
    g_bDontFlipBackfaceNormals: 0,
    g_bRenderBackfaceNormals: 1,
    g_bTransmissiveShadows: 1,
    g_bApplyColorCorrectionToTransmissiveColor: 0,
    g_vTexCoordXform0: [1, 0, 0, 0],
    g_vTexCoordXform1: [0, 1, 0, 0],
    g_vTexCoordScrollSpeed: [0, 0, 0, 0],
  },
});
describe("native foliage admission", () => {
  it("rejects animation branches outside the demonstrated source programs", () => {
    const x = source();
    expect(() => validateNativeFoliageMaterial(x)).not.toThrow();
    x.IntParams.F_VERTEX_ANIMATION = 3;
    expect(() => validateNativeFoliageMaterial(x)).toThrow(/animation selection/);
  });
  it("admits proved bare0 without requiring mode1 fields and rejects unresolved mode2 fields", () => {
    const x = source();
    x.IntParams = {};
    x.resolvedMaterialInputs.g_bRenderBackfaceNormals = 0;
    delete x.FloatParams.g_flSwaySpeed;
    expect(() => validateNativeFoliageMaterial(x)).not.toThrow();
    x.IntParams.F_VERTEX_ANIMATION = 2;
    expect(() => validateNativeFoliageMaterial(x)).toThrow(/g_flNoise1Strength/);
  });
  it("does not silently replace authored brightness with identity", () => {
    const x = source();
    x.FloatParams.g_fTextureColorBrightness = 1.2;
    expect(() => validateNativeFoliageMaterial(x)).toThrow(/explicit qualified color matrix/);
    x.colorCorrectionMatrix = [1.2, 0, 0, 0, 1.2, 0, 0, 0, 1.2];
    expect(() => validateNativeFoliageMaterial(x)).not.toThrow();
  });
  it("rejects absent native defaults and unsupported UV/face selections", () => {
    const x = source();
    delete x.FloatParams.g_flReflectance;
    expect(() => validateNativeFoliageMaterial(x)).toThrow(/g_flReflectance/);
    const y = source();
    y.resolvedMaterialInputs.g_vTexCoordXform0 = [2, 0, 0, 0];
    expect(() => validateNativeFoliageMaterial(y)).toThrow(/affine UV/);
    const z = source();
    z.resolvedMaterialInputs.g_bTransmissiveShadows = 0;
    expect(() => validateNativeFoliageMaterial(z)).toThrow(/transmission selection/);
  });
});

it("shares one owned coverage material across source instances and preserves no-cast policy after broad setup", () => {
  const definition = source();
  definition.IntParams.F_USE_ALBEDO_FOR_TRANSMISSIVE = 1;
  definition.IntParams.F_DO_NOT_CAST_SHADOWS = 1;
  definition.textures = { g_tColor: "color", g_tNormal: "normal", g_tAmbientOcclusion: "ao" };
  const root = new T.Group(),
    geometry = new T.PlaneGeometry();
  geometry.computeTangents();
  geometry.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(16).fill(1), 4));
  const material = new T.MeshStandardMaterial();
  material.name = "leaf";
  const a = new T.Mesh(geometry, material),
    b = new T.Mesh(geometry, material);
  root.add(a, b);
  const noise = new T.Data3DTexture(new Uint8Array(32), 2, 2, 2);
  noise.colorSpace = T.NoColorSpace;
  const textures = new Map(
    ["color", "normal", "ao"].map((key) => [key, new T.DataTexture(new Uint8Array(4), 1, 1)]),
  );
  const lookup = new T.DataTexture(new Uint8Array(4), 1, 1);
  const view = applyNativeMapFoliage(
    root,
    {
      materials: { leaf: definition },
      textures,
      lookup,
      noise,
      source: { model: "controlled", noise: "controlled" },
    },
    { windState: { direction: [1, 0, 0], strength: 1, timeSeconds: 0 } },
  );
  expect(view.depthScene.children).toHaveLength(2);
  const depth = (view.depthScene.children[0] as T.Mesh).material;
  expect((view.depthScene.children[1] as T.Mesh).material).toBe(depth);
  a.castShadow = b.castShadow = true;
  view.applyShadowPolicy();
  expect(a.castShadow).toBe(false);
  expect(b.castShadow).toBe(false);
  let depthDisposals = 0,
    geometryDisposals = 0;
  for (const d of Array.isArray(depth) ? depth : [depth])
    d.addEventListener("dispose", () => depthDisposals++);
  geometry.addEventListener("dispose", () => geometryDisposals++);
  view.dispose();
  view.dispose();
  expect(depthDisposals).toBe(1);
  expect(geometryDisposals).toBe(0);
});
