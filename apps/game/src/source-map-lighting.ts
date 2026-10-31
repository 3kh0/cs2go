import { assetFetch, assetUrl } from "./asset-url";
import * as T from "three";
import { fetchGzipped } from "./gltf";
import { applyCornerLightmap } from "./lightmap-geometry";
import { loadSourceLighting } from "./source-lighting";

// Native 8.2 lightmaps and volume irradiance. Geometry processing retained
// world positions but dropped native UV1; the offline linker restores atlas
// coordinates where Valve's query mesh covers the surface, and samples native
// spatial probes for the remaining props. No runtime rays or GPU bake passes.
export function loadSourceMapLighting() {
  return Promise.all([
    fetchGzipped("/models/maps/lighting/corner-uv.bin.gz"),
    fetchGzipped("/models/maps/lighting/triangle-valid.bin.gz"),
    fetchGzipped("/models/maps/lighting/fallback.bin.gz"),
    fetchGzipped("/models/maps/lighting/confidence.bin.gz"),
    assetFetch("/models/maps/lighting/meshes.json").then(async (r) => {
      if (!r.ok) throw new Error("Native map lighting layout unavailable");
      return (await r.json()) as {
        count: number;
        offset: number;
        indexOffset: number;
        indexCount: number;
      }[];
    }),
    new T.TextureLoader().loadAsync(assetUrl("/models/maps/lighting/irradiance.webp")),
    new T.TextureLoader().loadAsync(assetUrl("/models/maps/lighting/shadows.webp")),
    assetFetch("/models/maps/material-lighting.json").then(async (r) => {
      if (!r.ok) throw new Error("Native map material lighting unavailable");
      return (await r.json()) as {
        materials: { name: string; ambientOcclusionScale: number }[];
      };
    }),
    loadSourceLighting(),
  ]);
}
export async function applySourceMapLighting(
  root: T.Object3D,
  data: Awaited<ReturnType<typeof loadSourceMapLighting>>,
) {
  const [
    uvBuffer,
    validBuffer,
    fallbackBuffer,
    confidenceBuffer,
    meshes,
    irradiance,
    shadows,
    materialLighting,
  ] = data;
  // WebP carries square-root encoded linear irradiance data, not display-referred albedo.
  for (const texture of [irradiance, shadows]) {
    texture.colorSpace = T.NoColorSpace;
    texture.flipY = false;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
  }
  let index = 0;
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const layout = meshes[index++];
    if (!layout || object.geometry.attributes.position.count !== layout.count)
      throw new Error("Native map lighting geometry mismatch; regenerate lighting assets");
    const splits = applyCornerLightmap(
      object.geometry,
      new Uint16Array(uvBuffer, layout.indexOffset * 4, layout.indexCount * 2),
      new Uint8Array(validBuffer, layout.indexOffset / 3, layout.indexCount / 3),
      new Uint8Array(fallbackBuffer, layout.offset * 4, layout.count * 4),
      new Uint8Array(confidenceBuffer, layout.offset, layout.count),
    );
    root.userData.sourceLightmapSplits = (root.userData.sourceLightmapSplits ?? 0) + splits;
    // The native shadow atlas already contains stationary sun occlusion.
    object.receiveShadow = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (patched.has(material)) continue;
      patched.add(material);
      // Restore explicit native material AO strength omitted by the glTF export.
      // A zero native scale is essential for the decorative street lantern.
      const nativeMaterial = materialLighting.materials.find(
        (entry) => entry.name === material.name,
      );
      if (nativeMaterial && material instanceof T.MeshStandardMaterial)
        material.aoMapIntensity = nativeMaterial.ambientOcclusionScale;
      const prior = material.onBeforeCompile.bind(material);
      const priorKey = material.customProgramCacheKey();
      material.onBeforeCompile = (
        shader: T.WebGLProgramParametersWithUniforms,
        renderer: T.WebGLRenderer,
      ) => {
        prior(shader, renderer);
        shader.uniforms.sourceIrradiance = { value: irradiance };
        shader.uniforms.sourceShadows = { value: shadows };
        shader.vertexShader =
          `attribute vec3 sourceUv; attribute vec4 sourceProbe; varying vec3 vSourceUv; varying vec4 vSourceProbe;\n` +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvSourceUv=sourceUv; vSourceProbe=sourceProbe;",
        );
        shader.fragmentShader =
          `uniform sampler2D sourceIrradiance; uniform sampler2D sourceShadows; varying vec3 vSourceUv; varying vec4 vSourceProbe;\n` +
          shader.fragmentShader;
        const direct =
          "float sourceCoverage = vSourceUv.z;\n" +
          T.ShaderChunk.lights_fragment_begin.replace(
            "getDirectionalLightInfo( directionalLight, directLight );",
            "getDirectionalLightInfo( directionalLight, directLight );\ndirectLight.color *= mix(vSourceProbe.a, 1.0-texture2D(sourceShadows,vSourceUv.xy).r, sourceCoverage);",
          );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_begin>",
          direct,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_maps>",
          `#include <lights_fragment_maps>
          vec4 sourceLight = texture2D(sourceIrradiance, vSourceUv.xy);
          irradiance = mix(vSourceProbe.rgb * vSourceProbe.rgb * 16.0, sourceLight.rgb * sourceLight.rgb * 16.0, sourceCoverage) * PI;
          iblIrradiance = vec3(0.0);
        `,
        );
      };
      material.customProgramCacheKey = () => priorKey + "-native-source-lighting-v1";
      material.needsUpdate = true;
    }
  });
  if (index !== meshes.length) throw new Error("Native map lighting mesh count mismatch");
  return { irradiance, shadows };
}
