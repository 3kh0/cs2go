import * as T from "three";
import {
  applyModernEnvironmentShader,
  modernEnvironmentSamplers,
  usesModernEnvironment,
} from "./native-modern-environment";
import {
  bindEnvironmentTextures,
  createEnvironmentTextureBanks,
} from "./native-environment-textures";
import { environmentWetnessCode } from "./native-environment-wetness";
import {
  createEnvironmentWorldFrame,
  type EnvironmentWorldFrame,
} from "./native-environment-frame";
import { createEnvironmentDepthHook, validateEnvironmentAlpha } from "./native-environment-alpha";
import { registerSourceDepth, installSourceShadowDepth } from "./source-depth";
import { environmentEffects } from "./native-environment-effects";
import { loadSourceMaterialBundle } from "./source-layers";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";
import { registerSurfaceTextures } from "./presentation-settings";

export interface SourceEnvironmentMaterial {
  shader: string;
  nativeResource: string;
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
  textures: Record<string, string>;
  textureReflectivity: Record<string, number[]>;
  constants?: Record<string, number[]>;
  textureDimensions?: Record<string, number[]>;
  nativeTextureDimensions?: Record<string, number[]>;
  nativeMipLevels?: Record<string, number>;
  weather?: {
    coverage: number;
    drying: number;
    rain: number;
    ripples: number;
    rippleDirection: number;
    waveResourceQualification: string;
  };
}

const supportedFeatures = new Set([
  "F_MATERIAL_REFERENCE",
  "F_BLEND_EFFECTS_2",
  "F_BLEND_EFFECTS",
  "F_SHARED_COLOR_OVERLAY",
  "F_RENDER_BACKFACES",
  "F_DONT_FLIP_BACKFACE_NORMALS",
  "F_USE_NEW_BLENDING",
  "F_ENABLE_LAYER_3",
  "F_DETAIL_NORMAL",
  "F_BORDER_ROUGHNESS_2",
  "F_BORDER_ROUGHNESS_3",
  "F_BLEND_EFFECTS_3",
  "F_BORDER_BLEND_MODE_2",
  "F_BORDER_BLEND_MODE_3",
  "F_SECONDARY_UV",
  "F_ALPHA_TEST",
  "F_DO_NOT_CAST_SHADOWS",
  "F_OCCLUSION_CULLING_BOUNDS_SCALE",
  "F_BLEND_BY_FACING_DIRECTION_2",
  "F_BLEND_BY_FACING_DIRECTION_3",
  "F_WETNESS",
]);
export function validateSourceEnvironment(source: SourceEnvironmentMaterial) {
  if (!["csgo_environment.vfx", "csgo_environment_blend.vfx"].includes(source.shader))
    throw new Error(`Unsupported native environment shader: ${source.shader}`);
  for (const [name, value] of Object.entries(source.IntParams))
    if (name.startsWith("F_") && value && !supportedFeatures.has(name))
      throw new Error(`Unsupported native environment feature: ${source.nativeResource}/${name}`);
  for (const name of ["g_nTextureAddressModeU", "g_nTextureAddressModeV"])
    if (source.IntParams[name]) throw new Error(`Unsupported native environment UV mode: ${name}`);
  const layers = source.IntParams.F_ENABLE_LAYER_3
    ? 3
    : source.shader === "csgo_environment_blend.vfx"
      ? 2
      : 1;
  const modern = usesModernEnvironment(source);
  validateEnvironmentAlpha(source);
  if (source.IntParams.F_WETNESS) environmentWetnessCode(source);
  if (layers === 3 && !source.IntParams.F_USE_NEW_BLENDING)
    throw new Error("Native legacy three-layer blending has no selected shader evidence");
  if (source.IntParams.F_BLEND_EFFECTS_2 || source.IntParams.F_BLEND_EFFECTS) {
    if (!modern && layers !== 2) throw new Error("Native blend effects require two layers");
    if (!modern) environmentEffects(source);
  }
  for (let layer = 1; layer <= layers; layer++) {
    if (![0, 1, 2].includes(source.IntParams[`g_nUVSet${layer}`] ?? 1))
      throw new Error("Native environment biplanar UVs are not implemented");
    for (const sampler of ["Color", "Height", "Normal"])
      if (!source.textures[`g_t${sampler}${layer}`])
        throw new Error(`Native environment sampler missing: g_t${sampler}${layer}`);
    if (source.IntParams.F_DETAIL_NORMAL) {
      const selection = source.IntParams[`g_nDetailUVSet${layer}`] ?? -1;
      if (![-1, 0, 1, 2].includes(selection))
        throw new Error("Native environment biplanar detail UVs are not implemented");
      if (!source.textures[`g_tNormalDetail${layer}`])
        throw new Error(`Native environment sampler missing: g_tNormalDetail${layer}`);
    }
    if (!(source.textureReflectivity[`g_tColor${layer}`]?.length >= 3))
      throw new Error("Native environment color reflectivity is missing");
  }
  if (source.IntParams.F_SHARED_COLOR_OVERLAY) {
    if (!source.textures.g_tSharedColorOverlay)
      throw new Error("Native environment shared overlay is missing");
    if (![0, 1, 2].includes(source.IntParams.g_nColorOverlayUVSet ?? 2))
      throw new Error("Native environment biplanar overlay UVs are not implemented");
  }
  if (
    Object.values(source.FloatParams).some((value) => !Number.isFinite(value)) ||
    [...Object.values(source.VectorParams), ...Object.values(source.textureReflectivity)].some(
      (value) => value.some((number) => !Number.isFinite(number)),
    )
  )
    throw new Error("Native environment has nonfinite material parameters");
  return { layers, overlay: !!source.IntParams.F_SHARED_COLOR_OVERLAY };
}

/** Sampler names actually read by the selected ordinary color variant. */
export function activeEnvironmentSamplers(source: SourceEnvironmentMaterial) {
  const features = validateSourceEnvironment(source);
  if (usesModernEnvironment(source)) return modernEnvironmentSamplers(source, features.layers);
  const names = Array.from({ length: features.layers }, (_, i) =>
    ["Color", "Height", "Normal"].map((kind) => `g_t${kind}${i + 1}`),
  ).flat();
  if (features.overlay) names.push("g_tSharedColorOverlay");
  return names;
}
export function activeEnvironmentTextureIds(materials: Record<string, SourceEnvironmentMaterial>) {
  const ids = new Set<string>();
  for (const source of Object.values(materials))
    for (const name of activeEnvironmentSamplers(source))
      if (!usesModernEnvironment(source) || !source.constants?.[name])
        ids.add(source.textures[name]);
  return ids;
}
export async function loadNativeMapEnvironment(renderer: T.WebGLRenderer, path: string) {
  const directory = path.endsWith("/source.json")
    ? path.slice(0, -"source.json".length)
    : path.endsWith("/")
      ? path
      : `${path}/`;
  const bundle = await loadSourceMaterialBundle<SourceEnvironmentMaterial>(
    renderer,
    directory,
    activeEnvironmentTextureIds,
  );
  try {
    for (const source of Object.values(bundle.materials)) validateSourceEnvironment(source);
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const bankCandidates = new Map<string, T.Texture>();
    for (const source of Object.values(bundle.materials))
      if (usesModernEnvironment(source))
        for (const name of modernEnvironmentSamplers(
          source,
          validateSourceEnvironment(source).layers,
        ))
          if (!source.constants?.[name]) {
            const id = source.textures[name];
            bankCandidates.set(id, bundle.textures.get(id)!);
          }
    const banked = createEnvironmentTextureBanks(
      bankCandidates,
      gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) as number,
    );
    for (const [index, texture] of banked.arrays.entries())
      bundle.textures.set(`__nativeEnvironmentBank${index}`, texture);
    // Only the native lightmap OR LPV path is used. Reserve atlas (3), one
    // reflection array, sun shadows (2), grade and native BRDF: eight units.
    for (const source of Object.values(bundle.materials)) {
      const features = validateSourceEnvironment(source);
      const names = usesModernEnvironment(source)
        ? modernEnvironmentSamplers(source, features.layers)
        : Object.keys(source.textures).filter(
            (name) => name !== "g_tSharedColorOverlay" || features.overlay,
          );
      const layout = bindEnvironmentTextures(
        source,
        names,
        bundle.textures,
        usesModernEnvironment(source) ? banked.bindings : undefined,
        { uniforms: {} } as T.WebGLProgramParametersWithUniforms,
      );
      if (layout.samplers + 8 > renderer.capabilities.maxTextures)
        throw new Error(
          `Native environment exceeds renderer sampler budget: ${source.nativeResource} (${layout.samplers}+8)`,
        );
    }
    const lookup = Object.keys(bundle.materials).length
      ? await loadSourceSurfaceLookup()
      : undefined;
    const normalFrame = new T.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    normalFrame.needsUpdate = true;
    bundle.textures.set("__nativeEnvironmentFrame", normalFrame);
    const time = { value: 0 };
    return {
      ...bundle,
      lookup,
      banks: banked.bindings,
      bankBytes: banked.bytes,
      normalFrame,
      sourceWorldFrame: createEnvironmentWorldFrame(),
      time,
      update(seconds: number) {
        if (Number.isFinite(seconds)) time.value = seconds;
      },
    };
  } catch (error) {
    for (const texture of new Set(bundle.textures.values())) texture.dispose();
    throw error;
  }
}

/** Pinned VRF20.1 VfxEvalFunctions.MatrixColorCorrect2/MatrixColorTint2,
 * expressed as column-vector matrices for Three's GLSL uploads. */
export function environmentColorMatrix(
  csb: readonly number[],
  pivot: readonly number[],
  tint: readonly number[] = [1, 1, 1],
) {
  const lum = new T.Vector3(0.2126, 0.7152, 0.0722).normalize();
  const cross = new T.Vector3().crossVectors(lum, new T.Vector3(0, 0, 1));
  const angle = Math.atan2(cross.length(), lum.z);
  const rotation = new T.Matrix4().makeRotationAxis(cross.normalize(), angle);
  const inverse = rotation.clone().transpose();
  const lumScale = new T.Matrix4().makeScale(lum.x, lum.y, lum.z);
  const invLum = new T.Matrix4().makeScale(1 / lum.x, 1 / lum.y, 1 / lum.z);
  const correction = new T.Matrix4();
  for (const transform of [
    new T.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]),
    new T.Matrix4().makeScale(csb[0], csb[0], csb[0]),
    new T.Matrix4().makeTranslation(pivot[0], pivot[1], pivot[2]),
    new T.Matrix4().makeScale(csb[2], csb[2], csb[2]),
    lumScale,
    rotation,
    new T.Matrix4().makeScale(csb[1], csb[1], 1),
    inverse,
    invLum,
  ])
    correction.premultiply(transform);
  const max = Math.max(...tint),
    min = Math.min(...tint);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const gray = new T.Vector3().fromArray(tint).applyMatrix4(lumScale).applyMatrix4(rotation);
  const factor = 1 - saturation * saturation;
  const tintMatrix = new T.Matrix4();
  for (const transform of [
    lumScale,
    rotation,
    new T.Matrix4().makeTranslation(-gray.x, -gray.y, 0),
    new T.Matrix4().makeScale(1 - saturation, 1 - saturation, factor),
    new T.Matrix4().makeTranslation(gray.x, gray.y, (1 - factor) * gray.z),
    inverse,
    invLum,
  ])
    tintMatrix.premultiply(transform);
  // C# returns transposes and uploads tint*correction to the row-vector shader;
  // column-vector GLSL applies the correction, then the luminance-preserving tint.
  return tintMatrix.multiply(correction);
}

const number = (value: number) => {
  const raw = Number.isInteger(value) ? `${value}.0` : `${value}`;
  return value < 0 ? `(${raw})` : raw;
};
const vector = (values: readonly number[], width: number) =>
  `vec${width}(${values.slice(0, width).map(number).join(",")})`;
const scalar = (source: SourceEnvironmentMaterial, name: string, fallback: number) =>
  source.FloatParams[name] ?? fallback;
const values = (source: SourceEnvironmentMaterial, name: string, fallback: number[]) =>
  source.VectorParams[name] ?? fallback;

// Shader/color transport derived from ValveResourceFormat20.1 csgo_environment
// and csgo_environment_blend at9e2e6c7 (MIT). Full notice beside runtime maps.
const common = `
varying vec2 vEnvironmentUv1, vEnvironmentUv2, vEnvironmentOverlayUv;
varying vec4 vEnvironmentPaint, vEnvironmentBlend;
uniform vec3 environmentModelTint;
uniform mat4 environmentAdjust1, environmentTintAdjust1, environmentAdjust2, environmentTintAdjust2;
vec3 environmentGamma(vec3 c) {
  return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055, step(vec3(0.0031308),c));
}
vec2 environmentWeights(vec2 heights, vec2 scales, vec2 zeros, float blend, float softness) {
  float h1=scales.x+softness;
  float h2=scales.y+softness;
  float height1=heights.x*h1;
  float height2=heights.y*(scales.y-softness);
  float lo=-zeros.x*h1-(1.0-zeros.y)*h2-softness;
  float hi=(1.0-zeros.x)*h1+zeros.y*h2;
  height2+=mix(lo,hi,blend);
  vec2 weights=max(vec2(height1,height2)-vec2(max(height1,height2)-softness),vec2(0.0));
  weights.x+=0.001;
  return weights/(weights.x+weights.y);
}
vec2 environmentRotate(vec2 uv, float degrees, vec2 scale, vec2 offset, vec2 center) {
  float angle=radians(degrees), s=sin(angle), c=cos(angle);
  mat2 rotation=mat2(c*scale.x,s*scale.x,-s*scale.y,c*scale.y);
  mat2 centerRotation=mat2(c,s,-s,c);
  return rotation*uv+center+offset-centerRotation*center;
}
`;

function layerCode(source: SourceEnvironmentMaterial, layer: number, blend: boolean) {
  const f = (name: string, fallback: number) => number(scalar(source, name + layer, fallback));
  const mode = source.IntParams[`g_nVertexColorMode${layer}`] ?? 0;
  const modelTint = source.IntParams[`g_bModelTint${layer}`] ?? 1;
  const correction = source.IntParams[`g_nColorCorrectionMode${layer}`] ?? 0;
  const metal = source.IntParams[`g_bMetalness${layer}`] ?? 1;
  const colorMode = blend
    ? mode === 2
      ? "0.0"
      : mode === 0
        ? "1.0"
        : `height${layer}.g`
    : `height${layer}.g`;
  return `
  vec4 color${layer}=texture2D(environmentColor${layer},vEnvironmentUv${layer});
  vec4 height${layer}=texture2D(environmentHeight${layer},vEnvironmentUv${layer});
  vec4 normal${layer}=texture2D(environmentNormal${layer},vEnvironmentUv${layer});
  float tintMask${layer}=clamp(((height${layer}.g-0.5)*${f("g_fTintMaskContrast", 1)}+0.5)*${f("g_fTintMaskBrightness", 1)},0.0,1.0);
  height${layer}.a*=${number(metal ? 1 : 0)};
  ${source.IntParams.F_BLEND_EFFECTS_2 || source.IntParams.F_BLEND_EFFECTS ? "" : `normal${layer}.rg=(normal${layer}.rg-0.5)*${f("g_fTextureNormalContrast", 1)}+0.5;`}
  normal${layer}.b=clamp(((normal${layer}.b-0.5)*${f("g_fTextureRoughnessContrast", 1)}+0.5)*${f("g_fTextureRoughnessBrightness", 1)},0.0,1.0);
  vec3 adjusted${layer}=${correction === 1 ? `(environmentAdjust${layer}*color${layer}).rgb` : `color${layer}.rgb`};
  vec3 tinted${layer}=(environmentTintAdjust${layer}*color${layer}).rgb;
  vec3 baseColor${layer}=mix(adjusted${layer},tinted${layer},tintMask${layer});
  float luma${layer}=dot(baseColor${layer},vec3(0.2125,0.7154,0.0721));
  vec3 normTint${layer}=normalize(max(environmentModelTint,vec3(0.001)));
  float normLuma${layer}=dot(normTint${layer},vec3(0.2125,0.7154,0.0721));
  float highTint${layer}=max(environmentModelTint.r,max(environmentModelTint.g,environmentModelTint.b));
  color${layer}.rgb=clamp(mix(baseColor${layer},normTint${layer}*min(luma${layer}/normLuma${layer},3.0*luma${layer}*highTint${layer}),${number(scalar(source, "g_flModelTintAmount", 1))}*(1.0-min(environmentModelTint.r,min(environmentModelTint.g,environmentModelTint.b)))*tintMask${layer}*${number(modelTint ? 1 : 0)}),0.0,1.0);
  ${blend && source.IntParams.F_SHARED_COLOR_OVERLAY ? `color${layer}.rgb*=mix(vec3(1.0),environmentOverlayFactor,${(source.IntParams.g_nColorOverlayTintMask ?? 0) === 0 || source.IntParams.g_nColorOverlayTintMask === layer ? `tintMask${layer}` : "1.0"}*${number((source.IntParams.g_nColorOverlayMode ?? 0) === 0 || source.IntParams.g_nColorOverlayMode === layer ? 1 : 0)});` : ""}
  vec3 overlayColor${layer}=color${layer}.rgb;
  color${layer}.rgb*=mix(vec3(1.0),vEnvironmentPaint.rgb,${colorMode});
  `;
}

export function applyEnvironmentShader(
  shader: T.WebGLProgramParametersWithUniforms,
  source: SourceEnvironmentMaterial,
  textures: ReadonlyMap<string, T.Texture>,
  modelTint: T.Color,
  lookup: T.DataTexture,
  frame: EnvironmentWorldFrame = createEnvironmentWorldFrame(),
) {
  const { layers, overlay } = validateSourceEnvironment(source);
  const effects =
    source.IntParams.F_BLEND_EFFECTS_2 || source.IntParams.F_BLEND_EFFECTS
      ? environmentEffects(source, frame.unitScale)
      : undefined;
  shader.uniforms.environmentModelTint = { value: modelTint };
  const samplers: string[] = [];
  const canonical = new Map<string, string>();
  const aliases: string[] = [];
  const bindSampler = (name: string, key: string) => {
    const existing = canonical.get(key);
    if (existing) {
      aliases.push(`#define ${name} ${existing}`);
      return;
    }
    const texture = textures.get(key);
    if (!texture) throw new Error(`Native environment texture missing: ${key}`);
    canonical.set(key, name);
    shader.uniforms[name] = { value: texture };
    samplers.push(name);
  };
  for (let layer = 1; layer <= layers; layer++) {
    for (const sampler of ["Color", "Height", "Normal"]) {
      const key = source.textures[`g_t${sampler}${layer}`];
      bindSampler(`environment${sampler}${layer}`, key);
    }
    const csb = ["Contrast", "Saturation", "Brightness"].map((name) =>
      scalar(source, `g_fTextureColor${name}${layer}`, 1),
    );
    const pivot = source.textureReflectivity[`g_tColor${layer}`];
    shader.uniforms[`environmentAdjust${layer}`] = { value: environmentColorMatrix(csb, pivot) };
    shader.uniforms[`environmentTintAdjust${layer}`] = {
      value: environmentColorMatrix(
        csb,
        pivot,
        values(source, `g_vTextureColorTint${layer}`, [1, 1, 1]),
      ),
    };
  }
  if (overlay) {
    bindSampler("environmentSharedOverlay", source.textures.g_tSharedColorOverlay);
  }
  shader.vertexShader = `attribute vec2 sourceEnvironmentUv, sourceEnvironmentAlternateUv; attribute vec4 sourceEnvironmentPaint, sourceEnvironmentBlend;\n${common}\n${shader.vertexShader}`;
  const uv = (layer: number) => {
    const prefix = layer ? "TexCoord" : "OverlayTexCoord";
    const suffix = layer || "";
    const selected =
      source.IntParams[layer ? `g_nUVSet${layer}` : "g_nColorOverlayUVSet"] ?? (layer ? 1 : 2);
    return `environmentRotate(${selected === 2 ? "sourceEnvironmentAlternateUv" : "sourceEnvironmentUv"},${number(scalar(source, `g_fl${prefix}Rotation${suffix}`, 0))},${vector(values(source, `g_v${prefix}Scale${suffix}`, [1, 1]), 2)},${vector(values(source, `g_v${prefix}Offset${suffix}`, [0, 0]), 2)},${vector(values(source, `g_v${prefix}Center${suffix}`, [0.5, 0.5]), 2)})`;
  };
  const tint = new T.Color().setRGB(
    ...(values(source, "g_vColorTint", [1, 1, 1]).slice(0, 3) as [number, number, number]),
    T.SRGBColorSpace,
  );
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
    vEnvironmentUv1=${uv(1)};
    vEnvironmentUv2=${layers === 2 ? uv(2) : "vEnvironmentUv1"};
    vEnvironmentOverlayUv=${overlay ? uv(0) : "vEnvironmentUv1"};
    vEnvironmentPaint=vec4(${vector(tint.toArray(), 3)}*mix(vec3(1.0),sourceEnvironmentPaint.rgb,sourceEnvironmentPaint.a),1.0);
    vEnvironmentBlend=sourceEnvironmentBlend;
    ${effects ? "" : `vEnvironmentBlend.a=clamp(vEnvironmentBlend.a+${number(layers === 2 ? scalar(source, "g_flBlendSoftness2", 0.01) : 0)},0.001,1.0);`}
  `,
  );
  shader.fragmentShader = `${common}\nuniform sampler2D ${samplers.join(",")};\n${aliases.join("\n")}\n${effects?.shared ?? ""}\n${shader.fragmentShader}`;
  const overlayCode = overlay
    ? `vec3 overlay=texture2D(environmentSharedOverlay,vEnvironmentOverlayUv).rgb*2.0-1.0;
    vec3 environmentOverlayFactor=max(vec3(0.0),(vec3(1.0)-pow(max(vec3(1e-9),vec3(1.0)-max(vec3(0.0),overlay)),vec3(${number(scalar(source, "g_flOverlayBrightnessContrast", 1))})))*${number(scalar(source, "g_flOverlayBrightnessContrast", 1))}+(pow(max(vec3(1e-9),vec3(1.0)+min(vec3(0.0),overlay)),vec3(${number(scalar(source, "g_flOverlayDarknessContrast", 1))}))-vec3(1.0))*${number(scalar(source, "g_flOverlayDarknessContrast", 1))}+vec3(1.0));`
    : "";
  const blendCode =
    layers === 2
      ? `
    ${effects ? effects.weights : `vec2 weights=environmentWeights(vec2(height1.r-${number(scalar(source, "g_flHeightMapZeroPoint1", 0.5))},height2.r-${number(scalar(source, "g_flHeightMapZeroPoint2", 0.5))}),${vector([scalar(source, "g_flHeightMapScale1", 1), scalar(source, "g_flHeightMapScale2", 1)], 2)},${vector([scalar(source, "g_flHeightMapZeroPoint1", 0.5), scalar(source, "g_flHeightMapZeroPoint2", 0.5)], 2)},vEnvironmentBlend.r,vEnvironmentBlend.a);`}
    vec3 overlaid=color1.rgb*mix(vec3(1.0),environmentGamma(clamp(overlayColor2,0.0,1.0))*2.0,weights.y*${number(scalar(source, "g_flColorOverlay2", 0))});
    vec4 environmentColor=vec4(mix(overlaid,color2.rgb,weights.y*${number(scalar(source, "g_flColorReplace2", 1))}),dot(vec2(color1.a,color2.a),weights));
    vec4 environmentHeight=height1*weights.x+height2*weights.y;
    vec4 environmentNormal=normal1*weights.x+normal2*weights.y;
    vec3 environmentAoLevels=${vector(values(source, "g_vAmbientOcclusionLevels1", [0, 0.5, 1]), 3)}*weights.x+${vector(values(source, "g_vAmbientOcclusionLevels2", [0, 0.5, 1]), 3)}*weights.y;
  `
      : `vec4 environmentColor=color1,environmentHeight=height1,environmentNormal=normal1;vec3 environmentAoLevels=${vector(values(source, "g_vAmbientOcclusionLevels1", [0, 0.5, 1]), 3)};`;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <map_fragment>",
      `${overlayCode}\n${layerCode(source, 1, layers === 2)}\n${layers === 2 ? layerCode(source, 2, true) : ""}\n${blendCode}
    diffuseColor.rgb=environmentColor.rgb;
    ${effects?.ao ?? "float environmentAO=mix(environmentAoLevels.x,environmentAoLevels.z,pow(max(environmentColor.a,0.0),max(environmentAoLevels.y,0.001)));"}
  `,
    )
    .replace("#include <color_fragment>", "")
    .replace("#include <roughnessmap_fragment>", "float roughnessFactor=environmentNormal.b;")
    .replace("#include <metalnessmap_fragment>", "float metalnessFactor=environmentHeight.a;")
    .replace(
      "#include <normal_fragment_maps>",
      effects?.normal ??
        `vec2 environmentHemi=vec2(environmentNormal.r+environmentNormal.g-1.003922,environmentNormal.r-environmentNormal.g);vec3 mapN=normalize(vec3(environmentHemi.x,-environmentHemi.y,1.0-abs(environmentHemi.x)-abs(environmentHemi.y)));normal=normalize(tbn*mapN);`,
    )
    .replace(
      "#include <aomap_fragment>",
      `reflectedLight.directDiffuse*=mix(1.0,environmentAO,${number(scalar(source, "g_flAmbientOcclusionDirectDiffuse", 1))});reflectedLight.indirectDiffuse*=environmentAO;reflectedLight.directSpecular*=mix(1.0,environmentAO,${number(scalar(source, "g_flAmbientOcclusionDirectSpecular", 1))});reflectedLight.indirectSpecular*=environmentAO;`,
    );
  if (source.IntParams.F_DONT_FLIP_BACKFACE_NORMALS)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      T.ShaderChunk.normal_fragment_begin
        .replace("normal *= faceDirection;", "")
        .replace("tbn[0] *= faceDirection;", "")
        .replace("tbn[1] *= faceDirection;", ""),
    );
  applySourceSurface(shader, { directSpecular: true, indirectSpecular: true }, lookup);
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_physical_fragment>",
    `#include <lights_physical_fragment>\nmaterial.specularColor=vec3(${number(scalar(source, "g_flReflectance", 0.04))});material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);`,
  );
}

export function applyNativeMapEnvironment(
  root: T.Object3D,
  bundle: Pick<
    Awaited<ReturnType<typeof loadNativeMapEnvironment>>,
    "materials" | "textures" | "lookup"
  > &
    Partial<
      Pick<
        Awaited<ReturnType<typeof loadNativeMapEnvironment>>,
        "banks" | "normalFrame" | "time" | "sourceWorldFrame"
      >
    >,
) {
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const source = bundle.materials[material.name];
      if (!source || !(material instanceof T.MeshStandardMaterial)) continue;
      const { layers, overlay } = validateSourceEnvironment(source);
      const geometry = object.geometry,
        count = geometry.getAttribute("position").count;
      const uv = geometry.getAttribute("uv");
      if (!uv) throw new Error(`Native environment base UV missing: ${material.name}`);
      const alternate = geometry.getAttribute("uv2");
      const needsAlternate = [
        source.IntParams.g_nUVSet1 ?? 1,
        ...Array.from({ length: layers }, (_, i) => source.IntParams[`g_nUVSet${i + 1}`] ?? 1),
        ...(source.IntParams.F_DETAIL_NORMAL
          ? Array.from(
              { length: layers },
              (_, i) => source.IntParams[`g_nDetailUVSet${i + 1}`] ?? -1,
            )
          : []),
        overlay ? (source.IntParams.g_nColorOverlayUVSet ?? 2) : 1,
      ].includes(2);
      if (needsAlternate && !alternate)
        throw new Error(`Native environment alternate UV missing: ${material.name}`);
      geometry.setAttribute("sourceEnvironmentUv", uv);
      geometry.setAttribute("sourceEnvironmentAlternateUv", alternate ?? uv);
      const paint = geometry.getAttribute("color");
      geometry.setAttribute(
        "sourceEnvironmentPaint",
        paint?.itemSize === 4
          ? paint
          : new T.Float32BufferAttribute(
              Array.from({ length: count * 4 }, (_, i) =>
                i % 4 === 3 ? 1 : paint ? paint.getComponent(Math.floor(i / 4), i % 4) : 1,
              ),
              4,
            ),
      );
      const controls = geometry.getAttribute("color_1");
      if (layers > 1 && (!controls || controls.itemSize !== 4))
        throw new Error(`Native environment blend controls missing: ${material.name}`);
      geometry.setAttribute(
        "sourceEnvironmentBlend",
        controls ??
          new T.Float32BufferAttribute(
            Array.from({ length: count * 4 }, (_, i) => (i % 4 === 3 ? 1 : 0)),
            4,
          ),
      );
      const modern = usesModernEnvironment(source);
      if (modern && !geometry.getAttribute("normal"))
        throw new Error(`Native environment normal missing: ${material.name}`);
      if (modern && !geometry.getAttribute("tangent"))
        throw new Error(`Native environment tangent missing: ${material.name}`);
      if (source.IntParams.F_DO_NOT_CAST_SHADOWS) object.castShadow = false;
      if (patched.has(material)) continue;
      patched.add(material);
      if (!bundle.lookup) throw new Error("Native environment BRDF lookup unavailable");
      const modelTint = material.color.clone();
      material.color.setRGB(1, 1, 1);
      material.vertexColors = false;
      material.map = modern ? null : bundle.textures.get(source.textures.g_tColor1)!;
      material.normalMap = modern
        ? (bundle.normalFrame ?? null)
        : bundle.textures.get(source.textures.g_tNormal1)!;
      material.roughnessMap = material.metalnessMap = material.aoMap = null;
      if (source.IntParams.F_ALPHA_TEST) {
        material.alphaTest = source.FloatParams.g_flAlphaTestReference ?? 0.5;
        material.alphaToCoverage = false;
        registerSourceDepth(
          material,
          createEnvironmentDepthHook(
            source,
            bundle.textures,
            bundle.banks,
            bundle.sourceWorldFrame,
          ),
        );
      }
      material.side = source.IntParams.F_RENDER_BACKFACES ? T.DoubleSide : T.FrontSide;
      material.fog = source.IntParams.g_bFogEnabled !== 0;
      registerSurfaceTextures(material, [
        ...new Set(
          activeEnvironmentSamplers(source)
            .filter((name) => !modern || !source.constants?.[name])
            .map(
              (name) =>
                (modern ? bundle.banks?.get(source.textures[name])?.texture : undefined) ??
                bundle.textures.get(source.textures[name]),
            )
            .filter((texture): texture is T.Texture => !!texture),
        ),
      ]);
      const compile = material.onBeforeCompile.bind(material),
        key = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer);
        if (modern)
          applyModernEnvironmentShader(
            shader,
            source,
            bundle.textures,
            bundle.banks,
            modelTint,
            bundle.lookup!,
            bundle.time,
            bundle.sourceWorldFrame,
          );
        else
          applyEnvironmentShader(
            shader,
            source,
            bundle.textures,
            modelTint,
            bundle.lookup!,
            bundle.sourceWorldFrame,
          );
      };
      const bankKey = modern
        ? bindEnvironmentTextures(
            source,
            modernEnvironmentSamplers(source, layers),
            bundle.textures,
            bundle.banks,
            { uniforms: {} } as T.WebGLProgramParametersWithUniforms,
          ).signature
        : "legacy";
      const programKey = `${key}:native-environment:${bundle.sourceWorldFrame?.unitScale ?? 1}:${bankKey}:${JSON.stringify(source)}:${modelTint.getHexString()}`;
      material.customProgramCacheKey = () => programKey;
      material.needsUpdate = true;
    }
    installSourceShadowDepth(object);
  });
}
