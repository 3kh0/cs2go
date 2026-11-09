import { describe, expect, test } from "vitest";
import { deathcamArtwork } from "./deathcam-art";
import type { WeaponInstance } from "./weapon-instance";

const catalog = [
  { id: "killer-finish", weapon: 0, name: "Redline", image: "/skins/thumbs/7_282.webp" },
  { id: "local-finish", weapon: 0, name: "Case Hardened", image: "/skins/thumbs/7_44.webp" },
];
const appearance = (weapon: number, id: string): WeaponInstance => ({
  serial: 1,
  creator: "remote-killer",
  weapon,
  skin: { id, seed: 1, wear: 0.1 },
});

describe("death card econ art", () => {
  test("uses the killing instance's finish rather than another player's finish", () => {
    expect(deathcamArtwork(0, appearance(0, "killer-finish"), catalog, "/fallback.svg")).toEqual({
      path: "/skins/thumbs/7_282.webp",
      thumbnail: true,
      skin: "killer-finish",
      name: "AK-47 | Redline",
    });
  });
  test("unknown or mismatched appearance falls back to that weapon's native base art", () => {
    for (const instance of [undefined, appearance(0, "missing"), appearance(3, "killer-finish")]) {
      const art = deathcamArtwork(0, instance, catalog, "/fallback.svg");
      expect(art.path).toBe("/skins/defaults/0.webp");
      expect(art.skin).toBe("");
    }
    expect(deathcamArtwork(38, undefined, catalog, "/knife.svg").path).toBe(
      "/skins/defaults/38.webp",
    );
    expect(deathcamArtwork(-1, undefined, catalog, "/c4.svg")).toEqual({
      path: "/c4.svg",
      thumbnail: false,
      skin: "",
    });
  });
});
