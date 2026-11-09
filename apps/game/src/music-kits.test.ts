import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import startupDefault from "./data/default-music-kit.json";
import type { MusicKitCatalog } from "./music-kits";

test("the small startup default uses the same native tracks and event parameters as the optional library", () => {
  const catalog = JSON.parse(
    readFileSync("../../packages/assets/public/audio/music-kits/catalog.json", "utf8"),
  ) as MusicKitCatalog;
  expect(startupDefault).toEqual(catalog.kits.find((kit) => kit.id === catalog.defaultKitId));
  expect(startupDefault.events.menu.tracks[0]).toBe("/audio/music-kits/valve_cs2_01/mainmenu.mp3");
});
