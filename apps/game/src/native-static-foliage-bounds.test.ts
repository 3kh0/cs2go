import * as T from "three";
import { expect, test } from "vitest";
import { createStaticFoliageBounds } from "./native-static-foliage-bounds";

test("static coverage and partitioned color retain independent drawn bounds", () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [-1, -1, -5, 1, -1, -5, 0, 1, -5, 99, -1, -5, 101, -1, -5, 100, 1, -5],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 3, 4, 5]);
  const coverage = new T.Mesh(geometry);
  const partition = geometry.clone();
  partition.setIndex([3, 4, 5]);
  const color = new T.Mesh(partition);
  const root = new T.Group();
  root.add(color, coverage);
  root.updateMatrixWorld(true);
  const update = createStaticFoliageBounds();
  update(root);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 200);
  camera.updateMatrixWorld(true);
  const frustum = new T.Frustum().setFromProjectionMatrix(camera.projectionMatrix);
  expect(frustum.intersectsObject(coverage)).toBe(true);
  expect(frustum.intersectsObject(color)).toBe(false);
  // A changed partition becomes visible without a stale cached sphere.
  color.geometry = geometry;
  update(root);
  expect(frustum.intersectsObject(color)).toBe(true);
  color.matrixWorld.makeShear(1, 0, 0, 0, 0, 0);
  update(root);
  expect(color.frustumCulled).toBe(false);
});
