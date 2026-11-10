import * as T from "three";
import {
  nativeLightmappedProgram,
  type NativeLightmappedProgramKind,
} from "./native-lightmapped-program";
import { loadSourceMaterialBundle } from "./source-layers";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";
import { registerSurfaceTextures } from "./presentation-settings";
import { nativeLightmappedResponseGLSL } from "./native-lightmapped-response";

/** PS8070/d0+d4 VS6/d1+d9. FLOAT draw→packed tint upload remains unobserved;
 * combinedVSFactor is an explicitly qualified source-domain host bridge. */
export interface NativeLightmappedMaterial {
  shader: "csgo_lightmappedgeneric.vfx";
  nativeResource: string;
  selectedContract: "parking-8070-1158" | "lmg-four-build26445667";
  nativeSourceSha256?: string;
  programKind?: NativeLightmappedProgramKind;
  exportedName: string;
  exportedVariants: {
    packedMaterialIndex: number;
    baseColorFactor: number[];
    nativeCombinedVSFactor: number[];
  }[];
  tintTransportQualification: string;
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
  textures: Record<string, string>;
  resolvedMaterialInputs: Record<string, number | number[]>;
}
const samplers = ["g_tColor", "g_tLayer1NormalRoughness", "g_tLayer1AmbientOcclusion"];
function nativeSamplers(s: NativeLightmappedMaterial) {
  return [...samplers, ...(nativeLightmappedProgram(s)?.detail ? ["g_tLayer1Detail"] : [])];
}
function scalar(s: NativeLightmappedMaterial, key: string) {
  const raw = s.resolvedMaterialInputs[key],
    n = Array.isArray(raw) ? raw[0] : raw;
  if (!Number.isFinite(n)) throw new Error(`Native lightmapped input missing: ${key}`);
  return n as number;
}
function wrap(n = 0): T.Wrapping {
  if (n === 0) return T.RepeatWrapping;
  if (n === 1) return T.MirroredRepeatWrapping;
  if (n === 2) return T.ClampToEdgeWrapping;
  throw new Error(`Unsupported native lightmapped wrap: ${n}`);
}
export function validateNativeLightmapped(s: NativeLightmappedMaterial) {
  if (
    s.shader !== "csgo_lightmappedgeneric.vfx" ||
    !["parking-8070-1158", "lmg-four-build26445667"].includes(s.selectedContract)
  )
    throw new Error("Native lightmapped selected contract missing");
  const program = nativeLightmappedProgram(s);
  if (!program) {
    const flags = new Set([
      "F_OVERLAY",
      "F_TRANSLUCENT",
      "F_SPECULAR_DIRECT",
      "F_SPECULAR_INDIRECT",
    ]);
    for (const [k, v] of Object.entries(s.IntParams))
      if (k.startsWith("F_") && v && (!flags.has(k) || v !== 1))
        throw new Error(`Unsupported native lightmapped feature: ${k}`);
    for (const k of flags)
      if (s.IntParams[k] !== 1) throw new Error(`Native lightmapped baseline requires ${k}`);
    for (const [k, v] of [
      ["g_flReflectance", 0.04],
      ["g_flMetalness", 0],
      ["g_flModelTintAmount", 1],
      ["g_flOpacityScale", 1],
      ["g_flVertexColorOpacityScale", 1],
      ["g_flAlphaTestReference", 0.01],
      ["g_bNoSpecularAtFullRoughness", 0],
      ["g_bRenderBackfaceNormals", 0],
    ] as const)
      if (Math.abs(scalar(s, k) - v) > 1e-6)
        throw new Error(`Native lightmapped baseline differs: ${k}`);
    for (const k of ["g_vColorTint", "g_vLayer1Tint"]) {
      const v = s.VectorParams[k];
      if (!v || v.length < 3 || v.slice(0, 3).some((n) => n !== 1))
        throw new Error(`Native lightmapped unsupported tint: ${k}`);
    }
  }
  if (!s.tintTransportQualification || !s.exportedVariants.length)
    throw new Error("Native lightmapped instance transport missing");
  for (const v of s.exportedVariants)
    if (
      !Number.isInteger(v.packedMaterialIndex) ||
      [v.baseColorFactor, v.nativeCombinedVSFactor].some(
        (a) => a.length !== 4 || a.some((n) => !Number.isFinite(n)),
      )
    )
      throw new Error("Invalid native lightmapped instance");
  wrap(s.IntParams.g_nTextureAddressModeU);
  wrap(s.IntParams.g_nTextureAddressModeV);
  for (const name of nativeSamplers(s))
    if (!s.textures[name]) throw new Error(`Native lightmapped sampler missing: ${name}`);
}
export function selectNativeLightmappedMaterial(
  m: T.MeshStandardMaterial,
  materials: Record<string, NativeLightmappedMaterial>,
) {
  const f = [m.color.r, m.color.g, m.color.b, m.opacity];
  const candidates = Object.values(materials).filter((s) => s.exportedName === m.name);
  const matches = candidates.flatMap((source) =>
    source.exportedVariants
      .filter(
        (v) =>
          v.packedMaterialIndex === m.userData.nativeGltfMaterialIndex &&
          v.baseColorFactor.every((n, i) => Math.abs(n - f[i]) <= 1e-6),
      )
      .map((variant) => ({ source, variant })),
  );
  if (!candidates.length) return undefined;
  if (matches.length !== 1)
    throw new Error(`Native lightmapped instance identity mismatch: ${m.name}`);
  return matches[0];
}
export async function loadNativeMapLightmapped(renderer: T.WebGLRenderer, path: string) {
  const dir = path.endsWith("source.json") ? path.slice(0, -11) : path;
  const bundle = await loadSourceMaterialBundle<NativeLightmappedMaterial>(
    renderer,
    dir,
    (materials) => {
      const ids = new Set<string>();
      for (const s of Object.values(materials)) {
        validateNativeLightmapped(s);
        if (renderer.capabilities.maxTextures < 13)
          throw new Error("Native lightmapped combined stack needs 13 samplers");
        for (const name of nativeSamplers(s)) ids.add(s.textures[name]);
      }
      return ids;
    },
  );
  try {
    return { ...bundle, lookup: await loadSourceSurfaceLookup() };
  } catch (error) {
    for (const t of new Set(bundle.textures.values())) t.dispose();
    throw error;
  }
}
export function bindNativeLightmappedTextures(
  s: NativeLightmappedMaterial,
  owned: Map<string, T.Texture>,
) {
  const bindings = new Map<string, T.Texture>();
  for (const name of nativeSamplers(s)) {
    const id = s.textures[name],
      original = owned.get(id);
    if (!original) throw new Error(`Native lightmapped texture missing: ${id}`);
    const ao = name === "g_tLayer1AmbientOcclusion",
      u = wrap(ao ? 0 : s.IntParams.g_nTextureAddressModeU),
      v = wrap(ao ? 0 : s.IntParams.g_nTextureAddressModeV),
      key = `lightmapped:${id}:${u}:${v}`;
    let texture = original;
    if (original.wrapS !== u || original.wrapT !== v) {
      texture = owned.get(key)!;
      if (!texture) {
        texture = original.clone();
        texture.source = new T.Source(original.source.data);
        texture.wrapS = u;
        texture.wrapT = v;
        texture.needsUpdate = true;
        owned.set(key, texture);
      }
    }
    bindings.set(name, texture);
  }
  return bindings;
}
export function applyNativeMapLightmapped(
  root: T.Object3D,
  bundle: Awaited<ReturnType<typeof loadNativeMapLightmapped>>,
) {
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(m instanceof T.MeshStandardMaterial)) continue;
      if (patched.has(m)) {
        if (!object.geometry.hasAttribute("uv") || !object.geometry.hasAttribute("tangent"))
          throw new Error(`Native lightmapped original UV/tangent missing: ${m.name}`);
        continue;
      }
      const selected = selectNativeLightmappedMaterial(m, bundle.materials);
      if (!selected) continue;
      const { source: s, variant: v } = selected;
      const program = nativeLightmappedProgram(s);
      validateNativeLightmapped(s);
      if (!object.geometry.hasAttribute("uv") || !object.geometry.hasAttribute("tangent"))
        throw new Error(`Native lightmapped original UV/tangent missing: ${m.name}`);
      const textures = bindNativeLightmappedTextures(s, bundle.textures);
      patched.add(m);
      m.color.setRGB(
        v.nativeCombinedVSFactor[0],
        v.nativeCombinedVSFactor[1],
        v.nativeCombinedVSFactor[2],
      );
      m.opacity = v.nativeCombinedVSFactor[3];
      m.map = m.normalMap = m.aoMap = m.roughnessMap = m.metalnessMap = null;
      m.vertexColors = false;
      m.alphaTest = 0;
      m.alphaHash = false;
      m.alphaToCoverage = false;
      m.transparent = true;
      m.depthTest = true;
      m.depthWrite = false;
      m.depthFunc = T.LessEqualDepth;
      m.side = T.FrontSide;
      m.premultipliedAlpha = false;
      m.blending = T.CustomBlending;
      m.blendEquation = T.AddEquation;
      m.blendSrc = T.SrcAlphaFactor;
      m.blendDst = T.OneMinusSrcAlphaFactor;
      // Native RGB write-mask: separate alpha factors preserve destination alpha.
      m.blendEquationAlpha = T.AddEquation;
      m.blendSrcAlpha = T.ZeroFactor;
      m.blendDstAlpha = T.OneFactor;
      m.polygonOffset = true;
      m.polygonOffsetFactor = -2;
      m.polygonOffsetUnits = -64;
      m.userData.nativeLightmappedStateQualification =
        "WebGL slope/units bias; native clamp and receiver stencil producer unported";
      m.userData.nativeSourceFamily = "lightmapped";
      if (program && !program.overlay) {
        m.transparent = false;
        m.blending = T.NoBlending;
        m.depthWrite = true;
        m.polygonOffset = false;
        m.polygonOffsetFactor = 0;
        m.polygonOffsetUnits = 0;
        m.userData.nativeLightmappedStateQualification =
          "Native opaque state; receiver stencil producer/private screen AO remain unported";
      }
      m.userData.nativeLocalDirectSpecular = program?.direct ?? true;
      m.defines = { ...m.defines, USE_TANGENT: "", USE_NORMALMAP_TANGENTSPACE: "" };
      const before = m.onBeforeCompile.bind(m),
        key = m.customProgramCacheKey();
      m.onBeforeCompile = (shader, renderer) => {
        before(shader, renderer);
        for (const [name, texture] of textures) {
          shader.uniforms[`nativeLM_${name}`] = { value: texture };
          shader.fragmentShader = `uniform sampler2D nativeLM_${name};\n${shader.fragmentShader}`;
        }
        if (program) {
          Object.assign(shader.uniforms, {
            nativeLMLayerTint: { value: new T.Vector3(...program.layerTint) },
            nativeLMStaticMetalness: { value: program.metalness },
            nativeLMReflectance: { value: program.reflectance },
          });
          shader.fragmentShader = `uniform vec3 nativeLMLayerTint;uniform float nativeLMStaticMetalness;uniform float nativeLMReflectance;\n${shader.fragmentShader}`;
          if (program.detail) {
            shader.uniforms.nativeLMDetailScale = { value: new T.Vector2(...program.detailScale) };
            shader.uniforms.nativeLMDetailTint = { value: new T.Vector4(...program.detailTint) };
            shader.vertexShader =
              `uniform vec2 nativeLMDetailScale;varying vec2 vNativeLMDetailUv;\n${shader.vertexShader}`.replace(
                "#include <uv_vertex>",
                "#include <uv_vertex>\nvNativeLMDetailUv=uv*nativeLMDetailScale;",
              );
            shader.fragmentShader = `varying vec2 vNativeLMDetailUv;uniform vec4 nativeLMDetailTint;\n${shader.fragmentShader}`;
          }
        }
        shader.vertexShader = `varying vec2 vNativeLightmappedUv;\n${shader.vertexShader}`.replace(
          "#include <uv_vertex>",
          "#include <uv_vertex>\nvNativeLightmappedUv=uv;",
        );
        shader.fragmentShader = `varying vec2 vNativeLightmappedUv;\n${nativeLightmappedResponseGLSL}\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <map_fragment>",
            program
              ? `vec4 nativeLMColor=texture2D(nativeLM_g_tColor,vNativeLightmappedUv);diffuseColor.rgb=(nativeLMColor.rgb*nativeLMLayerTint)${program.detail ? "*mix(vec3(1.0),2.0*texture2D(nativeLM_g_tLayer1Detail,vNativeLMDetailUv).rgb*nativeLMDetailTint.rgb,nativeLMDetailTint.a)" : ""}*diffuseColor.rgb;diffuseColor.a=${program.overlay ? "nativeLightmappedOpacity(nativeLMColor.a,opacity,1.0,0.01)" : "opacity"};${program.overlay ? "if(diffuseColor.a<0.0010000000474974513)discard;" : ""}vec4 nativeLMPacked=texture2D(nativeLM_g_tLayer1NormalRoughness,vNativeLightmappedUv);`
              : `vec4 nativeLMColor=texture2D(nativeLM_g_tColor,vNativeLightmappedUv);diffuseColor.rgb*=nativeLMColor.rgb;diffuseColor.a=nativeLightmappedOpacity(nativeLMColor.a,opacity,1.0,0.01);if(diffuseColor.a<0.0010000000474974513)discard;vec4 nativeLMPacked=texture2D(nativeLM_g_tLayer1NormalRoughness,vNativeLightmappedUv);`,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            program && !program.direct
              ? "float roughnessFactor=1.0;"
              : "float roughnessFactor=nativeLMPacked.b;",
          )
          .replace(
            "#include <metalnessmap_fragment>",
            program
              ? "float metalnessFactor=nativeLMStaticMetalness;"
              : "float metalnessFactor=0.0;",
          )
          .replace(
            "#include <normal_fragment_maps>",
            "vec3 mapN=nativeLightmappedNormal(nativeLMPacked.rg);mapN.y=-mapN.y;normal=normalize(tbn*mapN);",
          );
        applySourceSurface(
          shader,
          {
            directSpecular: program?.direct ?? true,
            indirectSpecular: program?.indirect ?? true,
            nativeAO: false,
          },
          bundle.lookup,
        );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <aomap_fragment>",
            "float ambientOcclusion=texture2D(nativeLM_g_tLayer1AmbientOcclusion,vNativeLightmappedUv).r;reflectedLight.indirectDiffuse*=ambientOcclusion;reflectedLight.directSpecular*=ambientOcclusion;reflectedLight.indirectSpecular*=ambientOcclusion;",
          )
          .replace(
            "#include <lights_physical_fragment>",
            program
              ? "#include <lights_physical_fragment>\nmaterial.specularColor=mix(vec3(nativeLMReflectance),diffuseColor.rgb,metalnessFactor);material.specularColorBlended=material.specularColor;"
              : "#include <lights_physical_fragment>\nmaterial.specularColor=vec3(0.04);material.specularColorBlended=material.specularColor;",
          );
      };
      m.customProgramCacheKey = () =>
        program
          ? `${key}:native-lightmapped-four:${program.kind}`
          : `${key}:native-lightmapped-8070-1158`;
      registerSurfaceTextures(m, [...textures.values()]);
      m.needsUpdate = true;
    }
  });
}
