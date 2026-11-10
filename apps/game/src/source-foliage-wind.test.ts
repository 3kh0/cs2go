import { expect, test } from "vitest";
import * as T from "three";
import { createSourceFoliageSway } from "./source-foliage-wind";
const parameters = {
  swayAmount: 0.3,
  swaySpeed: 0.5,
  swayNoiseScale: 0.916,
  swayFalloff: 2.867,
  flutterAmount: 0.15,
  flutterSpeed: 1.44,
  flutterNoiseScale: 1.644,
  flutterFalloff: 3.4,
};
test("wind has no invented engine direction strength or time and requires a real volume", () => {
  const noise = new T.Data3DTexture(new Uint8Array(8 * 4), 2, 2, 2);
  noise.colorSpace = T.NoColorSpace;
  const state = { direction: [0, -1, 0] as const, strength: 0.5, timeSeconds: 0 };
  const wind = createSourceFoliageSway(parameters, state, noise);
  wind.update(3);
  expect(wind.uniforms.sourceFoliageTime.value).toBe(3);
  expect(() => wind.update(NaN)).toThrow("shader time");
  expect(() => createSourceFoliageSway(parameters, { ...state, strength: NaN }, noise)).toThrow(
    "Unresolved",
  );
  noise.colorSpace = T.SRGBColorSpace;
  expect(() => createSourceFoliageSway(parameters, state, noise)).toThrow(
    "linear three-dimensional",
  );
});
