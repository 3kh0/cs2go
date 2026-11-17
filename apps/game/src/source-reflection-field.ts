import * as T from "three";
import type { SourceReflections } from "./source-reflections";
export const sourceReflectionFieldWords = 13;
// WebGL2 guarantees 16KiB per block. Split record columns across blocks so
// every record remains directly addressable without shader selection branches.
export const sourceReflectionBlockBytes = 16384;
export function sourceReflectionFieldLayout(
  count: number,
  blockBytes = sourceReflectionBlockBytes,
) {
  const capacity = Math.floor(blockBytes / (count * 16));
  if (!Number.isInteger(count) || count < 1 || !Number.isFinite(capacity) || capacity < 1)
    throw new Error("Invalid native reflection block capacity");
  if (capacity >= 13) return [13];
  // Keep the scalar/vector fields and both affine matrices together when they
  // fit; smaller block budgets can split those columns further, still directly.
  if (capacity >= 8) return [5, 8];
  if (capacity >= 5) return [5, 4, 4];
  const words: number[] = [];
  for (let first = 0; first < sourceReflectionFieldWords; first += capacity)
    words.push(Math.min(sourceReflectionFieldWords - first, capacity));
  return words;
}
export function sourceReflectionFieldGLSL(count: number, blockBytes = sourceReflectionBlockBytes) {
  const words = sourceReflectionFieldLayout(count, blockBytes);
  return words
    .map(
      (length, i) =>
        `layout(std140) uniform NativeSourceReflectionField${i || ""} { vec4 nativeReflectionWords${i || ""}[${length * count}]; };`,
    )
    .join("\n");
}
/** Float32 records shared by the static default-uniform and std140 transports.
 * Keep scalar/vector rounding and column-major matrix uploads identical. */
export function packSourceReflectionRecords(records: SourceReflections["uniforms"], affine = true) {
  const stride = (affine ? sourceReflectionFieldWords : 5) * 4;
  const packed = new Float32Array(records.length * stride),
    identity = new T.Matrix4();
  records.forEach((v, i) => {
    const at = i * stride;
    packed.set(
      [
        ...v.origin.toArray(),
        v.index,
        ...v.mins.toArray(),
        0,
        ...v.maxs.toArray(),
        0,
        ...v.invEdge.toArray(),
        0,
        ...v.sh.toArray(),
      ],
      at,
    );
    if (affine) {
      packed.set((v.worldToLocal ?? identity).elements, at + 20);
      packed.set((v.localToWorld ?? identity).elements, at + 36);
    }
  });
  if (packed.some((v) => !Number.isFinite(v)))
    throw new Error("Native reflection field contains invalid Float32 values");
  return packed;
}
/** Exact std140 vec4 transport of complete affine records. Padding is explicit;
 * matrix columns and scalar Float32 uploads match the default-uniform path. */
export function createSourceReflectionField(
  data: SourceReflections,
  blockBytes = sourceReflectionBlockBytes,
) {
  if (data.uniforms.length !== data.volumes.length || !data.uniforms.length)
    throw new Error("Native reflection field must retain all source records");
  const packed = packSourceReflectionRecords(data.uniforms);
  let offset = 0;
  const groups = sourceReflectionFieldLayout(data.uniforms.length, blockBytes).map((length, i) => {
    const words = Array.from({ length: length * data.uniforms.length }, (_, word) =>
      new T.Vector4().fromArray(
        packed,
        (Math.floor(word / length) * sourceReflectionFieldWords + offset + (word % length)) * 4,
      ),
    );
    offset += length;
    return new T.UniformsGroup()
      .setName(`NativeSourceReflectionField${i || ""}`)
      .add(new T.Uniform(words));
  });
  const users = new Set<T.Material>();
  let disposed = false;
  return {
    group: groups[0],
    groups,
    packed,
    byteLength: packed.byteLength,
    attach(material: T.Material) {
      if (disposed) throw new Error("Native reflection field is disposed");
      const target = material as T.Material & { uniformsGroups?: T.UniformsGroup[] };
      if (target.uniformsGroups?.length)
        throw new Error("Native reflection uniform block coexistence requires explicit admission");
      target.uniformsGroups = groups.slice();
      users.add(material);
      material.userData.nativeReflectionFieldBytes = packed.byteLength;
      const release = () => {
        material.removeEventListener("dispose", release);
        users.delete(material);
        if (!users.size && !disposed) {
          disposed = true;
          for (const group of groups) group.dispose();
        }
      };
      material.addEventListener("dispose", release);
    },
  };
}
