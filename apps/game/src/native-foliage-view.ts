import * as T from "three";
import { createAuthoredWind } from "./native-authored-wind";
import { loadGzipped } from "./gltf";
import { MapResources } from "./map-resources";
import { applyNativeMapFoliage, loadNativeMapFoliage } from "./native-map-foliage";

/** A map-owned sidecar preserves the source's FLOAT4 controls. Its coverage
 * pass must run before every opaque color/depth consumer, including smoke. */
export async function loadNativeFoliageView(
  renderer: T.WebGLRenderer,
  path: string,
  resources: MapResources,
  space: "main" | "sky",
) {
  const bundle = await loadNativeMapFoliage(renderer, path);
  for (const texture of bundle.textures.values()) resources.texture(texture);
  resources.texture(bundle.noise);
  resources.external(bundle.lookup);
  if (!bundle.source.model) throw new Error("Native standalone foliage geometry unavailable");
  const asset = await loadGzipped(bundle.source.model, 1);
  const root = asset.scene;
  resources.capture(root);
  resources.onDispose(() => resources.capture(root));
  // Some native draws consume a COLOR0 input absent from their stored stream.
  // The engine's fallback binding is unobserved. Keep those original map draws
  // visible, and exclude their complete replacement material, including siblings
  // that happen to have controls. Never substitute the viewer's white stream.
  const held = new Set(bundle.source.admission?.unresolvedControlSidecarMaterialSlots ?? []);
  const excluded: T.Object3D[] = [];
  asset.scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const selected = materials.map((material) =>
      held.has(material.userData.nativeGltfMaterialIndex),
    );
    if (selected.some(Boolean)) {
      if (!selected.every(Boolean))
        throw new Error("Held foliage input shares an unsplit material batch");
      excluded.push(object);
    }
  });
  for (const object of excluded) object.removeFromParent();
  const wind = createAuthoredWind(bundle.source.controllers ?? [], {
    space,
    // Browser normalization of authored speed ranges; live native uploads have
    // not been captured. Keep this separate from the extracted sway equations.
    speedToStrength: 0.01,
    worldToOwn: bundle.source.frame
      ? new T.Matrix4().fromArray(bundle.source.frame.ownBrowserFromBrowserWorld)
      : undefined,
  });
  const view = applyNativeMapFoliage(asset.scene, bundle, { windState: wind.state });
  resources.onDispose(() => view.dispose());
  return {
    root: asset.scene,
    source: bundle.source,
    applyShadowPolicy() {
      view.applyShadowPolicy();
    },
    update(seconds: number) {
      view.update(seconds, wind.update(seconds));
    },
    renderDepth(this: void, camera: T.PerspectiveCamera) {
      const autoClear = renderer.autoClear;
      try {
        renderer.autoClear = false;
        view.syncDepth(renderer);
        renderer.render(view.depthScene, camera);
      } finally {
        renderer.autoClear = autoClear;
      }
    },
    prepare(camera: T.PerspectiveCamera) {
      renderer.initTexture(bundle.noise);
      view.syncDepth(renderer);
      return renderer.compileAsync(view.depthScene, camera);
    },
  };
}
