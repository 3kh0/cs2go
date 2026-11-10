import * as T from "three";
import { nativeTextureIdentity, shareNativeTexture } from "./native-texture-sharing";
import { assetFetch, assetUrl } from "./asset-url";
import { fetchGzipped } from "./gltf";
import { createLoadQueue } from "./loading";

interface LayerTexture {
  format?: "BC1" | "BC7" | "BC4" | "BC5";
  srgb: boolean;
  file?: string;
  fallback?: string;
  fallbackFile?: string;
  fallbackMips?: { width: number; height: number; bytes: number; sha256?: string }[];
  gpuBytes?: number;
  gpuSha256?: string;
  nativeMip?: number;
  mips?: { width: number; height: number; bytes: number; sha256?: string }[];
  constant?: number;
}

export interface SourceLayerMaterial {
  fancy: number;
  softness: number;
  border: number[];
  borderTint: number[];
  tint1: number[];
  tint2: number[];
  bevel: number[];
  metalness: number;
  /** Absent in historical diffuse-only map manifests. */
  specularDirect?: boolean;
  specularIndirect: boolean;
  ao: number[];
  normal1: string;
  normal2: string;
  color2: string;
  mask?: string;
  transforms: Record<string, number[]>;
  detail?: { texture: string; scale: number[]; tintBlend: number[] };
  detail2?: { texture: string; scale: number[]; tintBlend: number[] };
}

interface LayerManifest<Material> {
  materials: Record<string, Material>;
  textures: Record<string, LayerTexture>;
}

/** Resolve shared native texture banks before immutable asset-manifest lookup. */
function materialAsset(directory: string, file: string) {
  const url = new URL(file, `https://assets.invalid${directory}`);
  if (url.origin !== "https://assets.invalid")
    throw new Error("Native material texture must use a bundled asset path");
  return url.pathname;
}

export function loadSourceLayers(renderer: T.WebGLRenderer) {
  return loadSourceMaterialBundle(renderer, "/models/maps/lighting/layers/");
}

export async function loadSourceMaterialBundle<Material = SourceLayerMaterial>(
  renderer: T.WebGLRenderer,
  directory: string,
  selectTextures?: (materials: Record<string, Material>) => ReadonlySet<string>,
) {
  const response = await assetFetch(directory + "source.json");
  if (!response.ok) throw new Error("Native layered materials unavailable");
  const manifest = (await response.json()) as LayerManifest<Material>;
  const selected = selectTextures?.(manifest.materials);
  if (selected)
    for (const key of selected)
      if (!manifest.textures[key])
        throw new Error(`Native material texture definition missing: ${key}`);
  const textures = new Map<string, T.Texture>();
  const queue = createLoadQueue(6);
  const outcomes = await Promise.allSettled(
    Object.entries(manifest.textures)
      .filter(([key]) => !selected || selected.has(key))
      .map(([key, entry]) =>
        queue(async () => {
          if (entry.constant !== undefined) return;
          const supported =
            entry.format === "BC7"
              ? renderer.extensions.has("EXT_texture_compression_bptc")
              : entry.format === "BC4" || entry.format === "BC5"
                ? renderer.extensions.has("EXT_texture_compression_rgtc")
                : renderer.extensions.has(
                    entry.srgb
                      ? "WEBGL_compressed_texture_s3tc_srgb"
                      : "WEBGL_compressed_texture_s3tc",
                  );
          let texture: T.Texture;
          let identity: string | undefined;
          if (supported && entry.file && entry.mips) {
            const bytes = await fetchGzipped(materialAsset(directory, entry.file));
            if (bytes.byteLength !== entry.gpuBytes)
              throw new Error("Invalid native layer texture");
            let offset = 0;
            const mips = entry.mips.map((mip) => {
              if (
                entry.format === "BC5" &&
                (!Number.isInteger(mip.width) ||
                  !Number.isInteger(mip.height) ||
                  mip.width < 1 ||
                  mip.height < 1 ||
                  mip.bytes !== Math.ceil(mip.width / 4) * Math.ceil(mip.height / 4) * 16)
              )
                throw new Error("Invalid native BC5 mip shape");
              const data = new Uint8Array(bytes, offset, mip.bytes);
              offset += mip.bytes;
              return { data, width: mip.width, height: mip.height };
            });
            if (offset !== bytes.byteLength) throw new Error("Invalid native layer mip lengths");
            identity = nativeTextureIdentity(
              entry.format ?? "BC1",
              entry.mips,
              entry.gpuSha256,
              entry.nativeMip,
            );
            texture = new T.CompressedTexture(
              mips,
              mips[0].width,
              mips[0].height,
              entry.format === "BC7"
                ? T.RGBA_BPTC_Format
                : entry.format === "BC4"
                  ? T.RED_RGTC1_Format
                  : entry.format === "BC5"
                    ? T.RED_GREEN_RGTC2_Format
                    : T.RGB_S3TC_DXT1_Format,
            );
            texture.minFilter = mips.length > 1 ? T.LinearMipmapLinearFilter : T.LinearFilter;
          } else if (entry.fallbackFile && entry.fallbackMips) {
            const bytes = await fetchGzipped(materialAsset(directory, entry.fallbackFile));
            let offset = 0;
            const mips = entry.fallbackMips.map((mip) => {
              const data = new Uint8Array(bytes, offset, mip.bytes);
              offset += mip.bytes;
              return { data, width: mip.width, height: mip.height };
            });
            if (offset !== bytes.byteLength || !mips.length)
              throw new Error("Invalid material fallback mip lengths");
            identity = nativeTextureIdentity(
              "RGBA8",
              entry.fallbackMips,
              undefined,
              entry.nativeMip,
            );
            texture = new T.DataTexture(mips[0].data, mips[0].width, mips[0].height);
            texture.mipmaps = mips;
            texture.generateMipmaps = false;
            texture.minFilter = mips.length > 1 ? T.LinearMipmapLinearFilter : T.LinearFilter;
          } else {
            if (!entry.fallback) throw new Error("Missing native layer fallback");
            texture = await new T.TextureLoader().loadAsync(
              assetUrl(materialAsset(directory, entry.fallback)),
            );
          }
          texture.colorSpace = entry.srgb ? T.SRGBColorSpace : T.NoColorSpace;
          texture.flipY = false;
          texture.wrapS = texture.wrapT = T.RepeatWrapping;
          texture.magFilter = T.LinearFilter;
          texture.anisotropy = 8;
          texture.needsUpdate = true;
          shareNativeTexture(texture, identity);
          textures.set(key, texture);
        }),
      ),
  );
  const failure = outcomes.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    for (const texture of textures.values()) texture.dispose();
    throw failure.reason;
  }
  return { materials: manifest.materials, textures };
}

// Adapted from ValveResourceFormat csgo_lightmappedgeneric.frag.slang,
// blend_second_layer.slang and utils.slang at 5564866c7 (MIT).
// Copyright (c) 2015 ValveResourceFormat Contributors; full notice:
// packages/assets/public/models/maps/licenses/ValveResourceFormat-MIT.txt.
export function applySourceLayers(
  shader: T.WebGLProgramParametersWithUniforms,
  material: SourceLayerMaterial,
  textures: Map<string, T.Texture>,
) {
  const canonical = new Map<string, string>();
  const aliases: string[] = [];
  const bind = (name: string, key: string) => {
    const previous = canonical.get(key);
    if (previous) {
      aliases.push(`#define ${name} ${previous}`);
      return;
    }
    canonical.set(key, name);
    const texture = textures.get(key);
    if (!texture) throw new Error(`Native layer texture missing: ${key}`);
    shader.uniforms[name] = { value: texture };
  };
  bind("sourceLayerNormal1", material.normal1);
  bind("sourceLayerNormal2", material.normal2);
  bind("sourceLayerColor2", material.color2);
  if (material.fancy > 0) {
    if (!material.mask) throw new Error("Native fancy layer blend mask missing");
    bind("sourceLayerMask", material.mask);
  }
  for (const [name, values] of Object.entries(material.transforms))
    shader.uniforms["source" + name + "Transform"] = { value: new T.Matrix3().fromArray(values) };
  for (const [name, values] of Object.entries({
    sourceLayerTint1: material.tint1,
    sourceLayerTint2: material.tint2,
    sourceLayerBorder: material.border,
    sourceLayerBorderTint: material.borderTint,
    sourceLayerBevel: material.bevel,
  }))
    shader.uniforms[name] = { value: new T.Vector3().fromArray(values) };
  shader.uniforms.sourceLayerSoftness = { value: material.softness };
  shader.uniforms.sourceLayerAO = { value: new T.Vector2().fromArray(material.ao) };
  if (material.detail2 && !material.detail)
    throw new Error("Native second detail requires first detail");
  for (const [suffix, detail] of [
    ["", material.detail],
    ["2", material.detail2],
  ] as const) {
    if (!detail) continue;
    bind("sourceLayerDetail" + suffix, detail.texture);
    shader.uniforms["sourceLayerDetailScale" + suffix] = {
      value: new T.Vector2().fromArray(detail.scale),
    };
    shader.uniforms["sourceLayerDetailTintBlend" + suffix] = {
      value: new T.Vector4().fromArray(detail.tintBlend),
    };
  }
  shader.vertexShader =
    "attribute vec4 sourceBlend; varying float vSourceBlend;\n" + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\nvSourceBlend = sourceBlend.r;",
  );
  shader.fragmentShader =
    `varying float vSourceBlend;
    uniform sampler2D sourceLayerNormal1, sourceLayerNormal2, sourceLayerColor2, sourceLayerMask;
    uniform mat3 sourceLayer1Transform, sourceLayer1NormalTransform, sourceLayer2Transform, sourceLayer2NormalTransform, sourceBlendModulateTransform;
    uniform vec3 sourceLayerTint1, sourceLayerTint2, sourceLayerBorder, sourceLayerBorderTint, sourceLayerBevel;
    uniform vec2 sourceLayerAO;
    uniform float sourceLayerSoftness;
    ${(
      [
        ["", material.detail],
        ["2", material.detail2],
      ] as const
    )
      .map(([suffix, detail]) =>
        detail
          ? `uniform sampler2D sourceLayerDetail${suffix}; uniform vec2 sourceLayerDetailScale${suffix}; uniform vec4 sourceLayerDetailTintBlend${suffix};`
          : "",
      )
      .join("\n")}
    ${aliases.join("\n")}
    float sourceBlendModulation(float weight, float mask, float softness) {
      float lo = max(0.0, mask - softness), hi = min(1.0, mask + softness);
      return smoothstep(lo, max(lo + 1e-6, hi), weight);
    }
    ` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `
    vec2 sourceLayerUV = (sourceLayer1Transform * vec3(vMapUv, 1.0)).xy;
    vec4 sourceLayerColor1 = texture2D(map, sourceLayerUV);
    sourceLayerColor1.rgb *= sourceLayerTint1;
    ${
      material.fancy > 0
        ? `vec4 sourceLayerMaskValue = texture2D(sourceLayerMask, (sourceBlendModulateTransform * vec3(sourceLayerUV, 1.0)).xy);
    float sourceLayerMaskChannel = sourceLayerMaskValue.${material.fancy === 3 ? "a" : "g"};`
        : ""
    }
    float sourceLayerFactor = ${material.fancy > 0 ? `sourceBlendModulation(vSourceBlend, sourceLayerMaskChannel, ${material.fancy === 1 ? "sourceLayerMaskValue.r" : "sourceLayerSoftness"})` : "vSourceBlend"};
    ${
      material.fancy > 1
        ? `float sourceLayerBorderEdge = sourceBlendModulation(clamp(vSourceBlend + sourceLayerBorder.x, 0.0, 1.0), sourceLayerMaskChannel, sourceLayerBorder.y);
    float sourceLayerBorderAmount = (1.0 - abs(sourceLayerBorderEdge * 2.0 - 1.0)) * sourceLayerBorder.z;
    sourceLayerColor1.rgb *= mix(vec3(1.0), sourceLayerBorderTint, sourceLayerBorderAmount);`
        : ""
    }
    vec4 sourceLayerColorSecond = texture2D(sourceLayerColor2, (sourceLayer2Transform * vec3(sourceLayerUV, 1.0)).xy);
    sourceLayerColorSecond.rgb *= sourceLayerTint2;
    vec4 sourceLayerColor = mix(sourceLayerColor1, sourceLayerColorSecond, sourceLayerFactor);
    ${
      material.detail
        ? `vec3 sourceDetail = texture2D(sourceLayerDetail, sourceLayerUV * sourceLayerDetailScale).rgb * sourceLayerDetailTintBlend.rgb;
    float sourceDetailBlend = sourceLayerDetailTintBlend.a;
    ${
      material.detail2
        ? `vec3 sourceDetailSecond = texture2D(sourceLayerDetail2, sourceLayerUV * sourceLayerDetailScale2).rgb * sourceLayerDetailTintBlend2.rgb;
    sourceDetail = mix(sourceDetail, sourceDetailSecond, sourceLayerFactor);
    sourceDetailBlend = mix(sourceDetailBlend, sourceLayerDetailTintBlend2.a, sourceLayerFactor);`
        : ""
    }
    sourceLayerColor.rgb *= mix(vec3(1.0), sourceDetail * 2.0, sourceDetailBlend);`
        : ""
    }
    diffuseColor *= sourceLayerColor;
    vec4 sourceLayerNormal = mix(
      texture2D(sourceLayerNormal1, (sourceLayer1NormalTransform * vec3(sourceLayerUV, 1.0)).xy),
      texture2D(sourceLayerNormal2, (sourceLayer2NormalTransform * vec3(sourceLayerUV, 1.0)).xy), sourceLayerFactor);
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <roughnessmap_fragment>",
    "float roughnessFactor = sourceLayerNormal.b;",
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_maps>",
    `
    vec2 sourceHemi = vec2(sourceLayerNormal.r + sourceLayerNormal.g - 1.003922, sourceLayerNormal.r - sourceLayerNormal.g);
    vec3 mapN = normalize(vec3(sourceHemi.x, -sourceHemi.y, 1.0 - abs(sourceHemi.x) - abs(sourceHemi.y)));
    normal = normalize(tbn * mapN);
    ${
      material.fancy > 1
        ? `float sourceBevelBlend = sourceBlendModulation(vSourceBlend, sourceLayerMaskChannel, sourceLayerSoftness * sourceLayerBevel.x);
    vec3 sourceBevelPosition = -vViewPosition + nonPerturbedNormal * (sourceBevelBlend * sourceLayerBevel.z);
    vec3 sourceBevelNormal = normalize(cross(dFdx(sourceBevelPosition), dFdy(sourceBevelPosition)));
    float sourceBevelAmount = clamp((1.0 - 2.0 * abs(0.5 - sourceBevelBlend)) * sourceLayerBevel.y, 0.0, 1.0);
    normal = normalize(normal + sourceBevelNormal * sourceBevelAmount);
    mapN = normalize(transpose(tbn) * normal);`
        : ""
    }
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <aomap_fragment>",
    `
    float ambientOcclusion = mix(sourceLayerAO.x, sourceLayerAO.y, sourceLayerFactor);
    reflectedLight.indirectDiffuse *= ambientOcclusion;
    reflectedLight.directSpecular *= ambientOcclusion;
    reflectedLight.indirectSpecular *= ambientOcclusion;
  `,
  );
  if (!material.specularIndirect)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_maps>",
      "#include <lights_fragment_maps>\n#if defined(RE_IndirectSpecular)\nradiance = vec3(0.0); iblIrradiance = vec3(0.0);\n#endif",
    );
}
