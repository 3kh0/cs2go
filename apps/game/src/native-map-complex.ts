import * as T from "three";
import { loadSourceMaterialBundle } from "./source-layers";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";
import { registerSurfaceTextures } from "./presentation-settings";
export interface NativeComplexMaterial {
  shader: string;
  nativeResource: string;
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
  textures: Record<string, string>;
  resolvedMaterialInputs: Record<string, number | number[]>;
  nativeDetailMaskValue?: number;
}
const literal = (value: number) => {
  if (!Number.isFinite(value)) throw new Error("Nonfinite native complex material input");
  const text = Number.isInteger(value) ? `${value}.0` : `${value}`;
  return value < 0 ? `(${text})` : text;
};
function validate(source: NativeComplexMaterial) {
  if (
    source.shader !== "csgo_complex.vfx" ||
    !source.nativeResource.replace(/_c$/, "").endsWith("/hr_concrete_floor_001.vmat") ||
    source.IntParams.F_DETAIL_TEXTURE !== 2 ||
    source.nativeDetailMaskValue !== 1
  )
    throw new Error(
      "Unsupported native complex material; only proved concrete133 detail2 is implemented",
    );
  for (const [name, value] of Object.entries(source.IntParams))
    if (name.startsWith("F_") && value && name !== "F_DETAIL_TEXTURE")
      throw new Error(`Unsupported native concrete feature: ${name}`);
  const baseScale = source.VectorParams.g_vTexCoordScale,
    baseOffset = source.VectorParams.g_vTexCoordOffset;
  if (
    baseScale?.[0] !== 1 ||
    baseScale[1] !== 1 ||
    baseOffset?.[0] !== 0 ||
    baseOffset[1] !== 0 ||
    source.FloatParams.g_flTexCoordRotation !== 0
  )
    throw new Error(
      "Native concrete base transform requires an additional source vertex selection",
    );
}
export async function loadNativeMapComplex(renderer: T.WebGLRenderer, path: string) {
  const directory = path.endsWith("source.json") ? path.slice(0, -"source.json".length) : path;
  const bundle = await loadSourceMaterialBundle<NativeComplexMaterial>(
    renderer,
    directory,
    (materials) => {
      const ids = new Set<string>();
      for (const material of Object.values(materials)) {
        validate(material);
        for (const sampler of ["g_tColor", "g_tNormal", "g_tAmbientOcclusion", "g_tDetail"]) {
          const id = material.textures[sampler];
          if (!id) throw new Error(`Native complex sampler missing: ${sampler}`);
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
/** Native build26445667 csgo_complex PS5124/d4 + VS4/d9, bounded to the
 * actual Nuke concrete133 VMAT. The shared quality1 BRDF/lighting transport is
 * qualified: engine live LUT/probe/light uploads were not recovered. */
export function applyNativeMapComplex(
  root: T.Object3D,
  bundle: Awaited<ReturnType<typeof loadNativeMapComplex>>,
) {
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const native = bundle.materials[material.name];
      if (!native) continue;
      if (!(material instanceof T.MeshStandardMaterial) || !object.geometry.hasAttribute("tangent"))
        throw new Error(`Native concrete tangent/material missing: ${material.name}`);
      if (patched.has(material)) continue;
      patched.add(material);
      validate(native);
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
      const detail = required("g_tDetail"),
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
      const vector = (values: number[]) => `vec2(${values.map(literal).join(",")})`;
      material.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer);
        shader.uniforms.nativeComplexDetail = { value: detail };
        shader.vertexShader =
          `varying vec2 vNativeComplexDetailUv;\n${shader.vertexShader}`.replace(
            "#include <uv_vertex>",
            `#include <uv_vertex>\nvNativeComplexDetailUv=vec2(dot(uv,${vector(detailX)}),dot(uv,${vector(detailY)}))+${vector(shift)};`,
          );
        shader.fragmentShader = `varying vec2 vNativeComplexDetailUv;uniform sampler2D nativeComplexDetail;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <map_fragment>",
            `
     vec3 nativeComplexColor=texture2D(map,vMapUv).rgb*diffuseColor.rgb;
     vec3 nativeComplexGamma=pow(nativeComplexColor,vec3(1.0/2.2));
     vec3 nativeComplexD=texture2D(nativeComplexDetail,vNativeComplexDetailUv).rgb*(254.0/255.0);
     vec3 nativeComplexOverlay=mix(2.0*nativeComplexGamma*nativeComplexD,1.0-2.0*(1.0-nativeComplexGamma)*(1.0-nativeComplexD),step(vec3(.5),nativeComplexGamma));
     diffuseColor.rgb=mix(nativeComplexColor,pow(nativeComplexOverlay,vec3(2.2)),max(1.0,${literal(native.FloatParams.g_flDetailBlendToFull ?? 0)})*${literal(native.FloatParams.g_flDetailBlendFactor)});
     vec4 nativeComplexPackedNormal=texture2D(normalMap,vNormalMapUv);
    `,
          )
          .replace(
            "#include <roughnessmap_fragment>",
            "float roughnessFactor=nativeComplexPackedNormal.b;",
          )
          .replace(
            "#include <normal_fragment_maps>",
            `vec2 nativeComplexHemi=vec2(nativeComplexPackedNormal.r+nativeComplexPackedNormal.g-1.003921627998352,nativeComplexPackedNormal.r-nativeComplexPackedNormal.g);vec3 mapN=normalize(vec3(nativeComplexHemi.x,-nativeComplexHemi.y,1.0-abs(nativeComplexHemi.x)-abs(nativeComplexHemi.y)));normal=normalize(tbn*mapN);`,
          );
        applySourceSurface(
          shader,
          { directSpecular: true, indirectSpecular: true, nativeAO: true },
          bundle.lookup,
        );
        const resolvedReflectance = native.resolvedMaterialInputs.g_flReflectance;
        const reflectance = Array.isArray(resolvedReflectance)
          ? resolvedReflectance[0]
          : resolvedReflectance;
        if (!Number.isFinite(reflectance))
          throw new Error("Native concrete compiled reflectance missing");
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_physical_fragment>",
          `#include <lights_physical_fragment>\nmaterial.specularColor=vec3(${literal(reflectance)});material.specularColorBlended=material.specularColor;`,
        );
      };
      material.customProgramCacheKey = () =>
        `${key}:native-complex-quality1:${JSON.stringify(native)}`;
      material.needsUpdate = true;
      registerSurfaceTextures(material, [material.map, material.normalMap, material.aoMap, detail]);
    }
  });
}
