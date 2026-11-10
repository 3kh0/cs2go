import * as T from "three";

export interface NativeComplexDecalSource {
  decalSelection?: "nuke-crates-vs10-ps9610";
  decalSourceSha256?: string;
  nativeResource: string;
  IntParams: Record<string, number>;
  textures: Record<string, string>;
  resolvedMaterialInputs: Record<string, number | number[]>;
}
const selectedMaterials = {
  "materials/models/props/de_nuke/hr_nuke/metal_crate_001/metal_crate_001b.vmat":
    "9b0554ebda30643754572c429c1f0bcb5eb917bd6d8b551b47851719029e5041",
  "materials/models/props/de_nuke/hr_nuke/metal_crate_001/metal_crate_002b.vmat":
    "56c6414105d3f578a4bda8830dc34879b6f1be5c037eff4ee35f6db7e3f536e4",
  "materials/models/props/de_nuke/hr_nuke/metal_crate_001/metal_crate_003b.vmat":
    "b7491d28d216f6ae20859aa8f6850f8c606d7ad2c27401113b2606b03860a15b",
} as const;

/** Installed build26445667 VS10/d1,d9 + PS9610/d0,d4. The selected native
 * compiler expressions bind secondary decal UVs and replacement mode0. */
export function validateNativeComplexDecal(source: NativeComplexDecalSource) {
  if (!source.decalSelection) return false;
  const expected =
    selectedMaterials[source.nativeResource.replace(/_c$/, "") as keyof typeof selectedMaterials];
  if (
    source.decalSelection !== "nuke-crates-vs10-ps9610" ||
    !expected ||
    source.decalSourceSha256 !== expected ||
    ["F_DECAL_TEXTURE", "F_SECONDARY_UV", "F_METALNESS_TEXTURE", "F_TINT_MASK"].some(
      (name) => source.IntParams[name] !== 1,
    ) ||
    Object.entries(source.IntParams).some(
      ([name, value]) =>
        name.startsWith("F_") &&
        value !== 0 &&
        !["F_DECAL_TEXTURE", "F_SECONDARY_UV", "F_METALNESS_TEXTURE", "F_TINT_MASK"].includes(name),
    ) ||
    (source.IntParams.F_DETAIL_TEXTURE ?? 0) !== 0 ||
    !source.textures.g_tDecal
  )
    throw new Error("Unsupported native complex decal selection");
  for (const [name, value] of [
    ["g_nDecalBlendMode", 0],
    ["g_bUseSecondaryUvForDecal", 1],
    ["g_bUseSecondaryUvForAmbientOcclusion", 0],
    ["g_bUseSecondaryUvForTintMask", 0],
  ] as const) {
    const actual = source.resolvedMaterialInputs[name];
    if (!Array.isArray(actual) || actual.length !== 4 || actual.some((v) => v !== value))
      throw new Error(`Native complex decal resolved input differs: ${name}`);
  }
  return true;
}

/** Native PS9610 lines337–356 samples the untouched secondary stream and
 * composites only RGB after tint, before resolving metal F0/diffuse. Native
 * compiler transfer facts support sRGB RGB/linear alpha; actual host view and
 * execution remain unobserved. */
export function applyNativeComplexDecalShader(
  shader: T.WebGLProgramParametersWithUniforms,
  texture: T.Texture,
  blendMode: 0 | 1,
) {
  if (blendMode !== 0 && blendMode !== 1)
    throw new Error("Unsupported native complex decal blend mode");
  const colorAssignment = "diffuseColor.rgb=nativeComplexColor;";
  if (
    !shader.fragmentShader.includes(colorAssignment) ||
    !shader.vertexShader.includes("#include <uv_vertex>")
  )
    throw new Error("Native complex decal requires the native color assembly");
  shader.uniforms.nativeComplexDecalMap = { value: texture };
  shader.vertexShader =
    `attribute vec2 nativeComplexDecalUv;varying vec2 vNativeComplexDecalUv;\n${shader.vertexShader}`.replace(
      "#include <uv_vertex>",
      "#include <uv_vertex>\nvNativeComplexDecalUv=nativeComplexDecalUv;",
    );
  shader.fragmentShader =
    `varying vec2 vNativeComplexDecalUv;uniform sampler2D nativeComplexDecalMap;\n${shader.fragmentShader}`.replace(
      colorAssignment,
      `vec4 nativeComplexDecal=texture2D(nativeComplexDecalMap,vNativeComplexDecalUv);
      nativeComplexColor=${blendMode === 0 ? "nativeComplexDecal.rgb*nativeComplexDecal.a+nativeComplexColor*(1.0-nativeComplexDecal.a)" : "nativeComplexColor*nativeComplexDecal.rgb"};
      ${colorAssignment}`,
    );
}

/** Exact secondary coordinates remain independent of both primary material UVs
 * and the imported lightmap atlas. No transforms are inferred for this stream. */
export function bindNativeComplexDecalUv(geometry: T.BufferGeometry) {
  const uv = geometry.getAttribute("uv2");
  if (!uv || uv.itemSize !== 2 || uv.count !== geometry.getAttribute("position")?.count)
    throw new Error("Native complex decal secondary UV stream missing");
  geometry.setAttribute("nativeComplexDecalUv", uv);
}
