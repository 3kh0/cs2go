import { expect, it } from "vitest";
import * as T from "three";
import { createSourceFoliageAdvancedWind } from "./source-foliage-advanced-wind";
it("requires two independently resolved native fields and explicit engine state", () => {
  const noise = new T.Data3DTexture(new Uint8Array(32), 2, 2, 2);
  noise.colorSpace = T.NoColorSpace;
  const fields = [
    { strength: 2, scale: [1, 1, 1], speed: [0.5, 0, 0], falloff: 1 },
    { strength: 3, scale: [1, 1, 1], speed: [0, 0.5, 0], falloff: 2 },
  ] as const;
  const state = { direction: [1, 0, 0] as const, strength: 1, timeSeconds: 0 };
  const wind = createSourceFoliageAdvancedWind(fields, true, state, noise);
  expect(wind.uniforms.sourceFoliageNoise1.value.toArray()).toEqual([2, 1]);
  expect(wind.uniforms.sourceFoliageNoise2.value.toArray()).toEqual([3, 2]);
  wind.update(2);
  expect(wind.uniforms.sourceFoliageTime.value).toBe(2);
  expect(() => wind.update(NaN)).toThrow(/clock/);
  expect(() =>
    createSourceFoliageAdvancedWind(fields, true, { ...state, strength: NaN }, noise),
  ).toThrow(/engine\/noise/);
  noise.colorSpace = T.SRGBColorSpace;
  expect(() => createSourceFoliageAdvancedWind(fields, true, state, noise)).toThrow(
    /engine\/noise/,
  );
});
