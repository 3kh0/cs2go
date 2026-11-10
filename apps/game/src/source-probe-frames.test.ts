import { expect, test } from "vitest";
import * as T from "three";
import {
  packSourceProbeFrames,
  probeFrameKeys,
  sourceProbeUniformVectors,
  type SourceProbeFrame,
} from "./source-probe-frames";

function volume(matrix?: number[]): SourceProbeFrame {
  return {
    normalizedScale: [0.05, 0.025, 1 / 60],
    normalizedOffset: [-4.5, -4.5, -4.5],
    inverseEdge: [2, 3, 4],
    normalizedSkin: [0.005, 0.0025, 0.001],
    atlasScale: [0.25, 0.5, 0.125],
    atlasOffset: [0.125, 0.25, 0.5],
    borderMin: [0.01, 0.02, 0.03],
    borderMax: [0.99, 0.98, 0.97],
    worldToLocalVolumeNormalized: matrix,
  };
}

test("rotated native probe corners retain full affine sampling and every packed frame float", () => {
  // Source coordinates: 90-degree yaw, translated authored local box.
  const world = new T.Matrix4()
    .makeTranslation(100, 200, 300)
    .multiply(new T.Matrix4().makeRotationZ(Math.PI / 2));
  const normalized = new T.Matrix4()
    .makeScale(0.05, 0.025, 1 / 60)
    .multiply(new T.Matrix4().makeTranslation(10, 20, 30))
    .multiply(world.clone().invert());
  const native = volume(normalized.toArray());
  const packed = packSourceProbeFrames([native])!;
  expect(packed.values.length).toBe(24);
  expect(packed.rotations.length).toBe(12);
  for (let frame = 1; frame < 8; frame++)
    expect(Array.from(packed.values.slice(frame * 3, frame * 3 + 3))).toEqual(
      Array.from(new Float32Array(native[probeFrameKeys[frame]])),
    );
  for (const [local, expected] of [
    [new T.Vector3(-10, -20, -30), [0, 0, 0]],
    [new T.Vector3(10, 20, 30), [1, 1, 1]],
    [new T.Vector3(0, 0, 0), [0.5, 0.5, 0.5]],
  ] as const) {
    const point = local.clone().applyMatrix4(world).toArray();
    const sampled = [0, 1, 2].map((row) =>
      point.reduce(
        (sum, value, column) => sum + packed.rotations[row * 4 + column] * value,
        packed.rotations[row * 4 + 3],
      ),
    );
    sampled.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 5));
  }
});

test("new large map frames fit 1024 vectors without an additional texture sampler", () => {
  const diagonal = new T.Matrix4().makeScale(0.05, 0.025, 1 / 60).toArray();
  const rotated = new T.Matrix4().makeRotationZ(Math.PI / 4).toArray();
  const volumes = Array.from({ length: 118 }, (_, index) =>
    volume(index < 14 ? rotated : diagonal),
  );
  expect(sourceProbeUniformVectors(volumes)).toBe(878);
  const packed = packSourceProbeFrames(volumes)!;
  expect(packed.rotations.length).toBe(14 * 12);
  expect(Array.from(packed.values.slice(13 * 24, 13 * 24 + 3))).toEqual([-1, 13, 0]);
  expect(Array.from(packed.values.slice(14 * 24, 14 * 24 + 3))).toEqual(
    Array.from(new Float32Array([0.05, 0.025, 1 / 60])),
  );
});

test("legacy probe frames retain their shader path and invalid new transforms fail", () => {
  expect(packSourceProbeFrames([volume()])).toBeUndefined();
  expect(sourceProbeUniformVectors([volume()])).toBe(136);
  expect(() => packSourceProbeFrames([volume(Array.from({ length: 16 }, () => 0))])).toThrow(
    /affine/,
  );
  const matrix = new T.Matrix4().toArray();
  matrix[0] = 0;
  expect(() => packSourceProbeFrames([volume(matrix)])).toThrow(/singular/);
  expect(() => packSourceProbeFrames([volume(new T.Matrix4().toArray()), volume()])).toThrow(
    /missing/,
  );
});
