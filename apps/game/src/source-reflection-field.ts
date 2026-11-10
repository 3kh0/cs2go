import * as T from "three";
import type { SourceReflections } from "./source-reflections";
export const sourceReflectionFieldWords = 13;
/** Exact std140 vec4 transport of complete affine records. Padding is explicit;
 * matrix columns and scalar Float32 uploads match the default-uniform path. */
export function createSourceReflectionField(data: SourceReflections) {
  if (data.uniforms.length !== data.volumes.length || !data.uniforms.length)
    throw new Error("Native reflection field must retain all source records");
  const packed = new Float32Array(data.uniforms.length * sourceReflectionFieldWords * 4),
    identity = new T.Matrix4();
  data.uniforms.forEach((v, i) => {
    const at = i * 52;
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
    packed.set((v.worldToLocal ?? identity).elements, at + 20);
    packed.set((v.localToWorld ?? identity).elements, at + 36);
  });
  if (packed.some((v) => !Number.isFinite(v)))
    throw new Error("Native reflection field contains invalid Float32 values");
  const words = Array.from({ length: packed.length / 4 }, (_, i) =>
      new T.Vector4().fromArray(packed, i * 4),
    ),
    group = new T.UniformsGroup().setName("NativeSourceReflectionField").add(new T.Uniform(words)),
    users = new Set<T.Material>();
  let disposed = false;
  return {
    group,
    packed,
    byteLength: packed.byteLength,
    attach(material: T.Material) {
      if (disposed) throw new Error("Native reflection field is disposed");
      const target = material as T.Material & { uniformsGroups?: T.UniformsGroup[] };
      if (target.uniformsGroups?.length)
        throw new Error("Native reflection uniform block coexistence requires explicit admission");
      target.uniformsGroups = [group];
      users.add(material);
      material.userData.nativeReflectionFieldBytes = packed.byteLength;
      const release = () => {
        material.removeEventListener("dispose", release);
        users.delete(material);
        if (!users.size && !disposed) {
          disposed = true;
          group.dispose();
        }
      };
      material.addEventListener("dispose", release);
    },
  };
}
