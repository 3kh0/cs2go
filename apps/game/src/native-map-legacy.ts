import * as T from "three";
import { loadSourceMaterialBundle } from "./source-layers";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";
import { registerSurfaceTextures } from "./presentation-settings";

/** Original native sampler channels, not the glTF export's synthesized ORM maps.
 * Keep resolved values/provenance beside each source-owned material. Unsupported
 * branches fail before textures allocate; map config activation is independent. */
export interface NativeLegacyMaterial {
  shader: "csgo_vertexlitgeneric.vfx" | "csgo_simple.vfx";
  nativeResource: string;
  exportedName?: string;
  exportedVariants?: {
    materialIndex?: number;
    packedMaterialIndex?: number;
    baseColorFactor: number[];
    nativeCombinedVSFactor?: number[];
  }[];
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
  textures: Record<string, string>;
  /** Only all-texel/all-authored-mip source-proven constants, in sampling domain. */
  constants?: Record<string, [number, number, number, number]>;
  resolvedMaterialInputs: Record<string, number | number[]>;
}
function matchesLegacyVariant(
  material: T.MeshStandardMaterial,
  source: NativeLegacyMaterial,
  variant: NonNullable<NativeLegacyMaterial["exportedVariants"]>[number],
) {
  if (
    source.exportedName === material.name &&
    variant.packedMaterialIndex !== undefined &&
    material.userData.nativeGltfMaterialIndex !== variant.packedMaterialIndex
  )
    return false;
  return (
    variant.baseColorFactor.length === 4 &&
    variant.baseColorFactor.every(
      (v, i) =>
        Math.abs(v - [material.color.r, material.color.g, material.color.b, material.opacity][i]) <=
        1e-6,
    )
  );
}
export function selectNativeLegacyMaterial(
  material: T.MeshStandardMaterial,
  materials: Record<string, NativeLegacyMaterial>,
) {
  const candidates = [
    ...new Set([
      ...(materials[material.name] ? [materials[material.name]] : []),
      ...Object.values(materials).filter((m) => m.exportedName === material.name),
    ]),
  ];
  if (!candidates.length) return undefined;
  const matches = candidates.filter(
    (m) =>
      !m.exportedVariants || m.exportedVariants.some((v) => matchesLegacyVariant(material, m, v)),
  );
  if (matches.length !== 1) throw new Error(`Ambiguous native legacy instance: ${material.name}`);
  return matches[0];
}
const literal = (value: number) => {
  if (!Number.isFinite(value)) throw new Error("Nonfinite native legacy value");
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
};
function resolved(source: NativeLegacyMaterial, name: string) {
  const input = source.resolvedMaterialInputs[name],
    value = Array.isArray(input) ? input[0] : input;
  if (!Number.isFinite(value)) throw new Error(`Native legacy resolved input missing: ${name}`);
  return value;
}
function vertexlit(source: NativeLegacyMaterial) {
  return source.shader === "csgo_vertexlitgeneric.vfx";
}
export function validateNativeLegacy(source: NativeLegacyMaterial) {
  if (!vertexlit(source) && source.shader !== "csgo_simple.vfx")
    throw new Error(`Unsupported native legacy shader: ${source.shader}`);
  const supported = vertexlit(source)
    ? new Set([
        "F_SPECULAR_DIRECT",
        "F_SPECULAR_INDIRECT",
        "F_SCALE_NORMAL_MAP",
        "F_DETAIL_TEXTURE",
      ])
    : new Set(["F_AMBIENT_OCCLUSION_TEXTURE", "F_METALNESS_TEXTURE"]);
  for (const [flag, value] of Object.entries(source.IntParams))
    if (flag.startsWith("F_") && value && (!supported.has(flag) || value !== 1))
      throw new Error(
        `Unsupported native legacy feature: ${flag}=${value} (${source.nativeResource})`,
      );
  // These bounded opaque branches need no reconstruction of unavailable control
  // colors, depth coverage, model-coordinate animation, tint/decal/detail masks.
  for (const [key, expected] of [
    ["g_vTexCoordScale", [1, 1]],
    ["g_vTexCoordOffset", [0, 0]],
    ["g_vNormalTexCoordScale", [1, 1]],
    ["g_vNormalTexCoordOffset", [0, 0]],
    ["g_vTexCoordScrollSpeed", [0, 0]],
  ] as const) {
    const value = source.VectorParams[key];
    if (value && expected.some((component, index) => value[index] !== component))
      throw new Error(`Native legacy ${key} requires its selected source vertex/tint contract`);
  }
  for (const key of ["g_flTexCoordRotation", "g_flNormalTexCoordRotation"])
    if (source.FloatParams[key]) throw new Error(`Native legacy rotation unsupported: ${key}`);
  for (const [name, constant] of Object.entries(source.constants ?? {}))
    if (constant.length !== 4 || constant.some((value) => !Number.isFinite(value)))
      throw new Error(`Invalid proved native legacy constant: ${name}`);
  resolved(source, "g_flReflectance");
  if (vertexlit(source)) {
    resolved(source, "g_flAmbientOcclusionScale");
    resolved(source, "g_flInverseBlendTint");
    if (source.IntParams.F_SCALE_NORMAL_MAP) resolved(source, "g_flNormalMapScaleFactor");
    if (source.IntParams.F_DETAIL_TEXTURE) {
      resolved(source, "g_flDetailBlendFactor");
      resolved(source, "g_flDetailBlendToFull");
      for (const name of ["g_vDetailTexCoordXform", "g_vDetailTexCoordOffset"]) {
        const value = source.resolvedMaterialInputs[name];
        if (!Array.isArray(value) || value.length !== 4 || value.some((n) => !Number.isFinite(n)))
          throw new Error(`Native legacy detail transform missing: ${name}`);
      }
    }
  } else if (!source.IntParams.F_METALNESS_TEXTURE) resolved(source, "g_flMetalness");
}
function requiredSamplers(source: NativeLegacyMaterial) {
  return [
    "g_tColor",
    "g_tNormal",
    "g_tAmbientOcclusion",
    ...(vertexlit(source) ? ["g_tMetalness"] : []),
    ...(source.IntParams.F_DETAIL_TEXTURE ? ["g_tDetail", "g_tDetailMask"] : []),
  ];
}
/** Conservative common-world reserve: atlas3 + LPV2 + cube1 + shadow2 + fog1
 * + optional Three environment1 . Atlas/LPV are normally mutually exclusive; native SourceSurface omits stock DFG. */
export function nativeLegacySamplerBudget(source: NativeLegacyMaterial) {
  validateNativeLegacy(source);
  const indirect = !vertexlit(source) || source.IntParams.F_SPECULAR_INDIRECT === 1;
  return (
    10 +
    requiredSamplers(source).filter((name) => !source.constants?.[name]).length +
    Number(indirect)
  );
}
export async function loadNativeMapLegacy(renderer: T.WebGLRenderer, path: string) {
  const directory = path.endsWith("source.json") ? path.slice(0, -"source.json".length) : path;
  const bundle = await loadSourceMaterialBundle<NativeLegacyMaterial>(
    renderer,
    directory,
    (materials) => {
      const ids = new Set<string>();
      for (const source of Object.values(materials)) {
        validateNativeLegacy(source);
        const budget = nativeLegacySamplerBudget(source);
        if (budget > renderer.capabilities.maxTextures)
          throw new Error(
            `Native legacy requires ${budget} samplers including fog/shadows; device has ${renderer.capabilities.maxTextures}`,
          );
        for (const sampler of requiredSamplers(source)) {
          if (source.constants?.[sampler]) continue;
          if (!source.textures[sampler])
            throw new Error(`Native legacy sampler missing: ${sampler}`);
          ids.add(source.textures[sampler]);
        }
      }
      return ids;
    },
  );
  try {
    return { ...bundle, lookup: await loadSourceSurfaceLookup() };
  } catch (error) {
    for (const texture of new Set(bundle.textures.values())) texture.dispose();
    throw error;
  }
}

/** Bounded legacy response from pinned VRF5564866 primary shaders. Native API
 * sampling transfer and per-family selected CS2 combinations must remain in
 * bundle provenance; sharing this quality1 BRDF alone does not prove parity. */
export function applyNativeMapLegacy(
  root: T.Object3D,
  bundle: Awaited<ReturnType<typeof loadNativeMapLegacy>>,
) {
  const patched = new Set<T.Material>(),
    selected = new Map<T.Material, NativeLegacyMaterial>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const source =
        selected.get(material) ??
        (material instanceof T.MeshStandardMaterial
          ? selectNativeLegacyMaterial(material, bundle.materials)
          : bundle.materials[material.name]);
      if (!source) continue;
      validateNativeLegacy(source);
      if (!(material instanceof T.MeshStandardMaterial) || !object.geometry.hasAttribute("tangent"))
        throw new Error(`Native legacy tangent/material unavailable: ${material.name}`);
      // Native VS starts vec4(rawUv0.xyxy), then transforms only XY.
      // AO reads ZW, which is raw base UV0—not another exported UV stream.
      const aoChannel = 0;
      object.geometry.setAttribute("nativeLegacyAoUv", object.geometry.getAttribute("uv"));
      if (patched.has(material)) {
        if (material.userData.nativeLegacyAoChannel !== aoChannel)
          throw new Error("Mixed native legacy alternate AO UV batch");
        continue;
      }
      selected.set(material, source);
      const corrections =
        source.exportedVariants
          ?.filter((v) => v.nativeCombinedVSFactor && matchesLegacyVariant(material, source, v))
          .map((v) => v.nativeCombinedVSFactor!) ?? [];
      if (source.exportedVariants?.some((v) => v.nativeCombinedVSFactor) && !corrections.length)
        throw new Error(`Native legacy tint identity missing: ${material.name}`);
      if (corrections.length) {
        const factor = corrections[0];
        if (
          factor.length !== 4 ||
          factor.some((v) => !Number.isFinite(v)) ||
          corrections.some((other) => other.some((v, i) => Math.abs(v - factor[i]) > 1e-6))
        )
          throw new Error(`Conflicting native legacy tint: ${material.name}`);
        material.color.setRGB(factor[0], factor[1], factor[2]);
        material.opacity = factor[3];
      }
      patched.add(material);
      const textures = new Map<string, T.Texture>();
      for (const name of requiredSamplers(source)) {
        const constant = source.constants?.[name];
        if (constant) {
          if (constant.length !== 4 || constant.some((value) => !Number.isFinite(value)))
            throw new Error(`Invalid proved native legacy constant: ${name}`);
          continue;
        }
        const texture = bundle.textures.get(source.textures[name]);
        if (!texture) throw new Error(`Native legacy texture unavailable: ${name}`);
        textures.set(name, texture);
      }
      material.map =
        material.normalMap =
        material.aoMap =
        material.roughnessMap =
        material.metalnessMap =
          null;
      material.vertexColors = false;
      material.defines = { ...material.defines, USE_TANGENT: "", USE_NORMALMAP_TANGENTSPACE: "" };
      material.userData.nativeSourceFamily = "legacy";
      material.userData.nativeLegacyAoChannel = aoChannel;
      const isVertexlit = vertexlit(source);
      const direct = !isVertexlit || source.IntParams.F_SPECULAR_DIRECT === 1;
      material.userData.nativeLocalDirectSpecular = direct;
      const indirect = !isVertexlit || source.IntParams.F_SPECULAR_INDIRECT === 1;
      const key = material.customProgramCacheKey(),
        before = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        before(shader, renderer);
        const uniforms: Record<string, string> = {
          g_tColor: "nativeLegacyColorMap",
          g_tNormal: "nativeLegacyNormalMap",
          g_tAmbientOcclusion: "nativeLegacyAOMap",
          g_tMetalness: "nativeLegacyMetalnessMap",
          g_tDetail: "nativeLegacyDetailMap",
          g_tDetailMask: "nativeLegacyDetailMaskMap",
        };
        for (const [name, texture] of textures) {
          const uniform = uniforms[name];
          shader.uniforms[uniform] = { value: texture };
          shader.fragmentShader = `uniform sampler2D ${uniform};\n${shader.fragmentShader}`;
        }
        const sample = (name: string, uv = "vNativeLegacyUv") => {
          const constant = source.constants?.[name];
          return constant
            ? `vec4(${constant.map(literal).join(",")})`
            : `texture2D(${uniforms[name]},${uv})`;
        };
        shader.vertexShader = `attribute vec2 nativeLegacyAoUv;varying vec2 vNativeLegacyUv;varying vec2 vNativeLegacyAoUv;\n${shader.vertexShader}`;
        shader.fragmentShader = `varying vec2 vNativeLegacyUv;varying vec2 vNativeLegacyAoUv;\n${shader.fragmentShader}`;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <uv_vertex>",
          "#include <uv_vertex>\nvNativeLegacyUv=uv;vNativeLegacyAoUv=nativeLegacyAoUv;",
        );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <map_fragment>",
            `
            vec4 nativeLegacyColor=${sample("g_tColor")};
            ${isVertexlit ? `diffuseColor.rgb=nativeLegacyColor.rgb*mix(vec3(1.0),diffuseColor.rgb,clamp(nativeLegacyColor.a+${literal(resolved(source, "g_flInverseBlendTint"))},0.0,1.0));` : "diffuseColor.rgb*=nativeLegacyColor.rgb;"}
            ${
              source.IntParams.F_DETAIL_TEXTURE
                ? (() => {
                    const m = source.resolvedMaterialInputs.g_vDetailTexCoordXform as number[];
                    const o = source.resolvedMaterialInputs.g_vDetailTexCoordOffset as number[];
                    return `vec2 nativeLegacyDetailUv=vec2(dot(vNativeLegacyUv,vec2(${literal(m[0])},${literal(m[1])})),dot(vNativeLegacyUv,vec2(${literal(m[2])},${literal(m[3])})))+vec2(${literal(o[0])},${literal(o[1])});diffuseColor.rgb*=mix(vec3(1.0),(${sample("g_tDetail", "nativeLegacyDetailUv")}).rgb*(508.0/255.0),max((${sample("g_tDetailMask")}).r,${literal(resolved(source, "g_flDetailBlendToFull"))})*${literal(resolved(source, "g_flDetailBlendFactor"))});`;
                  })()
                : ""
            }
            vec4 nativeLegacyPackedNormal=${sample("g_tNormal")};`,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "float roughnessFactor=nativeLegacyPackedNormal.b;",
          )
          .replace(
            "#include <metalnessmap_fragment>",
            `float metalnessFactor=${isVertexlit ? `(${sample("g_tMetalness")}).g` : source.IntParams.F_METALNESS_TEXTURE ? "nativeLegacyColor.a" : literal(resolved(source, "g_flMetalness"))};`,
          )
          .replace(
            "#include <normal_fragment_maps>",
            `
            vec2 nativeLegacyHemi=vec2(nativeLegacyPackedNormal.r+nativeLegacyPackedNormal.g-1.003921627998352,nativeLegacyPackedNormal.r-nativeLegacyPackedNormal.g);
            vec3 mapN=normalize(vec3(nativeLegacyHemi.x,-nativeLegacyHemi.y,1.0-abs(nativeLegacyHemi.x)-abs(nativeLegacyHemi.y)));
            ${isVertexlit && source.IntParams.F_SCALE_NORMAL_MAP ? `mapN=normalize(mix(vec3(0.,0.,1.),mapN,${literal(resolved(source, "g_flNormalMapScaleFactor"))}));` : ""}
            normal=normalize(tbn*mapN);`,
          );
        applySourceSurface(
          shader,
          { directSpecular: direct, indirectSpecular: indirect, nativeAO: false },
          bundle.lookup,
        );
        const scale = isVertexlit ? resolved(source, "g_flAmbientOcclusionScale") : 0;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <aomap_fragment>",
          `float ambientOcclusion=(${sample("g_tAmbientOcclusion", "vNativeLegacyAoUv")}).r;
          ${scale > 0 ? `ambientOcclusion=min(mix(1.0,2.0*ambientOcclusion,${literal(scale)}),1.0);` : ""}
          reflectedLight.indirectDiffuse*=ambientOcclusion;reflectedLight.directSpecular*=ambientOcclusion;reflectedLight.indirectSpecular*=ambientOcclusion;`,
        );
        const reflectance = literal(resolved(source, "g_flReflectance"));
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_physical_fragment>",
          `#include <lights_physical_fragment>\nmaterial.specularColor=mix(vec3(${reflectance}),diffuseColor.rgb,metalnessFactor);material.specularColorBlended=material.specularColor;`,
        );
      };
      material.customProgramCacheKey = () =>
        `${key}:native-legacy-qualified:${JSON.stringify({
          shader: source.shader,
          direct,
          indirect,
          metalTexture: source.IntParams.F_METALNESS_TEXTURE ?? 0,
          normalScale: source.IntParams.F_SCALE_NORMAL_MAP
            ? resolved(source, "g_flNormalMapScaleFactor")
            : null,
          reflectance: resolved(source, "g_flReflectance"),
          metalness:
            !isVertexlit && !source.IntParams.F_METALNESS_TEXTURE
              ? resolved(source, "g_flMetalness")
              : null,
          aoScale: isVertexlit ? resolved(source, "g_flAmbientOcclusionScale") : 0,
          inverseTint: isVertexlit ? resolved(source, "g_flInverseBlendTint") : null,
          detail: source.IntParams.F_DETAIL_TEXTURE
            ? [
                source.resolvedMaterialInputs.g_vDetailTexCoordXform,
                source.resolvedMaterialInputs.g_vDetailTexCoordOffset,
                resolved(source, "g_flDetailBlendFactor"),
                resolved(source, "g_flDetailBlendToFull"),
              ]
            : null,
          constants: source.constants ?? {},
        })}`;
      material.needsUpdate = true;
      registerSurfaceTextures(material, [...textures.values()]);
    }
  });
}
