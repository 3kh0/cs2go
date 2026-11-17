import * as T from "three";
import type { SourceProbeFrame } from "./source-probe-frames";

export type SourceProbeSelection = {
  indices: { value: Int32Array };
  count: { value: number };
};

/** Include the complete positive-fade support, not only the inner LPV box.
 * Derive placement from the same Float32 coefficients read by the GPU. */
export function sourceProbeBounds(volumes: readonly SourceProbeFrame[]) {
  const sourceToWorld = new T.Matrix4().set(
    0.0254,
    0,
    0,
    0,
    0,
    0,
    0.0254,
    0,
    0,
    -0.0254,
    0,
    0,
    0,
    0,
    0,
    1,
  );
  return volumes.map((volume) => {
    if (volume.inverseEdge.some((value) => value <= 0))
      return new T.Box3(
        new T.Vector3(-Infinity, -Infinity, -Infinity),
        new T.Vector3(Infinity, Infinity, Infinity),
      );
    const transform = volume.worldToLocalVolumeNormalized
      ? new T.Matrix4().fromArray(volume.worldToLocalVolumeNormalized.map(Math.fround))
      : new T.Matrix4().set(
          Math.fround(volume.normalizedScale[0]),
          0,
          0,
          Math.fround(volume.normalizedOffset[0]),
          0,
          Math.fround(volume.normalizedScale[1]),
          0,
          Math.fround(volume.normalizedOffset[1]),
          0,
          0,
          Math.fround(volume.normalizedScale[2]),
          Math.fround(volume.normalizedOffset[2]),
          0,
          0,
          0,
          1,
        );
    if (!transform.determinant())
      return new T.Box3(
        new T.Vector3(-Infinity, -Infinity, -Infinity),
        new T.Vector3(Infinity, Infinity, Infinity),
      );
    const skin = volume.normalizedSkin.map((value) => Math.max(0, Math.fround(value)));
    return (
      new T.Box3(
        new T.Vector3(...skin.map((value) => -value)),
        new T.Vector3(...skin.map((value) => 1 + value)),
      )
        .applyMatrix4(transform.invert().premultiply(sourceToWorld))
        // Conservative allowance for FLOAT32 world/Source transforms and dots.
        .expandByScalar(0.05)
    );
  });
}

export function createSourceProbeSelection(count: number): SourceProbeSelection {
  return { indices: { value: new Int32Array(count) }, count: { value: 0 } };
}

/** Preserve native priority order; excluded volumes have zero weight at every
 * point in these bounds. No nearest-N limit or lighting approximation. */
export function updateSourceProbeSelection(
  selection: SourceProbeSelection,
  volumes: readonly T.Box3[],
  bounds: T.Box3,
) {
  let count = 0;
  for (let i = 0; i < volumes.length; i++)
    if (volumes[i].intersectsBox(bounds)) selection.indices.value[count++] = i;
  selection.count.value = count;
}
