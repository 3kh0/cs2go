import { copySourceDepth } from "./source-depth";
import * as T from "three";
import type { NativeDoorDefinition } from "@cs2go/simulation/doors";
import {
  applySourceReflections,
  createSourceReflectionBinding,
  sourceReflectionCandidates,
  type SourceReflections,
} from "./source-reflections";
import { partitionNativeReflections } from "./native-reflection-partition";

/** Map-owned static bindings use the same bounded native box projection as
 * actors. Geometry bounds select candidates once while each fragment retains
 * native priority/edge weighting and affine projection. */
export function applyNativeMapReflections(
  root: T.Object3D,
  data: SourceReflections,
  doors: readonly NativeDoorDefinition[] = [],
  preservedNames: readonly string[] = [],
  options: { worldToNative?: T.Matrix4 } = {},
) {
  root.updateMatrixWorld(true);
  const moving = new Map<string, NativeDoorDefinition>();
  for (const door of doors)
    for (const name of [
      ...door.renderNames,
      ...(door.damage?.stages.flatMap((stage) => stage.renderNames) ?? []),
    ]) {
      moving.set(name, door);
      moving.set(T.PropertyBinding.sanitizeNodeName(name), door);
    }
  const preserved = new Set(
    preservedNames.flatMap((name) => [name, T.PropertyBinding.sanitizeNodeName(name)]),
  );
  const variants = new Map<T.MeshStandardMaterial, Map<string, T.MeshStandardMaterial>>();
  const meshes: T.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof T.Mesh) meshes.push(object);
  });
  const stats = {
    meshes: meshes.length,
    partitioned: 0,
    drawsBefore: 0,
    drawsAfter: 0,
    extraVertices: 0,
    indexBytes: 0,
    indexBytesBefore: 0,
  };
  for (const object of meshes) {
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    if (sourceMaterials.every((material) => !(material instanceof T.MeshStandardMaterial)))
      continue;
    const bounds = new T.Box3().setFromObject(object);
    let dynamic = false;
    for (let parent: T.Object3D | null = object; parent; parent = parent.parent) {
      if (preserved.has(parent.name)) dynamic = true;
      const door = moving.get(parent.name);
      if (!door) continue;
      dynamic = true;
      // Candidate selection covers the complete hinge sweep, not only the
      // closed leaf. Per-fragment affine weights still choose the local probe.
      const pivot = new T.Vector3(...door.pivot);
      let radius = 0;
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            radius = Math.max(radius, pivot.distanceTo(new T.Vector3(x, y, z)));
      bounds.setFromCenterAndSize(pivot, new T.Vector3().setScalar(radius * 2));
      break;
    }
    stats.drawsBefore += object.geometry.groups.length || 1;
    const adapt = (source: T.Material, indices: number[]) => {
      if (!(source instanceof T.MeshStandardMaterial) || !indices.length) return source;
      if (indices.length > 8)
        throw new Error(`Native moving reflection overlap exceeds eight volumes: ${object.name}`);
      const nativeFamily = source.userData.nativeSourceFamily as "water" | "complex" | undefined;
      const selection = `${nativeFamily ?? "legacy"}:${indices.join(",")}`;
      let materials = variants.get(source);
      if (!materials) variants.set(source, (materials = new Map()));
      let material = materials.get(selection);
      if (material) return material;
      const binding = createSourceReflectionBinding(data);
      binding.count.value = indices.length;
      for (const [slot, index] of indices.entries())
        Object.assign(binding.uniforms[slot], data.uniforms[index]);
      material = source.clone();
      copySourceDepth(source, material);
      const previous = source.onBeforeCompile.bind(source);
      const key = source.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        previous(shader, renderer);
        // Native irradiance and box-projected radiance replace Three's scene
        // PMREM path. Keep its duplicate ambient contribution and sampler out.
        shader.fragmentShader = "#undef USE_ENVMAP\n" + shader.fragmentShader;
        const frame = options.worldToNative;
        if (frame) {
          shader.uniforms.nativeReflectionWorldToNative = { value: frame };
          shader.fragmentShader =
            "uniform mat4 nativeReflectionWorldToNative;\n" + shader.fragmentShader;
        }
        applySourceReflections(
          shader,
          binding,
          Array.from({ length: indices.length }, (_, i) => i),
          {
            count: binding.count,
            nativeFamily,
            ...(frame
              ? {
                  worldPosition:
                    "(nativeReflectionWorldToNative*vec4(cameraPosition+transpose(mat3(viewMatrix))*(-vViewPosition),1.0)).xyz",
                  worldNormal:
                    "normalize(mat3(nativeReflectionWorldToNative)*inverseTransformDirection(geometryNormal,viewMatrix))",
                  worldView:
                    "normalize(mat3(nativeReflectionWorldToNative)*inverseTransformDirection(geometryViewDir,viewMatrix))",
                }
              : {}),
          },
        );
      };
      material.customProgramCacheKey = () =>
        `${key}:native-world-reflections:${data.cubeSize}:${data.arraySplit}:${data.combined}:${!!data.volumes[0]?.worldToLocal}:${binding.uniforms.length}:${!!options.worldToNative}:${nativeFamily ?? "legacy"}`;
      material.needsUpdate = true;
      materials.set(selection, material);
      return material;
    };
    const nativeBounds = options.worldToNative
      ? bounds.clone().applyMatrix4(options.worldToNative)
      : bounds;
    const candidates = sourceReflectionCandidates(nativeBounds, data);
    if (options.worldToNative && candidates.length > 8)
      throw new Error("Native transformed reflection overlap exceeds eight volumes");
    if (candidates.length <= 8 || dynamic) {
      object.material = Array.isArray(object.material)
        ? sourceMaterials.map((source) => adapt(source, candidates))
        : adapt(sourceMaterials[0], candidates);
      stats.drawsAfter += object.geometry.groups.length || 1;
      continue;
    }
    stats.indexBytesBefore += object.geometry.index?.array.byteLength ?? 0;
    const partition = partitionNativeReflections(object, data);
    object.geometry = partition.original.geometry;
    object.material = partition.original.groups.map((group) =>
      adapt(sourceMaterials[group.material], group.candidates),
    );
    stats.partitioned++;
    stats.drawsAfter += partition.original.groups.length;
    stats.extraVertices += partition.extraVertices;
    stats.indexBytes += partition.original.geometry.index!.array.byteLength;
    if (partition.overflow) {
      const extra = new T.Mesh(
        partition.overflow.geometry,
        partition.overflow.groups.map((group) =>
          adapt(sourceMaterials[group.material], group.candidates),
        ),
      );
      extra.name = `${object.name}:reflection-triangles`;
      extra.castShadow = object.castShadow;
      extra.receiveShadow = object.receiveShadow;
      extra.frustumCulled = object.frustumCulled;
      object.add(extra);
      extra.updateMatrixWorld(true);
      stats.drawsAfter += partition.overflow.groups.length;
      stats.indexBytes += extra.geometry.index!.array.byteLength;
    }
  }
  root.userData.nativeReflectionPartition = stats;
  return stats;
}
