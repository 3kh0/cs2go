import { describe, expect, it } from "vitest";
import {
  addMoney,
  equipmentPrice,
  killReward,
  nextLossLevel,
  roundReward,
  rulesFor,
  weaponAvailable,
  weaponPrice,
} from "./economy";
import { isKnife, weapons, weaponSlot } from "./physics";

describe("CS2 round economy", () => {
  it("starts competitive with a pistol-round budget and charges armor separately", () => {
    expect(rulesFor("competitive").startMoney).toBe(800);
    expect(rulesFor("competitive").freeArmor).toBe(false);
    expect(equipmentPrice("vest", 0, false)).toBe(650);
    expect(equipmentPrice("helmet", 0, false)).toBe(1000);
    expect(equipmentPrice("helmet", 100, false)).toBe(350);
    expect(equipmentPrice("helmet", 76, true)).toBe(650);
    expect(equipmentPrice("helmet", 100, true)).toBe(0);
    expect(equipmentPrice("kit", 0, false)).toBe(400);
  });
  it("increments and decrements loss income, capped after four losses", () => {
    let level: number = rulesFor("competitive").startingLossLevel;
    expect(roundReward("competitive", false, "elimination", level, false)).toBe(1900);
    level = nextLossLevel(level, false);
    expect(roundReward("competitive", false, "elimination", level, false)).toBe(2400);
    expect(nextLossLevel(4, false)).toBe(4);
    expect(nextLossLevel(0, true)).toBe(0);
    expect(roundReward("competitive", false, "defuse", 4, true)).toBe(4000);
    expect(roundReward("competitive", true, "bomb", 0, true)).toBe(3500);
    expect(roundReward("competitive", true, "timeout", 0, false)).toBe(3250);
  });
  it("halves weapon kill rewards in casual and caps balances", () => {
    expect(killReward(3, "competitive")).toBe(100);
    expect(killReward(4, "competitive")).toBe(1500);
    expect(killReward(10, "casual")).toBe(450);
    expect(killReward(32, "competitive")).toBe(600);
    expect(killReward(16, "competitive")).toBe(300);
    expect(addMoney(15900, 3500, "competitive")).toBe(16000);
    expect(addMoney(9900, 2700, "casual")).toBe(10000);
    expect(addMoney(100, -300, "competitive")).toBe(0);
  });
  it("enforces faction purchases while allowing shared weapons", () => {
    expect(weaponAvailable(0, "ct")).toBe(false);
    expect(weaponAvailable(0, "t")).toBe(true);
    expect(weaponAvailable(9, "ct")).toBe(true);
    expect(weaponAvailable(14, "t")).toBe(false);
    expect(weaponAvailable(3, "t")).toBe(true);
    expect(weaponAvailable(3, "ct")).toBe(true);
    expect(weaponAvailable(99, "ct")).toBe(false);
    expect(weaponPrice(9)).toBe(2900);
    expect(weaponPrice(27)).toBe(1400);
  });
  it("preserves saved IDs while classifying the complete firearm roster", () => {
    expect(weapons).toHaveLength(37);
    expect(weapons.filter((_, id) => !isKnife(id))).toHaveLength(34);
    expect(weapons[4]!.name).toBe("Bayonet");
    expect(weapons[11]!.name).toBe("MP9");
    expect(weaponSlot(18)).toBe(2);
    expect(weaponSlot(36)).toBe(1);
    expect(weapons[3]!.mag).toBe(5);
    expect(weapons[3]!.reserveClips).toBe(2);
    expect(weapons[1]!.mag).toBe(20);
    expect(weapons[10]!.reserveAsClips).toBe(false);
    expect(weapons[33]!.reserveAsClips).toBe(true);
  });
});

it("discards the old magazine on a tactical reload but preserves shotgun shells", async () => {
  const { reloadMagazine } = await import("./physics");
  expect(reloadMagazine(0, 29, 90)).toEqual({ ammo: 30, reserve: 60 });
  expect(reloadMagazine(0, 0, 30)).toEqual({ ammo: 30, reserve: 0 });
  expect(reloadMagazine(0, 12, 0)).toEqual({ ammo: 12, reserve: 0 });
  expect(reloadMagazine(0, 30, 60)).toEqual({ ammo: 30, reserve: 60 });
  expect(reloadMagazine(10, 7, 32)).toEqual({ ammo: 8, reserve: 31 });
});
