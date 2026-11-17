import * as T from "three";
import type { SourceGpuProbes } from "./source-gpu-probes";

/** Immutable map data, shared by scenery and actors. All members are vec4s,
 * retaining the exact Float32 values of the default-uniform transport. */
export function createSourceProbeField(probes: SourceGpuProbes) {
  const frames = probes.packedFrames;
  if (!frames) throw new Error("Shared probe field requires packed native frames");
  const values = new Float32Array(frames.values.length + frames.rotations.length + 12);
  values.set(frames.values);
  values.set(frames.rotations, frames.values.length);
  probes.sky.forEach((row, i) =>
    row.toArray(values, frames.values.length + frames.rotations.length + i * 4),
  );
  return new T.UniformsGroup()
    .setName("NativeSourceProbeField")
    .add(
      new T.Uniform(
        Array.from({ length: values.length / 4 }, (_, i) =>
          new T.Vector4().fromArray(values, i * 4),
        ),
      ),
    );
}

const bindings = new WeakMap<T.Material, T.UniformsGroup>();
/** Preserve independently owned reflection/light blocks when switching maps. */
export function bindSourceProbeField(material: T.Material, probes?: SourceGpuProbes | null) {
  const next = probes?.uniformsGroup,
    previous = bindings.get(material);
  if (previous === next) return;
  const target = material as T.Material & { uniformsGroups?: T.UniformsGroup[] };
  target.uniformsGroups = (target.uniformsGroups ?? []).filter((group) => group !== previous);
  if (next) {
    target.uniformsGroups.push(next);
    bindings.set(material, next);
  } else bindings.delete(material);
}
