import { expect, it } from "vitest";
import * as T from "three";
import { rayCapsule } from "./soldier-hitboxes";

const start = new T.Vector3(0, -1, 0);
const end = new T.Vector3(0, 1, 0);
it("traces capsule body, endcaps, misses and origins inside the volume", () => {
  expect(
    rayCapsule(new T.Ray(new T.Vector3(0, 0, 5), new T.Vector3(0, 0, -1)), start, end, 0.5),
  ).toBeCloseTo(4.5);
  expect(
    rayCapsule(new T.Ray(new T.Vector3(0, 5, 0), new T.Vector3(0, -1, 0)), start, end, 0.5),
  ).toBeCloseTo(3.5);
  expect(
    rayCapsule(new T.Ray(new T.Vector3(0.51, 5, 0), new T.Vector3(0, -1, 0)), start, end, 0.5),
  ).toBe(Infinity);
  expect(rayCapsule(new T.Ray(new T.Vector3(), new T.Vector3(1, 0, 0)), start, end, 0.5)).toBe(0);
  expect(
    rayCapsule(new T.Ray(new T.Vector3(0, 0, 5), new T.Vector3(0, 0, 1)), start, end, 0.5),
  ).toBe(Infinity);
});
it("is invariant under rotations and handles a capsule collapsed to a sphere", () => {
  const rotation = new T.Quaternion().setFromEuler(new T.Euler(0.7, 1.4, -0.5));
  const ray = new T.Ray(
    new T.Vector3(0, 0, 5).applyQuaternion(rotation),
    new T.Vector3(0, 0, -1).applyQuaternion(rotation),
  );
  expect(
    rayCapsule(
      ray,
      start.clone().applyQuaternion(rotation),
      end.clone().applyQuaternion(rotation),
      0.5,
    ),
  ).toBeCloseTo(4.5);
  expect(rayCapsule(ray, new T.Vector3(), new T.Vector3(), 0.5)).toBeCloseTo(4.5);
});
