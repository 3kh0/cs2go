import { expect, it } from "vitest";
import { nativeLightmappedProgram } from "./native-lightmapped-program";
import {
  validateNativeLightmapped,
  type NativeLightmappedMaterial,
} from "./native-map-lightmapped";
function selected(): NativeLightmappedMaterial {
  return {
    shader: "csgo_lightmappedgeneric.vfx",
    nativeResource: "materials/de_cache/backdrop/plant_metal_002.vmat",
    nativeSourceSha256: "47a9981f100c1928fa1b227bb6c102c441a8e8b05f87119a8e1bb4a6484af44d",
    programKind: "detail1-opaque",
    selectedContract: "lmg-four-build26445667",
    exportedName: "plant_metal_002",
    exportedVariants: [
      {
        packedMaterialIndex: 109,
        baseColorFactor: [1, 1, 1, 1],
        nativeCombinedVSFactor: [1, 1, 1, 1],
      },
    ],
    tintTransportQualification: "Native BYTE3, originalexporter independentlyreplayed",
    IntParams: { F_DETAILTEXTURE: 1 },
    FloatParams: {},
    VectorParams: {},
    textures: {
      g_tColor: "color",
      g_tLayer1NormalRoughness: "normal",
      g_tLayer1AmbientOcclusion: "ao",
      g_tLayer1Detail: "detail",
    },
    resolvedMaterialInputs: {
      g_bDontFlipBackfaceNormals: [0, 0, 0, 0],
      g_bRenderBackfaceNormals: [0, 0, 0, 0],
      g_flModelTintAmount: [1, 1, 1, 1],
      g_flVertexColorOpacityScale: [1, 1, 1, 1],
      g_vColorTint: [1, 1, 1, 0],
      g_vLayer1Tint: [1, 1, 1, 0],
      g_flMetalness: [0, 0, 0, 0],
      g_vLayer1DetailScale: [0.125, 0.125, 0, 0],
      g_vLayer1DetailTintAndBlend: [1, 1, 1, 0.8],
      g_bAddBumpMaps: [0, 0, 0, 0],
    },
  };
}
it("admits native detail spelling/resource and rejects complex spelling or hash drift", () => {
  const s = selected();
  expect(() => validateNativeLightmapped(s)).not.toThrow();
  expect(nativeLightmappedProgram(s)?.detailScale).toEqual([0.125, 0.125]);
  s.IntParams.F_DETAIL_TEXTURE = 1;
  expect(() => validateNativeLightmapped(s)).toThrow("feature");
  delete s.IntParams.F_DETAIL_TEXTURE;
  s.nativeSourceSha256 = "changed";
  expect(() => validateNativeLightmapped(s)).toThrow("identity");
});
it("holds unknown bump/backface branches and requires all four resolved lanes", () => {
  const s = selected();
  s.resolvedMaterialInputs.g_bAddBumpMaps = [1, 1, 1, 1];
  expect(() => validateNativeLightmapped(s)).toThrow("bump");
  s.resolvedMaterialInputs.g_bAddBumpMaps = [0, 0, 0, 0];
  s.resolvedMaterialInputs.g_vLayer1DetailScale = [0.125, 0.125];
  expect(() => validateNativeLightmapped(s)).toThrow("four-lane");
});
