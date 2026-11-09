import { expect, test } from "vitest";
import {
  dustFade,
  dustForceCurve,
  particleBias,
  particleCurve,
  particleDrag,
} from "./home-particle-operators";

test("native drag is authored per 30Hz step and preserves the same one-second decay at 60Hz", () => {
  expect(particleDrag(0.3, 1 / 30)).toBeCloseTo(0.7, 12);
  expect(particleDrag(0.3, 1 / 60) ** 60).toBeCloseTo(0.7 ** 30, 12);
  expect(particleDrag(0, 1)).toBe(1);
});

test("dust reaches full opacity halfway through its life rather than after half a second", () => {
  expect(dustFade(0.5, 10)).toBeCloseTo(0.1);
  expect(dustFade(5, 10)).toBe(1);
  expect(dustFade(9.5, 10)).toBeCloseTo(0.1);
  expect(dustFade(10, 10)).toBe(0);
});

test("authored force knots preserve their values and domain-space derivative", () => {
  expect(particleCurve(-1, dustForceCurve)).toBe(1.35);
  expect(particleCurve(2, dustForceCurve)).toBe(0.25);
  const x = 0.474514,
    epsilon = 0.000001;
  expect(particleCurve(x, dustForceCurve)).toBeCloseTo(1.076584, 10);
  expect(
    (particleCurve(x + epsilon, dustForceCurve) - particleCurve(x - epsilon, dustForceCurve)) /
      (2 * epsilon),
  ).toBeCloseTo(-1.067879, 4);
  expect(particleBias(0.5, -0.68)).toBeCloseTo(0.16);
});
