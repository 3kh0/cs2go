import { expect, test } from "vitest";
import * as T from "three";
import {
  nativeWaterBrowserViewRow,
  nativeWaterReflectionNormal,
} from "./native-water-reflection-normal";
const close = (actual: T.Vector3, expected: number[]) =>
  expect(actual.distanceTo(new T.Vector3(...expected).normalize())).toBeLessThan(1e-12);
test("native reflection amplification uses source XY6 and view YZ2 in the proved order", () => {
  close(nativeWaterReflectionNormal(new T.Vector3(1, 1, 1), new T.Matrix4()), [3, 6, 1]);
  close(
    nativeWaterReflectionNormal(new T.Vector3(1, 1, 1), new T.Matrix4().makeRotationZ(Math.PI / 2)),
    [6, 3, 1],
  );
  close(
    nativeWaterReflectionNormal(
      new T.Vector3(0.2, 0.1, 1),
      new T.Matrix4().makeRotationZ(Math.PI / 4),
    ),
    [0.75, 0.15, 1],
  );
  const direct = new T.Vector3(0.2, 0.1, 1).normalize(),
    correct = nativeWaterReflectionNormal(direct, new T.Matrix4().makeRotationZ(Math.PI / 4));
  expect(correct.distanceTo(direct)).toBeGreaterThan(0.3);
  expect(
    correct.distanceTo(
      nativeWaterReflectionNormal(direct, new T.Matrix4().makeRotationZ(-Math.PI / 4)),
    ),
  ).toBeGreaterThan(0.3);
});
test("normal transport ignores view translation and rejects projection or scaled frames", () => {
  const row = new T.Matrix4().makeRotationZ(0.7),
    normal = new T.Vector3(0.2, 0.3, 1),
    base = nativeWaterReflectionNormal(normal, row);
  row.elements[3] = 12000;
  row.elements[7] = -900;
  row.elements[11] = 450;
  expect(nativeWaterReflectionNormal(normal, row).equals(base)).toBe(true);
  expect(() => nativeWaterReflectionNormal(new T.Vector3(), row)).toThrow("normal is invalid");
  expect(() => nativeWaterReflectionNormal(normal, new T.Matrix4().makeScale(2, 2, 2))).toThrow(
    "orthonormal",
  );
  const camera = new T.PerspectiveCamera(65, 1, 0.1, 100);
  expect(() => nativeWaterReflectionNormal(normal, camera.projectionMatrix)).toThrow("orthonormal");
});
test("browser normal frame equals the existing Source-unit row bridge without origin or scale leakage", () => {
  const camera = new T.PerspectiveCamera(65, 1, 0.1, 100);
  camera.position.set(8, 3, -5);
  camera.lookAt(-2, 1, 4);
  camera.updateMatrixWorld(true);
  const sourceToBrowser = new T.Matrix4().set(
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
    ),
    old = new T.Matrix4()
      .makeScale(1 / 0.0254, 1 / 0.0254, 1 / 0.0254)
      .multiply(camera.matrixWorldInverse)
      .multiply(sourceToBrowser)
      .transpose();
  const normal = new T.Vector3(0.17, -0.23, 1);
  expect(
    nativeWaterReflectionNormal(normal, old).distanceTo(
      nativeWaterReflectionNormal(normal, nativeWaterBrowserViewRow(camera.matrixWorldInverse)),
    ),
  ).toBeLessThan(1e-12);
});
