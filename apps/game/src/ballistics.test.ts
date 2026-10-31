import { test, expect } from "vitest";
import { ballistics, penetrate, rangeDamage } from "./ballistics";
test("AWP uses current imported weapon attributes and Source-unit range attenuation", () => {
  expect(ballistics[3]).toEqual({ damage: 115, power: 2.5, range: 8192, modifier: 0.99 });
  expect(rangeDamage(115, 12.7, 0.99)).toBeCloseTo(113.85);
});
test("body penetration retains damage, thin wood penetrates, thick cover stops", () => {
  const afterBody = penetrate(115, 2.5, 0.28, "flesh");
  expect(afterBody).toBeGreaterThan(80);
  expect(afterBody).toBeLessThan(100);
  expect(penetrate(115, 2.5, 0.12, "wood")).toBeGreaterThan(afterBody);
  expect(penetrate(115, 2.5, 3, "wood")).toBe(0);
  expect(penetrate(115, 2.5, 1, "concrete")).toBe(0);
});
