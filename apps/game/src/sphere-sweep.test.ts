import { expect, test } from "vitest";
import { Vector3 } from "three";
import { sweepSphereTriangle } from "./sphere-sweep";

const point = new Float32Array(9);
const face = new Float32Array([-2, 0, -2, 2, 0, -2, 0, 0, 2]);

test("sphere contacts include both displacement endpoints and leave separating normals alone", () => {
  const normal = new Vector3(7, 8, 9);
  expect(sweepSphereTriangle(new Vector3(0, 2, 0), new Vector3(0, -1, 0), 1, face, 0, normal)).toBe(
    1,
  );
  expect(normal.toArray()).toEqual([0, 1, 0]);
  expect(sweepSphereTriangle(new Vector3(0, 1, 0), new Vector3(0, -1, 0), 1, face, 0, normal)).toBe(
    0,
  );
  normal.set(7, 8, 9);
  expect(sweepSphereTriangle(new Vector3(0, 1, 0), new Vector3(0, 1, 0), 1, face, 0, normal)).toBe(
    Infinity,
  );
  expect(normal.toArray()).toEqual([7, 8, 9]);
});

test("zero-length triangle edges retain spherical vertex contacts and reject pure tangency", () => {
  const normal = new Vector3(7, 8, 9);
  expect(
    sweepSphereTriangle(new Vector3(0, 2, 0), new Vector3(0, -2, 0), 1, point, 0, normal),
  ).toBe(0.5);
  expect(normal.toArray()).toEqual([0, 1, 0]);
  normal.set(7, 8, 9);
  expect(
    sweepSphereTriangle(new Vector3(-1, 1, 0), new Vector3(2, 0, 0), 1, point, 0, normal),
  ).toBe(Infinity);
  expect(normal.toArray()).toEqual([7, 8, 9]);
  expect(sweepSphereTriangle(new Vector3(0, 2, 0), new Vector3(), 1, point, 0, normal)).toBe(
    Infinity,
  );
  expect(normal.toArray()).toEqual([7, 8, 9]);
});

test("face contacts respect vertex offsets and either triangle winding", () => {
  const normal = new Vector3();
  for (const vertices of [
    new Float32Array([99, ...face]),
    new Float32Array([99, ...face.slice(0, 3), ...face.slice(6, 9), ...face.slice(3, 6)]),
  ]) {
    expect(
      sweepSphereTriangle(new Vector3(0, 2, 0), new Vector3(0, -2, 0), 1, vertices, 1, normal),
    ).toBe(0.5);
    expect(normal.toArray()).toEqual([0, 1, 0]);
    expect(
      sweepSphereTriangle(new Vector3(0, -2, 0), new Vector3(0, 2, 0), 1, vertices, 1, normal),
    ).toBe(0.5);
    expect(normal.toArray()).toEqual([0, -1, 0]);
  }
});

test("contact output preserves existing behavior when it aliases an input vector", () => {
  const from = new Vector3(0, 2, 0);
  const delta = new Vector3(0, -2, 0);
  expect(sweepSphereTriangle(from, delta, 1, face, 0, from)).toBe(0.27639320225002095);
  expect(from.toArray()).toEqual([-0.8, 0.4472135954999581, -0.3999999999999999]);
  expect(delta.toArray()).toEqual([0, -2, 0]);

  from.set(0, 2, 0);
  expect(sweepSphereTriangle(from, delta, 1, face, 0, delta)).toBe(0.5);
  expect(from.toArray()).toEqual([0, 2, 0]);
  expect(delta.toArray()).toEqual([0, 1, 0]);
});
