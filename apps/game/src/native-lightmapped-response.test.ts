import { expect, test } from "vitest";
import { LIGHTMAPPED_ALPHA_EPSILON, lightmappedOpacity } from "./native-lightmapped-response";

test("native parking opacity squares the interpolated alpha and retains reference subtraction", () => {
  // Sealed native material pipeline vector, not a result computed by this helper.
  const result = lightmappedOpacity(0.8, 0.5270588546991348, 1, 0.01);
  expect(result.discarded).toBe(false);
  expect(result.alpha).toBeCloseTo(0.21223282905341098, 14);
  expect(lightmappedOpacity(1, 0.5, 1, 0.01).alpha).toBe(0.24);
});
test("native overlay clipping uses the reference-subtracted epsilon with strict rejection", () => {
  expect(lightmappedOpacity(0.01, 1, 1, 0.01).discarded).toBe(true);
  expect(lightmappedOpacity(0.0105, 1, 1, 0.01).discarded).toBe(true);
  expect(lightmappedOpacity(0.012, 1, 1, 0.01).discarded).toBe(false);
  expect(lightmappedOpacity(0.01 + LIGHTMAPPED_ALPHA_EPSILON, 1, 1, 0.01).discarded).toBe(false);
});
