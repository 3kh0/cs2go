import * as T from "three";
import { expect, test } from "vitest";
import {
  createSourceProbeSelection,
  sourceProbeBounds,
  updateSourceProbeSelection,
} from "./source-probe-selection";
import type { SourceProbeFrame } from "./source-probe-frames";

test("probe support includes the entire skin around rotated and scaled volumes", () => {
  const localToSource = new T.Matrix4().compose(
    new T.Vector3(150, -300, 12000),
    new T.Quaternion().setFromEuler(new T.Euler(0.3, 0.7, -0.2)),
    new T.Vector3(100, 200, 150),
  );
  const source = {
    normalizedScale: [1, 1, 1],
    normalizedOffset: [0, 0, 0],
    inverseEdge: [10, 10, 10],
    normalizedSkin: [0.2, 0.1, 0.3],
    atlasScale: [1, 1, 1],
    atlasOffset: [0, 0, 0],
    borderMin: [0, 0, 0],
    borderMax: [1, 1, 1],
    worldToLocalVolumeNormalized: localToSource.clone().invert().toArray(),
  } satisfies SourceProbeFrame;
  const bounds = sourceProbeBounds([source, { ...source, inverseEdge: [0, 1, 1] }]);
  const point = new T.Vector3();
  for (let x = -0.2; x <= 1.2; x += 0.1)
    for (let y = -0.1; y <= 1.1; y += 0.1)
      for (let z = -0.3; z <= 1.3; z += 0.1) {
        point.set(x, y, z).applyMatrix4(localToSource);
        point.set(point.x * 0.0254, point.z * 0.0254, -point.y * 0.0254);
        expect(bounds[0].containsPoint(point)).toBe(true);
      }
  const selection = createSourceProbeSelection(2);
  const far = new T.Box3().setFromCenterAndSize(
    new T.Vector3(10000, 10000, 10000),
    new T.Vector3(1, 1, 1),
  );
  updateSourceProbeSelection(selection, bounds, far);
  expect(selection.count.value).toBe(1);
  expect(selection.indices.value[0]).toBe(1);
  updateSourceProbeSelection(selection, bounds, bounds[0]);
  expect(selection.count.value).toBe(2);
  expect([...selection.indices.value]).toEqual([0, 1]);
});
