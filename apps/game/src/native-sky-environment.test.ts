import { expect, test } from "vitest";
import * as T from "three";
import { nativeSkyPanorama } from "./native-sky-environment";

test("panorama keeps existing zero-angle alignment and applies native yaw and linear radiance once", () => {
  const legacy = nativeSkyPanorama();
  expect(new T.Vector3(1, 0, 0).applyMatrix4(legacy.rotation).x).toBeCloseTo(-1);
  const native = nativeSkyPanorama({ angles: [0, 90, 0], brightness: 4, tint: [1, 0.5, 0.25] });
  const direction = new T.Vector3(1, 0, 0).applyMatrix4(native.rotation);
  expect(direction.x).toBeCloseTo(0);
  expect(direction.z).toBeCloseTo(1);
  expect(native.color.toArray()).toEqual([4, 2, 1]);
});
test("native pitch rotates about negative browser Z and malformed environments fail", () => {
  const native = nativeSkyPanorama({ angles: [90, 0, 0], brightness: 1, tint: [1, 1, 1] });
  const direction = new T.Vector3(1, 0, 0).applyMatrix4(native.rotation);
  expect(direction.y).toBeCloseTo(1);
  expect(() =>
    nativeSkyPanorama({ angles: [0, NaN, 0], brightness: 1, tint: [1, 1, 1] }),
  ).toThrow();
  expect(() =>
    nativeSkyPanorama({ angles: [0, 0, 0], brightness: Infinity, tint: [1, 1, 1] }),
  ).toThrow();
});
