import { expect, test } from "vitest";
import { matchSteamSkin, steamChoice, type SteamItem } from "./steam-inventory";
import type { Skin } from "./skins";

const skin: Skin = {
  id: "7_44",
  weapon: 0,
  paint: 44,
  name: "Case Hardened",
  rarity: "Classified",
  body: "legacy",
  image: "/skins/thumbs/7_44.webp",
};
const item: SteamItem = {
  assetId: "123",
  name: "StatTrak™ AK-47 | Case Hardened (Field-Tested)",
  weaponName: "AK-47",
  finish: "Case Hardened",
  wear: 0.231234565,
  seed: 661,
};
test("matches owned finishes to the right local weapon and preserves exact Steam properties", () => {
  expect(matchSteamSkin(item, [skin])).toEqual(skin);
  expect(steamChoice(item, skin)).toEqual({ id: "7_44", wear: 0.231234565, seed: 661 });
  expect(matchSteamSkin({ ...item, weaponName: "Five-SeveN" }, [skin])).toBeUndefined();
  expect(matchSteamSkin({ ...item, finish: "Nonexistent" }, [skin])).toBeUndefined();
});
test("does not invent missing floats or seeds", () => {
  for (const fields of [
    { wear: null },
    { seed: null },
    { wear: NaN },
    { seed: 1.5 },
    { wear: 2 },
    { seed: 1001 },
  ])
    expect(steamChoice({ ...item, ...fields }, skin)).toBeNull();
});
