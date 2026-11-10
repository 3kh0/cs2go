import * as T from "three";
import { partitionNativeReflections } from "./native-reflection-partition";
import type { SourceReflections } from "./source-reflections";

type Volumes = Pick<SourceReflections, "volumes">;
export interface NativeInstanceReflectionBatch {
  /** Original instance IDs and exact original FLOAT32 matrix bytes, in order. */
  instances: number[];
  matrices: Float32Array;
  /** Browser-world placement; attach beneath an identity root or convert once
   * to the new parent. Own-sky placement must not be applied twice. */
  worldMatrix: T.Matrix4;
  geometry: T.BufferGeometry;
  material: T.Material | T.Material[];
  candidates: number[];
}
export interface NativeInstanceReflectionOptions {
  worldToNative?: T.Matrix4;
  /** Proven maximum displacement per world-browser axis (metres), including
   * the full animation/wind schedule. Explicit zero declares static geometry. */
  worldPadding: number;
}
const capacity = 8;
const gamma64 = (64 * 2 ** -24) / (1 - 64 * 2 ** -24);

function bounds(data: Volumes) {
  return data.volumes.map((volume) => {
    const lo = volume.worldAABB?.[0] ?? volume.origin.map((v, i) => v + volume.min[i]);
    const hi = volume.worldAABB?.[1] ?? volume.origin.map((v, i) => v + volume.max[i]);
    return new T.Box3(
      new T.Vector3(lo[0] * 0.0254, lo[2] * 0.0254, -hi[1] * 0.0254),
      new T.Vector3(hi[0] * 0.0254, hi[2] * 0.0254, -lo[1] * 0.0254),
    );
  });
}
function check(mesh: T.InstancedMesh, options: NativeInstanceReflectionOptions) {
  if (
    !Number.isFinite(options.worldPadding) ||
    options.worldPadding < 0 ||
    !Number.isInteger(mesh.count) ||
    mesh.count < 0 ||
    mesh.count > mesh.instanceMatrix.count ||
    !(mesh.instanceMatrix.array instanceof Float32Array)
  )
    throw new Error("Invalid native instance reflection input");
  for (const matrix of [mesh.matrixWorld, options.worldToNative ?? new T.Matrix4()]) {
    const e = matrix.elements;
    if (
      e.some((v) => !Number.isFinite(v)) ||
      e[3] !== 0 ||
      e[7] !== 0 ||
      e[11] !== 0 ||
      e[15] !== 1
    )
      throw new Error("Native instance reflection placement must be finite and affine");
    if (!(matrix.determinant() > 0))
      throw new Error("Native instancing requires positive nonsingular placement");
  }
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
}
/** Absolute matrix products bound cancellation as well as final coordinates.
 * gamma64 is the standard conservative FLOAT32 roundoff bound for the bounded
 * affine transform chain; it is not a spatial/quality tuning distance. */
function frame(mesh: T.InstancedMesh, instance: number, options: NativeInstanceReflectionOptions) {
  const local = new T.Matrix4().fromArray(mesh.instanceMatrix.array, instance * 16);
  const e = local.elements;
  if (e.some((v) => !Number.isFinite(v)) || e[3] !== 0 || e[7] !== 0 || e[11] !== 0 || e[15] !== 1)
    throw new Error("Native instance reflection matrix is not finite affine data");
  if (!(local.determinant() > 0))
    throw new Error("Native instancing requires positive nonsingular instance transforms");
  const own = options.worldToNative ?? new T.Matrix4(),
    box = mesh.geometry.boundingBox!;
  let magnitude = [0, 1, 2].map((i) =>
    Math.max(Math.abs(box.min.getComponent(i)), Math.abs(box.max.getComponent(i))),
  );
  for (const matrix of [local, mesh.matrixWorld, own]) {
    const m = matrix.elements;
    magnitude = [0, 1, 2].map(
      (row) =>
        Math.abs(m[row + 12]) +
        magnitude.reduce((sum, v, col) => sum + Math.abs(m[row + 4 * col]) * v, 0),
    );
  }
  const m = own.elements,
    padding = new T.Vector3(
      ...([0, 1, 2].map(
        (row) =>
          options.worldPadding * (Math.abs(m[row]) + Math.abs(m[row + 4]) + Math.abs(m[row + 8])) +
          magnitude[row] * gamma64,
      ) as [number, number, number]),
    );
  const matrix = own.clone().multiply(mesh.matrixWorld).multiply(local),
    transformed = box.clone().applyMatrix4(matrix);
  if (
    [...padding.toArray(), ...transformed.min.toArray(), ...transformed.max.toArray()].some(
      (value) => !Number.isFinite(value),
    )
  )
    throw new Error("Native instance reflection transformed bounds are not finite");
  return { matrix, padding, box: transformed };
}
function candidates(box: T.Box3, boxes: T.Box3[], padding: T.Vector3) {
  const ids: number[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const volume = boxes[i];
    // Same inclusive expanded-box test without cloning every volume for every
    // authored instance (Cache retains79,547 placements).
    if (
      box.max.x >= volume.min.x - padding.x &&
      box.min.x <= volume.max.x + padding.x &&
      box.max.y >= volume.min.y - padding.y &&
      box.min.y <= volume.max.y + padding.y &&
      box.max.z >= volume.min.z - padding.z &&
      box.min.z <= volume.max.z + padding.z
    )
      ids.push(i);
  }
  return ids;
}
function materialAt(mesh: T.InstancedMesh, index: number) {
  return Array.isArray(mesh.material) ? mesh.material[index] : mesh.material;
}

/** CPU-only preparation: no texture/light-data changes and no instance
 * reduction. Whole consecutive instances share a draw only while their full
 * conservative candidate union fits. An individual large instance uses the
 * existing separate-mesh triangle partition, preserving its original ordering.
 * Call before adapters create coverage views; bind the returned candidates
 * explicitly rather than running the ordinary template-only partition again. */
export function partitionNativeInstanceReflections(
  mesh: T.InstancedMesh,
  data: Volumes,
  options: NativeInstanceReflectionOptions,
) {
  mesh.updateWorldMatrix(true, false, true);
  check(mesh, options);
  const boxes = bounds(data),
    batches: NativeInstanceReflectionBatch[] = [],
    owned = new Set<T.BufferGeometry>();
  let pending: NativeInstanceReflectionBatch | undefined,
    splitInstances = 0,
    extraVertices = 0;
  const push = (
    geometry: T.BufferGeometry,
    material: T.Material | T.Material[],
    indices: number[],
    ids: number[],
  ) => {
    const matrices = new Float32Array(indices.length * 16);
    indices.forEach((index, i) =>
      matrices.set(mesh.instanceMatrix.array.subarray(index * 16, index * 16 + 16), i * 16),
    );
    const batch = {
      geometry,
      material,
      instances: indices,
      matrices,
      candidates: ids,
      worldMatrix: mesh.matrixWorld.clone(),
    };
    batches.push(batch);
    return batch;
  };
  try {
    for (let instance = 0; instance < mesh.count; instance++) {
      const placement = frame(mesh, instance, options),
        ids = candidates(placement.box, boxes, placement.padding);
      if (ids.length <= capacity) {
        const union = pending
          ? [...new Set([...pending.candidates, ...ids])].sort((a, b) => a - b)
          : ids;
        if (pending && union.length <= capacity) {
          pending.instances.push(instance);
          pending.candidates = union;
        } else pending = push(mesh.geometry, mesh.material, [instance], ids);
        continue;
      }
      pending = undefined;
      splitInstances++;
      const separate = new T.Mesh(mesh.geometry, mesh.material);
      separate.matrixAutoUpdate = false;
      separate.matrix.copy(placement.matrix);
      separate.matrixWorldNeedsUpdate = true;
      const partition = partitionNativeReflections(
        separate,
        data,
        capacity,
        placement.padding,
        options.worldPadding === 0,
      );
      extraVertices += partition.extraVertices;
      for (const part of [partition.original, partition.overflow]) {
        if (!part) continue;
        for (const group of part.groups) {
          const geometry = new T.BufferGeometry();
          geometry.userData = { ...mesh.geometry.userData };
          for (const [name, attribute] of Object.entries(part.geometry.attributes))
            geometry.setAttribute(name, attribute);
          geometry.setIndex(group.indices);
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
          owned.add(geometry);
          push(geometry, materialAt(mesh, group.material), [instance], group.candidates);
        }
        part.geometry.dispose();
      }
    }
    // Pending whole-instance groups grow without repeatedly copying matrices.
    for (const batch of batches)
      if (batch.matrices.length !== batch.instances.length * 16) {
        batch.matrices = new Float32Array(batch.instances.length * 16);
        batch.instances.forEach((index, i) =>
          batch.matrices.set(
            mesh.instanceMatrix.array.subarray(index * 16, index * 16 + 16),
            i * 16,
          ),
        );
      }
    return {
      batches,
      ownedGeometries: owned,
      sourceInstances: mesh.count,
      splitInstances,
      extraVertices,
    };
  } catch (error) {
    for (const geometry of owned) geometry.dispose();
    throw new Error("This map's instanced reflections could not be prepared.", {
      cause: {
        objectName: mesh.name,
        capacity,
        reason: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

/** Fail closed if a future loader supplies an incomplete binding. Most batches
 * prove completeness using only bounds; triangle tests are needed solely for
 * conservative box false positives outside the supplied candidate set. */
export function assertNativeInstanceReflectionCoverage(
  mesh: T.InstancedMesh,
  data: Volumes,
  ids: readonly number[],
  options: NativeInstanceReflectionOptions,
) {
  mesh.updateWorldMatrix(true, false, true);
  check(mesh, options);
  if (
    ids.length > capacity ||
    ids.some(
      (id, i) =>
        !Number.isInteger(id) || id < 0 || id >= data.volumes.length || (i > 0 && id <= ids[i - 1]),
    )
  )
    throw new Error("Invalid native instance reflection candidate order/capacity");
  const boxes = bounds(data),
    positions = mesh.geometry.getAttribute("position"),
    index = mesh.geometry.index,
    allIds = new Set(ids),
    triangle = new T.Triangle();
  const groups = mesh.geometry.groups.length
    ? mesh.geometry.groups
    : [{ start: 0, count: index?.count ?? positions.count }];
  for (let instance = 0; instance < mesh.count; instance++) {
    const placement = frame(mesh, instance, options),
      missing = candidates(placement.box, boxes, placement.padding).filter((id) => !allIds.has(id));
    if (!missing.length) continue;
    for (const group of groups)
      for (let offset = group.start; offset < group.start + group.count; offset += 3) {
        for (const [n, target] of [
          [0, triangle.a],
          [1, triangle.b],
          [2, triangle.c],
        ] as const)
          target
            .fromBufferAttribute(positions, index ? index.getX(offset + n) : offset + n)
            .applyMatrix4(placement.matrix);
        for (const id of missing)
          if (boxes[id].clone().expandByVector(placement.padding).intersectsTriangle(triangle))
            throw new Error("This map's instanced reflections do not cover its native geometry.", {
              cause: { objectName: mesh.name, instance, missingVolume: id },
            });
      }
  }
}

export const nativeInstanceReflectionAttributes = [
  "sourceReflectionCandidates0",
  "sourceReflectionCandidates1",
] as const;
const absentInstanceReflection = 255;

/** Complete conservative candidates in authored instance order. The two BYTE4
 * attributes consume no sampler and retain exact small integer IDs. A fixed
 * eight-slot shader skips 255; no nearest-probe truncation or instance sorting. */
export function createNativeInstanceReflectionCandidates(
  mesh: T.InstancedMesh,
  data: Volumes,
  options: NativeInstanceReflectionOptions,
) {
  mesh.updateWorldMatrix(true, false, true);
  check(mesh, options);
  if (data.volumes.length > absentInstanceReflection)
    throw new Error("Native instance reflection field exceeds BYTE candidate capacity");
  const boxes = bounds(data),
    first = new Uint8Array(mesh.count * 4).fill(absentInstanceReflection),
    second = new Uint8Array(mesh.count * 4).fill(absentInstanceReflection);
  let maximumCandidates = 0;
  for (let instance = 0; instance < mesh.count; instance++) {
    const placement = frame(mesh, instance, options),
      ids = candidates(placement.box, boxes, placement.padding);
    if (ids.length > capacity)
      throw new Error("Native instance reflection candidates exceed eight; partition required", {
        cause: { objectName: mesh.name, instance, candidates: ids.length },
      });
    maximumCandidates = Math.max(maximumCandidates, ids.length);
    ids.forEach((id, slot) => {
      (slot < 4 ? first : second)[instance * 4 + (slot % 4)] = id;
    });
  }
  return {
    attributes: [
      new T.InstancedBufferAttribute(first, 4, false),
      new T.InstancedBufferAttribute(second, 4, false),
    ] as const,
    maximumCandidates,
    bytes: first.byteLength + second.byteLength,
  };
}

/** Check the actual attributes consumed by the shader, including sentinel,
 * order, divisor and complete conservative geometry/deformation coverage. */
export function assertNativeInstanceReflectionCandidates(
  mesh: T.InstancedMesh,
  data: Volumes,
  options: NativeInstanceReflectionOptions,
) {
  mesh.updateWorldMatrix(true, false, true);
  check(mesh, options);
  if (data.volumes.length > absentInstanceReflection)
    throw new Error("Native instance reflection field exceeds BYTE candidate capacity");
  const attributes = nativeInstanceReflectionAttributes.map((name) =>
    mesh.geometry.getAttribute(name),
  );
  if (
    attributes.some(
      (attribute) =>
        !(attribute instanceof T.InstancedBufferAttribute) ||
        !(attribute.array instanceof Uint8Array) ||
        attribute.itemSize !== 4 ||
        attribute.normalized ||
        attribute.meshPerAttribute !== 1 ||
        attribute.count !== mesh.count,
    )
  )
    throw new Error("Native instance reflection BYTE4 attributes are invalid");
  const boxes = bounds(data);
  for (let instance = 0; instance < mesh.count; instance++) {
    const placement = frame(mesh, instance, options),
      expected = candidates(placement.box, boxes, placement.padding);
    if (expected.length > capacity)
      throw new Error("Native instance reflection candidates exceed eight; partition required");
    for (let slot = 0; slot < capacity; slot++) {
      const actual = attributes[slot < 4 ? 0 : 1].getComponent(instance, slot % 4);
      if (actual !== (expected[slot] ?? absentInstanceReflection))
        throw new Error("Native instance reflection candidate bytes omit or reorder coverage", {
          cause: { objectName: mesh.name, instance, slot, actual, expected: expected[slot] },
        });
    }
  }
}
