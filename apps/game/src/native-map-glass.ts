import * as T from "three";
import { loadSourceMaterialBundle } from "./source-layers";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";
import {
  selectNativeComplexMaterial,
  applyNativeCombinedTint,
  type NativeComplexMaterial,
} from "./native-map-complex";
import { registerSurfaceTextures } from "./presentation-settings";
import { registerSourceDepth, installSourceShadowDepth } from "./source-depth";
import type { NativeMapFog } from "./native-map-fog";
import { applyNativeGlassFog } from "./native-glass-fog";
export type NativeGlassMaterial = NativeComplexMaterial;
export function validateNativeGlassMaterial(source: NativeGlassMaterial) {
  if (source.shader !== "csgo_glass.vfx") throw Error("Unsupported native glass shader");
  for (const [name, value] of Object.entries(source.IntParams))
    if (name.startsWith("F_") && value && name !== "F_DO_NOT_CAST_SHADOWS")
      throw Error(`Unsupported native glass feature:${name}`);
  const remap = source.resolvedMaterialInputs.g_flTranslucencyRemap;
  if (!Array.isArray(remap) || remap.length < 2 || remap.some((v) => !Number.isFinite(v)))
    throw Error("Native glass translucency remap missing");
}
export async function loadNativeMapGlass(renderer: T.WebGLRenderer, path: string) {
  const directory = path.endsWith("source.json") ? path.slice(0, -"source.json".length) : path;
  const bundle = await loadSourceMaterialBundle<NativeGlassMaterial>(
    renderer,
    directory,
    (materials) => {
      const ids = new Set<string>();
      for (const source of Object.values(materials)) {
        validateNativeGlassMaterial(source);
        for (const sampler of ["g_tGlassDust", "g_tGlassTintColor", "g_tNormal"]) {
          const id = source.textures[sampler];
          if (!id) throw Error(`Native glass sampler missing:${sampler}`);
          ids.add(id);
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
const varyings = "varying vec2 vNativeGlassUv;varying vec3 vNativeGlassWorld;\n";
const transmission = `vec3 nativeGlassTransmission(vec3 tint,float dust,float noV,float geometricNoV){float F=.04+.96*pow(1.0-max(0.0,noV),5.0);float path=1.0/max(.01,sqrt(1.0-(4.0/9.0)*(1.0-geometricNoV*geometricNoV)));return (1.0-F)*pow(tint,vec3(path))*(1.0-dust);}\n`;
/** Selected native PS16 COLOR + PS1 DEPTH, ordinary ONE/SRC_ALPHA path.
 * Native MBOIT/framegraph and engine light/shadow uploads remain unobserved. */
export function applyNativeMapGlass(
  root: T.Object3D,
  bundle: Awaited<ReturnType<typeof loadNativeMapGlass>>,
  options: { fog?: NativeMapFog; worldToSource?: T.Matrix4 } = {},
) {
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const original of materials) {
      if (patched.has(original)) continue;
      if (!(original instanceof T.MeshStandardMaterial)) continue;
      const source = selectNativeComplexMaterial(original, bundle.materials);
      if (!source) continue;
      validateNativeGlassMaterial(source);
      if (!object.geometry.hasAttribute("tangent"))
        throw Error(`Native glass tangent missing:${original.name}`);
      patched.add(original);
      applyNativeCombinedTint(original, source);
      const required = (name: string) => {
        const texture = bundle.textures.get(source.textures[name]);
        if (!texture) throw Error(`Native glass texture missing:${name}`);
        return texture;
      };
      const dust = required("g_tGlassDust"),
        tint = required("g_tGlassTintColor"),
        normal = required("g_tNormal"),
        remap = source.resolvedMaterialInputs.g_flTranslucencyRemap as number[],
        material = original;
      const fog = source.IntParams.g_bFogEnabled === 0 ? undefined : options.fog;
      material.map = dust;
      material.normalMap = normal;
      material.aoMap = material.alphaMap = material.metalnessMap = material.roughnessMap = null;
      material.metalness = 0;
      material.vertexColors = false;
      material.alphaTest = 0;
      material.transparent = true;
      material.premultipliedAlpha = false;
      material.blending = T.CustomBlending;
      material.blendEquation = material.blendEquationAlpha = T.AddEquation;
      material.blendSrc = T.OneFactor;
      material.blendDst = T.SrcAlphaFactor;
      material.blendSrcAlpha = T.SrcAlphaFactor;
      material.blendDstAlpha = T.OneMinusSrcAlphaFactor;
      material.depthTest = true;
      material.depthWrite = false;
      material.depthFunc = T.LessDepth;
      material.side = T.FrontSide;
      material.alphaToCoverage = false;
      material.userData.nativeSourceFamily = "glass";
      material.userData.nativeGlassCastsShadow = !source.IntParams.F_DO_NOT_CAST_SHADOWS;
      const key = material.customProgramCacheKey(),
        compile = material.onBeforeCompile.bind(material),
        uniforms = {
          nativeGlassDust: { value: dust },
          nativeGlassTint: { value: tint },
          nativeGlassNormal: { value: normal },
          nativeGlassRemap: { value: new T.Vector2(remap[0], remap[1]) },
        };
      const prefix = `${varyings}uniform sampler2D nativeGlassDust,nativeGlassTint,nativeGlassNormal;uniform vec2 nativeGlassRemap;${transmission}`;
      const vertex = (shader: T.WebGLProgramParametersWithUniforms, depth = false) => {
        shader.vertexShader =
          varyings +
          (depth ? "varying vec3 vNativeGlassGeometricNormal;\n" : "") +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <project_vertex>",
          `#include <project_vertex>\nvNativeGlassUv=uv;vNativeGlassWorld=(modelMatrix*vec4(transformed,1)).xyz;${depth ? "vNativeGlassGeometricNormal=normalize(inverseTransformDirection(normalMatrix*normal,viewMatrix));" : ""}`,
        );
      };
      material.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        vertex(shader);
        shader.fragmentShader =
          prefix +
          "vec3 nativeGlassBackLight=vec3(0),nativeGlassGeometricNormal=vec3(0);\n" +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <map_fragment>",
            `vec4 nativeGlassInstance=diffuseColor;vec4 nativeGlassD=texture2D(nativeGlassDust,vNativeGlassUv),nativeGlassG=texture2D(nativeGlassTint,vNativeGlassUv),nativeGlassN=texture2D(nativeGlassNormal,vNativeGlassUv);float nativeGlassA=nativeGlassRemap.x+clamp(nativeGlassD.a*nativeGlassInstance.a,0.0,1.0)*(nativeGlassRemap.y-nativeGlassRemap.x);vec3 nativeGlassC=nativeGlassG.rgb*nativeGlassInstance.rgb;diffuseColor.rgb=vec3(1.0);`,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "float roughnessFactor=nativeGlassN.b*nativeGlassInstance.a;",
          )
          .replace(
            "#include <normal_fragment_maps>",
            `vec2 h=vec2(nativeGlassN.r+nativeGlassN.g-1.003921627998352,nativeGlassN.r-nativeGlassN.g);vec3 mapN=normalize(vec3(h.x,-h.y,1.0-abs(h.x)-abs(h.y)));normal=normalize(tbn*mapN);nativeGlassGeometricNormal=nonPerturbedNormal;`,
          );
        applySourceSurface(shader, { directSpecular: true, indirectSpecular: true }, bundle.lookup);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_physical_fragment>",
          "#include <lights_physical_fragment>\nmaterial.specularColor=vec3(.04);material.specularColorBlended=vec3(.04);material.specularF90=1.0;",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "float NoL = saturate(dot(geometryNormal, directLight.direction));",
          "nativeGlassBackLight+=max(0.0,-dot(nativeGlassGeometricNormal,directLight.direction))*directLight.color*RECIPROCAL_PI;float NoL = saturate(dot(geometryNormal, directLight.direction));",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `vec3 L=reflectedLight.directDiffuse+reflectedLight.indirectDiffuse+nativeGlassBackLight*(nativeGlassG.a*nativeGlassA);vec3 tau=nativeGlassTransmission(nativeGlassC,nativeGlassA,max(0.0,dot(geometryViewDir,normal)),max(0.0,dot(geometryViewDir,nonPerturbedNormal)));vec3 R=nativeGlassA*nativeGlassD.rgb*L+reflectedLight.directSpecular+reflectedLight.indirectSpecular+tau*nativeGlassA*nativeGlassD.rgb*L*pow(nativeGlassC,vec3(1.600000023841858));nativeGlassFog(R,tau,nativeGlassA);gl_FragColor=vec4(R,dot(tau,vec3(.21250000596,.71539998055,.07209999859)));`,
        );
        applyNativeGlassFog(shader, fog, false, options.worldToSource);
      };
      const shape = `native-glass-q1:${!!fog}:${!!fog?.cube}:${fog?.definition.cube?.texture.mips[0].width ?? 0}`;
      material.customProgramCacheKey = () => `${key}:${shape}`;
      material.needsUpdate = true;
      registerSurfaceTextures(material, [dust, tint, normal]);
      registerSourceDepth(material, {
        cacheKey: shape,
        apply(shader, _renderer, depthSource) {
          const actual = depthSource instanceof T.MeshStandardMaterial ? depthSource : material,
            value = new T.Vector4();
          Object.assign(shader.uniforms, uniforms, {
            nativeGlassInstance: {
              get value() {
                return value.set(actual.color.r, actual.color.g, actual.color.b, actual.opacity);
              },
            },
          });
          vertex(shader, true);
          shader.fragmentShader =
            prefix +
            "uniform vec4 nativeGlassInstance;varying vec3 vNativeGlassGeometricNormal;\n" +
            shader.fragmentShader;
          applyNativeGlassFog(shader, fog, true, options.worldToSource);
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <clipping_planes_fragment>",
            `#include <clipping_planes_fragment>\nvec4 D=texture2D(nativeGlassDust,vNativeGlassUv),G=texture2D(nativeGlassTint,vNativeGlassUv);float a=nativeGlassRemap.x+clamp(D.a*nativeGlassInstance.a,0.0,1.0)*(nativeGlassRemap.y-nativeGlassRemap.x);float nv=max(0.0,dot(normalize(cameraPosition-vNativeGlassWorld),normalize(vNativeGlassGeometricNormal)));vec3 tau=nativeGlassTransmission(G.rgb*nativeGlassInstance.rgb,a,nv,nv),unused=vec3(0);nativeGlassFog(unused,tau,a);if(dot(tau,vec3(.21250000596,.71539998055,.07209999859))>0.699999988079071)discard;`,
          );
        },
      });
    }
    const glass = materials.filter((material) => material.userData.nativeSourceFamily === "glass");
    if (glass.length) {
      if (glass.length !== materials.length) throw Error("Mixed native glass shadow batch");
      object.castShadow &&= glass.some((material) => material.userData.nativeGlassCastsShadow);
      installSourceShadowDepth(object);
    }
  });
}
