import { expect, test } from "vitest";
import * as T from "three";
import {
  applyViewmodelCamera,
  readViewmodelSettings,
  viewmodelDefaults,
  viewmodelPointToWorld,
  viewmodelVerticalFov,
} from "./viewmodel-settings";
test("saved viewmodel controls clamp invalid values and retain independent aspect selection", () => {
  expect(
    readViewmodelSettings({
      viewmodelFov: 999,
      viewmodelOffsetX: -99,
      viewmodelOffsetY: Infinity,
      viewmodelOffsetZ: NaN,
      viewmodelAspect: "4:3",
    }),
  ).toEqual({
    ...viewmodelDefaults,
    viewmodelFov: 68,
    viewmodelOffsetX: -2,
    viewmodelAspect: "4:3",
  });
  expect(readViewmodelSettings({ viewmodelAspect: "constructor" })).toEqual(viewmodelDefaults);
});
test("native horizontal lens and stretched aspect preserve barrel screen alignment", () => {
  const view = new T.PerspectiveCamera(),
    world = new T.PerspectiveCamera(95, 16 / 9, 0.08, 400);
  world.position.set(5, 2, 9);
  world.rotation.set(0.12, 0.8, 0);
  world.updateMatrixWorld(true);
  for (const aspect of ["16:9", "16:10", "4:3", "5:4"] as const) {
    applyViewmodelCamera(view, 1920, 1080, {
      ...viewmodelDefaults,
      viewmodelFov: 68,
      viewmodelAspect: aspect,
    });
    const point = new T.Vector3(0.2, -0.15, -0.7);
    const expected = point.clone().project(view);
    const result = viewmodelPointToWorld(point.clone(), view, world).project(world);
    expect(result.x).toBeCloseTo(expected.x, 9);
    expect(result.y).toBeCloseTo(expected.y, 9);
  }
  expect(viewmodelVerticalFov(68)).toBeCloseTo(53.667998865, 9);
  const settings = {
    ...viewmodelDefaults,
    viewmodelOffsetX: 0,
    viewmodelOffsetY: 0,
    viewmodelOffsetZ: 0,
  };
  applyViewmodelCamera(view, 1920, 1080, settings);
  const normal = new T.Vector3(0.2, 0, -1).project(view).x;
  applyViewmodelCamera(view, 1920, 1080, { ...settings, viewmodelAspect: "4:3" });
  expect(new T.Vector3(0.2, 0, -1).project(view).x / normal).toBeCloseTo(4 / 3, 9);
});
