import { describe, expect, it } from "vitest";
import * as T from "three";
import {
  bindNativeLightmappedTextures,
  selectNativeLightmappedMaterial,
  validateNativeLightmapped,
  type NativeLightmappedMaterial,
} from "./native-map-lightmapped";
function source(): NativeLightmappedMaterial {
  return {
    shader: "csgo_lightmappedgeneric.vfx",
    nativeResource: "materials/de_nuke/hr_nuke_noparking_corner_left.vmat",
    selectedContract: "parking-8070-1158",
    exportedName: "parking",
    exportedVariants: [
      {
        packedMaterialIndex: 648,
        baseColorFactor: [0.694, 0.178, 0.0036, 1],
        nativeCombinedVSFactor: [0.851, 0.459, 0.046, 1],
      },
    ],
    tintTransportQualification: "Native FLOAT transport, private packed upload unobserved",
    IntParams: {
      F_OVERLAY: 1,
      F_TRANSLUCENT: 1,
      F_SPECULAR_DIRECT: 1,
      F_SPECULAR_INDIRECT: 1,
      g_nTextureAddressModeU: 2,
      g_nTextureAddressModeV: 2,
    },
    FloatParams: {},
    VectorParams: { g_vColorTint: [1, 1, 1, 0], g_vLayer1Tint: [1, 1, 1, 0] },
    textures: {
      g_tColor: "color",
      g_tLayer1NormalRoughness: "normal",
      g_tLayer1AmbientOcclusion: "ao",
    },
    resolvedMaterialInputs: {
      g_flReflectance: 0.04,
      g_flMetalness: 0,
      g_flModelTintAmount: 1,
      g_flOpacityScale: 1,
      g_flVertexColorOpacityScale: 1,
      g_flAlphaTestReference: 0.01,
      g_bNoSpecularAtFullRoughness: 0,
      g_bRenderBackfaceNormals: 0,
    },
  };
}
describe("selected native lightmapped overlay admission", () => {
  it("matches original factor AND packed slot before applying qualified tint", () => {
    const s = source(),
      m = new T.MeshStandardMaterial();
    m.name = "parking";
    m.color.setRGB(0.694, 0.178, 0.0036);
    m.userData.nativeGltfMaterialIndex = 648;
    expect(selectNativeLightmappedMaterial(m, { s })?.variant.nativeCombinedVSFactor).toEqual([
      0.851, 0.459, 0.046, 1,
    ]);
    m.userData.nativeGltfMaterialIndex = 649;
    expect(() => selectNativeLightmappedMaterial(m, { s })).toThrow("identity");
  });
  it("rejects unproved opaque/backface/detail branches and ignores tint W", () => {
    const s = source();
    expect(() => validateNativeLightmapped(s)).not.toThrow();
    s.IntParams.F_RENDER_BACKFACES = 1;
    expect(() => validateNativeLightmapped(s)).toThrow("feature");
  });
  it("isolates UserConfig clamp from AO's native trilinear wrap", () => {
    const s = source(),
      owned = new Map<string, T.Texture>();
    for (const id of Object.values(s.textures)) {
      const t = new T.Texture();
      t.wrapS = t.wrapT = T.RepeatWrapping;
      owned.set(id, t);
    }
    const original = owned.get("color"),
      b = bindNativeLightmappedTextures(s, owned);
    expect(b.get("g_tColor")).not.toBe(original);
    expect(b.get("g_tColor")?.wrapS).toBe(T.ClampToEdgeWrapping);
    expect(b.get("g_tLayer1AmbientOcclusion")?.wrapS).toBe(T.RepeatWrapping);
    expect(original?.wrapS).toBe(T.RepeatWrapping);
    expect(bindNativeLightmappedTextures(s, owned).get("g_tColor")).toBe(b.get("g_tColor"));
  });
});
