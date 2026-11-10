import { expect, test } from "vitest";
import * as T from "three";
import {
  waterSSRProjectionFromBrowser,
  fountainWaterSourceSha256,
  fountainWaterProgramSha256,
} from "./native-water-ssr";
import { nativeWaterConstants, isNativeFountainWater } from "./native-water-shader";
import { nativeWaterSource } from "../tests/native-water-source-fixture";
test("SSR view bridge matches world projection for translated rotated cameras", () => {
  for (const [position, target, fov, near, far] of [
    [[3, 5, 7], [0, 0, 0], 73, 0.05, 250],
    [[-8, 2, 1], [4, -3, 9], 45, 0.1, 1000],
    [[0, 8, -3], [1, -2, 4], 95, 0.5, 50],
  ] as const) {
    const camera = new T.PerspectiveCamera(fov, 1.6, near, far);
    camera.position.fromArray(position);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateMatrixWorld();
    for (const view of [
      new T.Vector3(0.1, 0.2, -near * 2),
      new T.Vector3(-1, 1, -far * 0.5),
      new T.Vector3(0, 0, -far),
    ]) {
      const expected = view.clone().applyMatrix4(camera.matrixWorld).project(camera),
        actual = new T.Vector4(
          -view.x / 0.0254,
          -view.y / 0.0254,
          -view.z / 0.0254,
          1,
        ).applyMatrix4(waterSSRProjectionFromBrowser(camera.projectionMatrix));
      expect(actual.x / actual.w).toBeCloseTo(expected.x, 10);
      expect(-actual.y / actual.w).toBeCloseTo(expected.y, 10);
      expect(actual.z / actual.w).toBeCloseTo(expected.z, 10);
    }
  }
});
test("native rational depth bridge reconstructs source-unit view Z near/far", () => {
  for (const [near, far] of [
    [0.05, 250],
    [0.5, 50],
    [0.1, 1000],
  ]) {
    const camera = new T.PerspectiveCamera(65, 1.6, near, far);
    for (const distance of [near, near * 2, Math.sqrt(near * far), far]) {
      const clip = new T.Vector4(0, 0, -distance, 1).applyMatrix4(camera.projectionMatrix),
        depth = (clip.z / clip.w) * 0.5 + 0.5,
        decoded = 1 / ((0.0254 / near - 0.0254 / far) * depth - 0.0254 / near);
      expect(decoded).toBeCloseTo(-distance / 0.0254, 5);
    }
  }
});
test("reflection2 requires exact installed fountain selection, not generic widening", () => {
  const source = structuredClone(nativeWaterSource);
  source.IntParams.F_REFLECTION_TYPE = 2;
  expect(() => nativeWaterConstants(source)).toThrow("Unsupported");
  Object.assign(source, {
    selectedContract: "inferno-fountain-860-d2",
    nativeResource: "materials/liquids/inferno_fountain.vmat",
    nativeSourceSha256: fountainWaterSourceSha256,
    nativeSelectedProgramSha256: fountainWaterProgramSha256,
  });
  source.resolvedMaterialInputs.g_nSSRMaxForwardSteps = 32;
  expect(isNativeFountainWater(source)).toBe(true);
  for (const change of [
    { nativeSourceSha256: "wrong" },
    { nativeSelectedProgramSha256: "wrong" },
    { nativeResource: "materials/other.vmat" },
  ])
    expect(isNativeFountainWater({ ...source, ...change })).toBe(false);
});
