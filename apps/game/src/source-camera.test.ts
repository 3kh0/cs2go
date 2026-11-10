import { expect, test } from "vitest";
import * as T from "three";
import { sourceVerticalFov, sourceZoomRatio } from "./source-camera";

test("Source90 places the 4:3 horizontal edge at45degrees and expands only width on widescreen", () => {
  const edge = new T.Vector3(1, 0, -1);
  const reference = new T.PerspectiveCamera(sourceVerticalFov(90), 4 / 3);
  const wide = new T.PerspectiveCamera(sourceVerticalFov(90), 16 / 9);
  expect(edge.clone().project(reference).x).toBeCloseTo(1, 10);
  expect(edge.clone().project(wide).x).toBeCloseTo(0.75, 10);
  expect(new T.Vector3(0, 0.75, -1).project(reference).y).toBeCloseTo(1, 10);
  expect(new T.Vector3(0, 0.75, -1).project(wide).y).toBeCloseTo(1, 10);
});

test("scope magnification and mouse scaling use the same converted lens", () => {
  for (const baseline of [75, 90, 110]) {
    expect(sourceZoomRatio(sourceVerticalFov(baseline), baseline)).toBeCloseTo(1, 12);
    for (const scope of [40, 10]) {
      const ratio = Math.tan((scope * Math.PI) / 360) / Math.tan((baseline * Math.PI) / 360);
      expect(sourceZoomRatio(sourceVerticalFov(scope), baseline)).toBeCloseTo(ratio, 12);
    }
  }
});
