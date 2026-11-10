import * as T from "three";
import { assetFetch } from "./asset-url";
import {
  validateNativeComplexDecal,
  bindNativeComplexDecalUv,
  applyNativeComplexDecalShader,
} from "./native-complex-decal";
import {
  validateAdvancedComplex,
  advancedComplexSamplers,
  createAdvancedComplexView,
  type NativeComplexAdvancedSelection,
} from "./native-complex-advanced";
import { loadSourceMaterialBundle } from "./source-layers";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";
import { registerSurfaceTextures } from "./presentation-settings";
export interface NativeComplexMaterial {
  decalSelection?: "nuke-crates-vs10-ps9610";
  decalSourceSha256?: string;
  advancedSelection?: NativeComplexAdvancedSelection;
  secondarySelection?: "nuke-silo-vs14-ps5134";
  secondarySourceSha256?: string;
  shader: string;
  nativeResource: string;
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
  textures: Record<string, string>;
  resolvedMaterialInputs: Record<string, number | number[]>;
  nativeDetailMaskValue?: number;
  exportedName?: string;
  exportedVariants?: {
    materialIndex?: number;
    packedMaterialIndex?: number;
    baseColorFactor: number[];
    nativeCombinedVSFactor?: number[];
  }[];
}
/** Native VS14/PS5134 routes secondary detail separately from the atlas.
 * The strict importer retains raw secondary as uv2 and atlas as uv1. */
export function validateNativeComplexSecondary(source: NativeComplexMaterial) {
  if (!source.secondarySelection) return false;
  const hashes: Record<string, string> = {
    "materials/models/props/de_nuke/hr_nuke/nuke_silo/nuke_silo_001.vmat":
      "f4e455b26a74e95a4b5b6666f3cd236a35fc2b0d1f7be8e57d5a9331c673a685",
    "materials/models/props/de_nuke/hr_nuke/nuke_silo/nuke_silo_001b.vmat":
      "25cecc64e0e9a6f803e2647bea6545133ed358a7fa9a9f7a2a5540b774eb9f84",
  };
  if (
    source.secondarySelection !== "nuke-silo-vs14-ps5134" ||
    !hashes[source.nativeResource.replace(/_c$/, "")] ||
    source.secondarySourceSha256 !== hashes[source.nativeResource.replace(/_c$/, "")] ||
    source.IntParams.F_SECONDARY_UV !== 1 ||
    source.IntParams.F_DETAIL_TEXTURE !== 2 ||
    scalar(source, "g_bUseSecondaryUvForDetailTexture") !== 1 ||
    scalar(source, "g_bUseSecondaryUvForDetailMask") !== 1 ||
    scalar(source, "g_bUseSecondaryUvForAmbientOcclusion") !== 0
  )
    throw new Error("Unsupported native secondary complex selection");
  return true;
}
function scalar(source: NativeComplexMaterial, name: string) {
  const value = source.resolvedMaterialInputs[name] ?? source.FloatParams[name];
  const result = Array.isArray(value) ? value[0] : value;
  if (!Number.isFinite(result)) throw new Error(`Native complex resolved input missing: ${name}`);
  return result;
}
export function validateNativeComplexMaterial(source: NativeComplexMaterial) {
  validateAdvancedComplex(source);
  const mode = source.IntParams.F_DETAIL_TEXTURE ?? 0;
  const secondary = validateNativeComplexSecondary(source);
  const decal = validateNativeComplexDecal(source);
  if (source.shader !== "csgo_complex.vfx" || ![0, 1, 2, 3].includes(mode))
    throw new Error("Unsupported native complex shader/detail selection");
  if (
    mode === 2 &&
    !secondary &&
    (!source.nativeResource.replace(/_c$/, "").endsWith("/hr_concrete_floor_001.vmat") ||
      source.nativeDetailMaskValue !== 1)
  )
    throw new Error("Native detail2 is only proved for concrete133");
  for (const [name, value] of Object.entries(source.IntParams))
    if (
      name.startsWith("F_") &&
      value &&
      !source.advancedSelection &&
      !(secondary && name === "F_SECONDARY_UV") &&
      !(decal && ["F_DECAL_TEXTURE", "F_SECONDARY_UV"].includes(name)) &&
      !["F_DETAIL_TEXTURE", "F_METALNESS_TEXTURE", "F_TINT_MASK"].includes(name)
    )
      throw new Error(`Unsupported native complex feature: ${name}`);
  if (
    source.IntParams.g_nScaleTexCoordUByModelScaleAxis ||
    source.IntParams.g_nScaleTexCoordVByModelScaleAxis
  )
    throw new Error("Native complex model-scale UV controls require original placement");
  for (const flag of ["F_TINT_MASK", "F_METALNESS_TEXTURE"])
    if (![0, 1].includes(source.IntParams[flag] ?? 0))
      throw new Error(`Invalid native complex flag: ${flag}`);
  const resolvedScalar = (name: string) => {
    const value = source.resolvedMaterialInputs[name] ?? source.FloatParams[name];
    if (!Number.isFinite(Array.isArray(value) ? value[0] : value))
      throw new Error(`Native complex resolved input missing: ${name}`);
  };
  resolvedScalar("g_flReflectance");
  if (!source.IntParams.F_METALNESS_TEXTURE) resolvedScalar("g_flMetalness");
  if (mode) resolvedScalar("g_flDetailBlendFactor");
  const x = source.resolvedMaterialInputs.g_vTexCoordXform0,
    y = source.resolvedMaterialInputs.g_vTexCoordXform1,
    scroll = source.resolvedMaterialInputs.g_vTexCoordScrollSpeed;
  if (
    !Array.isArray(x) ||
    !Array.isArray(y) ||
    !Array.isArray(scroll) ||
    x.some((value, index) => value !== [1, 0, 0, 0][index]) ||
    y.some((value, index) => value !== [0, 1, 0, 0][index]) ||
    scroll.some(Boolean)
  )
    throw new Error("Native complex base transform requires an additional source vertex selection");
}
function nativeSamplers(source: NativeComplexMaterial) {
  const names = ["g_tColor", "g_tNormal", "g_tAmbientOcclusion"],
    mode = source.IntParams.F_DETAIL_TEXTURE ?? 0;
  if (source.IntParams.F_TINT_MASK) names.push("g_tTintMask");
  if (mode) {
    names.push(mode === 3 ? "g_tNormalDetail" : "g_tDetail");
    if (source.nativeDetailMaskValue === undefined) names.push("g_tDetailMask");
  }
  return [
    ...names,
    ...advancedComplexSamplers(source),
    ...(validateNativeComplexDecal(source) ? ["g_tDecal"] : []),
  ];
}
function hasPackedIdentity(material: T.Material, source: NativeComplexMaterial) {
  return (
    source.exportedName === material.name &&
    source.exportedVariants?.some((variant) => variant.packedMaterialIndex !== undefined)
  );
}
function matchesVariant(
  material: T.MeshStandardMaterial,
  source: NativeComplexMaterial,
  variant: NonNullable<NativeComplexMaterial["exportedVariants"]>[number],
) {
  if (hasPackedIdentity(material, source)) {
    const index =
      material.userData.nativeComplexRawControl === true
        ? material.userData.nativeSourceMaterialIndex
        : material.userData.nativeGltfMaterialIndex;
    if (!Number.isInteger(index) || index < 0 || variant.packedMaterialIndex !== index)
      return false;
  }
  const factor = [material.color.r, material.color.g, material.color.b, material.opacity];
  return (
    variant.baseColorFactor.length === 4 &&
    variant.baseColorFactor.every((value, index) => Math.abs(value - factor[index]) <= 1e-6)
  );
}
/** Exact parser material slots distinguish native tint masks that the glTF
 * approximation omitted. Factor remains an independent retained identity check. */
export function selectNativeComplexMaterial(
  material: T.MeshStandardMaterial,
  materials: Record<string, NativeComplexMaterial>,
) {
  const direct = materials[material.name],
    candidates = [
      ...new Set([
        ...(direct ? [direct] : []),
        ...Object.values(materials).filter((source) => source.exportedName === material.name),
      ]),
    ];
  if (!candidates.length) return undefined;
  if (candidates.length === 1 && !hasPackedIdentity(material, candidates[0])) return candidates[0];
  const matches = candidates.filter((source) =>
    source.exportedVariants?.some((variant) => matchesVariant(material, source, variant)),
  );
  if (matches.length !== 1)
    throw new Error(`Ambiguous native complex instance identity: ${material.name}`);
  return matches[0];
}
export function applyNativeCombinedTint(
  material: T.MeshStandardMaterial,
  source: NativeComplexMaterial,
) {
  const corrections =
    source.exportedVariants
      ?.filter(
        (variant) => variant.nativeCombinedVSFactor && matchesVariant(material, source, variant),
      )
      .map((variant) => variant.nativeCombinedVSFactor!) ?? [];
  if (
    !corrections.length &&
    source.exportedVariants?.some((variant) => variant.nativeCombinedVSFactor)
  )
    throw new Error(`Native complex tint instance identity missing: ${material.name}`);
  if (corrections.length) {
    const factor = corrections[0];
    if (
      factor.length !== 4 ||
      factor.some((value) => !Number.isFinite(value)) ||
      corrections.some((other) =>
        other.some((value, index) => Math.abs(value - factor[index]) > 1e-6),
      )
    )
      throw new Error(`Ambiguous native complex tint correction: ${material.name}`);
    material.color.setRGB(factor[0], factor[1], factor[2]);
    material.opacity = factor[3];
  }
}
export async function loadNativeMapComplex(renderer: T.WebGLRenderer, path: string) {
  const directory = path.endsWith("source.json") ? path.slice(0, -"source.json".length) : path;
  const bundle = await loadSourceMaterialBundle<NativeComplexMaterial>(
    renderer,
    directory,
    (materials) => {
      const ids = new Set<string>();
      for (const material of Object.values(materials)) {
        validateNativeComplexMaterial(material);
        for (const sampler of nativeSamplers(material)) {
          const id = material.textures[sampler];
          if (!id) throw new Error(`Native complex sampler missing: ${sampler}`);
          ids.add(id);
        }
      }
      return ids;
    },
  );
  try {
    const manifest = (
      Object.values(bundle.materials).some((source) => source.IntParams.F_PAINT_VERTEX_COLORS)
        ? await assetFetch(directory + "source.json").then((response) => {
            if (!response.ok) throw new Error("Native complex source metadata unavailable");
            return response.json();
          })
        : {}
    ) as {
      paint?: {
        model: string;
        originalMainMaterialIndices: number[];
        materialBindings: {
          packedMaterialIndex: number;
          originalMaterialIndex: number;
          name: string;
          baseColorFactor: number[];
        }[];
        frame: { browserWorldFromOwnBrowser: number[]; ownBrowserFromBrowserWorld: number[] };
        source: Record<string, unknown>;
      };
    };
    return {
      ...bundle,
      lookup: await loadSourceSurfaceLookup(),
      ...(manifest.paint ? { paint: manifest.paint } : {}),
    };
  } catch (error) {
    for (const texture of new Set(bundle.textures.values())) texture.dispose();
    throw error;
  }
}
/** Native build26445667 common quality1 material arithmetic plus sealed rare14
 * selections. Advanced COLOR/DEPTH lowering is separately source-qualified;
 * engine live LUT/probe/light uploads and host MSAA scheduling remain unobserved. */
export function applyNativeMapComplex(
  root: T.Object3D,
  bundle: Awaited<ReturnType<typeof loadNativeMapComplex>>,
) {
  const advanced = createAdvancedComplexView();
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.userData.nativeComplexRawControl === true) {
        const control = object.geometry.getAttribute("color");
        if (
          !control ||
          control.itemSize !== 4 ||
          control.count !== object.geometry.getAttribute("position").count
        )
          throw new Error("Native complex sidecar raw RGBA missing");
        object.geometry.setAttribute("nativeComplexPaint", control);
      }
      if (material.userData.nativeComplexSecondary) {
        const uv = object.geometry.getAttribute("uv2");
        if (!uv || uv.itemSize !== 2 || uv.count !== object.geometry.getAttribute("position").count)
          throw new Error("Native silo secondary UV stream missing");
        object.geometry.setAttribute("nativeComplexSecondaryUv", uv);
      }
      if (material.userData.nativeComplexDecal === true) bindNativeComplexDecalUv(object.geometry);
      if (patched.has(material)) continue;
      const native =
        material instanceof T.MeshStandardMaterial
          ? selectNativeComplexMaterial(material, bundle.materials)
          : bundle.materials[material.name];
      if (!native) continue;
      if (
        native.IntParams.F_PAINT_VERTEX_COLORS &&
        bundle.paint &&
        material.userData.nativeComplexRawControl !== true
      )
        continue;
      if (!(material instanceof T.MeshStandardMaterial) || !object.geometry.hasAttribute("tangent"))
        throw new Error(`Native concrete tangent/material missing: ${material.name}`);
      patched.add(material);
      validateNativeComplexMaterial(native);
      applyNativeCombinedTint(material, native);
      const required = (name: string) => {
        const value = bundle.textures.get(native.textures[name]);
        if (!value) throw new Error(`Native concrete texture missing: ${name}`);
        return value;
      };
      material.map = required("g_tColor");
      material.normalMap = required("g_tNormal");
      material.aoMap = required("g_tAmbientOcclusion");
      material.aoMap.channel = 0;
      material.metalnessMap = material.roughnessMap = null;
      material.metalness = 0;
      material.vertexColors = false;
      material.userData.nativeSourceFamily = "complex";
      const secondary = validateNativeComplexSecondary(native);
      const decal = validateNativeComplexDecal(native) ? required("g_tDecal") : undefined;
      if (decal) {
        bindNativeComplexDecalUv(object.geometry);
        material.userData.nativeComplexDecal = true;
      }
      if (
        secondary &&
        (!object.geometry.getAttribute("uv2") ||
          object.geometry.getAttribute("uv2").itemSize !== 2 ||
          object.geometry.getAttribute("uv2").count !==
            object.geometry.getAttribute("position").count)
      )
        throw new Error("Native silo secondary UV stream missing");
      if (secondary) {
        object.geometry.setAttribute(
          "nativeComplexSecondaryUv",
          object.geometry.getAttribute("uv2"),
        );
        material.userData.nativeComplexSecondary = true;
      }
      const mode = native.IntParams.F_DETAIL_TEXTURE ?? 0,
        detail = mode ? required(mode === 3 ? "g_tNormalDetail" : "g_tDetail") : undefined,
        tint = native.IntParams.F_TINT_MASK ? required("g_tTintMask") : undefined,
        mask =
          mode && native.nativeDetailMaskValue === undefined
            ? required("g_tDetailMask")
            : undefined,
        key = material.customProgramCacheKey(),
        compile = material.onBeforeCompile.bind(material);
      const scale = native.VectorParams.g_vDetailTexCoordScale ?? [1, 1],
        offset = native.VectorParams.g_vDetailTexCoordOffset ?? [0, 0],
        rotation = ((native.FloatParams.g_flDetailTexCoordRotation ?? 0) * Math.PI) / 180;
      const c = Math.cos(rotation),
        s = Math.sin(rotation),
        detailX = [c * scale[0], -s * scale[1]],
        detailY = [s * scale[0], c * scale[1]];
      const shift = [0.5 + offset[0] - 0.5 * (c - s), 0.5 + offset[1] - 0.5 * (s + c)];
      // The selected native VS's center term is applied before scale: actual .1
      // scale, rotation0 produces +.45. Preserve this exact pinned affine form.
      shift[0] = 0.5 + offset[0] - 0.5 * (detailX[0] + detailX[1]);
      shift[1] = 0.5 + offset[1] - 0.5 * (detailY[0] + detailY[1]);
      const resolvedXform = native.resolvedMaterialInputs.g_vDetailTexCoordXform,
        resolvedOffset = native.resolvedMaterialInputs.g_vDetailTexCoordOffset;
      if (mode && (mode !== 2 || secondary)) {
        if (!Array.isArray(resolvedXform) || !Array.isArray(resolvedOffset))
          throw new Error("Native complex resolved detail UV transform missing");
        detailX.splice(0, 2, ...resolvedXform.slice(0, 2));
        detailY.splice(0, 2, ...resolvedXform.slice(2, 4));
        shift.splice(0, 2, ...resolvedOffset.slice(0, 2));
      }
      const controls = new T.Vector4(
        native.nativeDetailMaskValue ?? 0,
        mode ? scalar(native, "g_flDetailBlendToFull") : 0,
        mode ? scalar(native, "g_flDetailBlendFactor") : 0,
        native.IntParams.F_METALNESS_TEXTURE ? 0 : scalar(native, "g_flMetalness"),
      );
      const reflectance = scalar(native, "g_flReflectance"),
        normalStrength = native.resolvedMaterialInputs.g_vDetailNormalStrengthOffsetScale;
      if (mode === 3 && (!Array.isArray(normalStrength) || normalStrength.length !== 4))
        throw new Error("Native complex detail-normal strength missing");
      material.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer);
        Object.assign(shader.uniforms, {
          nativeComplexDetailXform: { value: new T.Vector4(...detailX, ...detailY) },
          nativeComplexDetailOffset: { value: new T.Vector2(...shift) },
          nativeComplexControl: { value: controls },
          nativeComplexReflectance: { value: reflectance },
          nativeComplexDetailNormal: {
            value: new T.Vector4(
              ...(Array.isArray(normalStrength) ? normalStrength : [0, 0, 1, 0]),
            ),
          },
        });
        if (detail) shader.uniforms.nativeComplexDetail = { value: detail };
        if (tint) shader.uniforms.nativeComplexTint = { value: tint };
        if (mask) shader.uniforms.nativeComplexMask = { value: mask };
        shader.vertexShader =
          `${secondary ? "attribute vec2 nativeComplexSecondaryUv;varying vec2 vNativeComplexSecondaryUv;" : ""}varying vec2 vNativeComplexDetailUv;uniform vec4 nativeComplexDetailXform;uniform vec2 nativeComplexDetailOffset;\n${shader.vertexShader}`.replace(
            "#include <uv_vertex>",
            `#include <uv_vertex>\n${secondary ? "vNativeComplexSecondaryUv=nativeComplexSecondaryUv;" : ""}vNativeComplexDetailUv=vec2(dot(${secondary ? "nativeComplexSecondaryUv" : "uv"},nativeComplexDetailXform.xy),dot(${secondary ? "nativeComplexSecondaryUv" : "uv"},nativeComplexDetailXform.zw))+nativeComplexDetailOffset;`,
          );
        const weight = mode
          ? `max(${mask ? `texture2D(nativeComplexMask,${secondary ? "vNativeComplexSecondaryUv" : "vMapUv"}).r` : "nativeComplexControl.x"},nativeComplexControl.y)*nativeComplexControl.z`
          : "0.0";
        shader.fragmentShader = `${secondary ? "varying vec2 vNativeComplexSecondaryUv;" : ""}varying vec2 vNativeComplexDetailUv;
uniform vec4 nativeComplexControl,nativeComplexDetailNormal;uniform float nativeComplexReflectance;
${detail ? "uniform sampler2D nativeComplexDetail;" : ""}
${tint ? "uniform sampler2D nativeComplexTint;" : ""}
${mask ? "uniform sampler2D nativeComplexMask;" : ""}
vec3 nativeComplexDecode(vec2 rg){vec2 h=vec2(rg.x+rg.y-1.003921627998352,rg.x-rg.y);return normalize(vec3(h,1.0-abs(h.x)-abs(h.y)));}
${shader.fragmentShader}`;
        let colorDetail = "";
        if (mode === 1)
          colorDetail = `nativeComplexColor*=mix(vec3(1),texture2D(nativeComplexDetail,vNativeComplexDetailUv).rgb*(508.0/255.0),nativeComplexWeight);`;
        if (mode === 2)
          colorDetail = `vec3 nativeComplexGamma=pow(nativeComplexColor,vec3(1.0/2.2));
vec3 nativeComplexD=texture2D(nativeComplexDetail,vNativeComplexDetailUv).rgb*(254.0/255.0);
vec3 nativeComplexOverlay=mix(2.0*nativeComplexGamma*nativeComplexD,1.0-2.0*(1.0-nativeComplexGamma)*(1.0-nativeComplexD),step(vec3(.5),nativeComplexGamma));
nativeComplexColor=mix(nativeComplexColor,pow(nativeComplexOverlay,vec3(2.2)),nativeComplexWeight);`;
        const metal = native.IntParams.F_METALNESS_TEXTURE
          ? "nativeComplexSample.a"
          : "nativeComplexControl.w";
        let detailNormal = "";
        if (mode === 3) {
          detailNormal = `vec3 nd=nativeComplexDecode(texture2D(nativeComplexDetail,vNativeComplexDetailUv).rg);
vec3 d=mix(vec3(0,0,1),nativeComplexDetailNormal.xyz+nativeComplexDetailNormal.w*nd,nativeComplexWeight);
vec3 q=mapN*d.z;mapN=normalize(vec3(q.xy+d.xy*q.z,q.z));`;
        }
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <map_fragment>",
            `vec4 nativeComplexSample=texture2D(map,vMapUv);
vec3 nativeComplexColor=nativeComplexSample.rgb*${tint ? "mix(vec3(1),diffuseColor.rgb,texture2D(nativeComplexTint,vMapUv).r)" : "diffuseColor.rgb"};
float nativeComplexWeight=${weight};${colorDetail}
diffuseColor.rgb=nativeComplexColor;
vec4 nativeComplexPackedNormal=texture2D(normalMap,vNormalMapUv);`,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "float roughnessFactor=nativeComplexPackedNormal.b;",
          )
          .replace("#include <metalnessmap_fragment>", `float metalnessFactor=${metal};`)
          .replace(
            "#include <normal_fragment_maps>",
            `vec3 mapN=nativeComplexDecode(nativeComplexPackedNormal.rg);${detailNormal}mapN.y=-mapN.y;normal=normalize(tbn*mapN);`,
          );
        if (decal) applyNativeComplexDecalShader(shader, decal, 0);
        applySourceSurface(
          shader,
          { directSpecular: true, indirectSpecular: true, nativeAO: true },
          bundle.lookup,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_physical_fragment>",
          `#include <lights_physical_fragment>\nmaterial.specularColor=mix(vec3(nativeComplexReflectance),diffuseColor.rgb,metalnessFactor);material.specularColorBlended=material.specularColor;`,
        );
      };
      material.customProgramCacheKey = () =>
        `${key}:native-complex-quality1-uniforms:${mode}:${!!tint}:${!!mask}:${!!native.IntParams.F_METALNESS_TEXTURE}:${secondary}${decal ? ":native-decal0" : ""}`;
      material.needsUpdate = true;
      advanced.bind(object, material, native, bundle.textures);
      registerSurfaceTextures(material, [
        material.map,
        material.normalMap,
        material.aoMap,
        ...[
          detail,
          tint,
          mask,
          decal,
          ...advancedComplexSamplers(native).map((name) =>
            bundle.textures.get(native.textures[name]),
          ),
        ].filter((texture): texture is T.Texture => !!texture),
      ]);
    }
    advanced.finish(object);
  });
  return advanced;
}
