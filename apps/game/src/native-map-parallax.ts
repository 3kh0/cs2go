import * as T from "three";
import { assetFetch } from "./asset-url";
import { fetchGzipped } from "./gltf";
import { loadSourceMaterialBundle } from "./source-layers";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";
import { sourceCubeSampling } from "./source-reflections";
import { registerSurfaceTextures } from "./presentation-settings";

export interface SourceParallaxMaterial {
  shader: string;
  nativeResource: string;
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
  textures: Record<string, string>;
  /** Only values verified across every decoded authored pixel and mip. */
  constants?: Record<string, number[]>;
}
export interface ParallaxCube {
  file: string;
  format: "BC6H";
  gpuBytes: number;
  mips: { width: number; height: number; bytes: number }[];
  fallbackFile: string;
  fallbackBytes: number;
  fallbackMips: { width: number; height: number; bytes: number }[];
}
const features = new Set([
  "F_TINT_MASK",
  "F_SECONDARY_UV",
  "F_SECOND_LAYER_CUBEMAP",
  "F_METALNESS_TEXTURE",
  "F_TRANSMISSIVE_BACKFACE_NDOTL",
  "F_DO_NOT_CAST_SHADOWS",
]);
export function validateSourceParallax(source: SourceParallaxMaterial) {
  if (source.shader !== "csgo_simple_3layer_parallax.vfx")
    throw new Error(`Unsupported native parallax shader: ${source.shader}`);
  for (const [flag, value] of Object.entries(source.IntParams))
    if (flag.startsWith("F_") && value && !features.has(flag))
      throw new Error(`Unsupported native parallax feature: ${source.nativeResource}/${flag}`);
  // The current native inputs have no secondary material UV feature. A lightmap
  // chart is never a substitute for an authored secondary material stream.
  if (source.IntParams.F_SECONDARY_UV)
    throw new Error("Native parallax secondary material UV binding is unavailable");
  for (const [name, expected] of [
    ["g_vTexCoordScale", [1, 1]],
    ["g_vTexCoordOffset", [0, 0]],
    ["g_vTexCoordScrollSpeed", [0, 0]],
  ] as const)
    if (source.VectorParams[name]?.slice(0, 2).some((value, i) => value !== expected[i]))
      throw new Error(`Unsupported native parallax UV transform: ${name}`);
  if (source.FloatParams.g_flTexCoordRotation)
    throw new Error("Unsupported native parallax UV rotation");
  for (const flag of ["g_nTextureAddressModeU", "g_nTextureAddressModeV"])
    if (source.IntParams[flag]) throw new Error(`Unsupported native parallax addressing: ${flag}`);
  for (const name of [
    "g_tColor",
    "g_tNormal",
    "g_tLayer0Mask",
    "g_tLayer1Color",
    "g_tLayer2Color",
    "g_tAmbientOcclusion",
    ...(source.IntParams.F_TINT_MASK ? ["g_tTintMask"] : []),
    ...(source.IntParams.F_SECOND_LAYER_CUBEMAP ? ["g_tLayer2Cubemap"] : []),
    ...(source.IntParams.F_TRANSMISSIVE_BACKFACE_NDOTL ? ["g_tTransmissiveMask"] : []),
  ])
    if (!source.textures[name]) throw new Error(`Native parallax sampler missing: ${name}`);
  if (
    Object.values(source.FloatParams).some((v) => !Number.isFinite(v)) ||
    Object.values(source.VectorParams).some((v) => v.some((n) => !Number.isFinite(n)))
  )
    throw new Error("Nonfinite native parallax parameters");
}
export function validateParallaxCube(entry: ParallaxCube) {
  const size = entry.mips?.[0]?.width;
  if (
    entry.format !== "BC6H" ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 1024 ||
    size & (size - 1) ||
    entry.mips.length < 1 ||
    entry.mips.length > Math.log2(size) + 1 ||
    entry.fallbackMips?.length !== entry.mips.length
  )
    throw new Error("Invalid native parallax cube layout/budget");
  let compressed = 0,
    fallback = 0;
  entry.mips.forEach((mip, index) => {
    const width = Math.max(1, size >> index),
      other = entry.fallbackMips[index];
    if (
      mip.width !== width ||
      mip.height !== width ||
      mip.bytes !== Math.ceil(width / 4) ** 2 * 16 * 6 ||
      other.width !== width ||
      other.height !== width ||
      other.bytes !== width * width * 8 * 6
    )
      throw new Error("Invalid native parallax cube mip/face lengths");
    compressed += mip.bytes;
    fallback += other.bytes;
  });
  if (
    compressed !== entry.gpuBytes ||
    fallback !== entry.fallbackBytes ||
    fallback > 64 * 1024 * 1024
  )
    throw new Error("Invalid native parallax cube payload budget");
  return size;
}
export async function loadNativeMapParallax(renderer: T.WebGLRenderer, path: string) {
  const directory = path.endsWith("/source.json")
    ? path.slice(0, -"source.json".length)
    : path.endsWith("/")
      ? path
      : path + "/";
  const response = await assetFetch(directory + "source.json");
  if (!response.ok) throw new Error("Native parallax materials unavailable");
  const manifest = (await response.json()) as {
    materials: Record<string, SourceParallaxMaterial>;
    cubemaps?: Record<string, ParallaxCube>;
  };
  for (const source of Object.values(manifest.materials)) validateSourceParallax(source);
  const bundle = await loadSourceMaterialBundle<SourceParallaxMaterial>(renderer, directory);
  const cubes = new Map<string, T.Texture>();
  try {
    const results = await Promise.allSettled(
      Object.entries(manifest.cubemaps ?? {}).map(async ([key, entry]) => {
        const size = validateParallaxCube(entry),
          compressed = renderer.extensions.has("EXT_texture_compression_bptc");
        const bytes = await fetchGzipped(
          directory + (compressed ? entry.file : entry.fallbackFile),
        );
        if (bytes.byteLength !== (compressed ? entry.gpuBytes : entry.fallbackBytes))
          throw new Error("Invalid native parallax cube bytes");
        let offset = 0;
        const mips = (compressed ? entry.mips : entry.fallbackMips).map((mip) => {
          const data = compressed
            ? new Uint8Array(bytes, offset, mip.bytes)
            : new Uint16Array(bytes, offset, mip.bytes / 2);
          offset += mip.bytes;
          return { width: mip.width, height: mip.height, data };
        });
        const texture = new T.CompressedArrayTexture(
          mips,
          size,
          size,
          6,
          T.RGB_BPTC_UNSIGNED_Format,
        );
        if (!compressed) {
          // Three 0.187 uploads manual array mips through this class's explicit
          // RGBA branch. DataArrayTexture only uploads level0, ignoring mipmaps.
          Object.assign(texture, { type: T.HalfFloatType, format: T.RGBAFormat });
        }
        texture.colorSpace = T.NoColorSpace;
        texture.flipY = false;
        texture.generateMipmaps = false;
        texture.minFilter = T.LinearMipmapLinearFilter;
        texture.magFilter = T.LinearFilter;
        texture.needsUpdate = true;
        cubes.set(key, texture);
      }),
    );
    for (const result of results) if (result.status === "rejected") throw result.reason;
    for (const source of Object.values(bundle.materials)) {
      if (source.IntParams.F_SECOND_LAYER_CUBEMAP && !cubes.has(source.textures.g_tLayer2Cubemap))
        throw new Error("Native parallax emissive cube unavailable");
      // Maximum additional material bindings, including the optional HDR cube.
      // Remaining native lighting bindings are validated against actual programs.
      if (new Set(Object.values(source.textures)).size > renderer.capabilities.maxTextures)
        throw new Error("Native parallax exceeds renderer material sampler budget");
    }
    const lookup = await loadSourceSurfaceLookup();
    return { ...bundle, cubes, cubeInfo: manifest.cubemaps ?? {}, lookup };
  } catch (error) {
    for (const texture of [...bundle.textures.values(), ...cubes.values()]) texture.dispose();
    throw error;
  }
}
const literal = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v));
const vector = (v: readonly number[]) => `vec${v.length}(${v.map(literal).join(",")})`;

/** Pinned VRF 5564866 csgo_simple_3layer_parallax.frag.slang (MIT).
 * This preserves its authored opaque three-layer illusion; it does not infer
 * screen-space transparency from material names containing "glass". */
export function applyParallaxShader(
  shader: T.WebGLProgramParametersWithUniforms,
  source: SourceParallaxMaterial,
  textures: ReadonlyMap<string, T.Texture>,
  cubes: ReadonlyMap<string, T.Texture>,
  modelTint: T.Color,
  lookup: T.DataTexture,
  cubeSize = 1,
  cubeLastLod = Math.log2(cubeSize),
) {
  validateSourceParallax(source);
  const floats = source.FloatParams,
    flags = source.IntParams;
  const number = (name: string, fallback = 0) => literal(floats[name] ?? fallback);
  const tint = new T.Color().setRGB(
    ...((source.VectorParams.g_vColorTint ?? [1, 1, 1]).slice(0, 3) as [number, number, number]),
    T.SRGBColorSpace,
  );
  tint.multiply(new T.Color(1, 1, 1).lerp(modelTint, floats.g_flModelTintAmount ?? 1));
  shader.uniforms.sourceParallaxTintColor = { value: tint };
  const samplers: string[] = [],
    aliases: string[] = [],
    canonical = new Map<string, string>();
  const constantReads: string[] = [];
  const bind = (native: string, name: string) => {
    const constant = source.constants?.[native];
    if (constant) {
      if (constant.length !== 4 || constant.some((v) => !Number.isFinite(v)))
        throw new Error(`Invalid verified parallax constant: ${native}`);
      constantReads.push(name);
      aliases.push(`vec4 ${name}Constant(vec2 uv){return ${vector(constant)};}
        vec4 ${name}Constant(vec2 uv,float bias){return ${vector(constant)};}`);
      return;
    }
    const key = source.textures[native],
      previous = canonical.get(key);
    if (previous) {
      aliases.push(`#define ${name} ${previous}`);
      return;
    }
    const texture = textures.get(key);
    if (!texture) throw new Error(`Native parallax texture missing: ${native}`);
    canonical.set(key, name);
    shader.uniforms[name] = { value: texture };
    samplers.push(name);
  };
  bind("g_tColor", "sourceParallaxBase");
  bind("g_tNormal", "sourceParallaxPacked");
  bind("g_tLayer0Mask", "sourceParallaxMask");
  bind("g_tLayer1Color", "sourceParallaxLayer1");
  bind("g_tLayer2Color", "sourceParallaxLayer2");
  bind("g_tAmbientOcclusion", "sourceParallaxAO");
  if (flags.F_TINT_MASK) bind("g_tTintMask", "sourceParallaxTintMask");
  if (flags.F_TRANSMISSIVE_BACKFACE_NDOTL)
    bind("g_tTransmissiveMask", "sourceParallaxTransmissiveMask");
  let cubeCode = "";
  if (flags.F_SECOND_LAYER_CUBEMAP) {
    const cube = cubes.get(source.textures.g_tLayer2Cubemap);
    if (!cube) throw new Error("Native parallax cube binding missing");
    shader.uniforms.sourceParallaxCubeTexture = { value: cube };
    cubeCode = sourceCubeSampling
      .replaceAll("SOURCE_REFLECTION", "SOURCE_PARALLAX")
      .replaceAll("sourceReflectionCubes0", "sourceParallaxCubeTexture")
      .replaceAll("sourceReflectionCubes1", "sourceParallaxUnusedCube")
      .replaceAll("sourceCube", "sourceParallaxCube");
    cubeCode =
      `#define SOURCE_PARALLAX_SINGLE_ARRAY\n#define SOURCE_PARALLAX_CUBE_SIZE ${cubeSize}\n` +
      cubeCode;
  }
  shader.fragmentShader =
    `uniform vec3 sourceParallaxTintColor;\n${samplers.length ? `uniform sampler2D ${samplers.join(",")};` : ""}\n${aliases.join("\n")}\n${cubeCode}\nvec3 sourceParallaxTransmission;\n` +
    shader.fragmentShader;
  const emissiveTint = (layer: number) =>
    vector((source.VectorParams[`g_vLayer${layer}EmissiveTint`] ?? [1, 1, 1]).slice(0, 3));
  const code = `
    vec2 sourceParallaxUV=vMapUv;
    vec4 sourceParallaxNormal=texture2D(sourceParallaxPacked,sourceParallaxUV);
    vec2 sourceParallaxHemi=vec2(sourceParallaxNormal.r+sourceParallaxNormal.g-1.003922,sourceParallaxNormal.r-sourceParallaxNormal.g);
    vec3 sourceParallaxMapN=normalize(vec3(sourceParallaxHemi,1.0-abs(sourceParallaxHemi.x)-abs(sourceParallaxHemi.y)));
    vec3 sourceParallaxN=normalize(vNormal),sourceParallaxV=normalize(vViewPosition);
    float sourceParallaxNoV=clamp(dot(sourceParallaxV,sourceParallaxN),0.0001,1.0);
    vec2 sourceParallaxViewTS=vec2(dot(-sourceParallaxV,normalize(vTangent)),dot(-sourceParallaxV,normalize(vBitangent)));
    vec2 sourceParallaxDirection=sourceParallaxViewTS*(pow(sourceParallaxNoV,0.7)/dot(-sourceParallaxV,sourceParallaxN));
    vec2 sourceParallaxNormalXY=sourceParallaxMapN.xy*vec2(1.0,-1.0);
    vec2 sourceParallaxUV1=sourceParallaxUV+sourceParallaxNormalXY*${number("g_flLayer1RefractionAmount")}+sourceParallaxDirection*(${number("g_flLayer1Offset")}/1024.0);
    vec2 sourceParallaxUV2=sourceParallaxUV+sourceParallaxNormalXY*${number("g_flLayer2RefractionAmount")}+sourceParallaxDirection*(${number("g_flLayer2Offset")}/1024.0);
    float sourceParallaxBlur1=mix(${number("g_flLayer1RoughnessBlurMin")},${number("g_flLayer1RoughnessBlurMax")},sourceParallaxNormal.b);
    float sourceParallaxBlur2=mix(${number("g_flLayer2RoughnessBlurMin")},${number("g_flLayer2RoughnessBlurMax")},sourceParallaxNormal.b);
    vec4 sourceParallaxColor=texture2D(sourceParallaxBase,sourceParallaxUV);
    float sourceParallaxMaskValue=texture2D(sourceParallaxMask,sourceParallaxUV).r;
    vec4 sourceParallaxColor1=texture2D(sourceParallaxLayer1,sourceParallaxUV1,sourceParallaxBlur1);
    vec3 sourceParallaxColor2=texture2D(sourceParallaxLayer2,sourceParallaxUV2,sourceParallaxBlur2).rgb;
    vec3 sourceParallaxTint=${flags.F_TINT_MASK ? "mix(vec3(1.0),sourceParallaxTintColor,texture2D(sourceParallaxTintMask,sourceParallaxUV).r)" : "sourceParallaxTintColor"};
    diffuseColor.rgb=mix(mix(sourceParallaxColor2,sourceParallaxColor1.rgb,sourceParallaxColor1.a),sourceParallaxColor.rgb,sourceParallaxMaskValue)*sourceParallaxTint;
    diffuseColor.a=1.0;
    vec3 sourceParallaxEmission1=sourceParallaxColor1.rgb*${emissiveTint(1)}*${number("g_flLayer1EmissiveLevel")};
    vec3 sourceParallaxEmission2=sourceParallaxColor2;
    ${
      flags.F_SECOND_LAYER_CUBEMAP
        ? `vec3 sourceParallaxRayWorld=inverseTransformDirection(-sourceParallaxV,viewMatrix);
    vec3 sourceParallaxRaySource=vec3(sourceParallaxRayWorld.x,-sourceParallaxRayWorld.z,sourceParallaxRayWorld.y)+vec3(sourceParallaxNormalXY*${number("g_flLayer2RefractionAmount")},0.0);
    sourceParallaxEmission2*=sourceParallaxCubeSample(sourceParallaxRaySource,0,clamp(sourceParallaxBlur2,0.0,${literal(cubeLastLod)}));`
        : ""
    }
    sourceParallaxEmission2*=pow(sourceParallaxNoV,${number("g_flLayer2EmissiveFresnel")})*${emissiveTint(2)}*${number("g_flLayer2EmissiveLevel")};
    vec3 sourceParallaxEmission=mix(sourceParallaxEmission2,sourceParallaxEmission1,sourceParallaxColor1.a)*(1.0-sourceParallaxMaskValue)*sourceParallaxTint;
    sourceParallaxTransmission=${flags.F_TRANSMISSIVE_BACKFACE_NDOTL ? "diffuseColor.rgb*texture2D(sourceParallaxTransmissiveMask,sourceParallaxUV).r" : "vec3(0.0)"};
    float sourceParallaxOcclusion=texture2D(sourceParallaxAO,sourceParallaxUV).r;
  `;
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <map_fragment>", code)
    .replace("#include <color_fragment>", "")
    .replace("#include <roughnessmap_fragment>", "float roughnessFactor=sourceParallaxNormal.b;")
    .replace(
      "#include <metalnessmap_fragment>",
      `float metalnessFactor=${flags.F_METALNESS_TEXTURE ? "sourceParallaxColor.a" : number("g_flMetalness")}*sourceParallaxMaskValue;`,
    )
    .replace(
      "#include <normal_fragment_maps>",
      "vec3 mapN=sourceParallaxMapN*vec3(1.0,-1.0,1.0);normal=normalize(tbn*mapN);",
    )
    .replace("#include <emissivemap_fragment>", "totalEmissiveRadiance=sourceParallaxEmission;")
    .replace(
      "#include <aomap_fragment>",
      "reflectedLight.indirectDiffuse*=sourceParallaxOcclusion;reflectedLight.directSpecular*=sourceParallaxOcclusion;reflectedLight.indirectSpecular*=sourceParallaxOcclusion;",
    );
  applySourceSurface(shader, { directSpecular: true, indirectSpecular: true }, lookup);
  if (flags.F_TRANSMISSIVE_BACKFACE_NDOTL)
    shader.fragmentShader = shader.fragmentShader.replace(
      "// Source ResolveDiffuseSpecular supplies albedo*(1-metalness), without",
      `reflectedLight.directDiffuse += saturate(-dot(geometryNormal,directLight.direction))*directLight.color*RECIPROCAL_PI*sourceParallaxTransmission;\n// Source ResolveDiffuseSpecular supplies albedo*(1-metalness), without`,
    );
  for (const name of constantReads)
    shader.fragmentShader = shader.fragmentShader.replaceAll(
      `texture2D(${name},`,
      `${name}Constant(`,
    );
}
export function applyNativeMapParallax(
  root: T.Object3D,
  bundle: Awaited<ReturnType<typeof loadNativeMapParallax>>,
) {
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const source = bundle.materials[material.name];
      if (!source || !(material instanceof T.MeshStandardMaterial)) continue;
      const tangent = object.geometry.getAttribute("tangent");
      const uv = object.geometry.getAttribute("uv");
      const count = object.geometry.getAttribute("position").count;
      if (!tangent || tangent.itemSize !== 4 || tangent.count !== count)
        throw new Error(`Native parallax tangent stream missing: ${material.name}`);
      if (!uv || uv.itemSize !== 2 || uv.count !== count)
        throw new Error(`Native parallax material UV missing: ${material.name}`);
      object.castShadow = !source.IntParams.F_DO_NOT_CAST_SHADOWS;
      if (patched.has(material)) continue;
      patched.add(material);
      const modelTint = material.color.clone();
      material.color.setRGB(1, 1, 1);
      material.vertexColors = false;
      // Three still needs the UV/tangent defines when an authored packed normal
      // or color is a verified constant and its sampler has been folded away.
      const uvCarrier = [...bundle.textures.values()][0];
      if (!uvCarrier) throw new Error("Native parallax UV carrier unavailable");
      material.map = bundle.textures.get(source.textures.g_tColor) ?? uvCarrier;
      material.normalMap = bundle.textures.get(source.textures.g_tNormal) ?? uvCarrier;
      material.roughnessMap = material.metalnessMap = material.aoMap = material.emissiveMap = null;
      material.emissive.setRGB(0, 0, 0);
      material.side = T.FrontSide;
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.alphaTest = 0;
      material.fog = source.IntParams.g_bFogEnabled !== 0;
      registerSurfaceTextures(
        material,
        Object.values(source.textures)
          .map((key) => bundle.textures.get(key))
          .filter((t): t is T.Texture => !!t),
      );
      const previous = material.onBeforeCompile.bind(material),
        key = material.customProgramCacheKey();
      const cubeSize = bundle.cubeInfo[source.textures.g_tLayer2Cubemap]?.mips[0].width ?? 1;
      const cubeLastLod = (bundle.cubeInfo[source.textures.g_tLayer2Cubemap]?.mips.length ?? 1) - 1;
      material.onBeforeCompile = (shader, renderer) => {
        previous(shader, renderer);
        applyParallaxShader(
          shader,
          source,
          bundle.textures,
          bundle.cubes,
          modelTint,
          bundle.lookup,
          cubeSize,
          cubeLastLod,
        );
      };
      material.customProgramCacheKey = () =>
        `${key}:source-parallax:${JSON.stringify(source)}:${cubeSize}`;
      material.needsUpdate = true;
    }
  });
}
