import { copySourceDepth } from "./source-depth";
import * as T from "three";
import { assetFetch } from "./asset-url";
import { sourceProbeUniformVectors } from "./source-probe-frames";
import {
  createSourceGpuProbes,
  applySourceGpuProbes,
  type SourceGpuProbes,
} from "./source-gpu-probes";

/** Map-owned LPVs; never replace Dust II's active probe cache during preload. */
export async function loadNativeMapProbes(renderer: T.WebGLRenderer, directory: string) {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const read = async (file: string) => {
    const response = await assetFetch(directory + file);
    if (!response.ok) throw new Error("Native map lighting probes unavailable");
    return response.json();
  };
  const [source, metadata] = await Promise.all([read("source.json"), read("probes.json")]);
  const arrays = renderer.extensions.has("EXT_texture_compression_bptc")
    ? source.arrays
    : source.fallbacks;
  if (
    renderer.capabilities.maxTextures < 16 ||
    renderer.capabilities.maxFragmentUniforms < sourceProbeUniformVectors(metadata.volumes) ||
    gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) <
      Math.max(...arrays.map((a: { layers: number }) => a.layers))
  )
    return undefined;
  return createSourceGpuProbes(directory, arrays, metadata);
}

/** Apply the native six-direction irradiance and sunlight visibility to props. */
export function applyNativeMapProbes(root: T.Object3D, probes: SourceGpuProbes) {
  const materials = new Map<T.MeshStandardMaterial, T.MeshStandardMaterial>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) || object.geometry.hasAttribute("nativeMapLightUv")) return;
    const patch = (source: T.Material) => {
      if (!(source instanceof T.MeshStandardMaterial)) return source;
      let material = materials.get(source);
      if (material) return material;
      material = source.clone();
      copySourceDepth(source, material);
      materials.set(source, material);
      const prior = source.onBeforeCompile.bind(source);
      const key = source.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        prior(shader, renderer);
        applySourceGpuProbes(shader, probes);
        shader.fragmentShader = shader.fragmentShader.replace(
          "void main() {",
          "SourceGpuProbe nativePropProbe;\nvoid main() {",
        );
        // Previous sun-shadow hooks may already have expanded this chunk.
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_begin>",
          T.ShaderChunk.lights_fragment_begin,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "vec3 geometryPosition = - vViewPosition;",
          `nativePropProbe = sourceGpuSample(cameraPosition + transpose(mat3(viewMatrix)) * (-vViewPosition), inverseTransformDirection(normal, viewMatrix));\nvec3 geometryPosition = - vViewPosition;`,
        );
        shader.fragmentShader = shader.fragmentShader.replaceAll(
          "getDirectionalLightInfo( directionalLight, directLight );",
          "getDirectionalLightInfo( directionalLight, directLight );\nif (UNROLLED_LOOP_INDEX == 0) directLight.color *= 1.0 - nativePropProbe.occlusion.r;",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_maps>",
          "#include <lights_fragment_maps>\nirradiance = nativePropProbe.irradiance * PI;",
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_end>",
          T.ShaderChunk.lights_fragment_end.replace(
            "RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",
            "vec3 nativePropDiffuse = reflectedLight.indirectDiffuse;\nRE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\nreflectedLight.indirectDiffuse = nativePropDiffuse;",
          ),
        );
      };
      material.customProgramCacheKey = () =>
        `${key}:native-map-probes:${probes.count}:${!!probes.packedFrames}:${probes.packedFrames?.rotations.length ?? 0}`;
      material.needsUpdate = true;
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(patch)
      : patch(object.material);
  });
}
