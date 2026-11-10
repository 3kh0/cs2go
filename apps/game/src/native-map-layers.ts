import * as T from "three";
import type { MapId } from "@cs2go/protocol";
import { applySourceLayers, loadSourceMaterialBundle } from "./source-layers";
import { registerSurfaceTextures } from "./presentation-settings";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";

export async function loadNativeMapLayers(renderer: T.WebGLRenderer, id: MapId) {
  return loadNativeMapLayerBundle(renderer, `/models/maps/${id}-materials/layers/`);
}

export async function loadNativeMapLayerBundle(renderer: T.WebGLRenderer, directory: string) {
  if (directory.endsWith("/source.json")) directory = directory.slice(0, -"source.json".length);
  const bundle = await loadSourceMaterialBundle(renderer, directory);
  const lookup = Object.values(bundle.materials).some((material) => material.specularIndirect)
    ? await loadSourceSurfaceLookup()
    : undefined;
  return { ...bundle, lookup };
}

/** Native TEXCOORD4 is a linear blend-control stream, separate from paint and lightmap UVs. */
export function applyNativeMapLayers(
  root: T.Object3D,
  bundle: Awaited<ReturnType<typeof loadNativeMapLayers>>,
) {
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const source = bundle.materials[material.name];
      if (!source || !(material instanceof T.MeshStandardMaterial)) continue;
      const blend = object.geometry.getAttribute("color_1");
      if (
        !blend ||
        blend.itemSize !== 4 ||
        blend.count !== object.geometry.getAttribute("position").count
      )
        throw new Error(`Native map layer weights missing: ${material.name}`);
      object.geometry.setAttribute("sourceBlend", blend);
      if (patched.has(material)) continue;
      patched.add(material);
      if (!material.map) throw new Error(`Native map layer albedo missing: ${material.name}`);
      // The packed native layer normals/roughness replace the glTF adaptation;
      // keep the primary UV transform for the derivative tangent frame.
      material.normalMap = material.map;
      material.roughnessMap = material.metalnessMap = material.aoMap = null;
      material.metalness = source.metalness;
      const textures = [source.normal1, source.normal2, source.color2];
      if (source.fancy > 0 && source.mask) textures.push(source.mask);
      if (source.detail) textures.push(source.detail.texture);
      if (source.detail2) textures.push(source.detail2.texture);
      registerSurfaceTextures(
        material,
        textures.map((key) => {
          const texture = bundle.textures.get(key);
          if (!texture) throw new Error(`Native map layer texture missing: ${key}`);
          return texture;
        }),
      );
      const compile = material.onBeforeCompile.bind(material);
      const key = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer);
        applySourceLayers(shader, source, bundle.textures);
        // Preserve each source material's feature flags; historical Mirage
        // manifests omit direct specular and explicitly disable indirect specular.
        applySourceSurface(
          shader,
          {
            directSpecular: source.specularDirect ?? false,
            indirectSpecular: source.specularIndirect,
          },
          bundle.lookup,
        );
      };
      material.customProgramCacheKey = () =>
        `${key}:native-map-layers-${source.fancy}-${!!source.detail}-${!!source.detail2}-${source.specularIndirect}-${source.specularDirect ?? false}-${JSON.stringify([source.normal1, source.normal2, source.color2, source.mask, source.detail?.texture, source.detail2?.texture])}`;
      material.needsUpdate = true;
    }
  });
}
