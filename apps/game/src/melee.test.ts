import { describe, expect, it } from "vitest";
import { knifeBackstab, knifeDamage, knifeRange, REVOLVER_COCK_TIME } from "./melee";
import { applyArmorDamage } from "./damage";
describe("knife combat", () => {
  it("distinguishes recovered, repeated, heavy and rear attacks with armor", () => {
    for (const [stab, first, back, raw, armored] of [
      [false, true, false, 40, 34],
      [false, false, false, 25, 21],
      [true, true, false, 65, 55],
      [false, false, true, 90, 76],
      [true, false, true, 180, 153],
    ] as const) {
      expect(knifeDamage(stab, first, back)).toBe(raw);
      expect(Math.floor(applyArmorDamage(raw, "chest", 100, true, 1.7).healthDamage)).toBe(armored);
    }
  });
  it("rotates the rear cone with the victim and rejects front and sides", () => {
    const target = { x: 0, z: 0 };
    expect(knifeBackstab({ x: 0, z: -1 }, target, 0)).toBe(true);
    expect(knifeBackstab({ x: 0, z: 1 }, target, 0)).toBe(false);
    expect(knifeBackstab({ x: 1, z: 0 }, target, 0)).toBe(false);
    expect(knifeBackstab({ x: -1, z: 0 }, target, Math.PI / 2)).toBe(true);
  });
  it("keeps heavy attacks shorter and cocking independent of render rate", () => {
    expect(knifeRange(true)).toBeCloseTo(0.8128);
    expect(knifeRange(false)).toBeCloseTo(1.2192);
    expect(REVOLVER_COCK_TIME * 128).toBe(30);
  });
});
