import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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

test("Monstercat kits retain complete native cues and verified local media", () => {
  const root = "../../packages/assets/public";
  const catalog = JSON.parse(
    readFileSync(`${root}/audio/music-kits/catalog.json`, "utf8"),
  ) as MusicKitCatalog;
  const native = JSON.parse(
    readFileSync(`${root}/audio/music-kits/native-events.json`, "utf8"),
  ) as {
    events: Record<string, Record<string, { stop_at_time?: number; endpoint_01?: number }>>;
  };
  const source = JSON.parse(readFileSync(`${root}/audio/music-kits/source.json`, "utf8")) as {
    files: {
      runtime: string;
      sourceRelease?: string;
      output: { sha256: string; native_stream_bit_identical?: boolean };
    }[];
  };
  const ids = [
    "alleycvt_01",
    "arcando_01",
    "djdiesel_01",
    "fool_01",
    "noisestorm_01",
    "pegboardnerds_01",
    "tristam_braken_01",
    "vicetone_01",
  ];
  const media = new Set<string>();
  for (const id of ids) {
    const kit = catalog.kits.find((entry) => entry.id === id)!;
    expect(kit, id).toBeDefined();
    expect(existsSync(`${root}${kit.image}`), kit.image).toBe(true);
    expect(existsSync(`${root}/models/music-kit/covers/${id}.png`), id).toBe(true);
    expect(Object.keys(kit.events)).toHaveLength(19);
    expect(kit.events.mvp.tracks).toHaveLength(2);
    for (const cue of Object.values(kit.events)) {
      const event = native.events[id][cue.nativeEvent!];
      expect(cue.stopAfter).toBe(event.stop_at_time);
      if (cue.loop && event.endpoint_01) expect(cue.ends?.[0]).toBe(event.endpoint_01);
      for (const track of cue.tracks) media.add(track);
    }
    for (const track of kit.extraTracks ?? []) media.add(track);
  }
  expect(media.size).toBe(116);
  for (const path of media) {
    const record = source.files.find((file) => file.runtime === path)!;
    expect(record.sourceRelease).toBe("monstercat-2026-11-17");
    expect(record.output.native_stream_bit_identical).toBe(true);
    expect(
      createHash("sha256")
        .update(readFileSync(`${root}${path}`))
        .digest("hex"),
    ).toBe(record.output.sha256);
  }
});
