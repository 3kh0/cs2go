import * as T from "three";
import type { MapId } from "@cs2go/protocol";
import { applySourceLayers, loadSourceMaterialBundle } from "./source-layers";
import { registerSurfaceTextures } from "./presentation-settings";
import { applySourceSurface } from "./source-surface";

export function loadNativeMapLayers(renderer: T.WebGLRenderer, id: MapId) {
  return loadSourceMaterialBundle(renderer, `/models/maps/${id}-materials/layers/`);
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
      const textures = [source.normal1, source.normal2, source.color2, source.mask];
      if (source.detail) textures.push(source.detail.texture);
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
        // The shipped Mirage layered materials omit both specular features.
        // Match the native diffuse BRDF instead of introducing glTF highlights.
        applySourceSurface(shader, { directSpecular: false, indirectSpecular: false });
      };
      material.customProgramCacheKey = () =>
        `${key}:native-map-layers-${source.fancy}-${!!source.detail}-${source.specularIndirect}`;
      material.needsUpdate = true;
    }
  });
}
