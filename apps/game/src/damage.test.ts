import { describe, expect, it } from "vitest";
import { applyArmorDamage, friendlyFireScale, hitRegionMultiplier } from "./damage";
import { weapons } from "./physics";

describe("shared player and bot armor", () => {
  it("makes a close AK helmet headshot lethal and an M4 helmet headshot survivable", () => {
    const shot = (id: number) => {
      const w = weapons[id]!;
      return applyArmorDamage(w.damage * w.head, "head", 100, true, w.armorRatio);
    };
    expect(shot(0).healthDamage).toBeCloseTo(111.6);
    expect(shot(9).healthDamage).toBeCloseTo(92.4);
    expect(shot(1).healthDamage).toBeLessThan(100);
  });
  it("requires a helmet for head protection and never protects legs", () => {
    expect(applyArmorDamage(140, "head", 100, false, 1).healthDamage).toBe(140);
    expect(applyArmorDamage(26.25, "leg", 100, true, 1)).toEqual({
      healthDamage: 26.25,
      armorDamage: 0,
      armor: 100,
    });
    expect(hitRegionMultiplier("stomach")).toBe(1.25);
    expect(hitRegionMultiplier("leg")).toBe(0.75);
  });
  it("spends armor according to the weapon penetration ratio and handles exhaustion", () => {
    const hit = applyArmorDamage(36, "chest", 100, true, 1.55);
    expect(hit.healthDamage).toBeCloseTo(27.9);
    expect(hit.armorDamage).toBeCloseTo(4.05);
    expect(hit.armor).toBeCloseTo(95.95);
    expect(applyArmorDamage(36, "chest", 2, true, 1.55)).toEqual({
      healthDamage: 32,
      armorDamage: 2,
      armor: 0,
    });
    expect(applyArmorDamage(36, "chest", 0, true, 1.55).healthDamage).toBe(36);
    expect(applyArmorDamage(30, "chest", 100, true, 2).healthDamage).toBe(30);
  });
  it("uses mode-specific friendly fire reductions", () => {
    expect(friendlyFireScale("casual", "bullet")).toBe(0);
    expect(friendlyFireScale("competitive", "bullet")).toBe(0.33);
    expect(friendlyFireScale("competitive", "other")).toBe(0.4);
  });
});
