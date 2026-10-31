import { expect, it } from "vitest";
import { changeLoadout, defaultLoadouts, loadoutCategory, readLoadouts } from "./loadouts";
import { weaponAvailable } from "./economy";
it("defaults contain five faction-valid choices per category and preserve edited loadouts", () => {
  const loadouts = defaultLoadouts();
  for (const team of ["t", "ct"] as const) {
    expect(loadouts[team].every((id) => weaponAvailable(id, team))).toBe(true);
    for (const category of ["Pistols", "Mid-Tier", "Rifles"])
      expect(loadouts[team].filter((id) => loadoutCategory(id) === category)).toHaveLength(5);
  }
  expect(changeLoadout(loadouts, "t", 17)).toBe(false);
  expect(changeLoadout(loadouts, "t", 16)).toBe(true);
  expect(changeLoadout(loadouts, "t", 17)).toBe(true);
  expect(changeLoadout(loadouts, "t", 2)).toBe(false);
  expect(readLoadouts(loadouts)).toEqual(loadouts);
});
it("rejects oversized categories and accepts empty slots", () => {
  const defaults = defaultLoadouts();
  expect(readLoadouts({ ...defaults, t: [...defaults.t, 17] }).t).toEqual(defaults.t);
  expect(readLoadouts({ ...defaults, t: [] }).t).toEqual([]);
});
it("migrates the earlier two-starter CT layout without changing rifle or mid-tier choices", () => {
  const old = defaultLoadouts();
  old.ct[2] = 12;
  const migrated = readLoadouts(old);
  expect(migrated.ct.slice(0, 5)).toEqual([2, 8, 18, 13, 14]);
  expect(migrated.ct.slice(5)).toEqual(old.ct.slice(5));
  old.ct[0] = 12;
  old.ct[2] = 18;
  expect(readLoadouts(old).ct[0]).toBe(12);
});
