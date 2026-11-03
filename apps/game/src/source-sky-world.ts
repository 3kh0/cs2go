import * as T from "three";
import { assetFetch } from "./asset-url";
import { fetchGzipped, loadGzipped } from "./gltf";
import { createSourceGpuProbes } from "./source-gpu-probes";
import { applySourceMapLighting, loadSourceMapLighting } from "./source-map-lighting";
import { loadSourceReflections } from "./source-reflections";

const directory = "/models/maps/lighting/sky/";
type Atlas = {
  file: string;
  width: number;
  height: number;
  gpuBytes: number;
  fallbackFile?: string;
};

/** Separate 8.2 bake and LPV frames, sampled in native sky coordinates. */
export async function loadSourceSkyWorld(renderer: T.WebGLRenderer) {
  const [manifest, asset, shared, materialLighting, reflections] = await Promise.all([
    assetFetch(directory + "world-source.json").then(async (response) => {
      if (!response.ok) throw new Error("Native sky-world lighting unavailable");
      return response.json() as Promise<{
        arrays: Parameters<typeof createSourceGpuProbes>[1];
        metadata: Parameters<typeof createSourceGpuProbes>[2];
        atlases: Record<string, Atlas>;
        sunColorLinear: number[];
      }>;
    }),
    loadGzipped(directory + "world.glb.gz", 1),
    loadSourceMapLighting(renderer),
    assetFetch(directory + "material-lighting.json").then((response) => response.json()),
    loadSourceReflections(renderer, true, { directory, manifest: "reflections.json", volumes: 2 }),
  ]);
  async function atlas(entry: Atlas, format: T.CompressedPixelFormat, supported = true) {
    const bytes = await fetchGzipped(directory + (supported ? entry.file : entry.fallbackFile));
    let texture: T.Texture;
    if (supported) {
      if (bytes.byteLength !== entry.gpuBytes) throw new Error("Invalid native sky atlas");
      texture = new T.CompressedTexture(
        [{ data: new Uint8Array(bytes), width: entry.width, height: entry.height }],
        entry.width,
        entry.height,
        format,
      );
    } else {
      if (bytes.byteLength !== entry.width * entry.height * 4)
        throw new Error("Invalid sky atlas fallback");
      texture = new T.DataTexture(new Uint8Array(bytes), entry.width, entry.height);
    }
    texture.colorSpace = T.NoColorSpace;
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.flipY = false;
    texture.needsUpdate = true;
    return texture;
  }
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const [irradiance, directional, shadows, gpuProbes] = await Promise.all([
    atlas(manifest.atlases.irradiance, T.RGB_BPTC_UNSIGNED_Format),
    atlas(
      manifest.atlases.directional_irradiance,
      T.RGB_S3TC_DXT1_Format,
      renderer.extensions.has("WEBGL_compressed_texture_s3tc"),
    ),
    atlas(
      manifest.atlases.direct_light_shadows,
      T.RED_RGTC1_Format,
      renderer.extensions.has("EXT_texture_compression_rgtc"),
    ),
    gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) >= 336
      ? createSourceGpuProbes(directory, manifest.arrays, manifest.metadata)
      : undefined,
  ]);
  const root = asset.scene;
  applySourceMapLighting(root, {
    ...shared,
    irradiance,
    directional,
    shadows,
    gpuProbes,
    materialLighting,
    native: true,
    barns: [],
    reflections,
    skySpace: true,
  });
  root.updateMatrixWorld(true);
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  root.traverse((object) => {
    object.matrixAutoUpdate = false;
    if (!(object instanceof T.Mesh)) return;
    object.castShadow = object.receiveShadow = false;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      material.toneMapped = false;
      for (const value of Object.values(material))
        if (value instanceof T.Texture && !Object.values(shared).includes(value))
          textures.add(value);
    }
  });
  const sun = new T.DirectionalLight();
  sun.color.setRGB(...(manifest.sunColorLinear as [number, number, number]));
  sun.intensity = Math.PI;
  const pitch = T.MathUtils.degToRad(50),
    yaw = T.MathUtils.degToRad(43);
  sun.position.set(
    -Math.cos(pitch) * Math.cos(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(yaw),
  );
  root.add(sun, sun.target);
  return {
    root,
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      for (const texture of [
        irradiance,
        directional,
        shadows,
        ...(gpuProbes?.textures ?? []),
        ...(reflections?.textures ?? []),
      ])
        texture.dispose();
    },
  };
}
