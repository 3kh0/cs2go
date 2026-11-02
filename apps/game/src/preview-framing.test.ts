import { expect, test } from "vitest";
import * as T from "three";
import { framePreview, previewBounds } from "./preview-framing";

test("asymmetric long weapons and low boots fit portrait and landscape stages", () => {
  const box = new T.Box3(new T.Vector3(-0.5, -0.18, -0.4), new T.Vector3(1.3, 1.95, 0.5));
  const camera = new T.PerspectiveCamera(33, 1, 0.05, 20);
  camera.position.set(0, 1.05, 3.7);
  camera.lookAt(0, 0.96, 0);
  const orientation = camera.quaternion.clone();
  for (const aspect of [0.3, 0.55, 1, 2]) {
    framePreview(camera, box, aspect);
    expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
    for (let corner = 0; corner < 8; corner++) {
      const point = new T.Vector3(
        corner & 1 ? box.max.x : box.min.x,
        corner & 2 ? box.max.y : box.min.y,
        corner & 4 ? box.max.z : box.min.z,
      ).project(camera);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(0.880001);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(0.880001);
      expect(Math.abs(point.z)).toBeLessThan(1);
    }
  }
});

test("hidden cached models cannot shrink the visible preview", () => {
  const root = new T.Group(),
    geometry = new T.BoxGeometry(1, 2, 1);
  const visible = new T.Mesh(geometry);
  visible.position.y = 1;
  root.add(visible);
  const hidden = new T.Group();
  hidden.visible = false;
  root.add(hidden);
  hidden.add(new T.Mesh(new T.BoxGeometry(100, 100, 100)));
  const bounds = previewBounds([root]);
  expect(bounds.min.toArray()).toEqual([-0.5, 0, -0.5]);
  expect(bounds.max.toArray()).toEqual([0.5, 2, 0.5]);
});
