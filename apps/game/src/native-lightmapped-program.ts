import type { NativeLightmappedMaterial } from "./native-map-lightmapped";
const nativeSources: Record<string, readonly [string, string]> = {
  "materials/metal/metalvent015a.vmat": [
    "241ccebdf5dac73943dc68217f89be460022b8243a9fc12366eab3c903d47209",
    "plain-opaque",
  ],
  "materials/de_cache/backdrop/cache_backdrop_ac_001.vmat": [
    "bf096097cf245cde4a816d5ac56785600bba9ed210071b0bbf1c24db7c0308e3",
    "plain-opaque",
  ],
  "materials/de_dust/door03.vmat": [
    "74fc203f7a6cbb5bf27d21c58c19235bf92f259f607f79c8014aa097208efe61",
    "plain-opaque",
  ],
  "materials/de_cache/backdrop/plant_metal_002.vmat": [
    "47a9981f100c1928fa1b227bb6c102c441a8e8b05f87119a8e1bb4a6484af44d",
    "detail1-opaque",
  ],
  "materials/de_cache/backdrop/plant_metal_004.vmat": [
    "f91f1112bf20b5bf89f5f3ce6c4c16ead7ca86a3bce98cc740081255ace9bb5e",
    "detail1-opaque",
  ],
  "materials/de_cache/backdrop/plant_metal_003.vmat": [
    "848c15b2ff26a99a4f3c95ad5e7770e5826d11391f42d70b1a335835b1dad411",
    "plain-opaque",
  ],
  "materials/metal/metalvent005a.vmat": [
    "58c1b7204485b9f3b1c366e5c2cc7fdb477945aaed07fa9c601646aee61d940d",
    "plain-opaque",
  ],
  "materials/cs_italy/black.vmat": [
    "5724f2cac7f05b9ec713ab48fb6e0e1688b3405ee4c6b56fbd77dcaf364732ea",
    "plain-opaque",
  ],
  "materials/concrete/hr_c/hr_concrete_roof_001.vmat": [
    "5079e85dfe7da72832d10d3740f35de096293cffb3031194dd2141030090f596",
    "detail1-opaque",
  ],
  "materials/de_nuke/hr_nuke_handicapped_parking.vmat": [
    "25e8b065e9f59499f70c4ae667d0574fb0078c13305cb9c7515319af4c819cc0",
    "nonspec-overlay",
  ],
  "materials/ground/hr_g/ground_farm_01.vmat": [
    "7911615d192962ded0bd097d0a51daed43a1ce7141ff57f4b962bd219acf09a9",
    "detail1-opaque",
  ],
  "materials/concrete/hr_c/hr_concrete_wall_005.vmat": [
    "7d1eb11f98c9476cb42516f9156f046f97886c9fd27aaf1902ab9c8eadd815f5",
    "detail1-opaque",
  ],
  "materials/metal/ibeam.vmat": [
    "d8557a0308bba17c81ab1c5e416f54859560cd07b19e673a8e3824fae4855e3a",
    "specular-opaque",
  ],
  "materials/ar_dizzy/dizzy_drywall_color.vmat": [
    "8641908881dc16aff9acb85f4314f62d7ab0390345a63bd6db28f39d59e110ea",
    "specular-opaque",
  ],
  "materials/decals/constructionmarkup_spray.vmat": [
    "c47db7c60af8f8cb2bb9f624ec5509b21759f67c51d3e23463644777b9bc1696",
    "nonspec-overlay",
  ],
  "materials/ar_dizzy/dizzy_wooden_planks_02.vmat": [
    "c408f179ed5f6f4020b6524b06b8469d6f2bacb7503952e27516fdf5eea5cbe3",
    "specular-opaque",
  ],
  "materials/concrete/hr_c/hr_concrete_floor_05.vmat": [
    "1969166de3199b97ac207e7058fec3094b9ceb95701ae1afa2a147f58951263f",
    "detail1-opaque",
  ],
  "materials/ar_dizzy/dizzy_drywall_patched_color.vmat": [
    "e8781ce05797bbec649acc5614a6cff65f7945a141d2870cf70bd5f313570d8a",
    "specular-opaque",
  ],
  "materials/concrete/hr_c/hr_concrete_stairs_01_color.vmat": [
    "f33dd18a98663658e296f87448a7becde74223ad1968fda35fddc9679500ec7e",
    "plain-opaque",
  ],
  "materials/metal/vertigo_ibeam.vmat": [
    "b2d5855ada6886290d90f2e6074f3f68618fc901e955ec0c1ce49ec7f822e7f5",
    "detail1-opaque",
  ],
  "materials/overlays/trash_01.vmat": [
    "8dd4c813acfcccf64744a89bdac645072fb2b9ac59d3f6ec3f9fa5c9521849ee",
    "nonspec-overlay",
  ],
  "materials/decals/trashdecal02a.vmat": [
    "ffcf6a313a01cf6beb5a3e4304fc87be5c1711b80104eb6864772308593d3a5f",
    "nonspec-overlay",
  ],
  "materials/hr_massive/wood_planks_4.vmat": [
    "c4a0976867d3cb080b4647a90b6498efdd2b706af067d57cec0e93106c1f0506",
    "plain-opaque",
  ],
  "materials/ar_dizzy/dizzy_insulation_back_color.vmat": [
    "08886e8005850a7542e1e59761a5bc7368fee521176e390739dd2debce1ffc62",
    "plain-opaque",
  ],
  "materials/decals/vertigo_paint.vmat": [
    "e962a2ac146e34f7453ad35d757d35b5dd699347fdd0dddde52ff9d66adddc3f",
    "nonspec-overlay",
  ],
  "materials/decals/trash_00.vmat": [
    "1fcb81045d877e93d931920b9b63e824fea4aec8be5ffbe7f5b46b5d0aabd939",
    "nonspec-overlay",
  ],
  "materials/de_nuke/nuke_metaltrims_01.vmat": [
    "92228d8681c0d938358b1a7a31898003a363f121ad3c38a0d5fc444a2f00418e",
    "plain-opaque",
  ],
  "materials/decals/bombsite_letter_a_spray.vmat": [
    "7014565f2c3ae6676f1def5ee82de3cbc2345ed269fd754b9592fb38e4b3cf36",
    "nonspec-overlay",
  ],
  "materials/ar_dizzy/dizzy_facade_color.vmat": [
    "63c5f509db368ef32e159b85cf92597e9a82fbe11c32e02fdf771038ca4a4663",
    "specular-opaque",
  ],
  "materials/de_vertigo/safety_sign_2.vmat": [
    "748582d1bdf62309b7b4b795d642b8f57da5f6f00b929dc9f7c809d45d078b70",
    "specular-opaque",
  ],
  "materials/overlays/vertigo_sign_fall_overlay.vmat": [
    "e538796f1d40fedd0bf67060b4a4511bb33a7c769aaedecdeafbc12afec38ae9",
    "nonspec-overlay",
  ],
  "materials/decals/bombsite_right_arrow_spray.vmat": [
    "5a57adb38923b9c8b18e650e2bef4019d7c659948d767af86093aa4d9269987a",
    "nonspec-overlay",
  ],
  "materials/decals/vertigo_sign_accessladder.vmat": [
    "ade43bfb9ca02108f76090182305a2f3b896995bd7cb10c1d86ccf8151148356",
    "nonspec-overlay",
  ],
  "materials/decals/bombsite_letter_b_spray.vmat": [
    "6da152573d7701f3f542dd6fe4139e0efc05db1a311ce2ae84d8518bf1d15b2e",
    "nonspec-overlay",
  ],
  "materials/effects/green.vmat": [
    "4a99e440da0d6defbfa5a0ffa1fb297c45db9ecd44f0043f927d2bf4c0f828bd",
    "plain-opaque",
  ],
  "materials/buildings/vertigo_insulation_back.vmat": [
    "43ee0cecbcfbfeb6aac1bdbf294be40408a730caff2838c01a753a7022cb7c7d",
    "plain-opaque",
  ],
  "materials/decals/bombsite_left_arrow_spray.vmat": [
    "4b307da2d1836dc6c17e50007fdd008db0235f77d0f317e4a0464786f843767e",
    "nonspec-overlay",
  ],
  "materials/overlays/vertigo_sign_overlay.vmat": [
    "cf2e349cd72811a6bd86061935029091f6b65eb1266df9f1e3e56c8e552119c9",
    "nonspec-overlay",
  ],
  "materials/de_nuke/nuke_metaldoor_01.vmat": [
    "13389ac38b16137dea01471ceb5693307ed393a095e922c1efdbf59f94be1809",
    "specular-opaque",
  ],
};
export type NativeLightmappedProgramKind =
  | "plain-opaque"
  | "detail1-opaque"
  | "specular-opaque"
  | "nonspec-overlay";
function value(s: NativeLightmappedMaterial, key: string) {
  const v = s.resolvedMaterialInputs[key];
  if (!Array.isArray(v) || v.length !== 4 || v.some((n) => !Number.isFinite(n)))
    throw new Error(`Native lightmapped four-lane input missing: ${key}`);
  return v;
}
export function nativeLightmappedProgram(s: NativeLightmappedMaterial) {
  if (s.selectedContract !== "lmg-four-build26445667") return undefined;
  const identity = nativeSources[s.nativeResource.replace(/_c$/, "")];
  if (!identity || identity[0] !== s.nativeSourceSha256 || identity[1] !== s.programKind)
    throw new Error("Native lightmapped program resource/identity mismatch");
  const kind = s.programKind!,
    direct = kind === "specular-opaque",
    detail = kind === "detail1-opaque",
    overlay = kind === "nonspec-overlay";
  const flags: Record<string, number> = direct
    ? { F_SPECULAR_DIRECT: 1, F_SPECULAR_INDIRECT: 1 }
    : detail
      ? { F_DETAILTEXTURE: 1 }
      : overlay
        ? { F_OVERLAY: 1, F_TRANSLUCENT: 1 }
        : {};
  for (const [k, v] of Object.entries(s.IntParams))
    if (k.startsWith("F_") && v !== (flags[k] ?? 0))
      throw new Error(`Unsupported selected native lightmapped feature: ${k}`);
  for (const [k, v] of Object.entries(flags))
    if (s.IntParams[k] !== v) throw new Error(`Native lightmapped feature missing: ${k}`);
  for (const [k, n] of [
    ["g_bDontFlipBackfaceNormals", 0],
    ["g_bRenderBackfaceNormals", 0],
    ["g_flModelTintAmount", 1],
    ["g_flVertexColorOpacityScale", 1],
  ] as const)
    if (value(s, k).some((v) => v !== n))
      throw new Error(`Native lightmapped baseline differs: ${k}`);
  if (
    value(s, "g_vColorTint")
      .slice(0, 3)
      .some((v) => v !== 1)
  )
    throw new Error("Native lightmapped model tint requires own selected proof");
  if (direct && value(s, "g_bNoSpecularAtFullRoughness").some((v) => v !== 0))
    throw new Error("Native lightmapped full-roughness specular switch unproved");
  const layerTint = value(s, "g_vLayer1Tint").slice(0, 3),
    metalness = value(s, "g_flMetalness")[0];
  if (metalness < 0 || metalness > 1)
    throw new Error("Native lightmapped static metalness out of source range");
  const detailScale = detail ? value(s, "g_vLayer1DetailScale").slice(0, 2) : [1, 1],
    detailTint = detail ? value(s, "g_vLayer1DetailTintAndBlend") : [1, 1, 1, 0];
  if (detail && value(s, "g_bAddBumpMaps").some((v) => v !== 0))
    throw new Error("Native lightmapped bump/detail combination unproved");
  const opacity = overlay ? value(s, "g_flOpacityScale")[0] : 1,
    reference = overlay ? value(s, "g_flAlphaTestReference")[0] : 0,
    reflectance = direct ? value(s, "g_flReflectance")[0] : 0;
  if (overlay && (opacity !== 1 || Math.abs(reference - 0.01) > 1e-6))
    throw new Error("Native lightmapped overlay opacity program differs");
  return {
    kind,
    direct,
    indirect: direct,
    detail,
    overlay,
    layerTint,
    metalness,
    detailScale,
    detailTint,
    opacity,
    reference,
    reflectance,
  };
}
