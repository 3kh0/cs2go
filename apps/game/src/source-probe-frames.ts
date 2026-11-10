export const probeFrameKeys = [
  "normalizedScale",
  "normalizedOffset",
  "inverseEdge",
  "normalizedSkin",
  "atlasScale",
  "atlasOffset",
  "borderMin",
  "borderMax",
] as const;

export type SourceProbeFrame = Record<(typeof probeFrameKeys)[number], number[]> & {
  /** Column-major affine transform in native Source coordinates. */
  worldToLocalVolumeNormalized?: number[];
};
export type PackedProbeFrames = { values: Float32Array; rotations: Float32Array };

/** Six vec4s carry the same eight vec3s without std140 array padding. Rotated
 * volumes additionally retain their three affine rows; no extra sampler needed. */
export function packSourceProbeFrames(
  volumes: readonly SourceProbeFrame[],
): PackedProbeFrames | undefined {
  if (!volumes.some((volume) => volume.worldToLocalVolumeNormalized)) return undefined;
  const values = new Float32Array(volumes.length * 24);
  const rotations: number[] = [];
  for (const [index, volume] of volumes.entries()) {
    const matrix = volume.worldToLocalVolumeNormalized;
    if (
      !matrix ||
      matrix.length !== 16 ||
      !matrix.every(Number.isFinite) ||
      matrix[3] !== 0 ||
      matrix[7] !== 0 ||
      matrix[11] !== 0 ||
      matrix[15] !== 1
    )
      throw new Error("Native probe affine frame is missing or invalid");
    const determinant =
      matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) -
      matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) +
      matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2]);
    if (!Number.isFinite(determinant) || determinant === 0)
      throw new Error("Native probe affine frame is singular");
    for (const [frame, key] of probeFrameKeys.entries()) {
      if (volume[key].length !== 3 || !volume[key].every(Number.isFinite))
        throw new Error("Native probe frame dimensions are invalid");
      values.set(volume[key], index * 24 + frame * 3);
    }
    const rotated =
      [1, 2, 4, 6, 8, 9].some((element) => matrix[element] !== 0) ||
      [0, 5, 10].some((element) => matrix[element] <= 0);
    if (rotated) {
      // Positive scale is guaranteed for the ordinary diagonal path. A negative
      // first component therefore safely selects the separately packed matrix.
      values.set([-1, rotations.length / 12, 0], index * 24);
      for (let row = 0; row < 3; row++)
        rotations.push(matrix[row], matrix[4 + row], matrix[8 + row], matrix[12 + row]);
    } else {
      values.set(
        [matrix[0], matrix[5], matrix[10], matrix[12], matrix[13], matrix[14]],
        index * 24,
      );
    }
  }
  return { values, rotations: new Float32Array(rotations) };
}

export function sourceProbeUniformVectors(volumes: readonly SourceProbeFrame[]) {
  const packed = packSourceProbeFrames(volumes);
  return (
    (packed ? packed.values.length / 4 + packed.rotations.length / 4 : volumes.length * 8) + 128
  );
}
