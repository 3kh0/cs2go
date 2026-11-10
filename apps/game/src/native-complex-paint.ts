import * as T from "three";
import { loadGzipped } from "./gltf";
import type { MapResources } from "./map-resources";
import type { loadNativeMapComplex } from "./native-map-complex";

/** Source vertex paint is a raw FLOAT4 control, not display color. It is
 * restored in an audited sidecar instead of reusing the white export fallback. */
export async function loadNativeComplexPaint(
  bundle: Awaited<ReturnType<typeof loadNativeMapComplex>> | undefined,
  resources: MapResources,
) {
  const paint = bundle?.paint;
  if (!paint) return undefined;
  const asset = await loadGzipped(paint.model, 1);
  resources.capture(asset.scene);
  resources.onDispose(() => resources.capture(asset.scene));
  const bindings = new Map(
    paint.materialBindings.map((binding) => [binding.packedMaterialIndex, binding]),
  );
  if (bindings.size !== paint.materialBindings.length)
    throw new Error("Duplicate native vertex-paint material binding");
  const seen = new Set<number>();
  asset.scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const control = object.geometry.getAttribute("color");
    if (
      !control ||
      control.itemSize !== 4 ||
      control.normalized ||
      !(control.array instanceof Float32Array) ||
      control.count !== object.geometry.getAttribute("position").count
    )
      throw new Error("Native vertex paint requires its original FLOAT4 stream");
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const slot = material.userData.nativeGltfMaterialIndex,
        binding = bindings.get(slot);
      if (
        !(material instanceof T.MeshStandardMaterial) ||
        !binding ||
        material.userData.nativeComplexRawControl !== true ||
        material.userData.nativeSourceMaterialIndex !== binding.originalMaterialIndex ||
        material.name !== binding.name ||
        !paint.originalMainMaterialIndices.includes(binding.originalMaterialIndex) ||
        binding.baseColorFactor.length !== 4 ||
        binding.baseColorFactor.some(
          (v, i) =>
            !Number.isFinite(v) ||
            Math.abs(
              v - [material.color.r, material.color.g, material.color.b, material.opacity][i],
            ) > 1e-6,
        )
      )
        throw new Error("Native vertex-paint sidecar identity does not match its source");
      seen.add(slot);
    }
    object.geometry.setAttribute("nativeComplexPaint", control);
  });
  if (seen.size !== bindings.size) throw new Error("Native vertex-paint sidecar is incomplete");
  return { root: asset.scene, originalMainMaterialIndices: paint.originalMainMaterialIndices };
}
