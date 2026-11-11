/** Native build26445667 foliage color/depth equations and Source-space sway.
 * WebGL uses actual target MSAA for coverage/A2C and coincident alpha prepass
 * depth for EqualDepth color. Native host pass/bias ordering and live engine
 * AA/wind uploads are unobserved; authored wind scheduling remains qualified. */
import * as T from "three";
import { createSourceFoliageAdvancedWind } from "./source-foliage-advanced-wind";
import { sourceSunCaster } from "./source-sun";
import type { NativeFoliageVisibilityLink } from "./native-foliage-visibility";
import { selectNativeComplexMaterial, type NativeComplexMaterial } from "./native-map-complex";
import { assetFetch } from "./asset-url";
import { fetchGzipped } from "./gltf";
import { loadSourceMaterialBundle } from "./source-layers";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";
import { createSourceFoliageSway, type SourceFoliageWindState } from "./source-foliage-wind";
import {
  createEnvironmentWorldFrame,
  type EnvironmentWorldFrame,
} from "./native-environment-frame";
import { registerSourceDepth, installSourceShadowDepth } from "./source-depth";
import { registerSurfaceTextures } from "./presentation-settings";

export interface NativeFoliageMaterial extends NativeComplexMaterial {
  /** Qualified primary-source MatrixColorCorrect2 transport, applied after tint. */
  colorCorrectionMatrix?: number[];
  shader: string;
  nativeResource: string;
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
  resolvedMaterialInputs: Record<string, number | number[]>;
  textures: Record<string, string>;
}
interface FoliageManifest {
  model?: string;
  geometryManifest?: string;
  noise: string;
  originalMainMaterialIndices?: number[];
  controllers?: unknown[];
  visibilityLinks?: NativeFoliageVisibilityLink[];
  admission?: {
    unresolvedControlSidecarMaterialSlots?: number[];
    unresolvedControlOriginalMaterialIndices?: number[];
    policy?: string;
  };
  frame?: {
    ownBrowserFromBrowserWorld: number[];
    browserWorldFromOwnBrowser: number[];
    gameWorldFromSource: number[];
    sourceFromGameWorld: number[];
  };
}
function scalar(source: NativeFoliageMaterial, name: string) {
  const value = source.resolvedMaterialInputs[name] ?? source.FloatParams[name];
  const number = Array.isArray(value) ? value[0] : value;
  if (!Number.isFinite(number)) throw new Error(`Native foliage input missing: ${name}`);
  return number;
}
export function validateNativeFoliageMaterial(source: NativeFoliageMaterial) {
  const mode = source.IntParams.F_VERTEX_ANIMATION ?? 0;
  if (source.shader !== "csgo_foliage.vfx" || ![0, 1, 2].includes(mode))
    throw new Error("Unsupported native foliage animation selection");
  const flags = [
    "F_ALPHA_TEST",
    "F_RENDER_BACKFACES",
    "F_TRANSMISSIVE_BACKFACE_NDOTL",
    "F_USE_ALBEDO_FOR_TRANSMISSIVE",
    "F_VERTEX_ANIMATION",
    "F_TINT_MASK",
    "F_DO_NOT_CAST_SHADOWS",
  ];
  for (const [name, value] of Object.entries(source.IntParams))
    if (
      name.startsWith("F_") &&
      ((value && !flags.includes(name)) ||
        (name !== "F_VERTEX_ANIMATION" && ![0, 1].includes(value)))
    )
      throw new Error(`Unsupported native foliage feature: ${name}`);
  const common = [
    "g_flVertexAmbientOcclusionAmount",
    "g_flVertexAmbientOcclusionPower",
    "g_flHeightGradientAmount",
    "g_flHeightGradientPower",
    "g_flReflectance",
    "g_fTextureNormalContrast",
    "g_fTextureRoughnessContrast",
    "g_fTextureRoughnessBrightness",
  ];
  for (const name of common) scalar(source, name);
  if (source.IntParams.F_ALPHA_TEST)
    for (const name of [
      "g_flAlphaTestReference",
      "g_flAlphaBoostDistance",
      "g_flAlphaBoostStrength",
      "g_flGrazingAngleMask",
    ])
      scalar(source, name);
  if (mode === 1)
    for (const name of [
      "g_flSwayAmount",
      "g_flSwaySpeed",
      "g_flSwayNoiseScale",
      "g_flSwayFalloff",
      "g_flFlutterAmount",
      "g_flFlutterSpeed",
      "g_flFlutterNoiseScale",
      "g_flFlutterFalloff",
    ])
      scalar(source, name);
  if (mode === 2) {
    for (const layer of [1, 2]) {
      scalar(source, `g_flNoise${layer}Strength`);
      scalar(source, `g_flNoise${layer}MaskFalloff`);
      for (const kind of ["Scale", "Speed"]) {
        const value =
          source.resolvedMaterialInputs[`g_vNoise${layer}${kind}`] ??
          source.VectorParams[`g_vNoise${layer}${kind}`];
        if (!Array.isArray(value) || value.length < 3 || value.some((x) => !Number.isFinite(x)))
          throw new Error("Native foliage mode2 vector missing");
      }
    }
    if (![0, 1].includes(scalar(source, "g_bUseEnvWind")))
      throw new Error("Invalid foliage mode2 wind gate");
  }
  for (const name of ["g_bDontFlipBackfaceNormals", "g_bRenderBackfaceNormals"])
    if (![0, 1].includes(scalar(source, name))) throw new Error("Invalid foliage face selection");
  if (
    source.IntParams.F_TRANSMISSIVE_BACKFACE_NDOTL &&
    (scalar(source, "g_bTransmissiveShadows") !== 1 ||
      scalar(source, "g_bApplyColorCorrectionToTransmissiveColor") !== 0)
  )
    throw new Error("Unsupported native foliage transmission selection");
  for (const name of ["g_fTextureColorContrast", "g_fTextureColorSaturation"]) {
    const v = source.resolvedMaterialInputs[name] ?? source.FloatParams[name] ?? 1;
    if ((Array.isArray(v) ? v[0] : v) !== 1)
      throw new Error("Unproved non-unity foliage color correction selection");
  }
  const brightness =
    source.resolvedMaterialInputs.g_fTextureColorBrightness ??
    source.FloatParams.g_fTextureColorBrightness ??
    1;
  if (
    (Array.isArray(brightness) ? brightness[0] : brightness) !== 1 &&
    !source.colorCorrectionMatrix
  )
    throw new Error("Native foliage brightness requires explicit qualified color matrix");
  if (
    source.colorCorrectionMatrix &&
    (source.colorCorrectionMatrix.length !== 9 ||
      source.colorCorrectionMatrix.some((x) => !Number.isFinite(x)))
  )
    throw new Error("Invalid native foliage qualified color matrix");
  for (const [name, expected] of [
    ["g_vTexCoordXform0", [1, 0, 0, 0]],
    ["g_vTexCoordXform1", [0, 1, 0, 0]],
    ["g_vTexCoordScrollSpeed", [0, 0, 0, 0]],
  ] as const) {
    const actual = source.resolvedMaterialInputs[name];
    if (!Array.isArray(actual) || actual.length !== 4 || actual.some((v, i) => v !== expected[i]))
      throw new Error("Native foliage requires proved affine UV selection");
  }
}
const samplers = (source: NativeFoliageMaterial) => [
  "g_tColor",
  "g_tNormal",
  "g_tAmbientOcclusion",
  ...(source.IntParams.F_TINT_MASK ? ["g_tTintMask"] : []),
  ...(source.IntParams.F_TRANSMISSIVE_BACKFACE_NDOTL &&
  !source.IntParams.F_USE_ALBEDO_FOR_TRANSMISSIVE
    ? ["g_tTransmissiveColor"]
    : []),
];
export async function loadNativeMapFoliage(renderer: T.WebGLRenderer, path: string) {
  const directory = path.endsWith("source.json") ? path.slice(0, -11) : path;
  const response = await assetFetch(directory + "source.json");
  if (!response.ok) throw new Error("Native foliage manifest unavailable");
  const source = (await response.json()) as FoliageManifest;
  const held = new Set(source.admission?.unresolvedControlSidecarMaterialSlots ?? []);
  if ([...held].some((i) => !Number.isInteger(i) || i < 0))
    throw new Error("Invalid withheld native foliage slot");
  const bundle = await loadSourceMaterialBundle<NativeFoliageMaterial>(
    renderer,
    directory,
    (materials) => {
      const selected = new Set<string>();
      for (const material of Object.values(materials)) {
        if (
          material.exportedVariants?.length &&
          material.exportedVariants.every(
            (v) => v.packedMaterialIndex !== undefined && held.has(v.packedMaterialIndex),
          )
        )
          continue;
        validateNativeFoliageMaterial(material);
        for (const sampler of samplers(material)) {
          const id = material.textures[sampler];
          if (!id) throw new Error(`Native foliage sampler missing: ${sampler}`);
          selected.add(id);
        }
      }
      return selected;
    },
  );
  let noise: T.Data3DTexture | undefined;
  try {
    const noiseResponse = await assetFetch(source.noise);
    if (!noiseResponse.ok) throw new Error("Native foliage volume unavailable");
    const manifest = (await noiseResponse.json()) as {
      file: string;
      format: string;
      srgb: boolean;
      bytes: number;
      mips: { width: number; height: number; depth: number; bytes: number }[];
    };
    const bytes = await fetchGzipped(
      source.noise.slice(0, source.noise.lastIndexOf("/") + 1) + manifest.file,
    );
    if (
      manifest.format !== "RGBA8" ||
      manifest.srgb ||
      manifest.mips.length !== 9 ||
      bytes.byteLength !== manifest.bytes
    )
      throw new Error("Invalid authored foliage volume");
    let total = 0;
    manifest.mips.forEach((mip, index) => {
      if (
        mip.width !== Math.max(1, 64 >> index) ||
        mip.height !== Math.max(1, 64 >> index) ||
        mip.depth !== Math.max(1, 256 >> index) ||
        mip.bytes !== mip.width * mip.height * mip.depth * 4
      )
        throw new Error("Invalid native foliage volume mip chain");
      total += mip.bytes;
    });
    if (total !== bytes.byteLength) throw new Error("Native foliage volume payload mismatch");
    // Both sealed native VS selections explicitly sample LOD0. Retain and validate
    // all authored levels; upload only the level those programs actually read.
    noise = new T.Data3DTexture(new Uint8Array(bytes, 0, manifest.mips[0].bytes), 64, 64, 256);
    noise.format = T.RGBAFormat;
    noise.type = T.UnsignedByteType;
    noise.colorSpace = T.NoColorSpace;
    noise.wrapS = noise.wrapT = noise.wrapR = T.RepeatWrapping;
    noise.minFilter = noise.magFilter = T.LinearFilter;
    noise.generateMipmaps = false;
    noise.needsUpdate = true;
    return { ...bundle, source, noise, lookup: await loadSourceSurfaceLookup() };
  } catch (error) {
    noise?.dispose();
    for (const texture of new Set(bundle.textures.values())) texture.dispose();
    throw error;
  }
}

export function applyNativeMapFoliage(
  root: T.Object3D,
  bundle: Awaited<ReturnType<typeof loadNativeMapFoliage>>,
  options: {
    sourceWorldFrame?: EnvironmentWorldFrame;
    windState: SourceFoliageWindState;
    /** Explicit local bounds including authored placements and wind envelope. */
    instanceBounds?: ReadonlyMap<T.InstancedMesh, T.Sphere>;
  },
) {
  const frame =
      options.sourceWorldFrame ??
      createEnvironmentWorldFrame(
        bundle.source.frame
          ? new T.Matrix4().fromArray(bundle.source.frame.ownBrowserFromBrowserWorld)
          : undefined,
      ),
    nativeToWorld = frame.worldToNative.clone().invert();
  const depthScene = new T.Scene(),
    depthPairs: { source: T.Mesh; depth: T.Mesh; matrixVersion?: number }[] = [],
    instanceDepthViews = new Set<T.InstancedMesh>(),
    owned = new Set<T.Material>(),
    updates: (
      | ReturnType<typeof createSourceFoliageSway>
      | ReturnType<typeof createSourceFoliageAdvancedWind>
    )[] = [];
  const patched = new Map<
    T.Material,
    { depth: T.MeshDepthMaterial; controls: boolean; noShadow: boolean; dynamic: boolean }
  >();
  const noShadowMeshes = new Set<T.Mesh>();
  const applyShadowPolicy = () => {
    for (const mesh of noShadowMeshes) mesh.castShadow = false;
  };
  const time = { value: options.windState.timeSeconds },
    prepassAA = { value: false };
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    if (object instanceof T.InstancedMesh) {
      // Current authored clutter has one BYTE3 tint palette per group. Resolve
      // that palette through the existing native material tint path, not Three's
      // otherwise unqualified per-instance color multiplication.
      if (object.instanceColor || object.morphTexture)
        throw new Error(
          "Native foliage instances require resolved palette materials and no morph input",
        );
      const bounds = options.instanceBounds?.get(object);
      if (bounds) {
        if (
          !Number.isFinite(bounds.radius) ||
          bounds.radius < 0 ||
          bounds.center.toArray().some((value) => !Number.isFinite(value))
        )
          throw new Error("Invalid conservative native foliage instance bounds");
        object.boundingSphere = bounds.clone();
      }
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const depthMaterials: T.MeshDepthMaterial[] = [],
      shadowFlags: boolean[] = [];
    let animatedCaster = false;
    for (const material of materials) {
      const previous = patched.get(material);
      if (previous) {
        if (
          object.geometry.getAttribute("tangent")?.itemSize !== 4 ||
          (previous.controls && object.geometry.getAttribute("color")?.itemSize !== 4)
        )
          throw new Error("Native foliage shared material attribute mismatch");
        if (previous.controls)
          object.geometry.setAttribute(
            "nativeFoliageControl",
            object.geometry.getAttribute("color"),
          );
        depthMaterials.push(previous.depth);
        shadowFlags.push(previous.noShadow);
        animatedCaster ||= previous.dynamic;
        continue;
      }
      const native =
        material instanceof T.MeshStandardMaterial
          ? (selectNativeComplexMaterial(material, bundle.materials) as
              | NativeFoliageMaterial
              | undefined)
          : undefined;
      if (!native)
        throw new Error(`Native foliage sidecar has an unbound material: ${material.name}`);
      validateNativeFoliageMaterial(native);
      shadowFlags.push(!!native.IntParams.F_DO_NOT_CAST_SHADOWS);
      animatedCaster ||= !!native.IntParams.F_VERTEX_ANIMATION;
      const mode = native.IntParams.F_VERTEX_ANIMATION ?? 0,
        alphaTest = !!native.IntParams.F_ALPHA_TEST,
        transmission = !!native.IntParams.F_TRANSMISSIVE_BACKFACE_NDOTL;
      const needsControls =
          mode !== 0 ||
          scalar(native, "g_flVertexAmbientOcclusionAmount") !== 0 ||
          scalar(native, "g_flHeightGradientAmount") !== 0,
        hasControls = needsControls;
      const flipNormals =
        !!scalar(native, "g_bRenderBackfaceNormals") &&
        !scalar(native, "g_bDontFlipBackfaceNormals");
      if (
        !(material instanceof T.MeshStandardMaterial) ||
        object.geometry.getAttribute("tangent")?.itemSize !== 4 ||
        (needsControls && object.geometry.getAttribute("color")?.itemSize !== 4)
      )
        throw new Error("Native foliage requires original active FLOAT4 controls and tangent4");
      const corrected =
        native.exportedVariants
          ?.filter(
            (v) =>
              v.nativeCombinedVSFactor &&
              (native.exportedName !== material.name ||
                v.packedMaterialIndex === undefined ||
                v.packedMaterialIndex === material.userData.nativeGltfMaterialIndex) &&
              v.baseColorFactor.every(
                (x, i) =>
                  Math.abs(
                    x - [material.color.r, material.color.g, material.color.b, material.opacity][i],
                  ) <= 1e-6,
              ),
          )
          .map((v) => v.nativeCombinedVSFactor!) ?? [];
      if (
        native.exportedVariants?.some((v) => v.nativeCombinedVSFactor) &&
        (!corrected.length ||
          corrected.some(
            (v) =>
              v.length !== 4 ||
              v.some((x, i) => !Number.isFinite(x) || Math.abs(x - corrected[0][i]) > 1e-6),
          ))
      )
        throw new Error("Native foliage instance tint identity missing/ambiguous");
      if (corrected.length) {
        material.color.setRGB(corrected[0][0], corrected[0][1], corrected[0][2]);
        material.opacity = corrected[0][3];
      }
      const correction = native.colorCorrectionMatrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
      if (correction.length !== 9 || correction.some((x) => !Number.isFinite(x)))
        throw new Error("Invalid native foliage qualified color correction");
      const required = (name: string) => {
        const texture = bundle.textures.get(native.textures[name]);
        if (!texture) throw new Error(`Native foliage texture missing: ${name}`);
        return texture;
      };
      material.map = required("g_tColor");
      material.normalMap = required("g_tNormal");
      material.aoMap = required("g_tAmbientOcclusion");
      material.aoMap.channel = 0;
      material.metalnessMap = material.roughnessMap = null;
      material.metalness = 0;
      material.vertexColors = false;
      material.side = native.IntParams.F_RENDER_BACKFACES ? T.DoubleSide : T.FrontSide;
      material.alphaTest = 0;
      material.transparent = false;
      material.depthFunc = alphaTest ? T.EqualDepth : T.LessEqualDepth;
      material.depthWrite = !alphaTest;
      material.opacity = 1;
      const advancedLayer = (layer: number) => ({
        strength: scalar(native, `g_flNoise${layer}Strength`),
        falloff: scalar(native, `g_flNoise${layer}MaskFalloff`),
        scale: (native.resolvedMaterialInputs[`g_vNoise${layer}Scale`] ??
          native.VectorParams[`g_vNoise${layer}Scale`]) as number[],
        speed: (native.resolvedMaterialInputs[`g_vNoise${layer}Speed`] ??
          native.VectorParams[`g_vNoise${layer}Speed`]) as number[],
      });
      const sway =
        mode === 1
          ? createSourceFoliageSway(
              {
                swayAmount: scalar(native, "g_flSwayAmount"),
                swaySpeed: scalar(native, "g_flSwaySpeed"),
                swayNoiseScale: scalar(native, "g_flSwayNoiseScale"),
                swayFalloff: scalar(native, "g_flSwayFalloff"),
                flutterAmount: scalar(native, "g_flFlutterAmount"),
                flutterSpeed: scalar(native, "g_flFlutterSpeed"),
                flutterNoiseScale: scalar(native, "g_flFlutterNoiseScale"),
                flutterFalloff: scalar(native, "g_flFlutterFalloff"),
              },
              options.windState,
              bundle.noise,
            )
          : mode === 2
            ? createSourceFoliageAdvancedWind(
                [advancedLayer(1), advancedLayer(2)],
                !!scalar(native, "g_bUseEnvWind"),
                options.windState,
                bundle.noise,
              )
            : undefined;
      if (sway) updates.push(sway);

      const uniforms = {
        ...sway?.uniforms,
        nativeFoliageWorldToOwn: { value: frame.worldToNative },
        nativeFoliageOwnToWorld: { value: nativeToWorld },
        nativeFoliageNormalToOwn: { value: frame.worldToNativeNormal },
        nativeFoliageNormalToWorld: { value: frame.nativeToWorldNormal },
        nativeFoliageTime: time,
      };
      const instanceFrame = `
mat4 foliageModelMatrix(){
 #ifdef USE_INSTANCING
 return modelMatrix*instanceMatrix;
 #else
 return modelMatrix;
 #endif
}
`;
      const positionFunction = mode
        ? `vec3 foliagePosition(vec3 p){mat4 placement=foliageModelMatrix();vec3 world=(placement*vec4(p,1)).xyz;vec3 own=(nativeFoliageWorldToOwn*vec4(world,1)).xyz;vec3 bent=sourceFoliageSwayPoint(foliageBToS(own),nativeFoliageControl);return(inverse(placement)*nativeFoliageOwnToWorld*vec4(foliageSToB(bent),1)).xyz;}`
        : `vec3 foliagePosition(vec3 p){return p;}`;
      // Color and depth have different normal/lighting work. Keep their shared
      // clip position invariant so EqualDepth retains the covered samples.
      const vertex = (shader: T.WebGLProgramParametersWithUniforms) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `invariant gl_Position;\n${hasControls ? "attribute vec4 nativeFoliageControl;" : ""}\nuniform mat4 nativeFoliageWorldToOwn,nativeFoliageOwnToWorld;uniform mat3 nativeFoliageNormalToOwn,nativeFoliageNormalToWorld;varying vec4 vNativeFoliageControl;varying vec3 vNativeFoliageView;varying vec2 vNativeFoliageUv;varying vec3 vNativeFoliageCross,vNativeFoliageOriginal;\n${(sway?.glsl ?? "").replace("animatedN=normalize(cross(tangent,bitangent));", "animatedN=cross(tangent,bitangent);").replace("animatedT=normalize(tangent);", "animatedT=tangent;")}\nvec3 foliageBToS(vec3 p){return vec3(p.x,-p.z,p.y)/.0254;}vec3 foliageSToB(vec3 p){return vec3(p.x,p.z,-p.y)*.0254;}\n${instanceFrame}\n${positionFunction}\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <begin_vertex>",
            `vec3 transformed=foliagePosition(position);vNativeFoliageControl=${hasControls ? "nativeFoliageControl" : "vec4(0)"};vNativeFoliageUv=uv;`,
          )
          .replace(
            "#include <project_vertex>",
            "#include <project_vertex>\nvNativeFoliageView=-mvPosition.xyz;",
          );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <beginnormal_vertex>",
          mode
            ? `#include <beginnormal_vertex>\nvec3 nativeFoliageViewTangent;vec3 ownP=foliageBToS((nativeFoliageWorldToOwn*foliageModelMatrix()*vec4(position,1)).xyz);vec3 ownN=nativeFoliageNormalToOwn*normalize(mat3(foliageModelMatrix())*objectNormal);vec3 ownT=nativeFoliageNormalToOwn*normalize(mat3(foliageModelMatrix())*objectTangent);ownN=vec3(ownN.x,-ownN.z,ownN.y);ownT=vec3(ownT.x,-ownT.z,ownT.y);vNativeFoliageOriginal=mat3(viewMatrix)*normalize(mat3(foliageModelMatrix())*objectNormal);vec3 bendP,bendN,bendT;sourceFoliageSwayFrame(ownP,ownN,ownT,nativeFoliageControl,bendP,bendN,bendT);vNativeFoliageCross=mat3(viewMatrix)*nativeFoliageNormalToWorld*vec3(bendN.x,bendN.z,-bendN.y);objectNormal=inverse(mat3(foliageModelMatrix()))*nativeFoliageNormalToWorld*vec3(bendN.x,bendN.z,-bendN.y);objectTangent=inverse(mat3(foliageModelMatrix()))*nativeFoliageNormalToWorld*vec3(bendT.x,bendT.z,-bendT.y);nativeFoliageViewTangent=mat3(viewMatrix)*nativeFoliageNormalToWorld*vec3(bendT.x,bendT.z,-bendT.y);`
            : `#include <beginnormal_vertex>\nvec3 nativeFoliageViewTangent=mat3(viewMatrix)*normalize(mat3(foliageModelMatrix())*objectTangent);vNativeFoliageOriginal=mat3(viewMatrix)*normalize(mat3(foliageModelMatrix())*objectNormal);vNativeFoliageCross=vNativeFoliageOriginal;`,
        );
        // Native normals use direct authored placement, not Three's
        // inverse-square instance-scale correction.
        shader.vertexShader = shader.vertexShader.replace(
          "#include <defaultnormal_vertex>",
          `#include <defaultnormal_vertex>
#ifdef USE_INSTANCING
transformedNormal=vNativeFoliageCross;
#ifdef USE_TANGENT
transformedTangent=nativeFoliageViewTangent;
#endif
#ifdef FLIP_SIDED
transformedNormal=-transformedNormal;
#endif
#endif
`,
        );
      };
      // Alias the preserved source stream without editing or gamma-decoding it.
      if (hasControls)
        object.geometry.setAttribute("nativeFoliageControl", object.geometry.getAttribute("color"));
      const coverage = alphaTest
        ? new T.Vector4(
            scalar(native, "g_flAlphaTestReference"),
            scalar(native, "g_flGrazingAngleMask"),
            scalar(native, "g_flAlphaBoostStrength"),
            scalar(native, "g_flAlphaBoostDistance") * 0.0254 * frame.unitScale,
          )
        : undefined;
      const depthHook = {
        cacheKey: `native-foliage-depth-invariant-v2:${mode}:${alphaTest}:${hasControls}`,
        apply(
          shader: T.WebGLProgramParametersWithUniforms,
          _renderer?: T.WebGLRenderer,
          _source?: T.Material,
          prepass = false,
        ) {
          vertex(shader);
          if (!alphaTest) return;
          shader.uniforms.nativeFoliageAA = prepass ? prepassAA : { value: false };
          shader.uniforms.nativeFoliageCoverage = { value: coverage };
          shader.uniforms.nativeFoliageAlpha = { value: material.map };
          shader.fragmentShader = `uniform bool nativeFoliageAA;uniform vec4 nativeFoliageCoverage;uniform sampler2D nativeFoliageAlpha;varying vec3 vNativeFoliageView;varying vec2 vNativeFoliageUv;\n${shader.fragmentShader}`;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <alphatest_fragment>",
            `float a=texture2D(nativeFoliageAlpha,vNativeFoliageUv).a*pow(max(abs(dot(normalize(vNativeFoliageView),normalize(cross(dFdx(vNativeFoliageView),dFdy(vNativeFoliageView))))),1e-6),nativeFoliageCoverage.y)*mix(1.,nativeFoliageCoverage.z,clamp(length(vNativeFoliageView)/nativeFoliageCoverage.w,0.,1.));float nativeFoliageAlphaCoverage=nativeFoliageAA?clamp(.5+(a-nativeFoliageCoverage.x)/max(fwidth(a),1e-6),0.,1.):a-nativeFoliageCoverage.x;if(nativeFoliageAlphaCoverage<.001)discard;`,
          );
        },
      };
      registerSourceDepth(material, depthHook);
      const depth = new T.MeshDepthMaterial({
        map: material.map,
        side: material.side,
        depthPacking: T.BasicDepthPacking,
      });
      depth.colorWrite = false;
      depth.visible = alphaTest;
      depth.depthWrite = true;
      depth.depthFunc = T.LessEqualDepth;
      depth.onBeforeCompile = (shader) => {
        depthHook.apply(shader, undefined, undefined, true);
        if (alphaTest)
          shader.fragmentShader = shader.fragmentShader.replace(
            "gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );",
            "gl_FragColor = vec4(vec3(1.0-fragCoordZ),nativeFoliageAA?nativeFoliageAlphaCoverage:1.0);",
          );
      };
      depth.customProgramCacheKey = () => depthHook.cacheKey;
      depthMaterials.push(depth);
      owned.add(depth);
      patched.set(material, {
        depth,
        controls: hasControls,
        noShadow: !!native.IntParams.F_DO_NOT_CAST_SHADOWS,
        dynamic: !!mode,
      });
      const compile = material.onBeforeCompile.bind(material),
        key = material.customProgramCacheKey(),
        useAlbedo = !!native.IntParams.F_USE_ALBEDO_FOR_TRANSMISSIVE,
        tint = !!native.IntParams.F_TINT_MASK;
      material.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer);
        vertex(shader);
        shader.uniforms.nativeFoliageColorCorrection = {
          value: new T.Matrix3().fromArray(correction),
        };
        shader.uniforms.nativeFoliageHeight = {
          value: new T.Vector2(
            scalar(native, "g_flHeightGradientAmount"),
            scalar(native, "g_flHeightGradientPower"),
          ),
        };
        shader.uniforms.nativeFoliageAO = {
          value: new T.Vector2(
            scalar(native, "g_flVertexAmbientOcclusionAmount"),
            scalar(native, "g_flVertexAmbientOcclusionPower"),
          ),
        };
        shader.uniforms.nativeFoliageRoughness = {
          value: new T.Vector3(
            scalar(native, "g_fTextureNormalContrast"),
            scalar(native, "g_fTextureRoughnessContrast"),
            scalar(native, "g_fTextureRoughnessBrightness"),
          ),
        };
        shader.uniforms.nativeFoliageReflectance = { value: scalar(native, "g_flReflectance") };
        if (tint) shader.uniforms.nativeFoliageTint = { value: required("g_tTintMask") };
        if (transmission && !useAlbedo)
          shader.uniforms.nativeFoliageTransmission = { value: required("g_tTransmissiveColor") };
        shader.fragmentShader = `varying vec4 vNativeFoliageControl;varying vec3 vNativeFoliageView;varying vec3 vNativeFoliageCross,vNativeFoliageOriginal;uniform mat3 nativeFoliageColorCorrection;uniform vec2 nativeFoliageAO,nativeFoliageHeight;uniform vec3 nativeFoliageRoughness;uniform float nativeFoliageReflectance;vec3 nativeFoliageTransmitted;vec3 nativeFoliageGeometric;${tint ? "uniform sampler2D nativeFoliageTint;" : ""}${transmission && !useAlbedo ? "uniform sampler2D nativeFoliageTransmission;" : ""}\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <map_fragment>",
            `vec4 nativeFoliageColor=texture2D(map,vMapUv);diffuseColor.rgb=nativeFoliageColor.rgb*${tint ? "mix(vec3(1),diffuseColor.rgb,texture2D(nativeFoliageTint,vMapUv).r)" : "diffuseColor.rgb"};diffuseColor.rgb=nativeFoliageColorCorrection*diffuseColor.rgb;diffuseColor.a=${alphaTest ? "1." : "nativeFoliageColor.a"};vec4 nativeFoliagePacked=texture2D(normalMap,vNormalMapUv);nativeFoliageTransmitted=vec3(0);`,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "float roughnessFactor=clamp(((nativeFoliagePacked.b-.5)*nativeFoliageRoughness.y+.5)*nativeFoliageRoughness.z,0.,1.);",
          )
          .replace("#include <metalnessmap_fragment>", "float metalnessFactor=0.;")
          .replace(
            "#include <normal_fragment_maps>",
            `vec2 h=vec2(nativeFoliagePacked.r+nativeFoliagePacked.g-256./255.,nativeFoliagePacked.r-nativeFoliagePacked.g);vec3 mapN=vec3(h*nativeFoliageRoughness.x,1.-abs(h.x)-abs(h.y));if(${flipNormals ? "gl_FrontFacing" : "true"})mapN.y=-mapN.y;normal=normalize(tbn*mapN);nativeFoliageGeometric=nonPerturbedNormal;`,
          )
          .replace("#include <alphatest_fragment>", "");
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <normal_fragment_begin>",
          T.ShaderChunk.normal_fragment_begin
            .replace(
              "vec3 normal = normalize( vNormal );",
              "vec3 normal=normalize(dot(vNativeFoliageCross,vNativeFoliageCross)>=1.01?vNativeFoliageOriginal:vNativeFoliageCross);",
            )
            .replace("tbn[0] *= faceDirection;", "")
            .replace("normal *= faceDirection;", flipNormals ? "normal *= faceDirection;" : "")
            .replace("tbn[1] *= faceDirection;", flipNormals ? "tbn[1] *= faceDirection;" : ""),
        );
        applySourceSurface(
          shader,
          { directSpecular: true, indirectSpecular: true, nativeAO: true },
          bundle.lookup,
        );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "float ambientOcclusion = texture2D(aoMap, vAoMapUv).r;",
            "float ambientOcclusion = texture2D(aoMap, vAoMapUv).r*mix(1.,pow(clamp(vNativeFoliageControl.a,.001,1.),nativeFoliageAO.y),nativeFoliageAO.x);",
          )
          .replace(
            "#include <lights_physical_fragment>",
            "#include <lights_physical_fragment>\nmaterial.diffuseContribution*=1.+nativeFoliageHeight.x*pow(clamp(vNativeFoliageControl.r,.001,1.),nativeFoliageHeight.y);material.specularColor=vec3(nativeFoliageReflectance);material.specularColorBlended=material.specularColor;",
          )
          .replace(
            "// Source ResolveDiffuseSpecular supplies albedo*(1-metalness), without",
            // Native transmission and direct diffuse consume the same light
            // radiance. Three's map sun carries pi for Lambert; undo it here
            // too, since transmission bypasses BRDF_Lambert.
            `${transmission ? "nativeFoliageTransmitted+=max(0.,-dot(nativeFoliageGeometric,directLight.direction))*directLight.color*RECIPROCAL_PI;" : ""}\n// Source ResolveDiffuseSpecular supplies albedo*(1-metalness), without`,
          )
          .replace(
            "#include <opaque_fragment>",
            `${transmission ? `outgoingLight+=nativeFoliageTransmitted*${useAlbedo ? "diffuseColor.rgb" : "texture2D(nativeFoliageTransmission,vMapUv).rgb*diffuse"};` : ""}\n#include <opaque_fragment>\n${!alphaTest ? "gl_FragColor.a=nativeFoliageColor.a;" : ""}`,
          );
      };
      material.customProgramCacheKey = () =>
        `${key}:native-foliage-invariant-v2:${mode}:${alphaTest}:${transmission}:${useAlbedo}:${tint}:${flipNormals}:${hasControls}`;
      material.needsUpdate = true;
      registerSurfaceTextures(material, samplers(native).map(required));
      material.userData.nativeFoliageInstanceSafe = true;
    }
    if (depthMaterials.some((material) => material.visible)) {
      const depthMaterial = Array.isArray(object.material) ? depthMaterials : depthMaterials[0];
      const depthMesh =
        object instanceof T.InstancedMesh
          ? new T.InstancedMesh(object.geometry, depthMaterial, 0)
          : new T.Mesh(object.geometry, depthMaterial);
      if (depthMesh instanceof T.InstancedMesh && object instanceof T.InstancedMesh) {
        // Share immutable CPU matrix bytes; separate attribute ownership keeps
        // color and depth GPU lifetimes independent and avoids double release.
        depthMesh.instanceMatrix = new T.InstancedBufferAttribute(object.instanceMatrix.array, 16);
        depthMesh.count = object.count;
        depthMesh.boundingSphere = object.boundingSphere?.clone() ?? null;
        instanceDepthViews.add(depthMesh);
      }
      depthMesh.matrixAutoUpdate = false;
      depthMesh.frustumCulled =
        object instanceof T.InstancedMesh && !!options.instanceBounds?.has(object);
      depthScene.add(depthMesh);
      depthPairs.push({ source: object, depth: depthMesh });
    }
    object.frustumCulled =
      object instanceof T.InstancedMesh && !!options.instanceBounds?.has(object);
    if (shadowFlags.some(Boolean) && !shadowFlags.every(Boolean))
      throw new Error("Mixed native foliage shadow policy requires primitive split");
    sourceSunCaster(object, animatedCaster);
    if (shadowFlags.every(Boolean)) {
      noShadowMeshes.add(object);
      object.castShadow = false;
    }
    installSourceShadowDepth(object);
  });
  return {
    depthScene,
    applyShadowPolicy,
    syncDepth(renderer?: T.WebGLRenderer) {
      applyShadowPolicy();
      const target = renderer?.getRenderTarget();
      const aa =
        !!renderer &&
        (target ? target.samples > 0 : !!renderer.getContext().getContextAttributes()?.antialias);
      prepassAA.value = aa;
      for (const material of owned)
        if (material.alphaToCoverage !== aa) {
          material.alphaToCoverage = aa;
          material.needsUpdate = true;
        }
      // Main-map architecture owns frozen world matrices, including foliage.
      // Three cannot change those matrices in this traversal; retain the walk
      // only for sources whose world transforms are still managed by Three.
      if (depthPairs.some((pair) => pair.source.matrixWorldAutoUpdate))
        root.updateWorldMatrix(true, true);
      for (const pair of depthPairs) {
        pair.depth.matrix.copy(pair.source.matrixWorld);
        pair.depth.matrixWorldNeedsUpdate = true;
        if (pair.source instanceof T.InstancedMesh && pair.depth instanceof T.InstancedMesh) {
          if (pair.depth.instanceMatrix.array !== pair.source.instanceMatrix.array) {
            pair.depth.instanceMatrix.dispose();
            pair.depth.instanceMatrix = new T.InstancedBufferAttribute(
              pair.source.instanceMatrix.array,
              16,
            );
          }
          if (pair.matrixVersion !== pair.source.instanceMatrix.version) {
            pair.depth.instanceMatrix.needsUpdate = true;
            pair.matrixVersion = pair.source.instanceMatrix.version;
          }
          pair.depth.count = pair.source.count;
          if (pair.source.boundingSphere) {
            pair.depth.boundingSphere ??= new T.Sphere();
            pair.depth.boundingSphere.copy(pair.source.boundingSphere);
          }
          pair.depth.frustumCulled = pair.source.frustumCulled;
        }
        let visible = true;
        for (let p: T.Object3D | null = pair.source; p; p = p.parent) visible &&= p.visible;
        pair.depth.visible = visible;
      }
    },
    update(seconds: number, state?: SourceFoliageWindState) {
      if (!Number.isFinite(seconds)) throw new Error("Invalid foliage clock");
      if (
        state &&
        (!Number.isFinite(state.strength) ||
          state.direction.length !== 3 ||
          state.direction.some((x) => !Number.isFinite(x)))
      )
        throw new Error("Invalid resolved foliage wind update");
      time.value = seconds;
      for (const sway of updates) {
        sway.update(seconds);
        if (state) {
          sway.uniforms.sourceFoliageWindDirection.value.set(...state.direction);
          sway.uniforms.sourceFoliageWindStrength.value = state.strength;
        }
      }
    },
    dispose() {
      for (const mesh of instanceDepthViews) mesh.dispose();
      instanceDepthViews.clear();
      for (const material of owned) material.dispose();
      owned.clear();
      depthPairs.length = 0;
      noShadowMeshes.clear();
      updates.length = 0;
      depthScene.clear();
    },
  };
}
