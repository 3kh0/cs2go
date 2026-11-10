import type { NativeGlassMaterial } from "../src/native-map-glass";
/** Actual panel VMAT and sealed native compiled inputs, build26445667. */
export const nativeGlassSource: NativeGlassMaterial = {
  IntParams: { g_bFogEnabled: 1, g_nTextureAddressModeU: 0, g_nTextureAddressModeV: 0 },
  FloatParams: {},
  VectorParams: {
    g_vTexCoordOffset: [0.0, 0.0, 0.0, 0.0],
    g_vTexCoordScale: [1.0, 1.0, 0.0, 0.0],
    GlassMaskColor: [0.0, 0.0, 0.0, 0.0],
    GlassMaskTransmission: [0.0, 0.0, 0.0, 0.0],
    GlassTintColor: [1.0, 1.0, 1.0, 0.0],
  },
  shader: "csgo_glass.vfx",
  nativeResource: "materials/glass/hr_g/hr_glass_panel_001.vmat_c",
  textures: {
    g_tGlassDust: "g_tGlassDust",
    g_tGlassTintColor: "g_tGlassTintColor",
    g_tNormal: "g_tNormal",
  },
  resolvedMaterialInputs: {
    g_bDontFlipBackfaceNormals: [0.0, 0.0, 0.0, 0.0],
    g_bFogEnabled: [1, 1, 1, 1],
    g_bRenderBackfaceNormals: [0.0, 0.0, 0.0, 0.0],
    g_flModelTintAmount: [1.0, 0.0, 0.0, 0.0],
    g_flReflectance: [
      0.04000000000000001, 0.04000000000000001, 0.04000000000000001, 0.04000000000000001,
    ],
    g_flTranslucencyRemap: [0.0, 1.0, 0.0, 0.0],
  },
};
