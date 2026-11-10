import { expect, test } from "vitest";
import { nativeFogParameters } from "./native-map-fog";

test("height-disabled fog keeps a finite neutral height and independent 3D distance gate", () => {
  const p = nativeFogParameters({
    gradient: {
      distance: [384, 35000, 1],
      color: [58 / 255, 151 / 255, 209 / 255],
      opacity: 0.9,
      strength: 1,
    },
  });
  expect(p.gradientBiasScale.y).toBe(1);
  expect(p.gradientBiasScale.w).toBe(0);
  expect(p.gradientExponents.y).toBe(1);
  expect(p.gradientCull.toArray()).toEqual([384 ** 2, 1, 0]);
  for (const height of [-10000, 0, 100000])
    expect(p.gradientBiasScale.y + height * p.gradientBiasScale.w).toBe(1);
});

test("native fog rejects degenerate ranges, invalid colors and unbounded opacity", () => {
  for (const distance of [
    [0, 0, 1],
    [100, 20, 1],
    [0, 20, 0],
    [0, Infinity, 1],
  ] as [number, number, number][])
    expect(() =>
      nativeFogParameters({ gradient: { distance, color: [0, 0, 0], opacity: 1, strength: 1 } }),
    ).toThrow("distance");
  expect(() =>
    nativeFogParameters({
      gradient: { distance: [0, 20, 1], color: [NaN, 0, 0], opacity: 1, strength: 1 },
    }),
  ).toThrow("color");
  expect(() =>
    nativeFogParameters({
      gradient: { distance: [0, 20, 1], color: [0, 0, 0], opacity: 2, strength: 1 },
    }),
  ).toThrow("opacity");
});
