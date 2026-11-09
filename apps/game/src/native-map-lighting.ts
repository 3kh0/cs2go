import * as T from "three";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { fetchGzipped } from "./gltf";
import { assetUrl } from "./asset-url";

/** Decoded native atlases; all channels are linear data, including the shadow mask. */
export type NativeMapLightingPaths = {
  /** Native atlas dimensions, independent for each world/3D sky. */
  size?: number;
  irradiance: string;
  nativeIrradiance?: string;
  shadows: string;
  directional?: string;
  nativeDirectional?: string;
};
export type NativeMapLighting = {
  irradiance: T.Texture;
  shadows: T.Texture;
  directional?: T.Texture;
};

export async function loadNativeMapLighting(
  paths: NativeMapLightingPaths,
  renderer?: T.WebGLRenderer,
): Promise<NativeMapLighting> {
  const size = paths.size ?? 4096;
  if (!Number.isInteger(size) || size < 4 || size > 4096 || (size & (size - 1)) !== 0)
    throw new Error("Invalid native map atlas size");
  const blocks = Math.ceil(size / 4) ** 2;
  const native =
    paths.nativeIrradiance &&
    renderer &&
    renderer.capabilities.maxTextureSize >= size &&
    renderer.extensions.has("EXT_texture_compression_bptc");
  const irradianceLoad = native
    ? fetchGzipped(paths.nativeIrradiance!).then((bytes) => {
        if (bytes.byteLength !== blocks * 16)
          throw new Error(`Invalid native ${size} BC6H irradiance atlas`);
        return new T.CompressedTexture(
          [{ data: new Uint8Array(bytes), width: size, height: size }],
          size,
          size,
          T.RGB_BPTC_UNSIGNED_Format,
        );
      })
    : new EXRLoader().setDataType(T.HalfFloatType).loadAsync(assetUrl(paths.irradiance));
  const nativeDirectional =
    paths.nativeDirectional &&
    renderer &&
    renderer.capabilities.maxTextureSize >= size &&
    renderer.extensions.has("WEBGL_compressed_texture_s3tc");
  const directionalLoad = nativeDirectional
    ? fetchGzipped(paths.nativeDirectional!).then((bytes) => {
        if (bytes.byteLength !== blocks * 8)
          throw new Error(`Invalid native ${size} BC1 directional atlas`);
        return new T.CompressedTexture(
          [{ data: new Uint8Array(bytes), width: size, height: size }],
          size,
          size,
          T.RGB_S3TC_DXT1_Format,
        );
      })
    : paths.directional
      ? new T.TextureLoader().loadAsync(assetUrl(paths.directional))
      : undefined;
  const [irradiance, shadows, directional] = await Promise.all([
    irradianceLoad,
    new T.TextureLoader().loadAsync(assetUrl(paths.shadows)),
    directionalLoad,
  ]);
  for (const texture of [irradiance, shadows, directional]) {
    if (!texture) continue;
    const { width, height } = texture.image as { width: number; height: number };
    if (!width || !height || width > 4096 || height > 4096) {
      irradiance.dispose();
      shadows.dispose();
      directional?.dispose();
      throw new Error("Native map atlases must retain their original dimensions up to 4096 pixels");
    }
    texture.colorSpace = T.NoColorSpace;
    texture.flipY = false;
    texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
    // Native chart gutters are baked into the atlas. Do not generate cross-chart mip blends.
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
  }
  return { irradiance, shadows, directional };
}

/** Applies native UV1 irradiance without borrowing another map's palettes, probes or LUT. */
export function applyNativeMapLighting(root: T.Object3D, data: NativeMapLighting) {
  const materials = new Map<T.MeshStandardMaterial, T.MeshStandardMaterial>();
  let lightmappedMeshes = 0;
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const uv = object.geometry.getAttribute("uv1");
    if (!uv || uv.count !== object.geometry.getAttribute("position").count) return;
    // Use a distinct attribute so Three's AO/lightMap channel defines cannot redeclare uv1.
    object.geometry.setAttribute("nativeMapLightUv", uv);
    let applied = false;
    const patch = (source: T.Material) => {
      if (!(source instanceof T.MeshStandardMaterial)) return source;
      let material = materials.get(source);
      if (material) {
        applied = true;
        return material;
      }
      material = source.clone();
      // Cloning only the UV1 branch keeps shared prop materials on their own lighting path.
      materials.set(source, material);
      // oxlint-disable-next-line typescript/unbound-method -- Invoked with the cloned material via .call below.
      const compile = source.onBeforeCompile;
      const key = source.customProgramCacheKey();
      material.onBeforeCompile = function (shader, renderer) {
        compile.call(this, shader, renderer);
        shader.uniforms.nativeMapIrradiance = { value: data.irradiance };
        shader.uniforms.nativeMapShadows = { value: data.shadows };
        if (data.directional) shader.uniforms.nativeMapDirectional = { value: data.directional };
        shader.vertexShader = `attribute vec2 nativeMapLightUv; varying vec2 vNativeMapLightUv;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvNativeMapLightUv = nativeMapLightUv;",
        );
        shader.fragmentShader = `uniform sampler2D nativeMapIrradiance; uniform sampler2D nativeMapShadows; varying vec2 vNativeMapLightUv;\n${data.directional ? "uniform sampler2D nativeMapDirectional;\n" : ""}${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_begin>",
          T.ShaderChunk.lights_fragment_begin,
        );
        shader.fragmentShader = shader.fragmentShader.replaceAll(
          "getDirectionalLightInfo( directionalLight, directLight );",
          "getDirectionalLightInfo( directionalLight, directLight );\nif (UNROLLED_LOOP_INDEX == 0) directLight.color *= 1.0 - texture2D(nativeMapShadows, vNativeMapLightUv).r;",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_maps>",
          `#include <lights_fragment_maps>
          #if defined(RE_IndirectDiffuse)
            vec3 nativeMapDiffuse = texture2D(nativeMapIrradiance, vNativeMapLightUv).rgb;
            ${
              data.directional
                ? `
              vec3 nativeMapDirection = texture2D(nativeMapDirectional, vNativeMapLightUv).rgb;
              vec2 nativeMapDirectionXY = nativeMapDirection.xy * 2.0 - 1.0;
              const float nativeMapMaxXY = 0.996190805;
              nativeMapDirectionXY *= nativeMapMaxXY / max(nativeMapMaxXY, length(nativeMapDirectionXY));
              float nativeMapDirectionZ = sqrt(max(1.0 - dot(nativeMapDirectionXY, nativeMapDirectionXY), 0.0));
              float nativeMapCurvature = length(fwidth(nonPerturbedNormal)) * 0.0254 / max(length(fwidth(vViewPosition)), 1e-6);
              float nativeMapFlatness = (1.0 - smoothstep(0.01, 0.1, nativeMapCurvature)) * 0.8;
              float nativeMapZScale = mix(1.0, mix(0.1, 2.0, clamp((1.0-nativeMapDirectionZ)*1.5, 0.0, 1.0)), nativeMapFlatness);
              vec3 nativeMapLightTs = normalize(vec3(nativeMapDirectionXY, nativeMapDirectionZ * nativeMapZScale));
              vec3 nativeMapNormalTs = vec3(0.0, 0.0, 1.0);
              #ifdef USE_NORMALMAP_TANGENTSPACE
                nativeMapNormalTs = normalize(mapN);
              #endif
              vec3 nativeMapNonDirectional = nativeMapDiffuse * nativeMapDirection.z;
              nativeMapDiffuse = nativeMapNonDirectional + max(dot(nativeMapLightTs, nativeMapNormalTs), 0.0) * (nativeMapDiffuse - nativeMapNonDirectional) / max(nativeMapLightTs.z, 1e-6);
            `
                : ""
            }
            // Source stores diffuse radiance. Three's Lambert term divides by PI once.
            irradiance = nativeMapDiffuse * PI;

          #endif
        `,
        );
        // Three also uses diffuse IBL for GGX multiscattering. Keep that specular
        // compensation, removing only the extra diffuse lobe already supplied by the atlas.
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_end>",
          T.ShaderChunk.lights_fragment_end.replace(
            "RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",
            `vec3 nativeMapDiffuseBeforeIbl = reflectedLight.indirectDiffuse;
          RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          reflectedLight.indirectDiffuse = nativeMapDiffuseBeforeIbl;`,
          ),
        );
        // radiance/clearcoatRadiance remain untouched: the atlas is diffuse only.
      };
      material.customProgramCacheKey = () => `${key}:native-map-atlas-v1:${!!data.directional}`;
      material.needsUpdate = true;
      applied = true;
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(patch)
      : patch(object.material);
    if (applied) {
      object.receiveShadow = true;
      lightmappedMeshes++;
    }
  });
  return { lightmappedMeshes, materials };
}
