import { expect, test } from "vitest";
import * as T from "three";
import { createEnvironmentWorldFrame } from "./native-environment-frame";

test.each([1, 16])(
  "own-world frame undoes translated rotated scale%s sky placement without changing normal length",
  (scale) => {
    const origin = new T.Vector3(9, -3, 5),
      reference = new T.Vector3(30, 12, -7),
      rotation = new T.Quaternion().setFromEuler(new T.Euler(0.2, 0.6, -0.1));
    const placement = new T.Matrix4()
      .makeTranslation(...reference.toArray())
      .multiply(new T.Matrix4().makeRotationFromQuaternion(rotation))
      .multiply(new T.Matrix4().makeScale(scale, scale, scale))
      .multiply(new T.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
    const frame = createEnvironmentWorldFrame(placement.clone().invert()),
      nativePoint = new T.Vector3(0.25, 2, -4),
      worldPoint = nativePoint.clone().applyMatrix4(placement);
    expect(
      worldPoint.clone().applyMatrix4(frame.worldToNative).distanceTo(nativePoint),
    ).toBeLessThan(1e-10);
    expect(frame.unitScale).toBeCloseTo(scale, 12);
    const sourceNormal = new T.Vector3(0.3, 0.4, 0.2),
      worldNormal = sourceNormal.clone().applyQuaternion(rotation);
    expect(
      worldNormal.clone().applyMatrix3(frame.worldToNativeNormal).distanceTo(sourceNormal),
    ).toBeLessThan(1e-12);
    expect(
      sourceNormal.clone().applyMatrix3(frame.nativeToWorldNormal).distanceTo(worldNormal),
    ).toBeLessThan(1e-12);
    expect(worldNormal.clone().applyMatrix3(frame.worldToNativeNormal).length()).toBeCloseTo(
      sourceNormal.length(),
      12,
    );
  },
);
test("main-world identity stays exact and unsupported nonuniform shears are rejected", () => {
  const frame = createEnvironmentWorldFrame();
  expect(frame.unitScale).toBe(1);
  expect(frame.worldToNative.equals(new T.Matrix4())).toBe(true);
  expect(() => createEnvironmentWorldFrame(new T.Matrix4().makeScale(0.5, 0.25, 0.5))).toThrow(
    "uniform similarity",
  );
  expect(() => createEnvironmentWorldFrame(new T.Matrix4().makeScale(0, 0, 0))).toThrow(
    "uniform similarity",
  );
  expect(() => createEnvironmentWorldFrame(new T.Matrix4().makeScale(-1, 1, 1))).toThrow(
    "uniform similarity",
  );
});
