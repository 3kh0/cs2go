import { expect, test } from "vitest";
import { isKnife, weapons } from "./physics";
import { deathmatchKillPoints } from "./deathmatch-scoring";

// Independent golden values from the pinned native scorer + installed VData,
// not calculated using the browser implementation under test.
test("all firearm awards match the installed native Deathmatch snapshot", () => {
  const actual = Object.fromEntries(
    weapons
      .filter((weapon) => !isKnife(weapon.id))
      .map((weapon) => [weapon.slug, deathmatchKillPoints(weapon.id)]),
  );
  expect(actual).toEqual({
    ak47: 10,
    m4a1_silencer: 10,
    usp_silencer: 18,
    awp: 8,
    glock: 18,
    deagle: 14,
    m4a1: 10,
    nova: 13,
    mp9: 13,
    hkp2000: 18,
    p250: 16,
    fiveseven: 16,
    tec9: 16,
    cz75a: 16,
    revolver: 14,
    elite: 16,
    famas: 11,
    galilar: 11,
    aug: 10,
    sg556: 10,
    ssg08: 11,
    scar20: 8,
    g3sg1: 8,
    mac10: 13,
    mp7: 13,
    mp5sd: 13,
    ump45: 13,
    p90: 11,
    bizon: 13,
    xm1014: 11,
    mag7: 13,
    sawedoff: 13,
    m249: 8,
    negev: 11,
  });
});

test("every cosmetic knife uses the native knife award instead of its zero price", () => {
  const knives = weapons.filter((weapon) => isKnife(weapon.id));
  expect(knives.length).toBeGreaterThan(20);
  for (const knife of knives) expect(deathmatchKillPoints(knife.id)).toBe(25);
  expect(deathmatchKillPoints(-1)).toBe(0);
});
