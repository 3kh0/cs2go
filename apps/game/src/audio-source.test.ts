import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import bindings from "./data/source-weapon-audio.json";

it("covers every firearm marker with a native CS2 event and verifies bundled clip hashes", () => {
  const provenance = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-weapons-source.json", "utf8"),
  );
  expect(provenance.manifest).toBe("4758919807587010422");
  expect(provenance.vpkDirectorySha256).toBe(
    "48018be3f8da306ce9b48bf746bce08ceff19fe4dff15c9d5e2e53b3c3e9bbad",
  );
  const ids = new Set(bindings.selection.coverage.map((marker) => marker.weaponId));
  expect([...ids].sort((a, b) => a - b)).toEqual(
    Array.from({ length: 37 }, (_, i) => i).filter((i) => ![4, 5, 6].includes(i)),
  );
  const clips = new Map(
    provenance.clips.map((clip: { name: string; resource: string; outputSha256: string }) => [
      clip.name,
      clip,
    ]),
  );
  for (const marker of bindings.selection.coverage) expect(clips.has(marker.name)).toBe(true);
  for (const clip of bindings.clips) {
    expect(clip.nativeVariants).toContain(clip.resource.replace(/_c$/, ""));
    const imported = clips.get(clip.name) as { resource: string; outputSha256: string };
    expect(imported.resource).toBe(clip.resource);
    const bytes = readFileSync(`../../packages/assets/public/audio/${clip.name}.ogg`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(imported.outputSha256);
  }
  expect(clips.get("ak47-1")).toMatchObject({ resource: "sounds/weapons/ak47/ak47_02.vsnd_c" });
  expect(clips.get("cz75_clipin")).toMatchObject({
    resource: "sounds/weapons/cz75a/cz75_clipin_01.vsnd_c",
  });
  expect(clips.get("galil_clipin")).toMatchObject({
    resource: "sounds/weapons/magazine_slide_01.vsnd_c",
    resourceSha256: "d593f8b111e9e1bbe81416e3b4e6be2b05f57b7fe65affd8dc8f176943739a7a",
  });
  expect(clips.get("elite_leftclipin")).toMatchObject({
    event: "Weapon_ELITE.Clipin",
    resource: "sounds/weapons/elite/elites_clipin_07.vsnd_c",
    resourceSha256: "e0339d33d75046e24e2fdadc510930386125d74925f4609d8facebe8a931128b",
  });
});

it("ships the CS2 soundtrack with verified local bytes and no former CS:GO music references", () => {
  const provenance = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-music-source.json", "utf8"),
  );
  const manifest = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/manifest.json", "utf8"),
  );
  expect(provenance.manifest).toBe("4758919807587010422");
  for (const clip of provenance.clips) {
    expect(clip.resource).toContain("sounds/music/valve_cs2_01/");
    expect(
      createHash("sha256")
        .update(readFileSync(`../../packages/assets/public/audio/source/${clip.name}.ogg`))
        .digest("hex"),
    ).toBe(clip.outputSha256);
    expect(manifest.clips.find((c: { name: string }) => c.name === clip.name)?.source).toBe(
      clip.resource,
    );
  }
  expect(manifest.clips.filter((c: { name: string }) => c.name.startsWith("music-"))).toHaveLength(
    11,
  );
});

it("every packed effect has verified native CS2 or pinned supplemental C4 provenance", () => {
  const effects = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-effects-source.json", "utf8"),
  );
  const weapons = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-weapons-source.json", "utf8"),
  );
  const elite = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-elite-source.json", "utf8"),
  );
  expect(elite.manifest).toBe("67499503218971311");
  expect(elite.clips).toMatchObject([
    {
      name: "elite_lclipin",
      event: "Weapon_ELITE.Lclipin",
      resource: "sounds/weapons/elite/elite_leftclipin.vsnd_c",
      resourceSha256: "b89ee98c057a7c5431e48febc4ff3d13f01eea10011f37bbc1f96a60929bc5af",
    },
    {
      name: "elite_rclipin",
      event: "Weapon_ELITE.Rclipin",
      resource: "sounds/weapons/elite/elite_rightclipin.vsnd_c",
      resourceSha256: "2c6f735bfc906c5d9eb2bdaf2dc5366977e930f981ce3c05b4ef134095f71185",
    },
  ]);
  const bank = JSON.parse(
    readFileSync("../../packages/assets/public/audio/startup-source.json", "utf8"),
  );
  const manifest = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/manifest.json", "utf8"),
  );
  const sources = new Map<string, string>();
  const ui = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-ui-source.json", "utf8"),
  );
  expect(ui.depotManifest).toBe("67499503218971311");
  for (const clip of ui.clips) sources.set(`/audio/source/${clip.name}.ogg`, clip.outputSha256);
  expect(effects.manifest).toBe("67499503218971311");
  for (const [report, prefix] of [
    [effects, "/audio/source/"],
    [weapons, "/audio/"],
    [elite, "/audio/"],
  ] as const) {
    expect(report.source).toBe("Valve CS2 Steam depot");
    for (const clip of report.clips) sources.set(`${prefix}${clip.name}.ogg`, clip.outputSha256);
  }
  for (const clip of effects.clips) {
    expect(clip.variants).toContain(clip.resource.replace(/_c$/, ""));
    expect(effects.soundEventsSha256[clip.eventFile]).toMatch(/^[a-f0-9]{64}$/);
    expect(
      manifest.clips.find((entry: { name: string }) => entry.name === clip.name),
    ).toMatchObject({
      resource: clip.resource,
      outputSha256: clip.outputSha256,
      manifest: effects.manifest,
    });
  }
  const c4Names = ["bomb-draw"];
  for (const name of c4Names) {
    const clip = manifest.clips.find((entry: { name: string }) => entry.name === name);
    const file = name === "bomb-draw" ? "c4_draw" : `key_press${name.at(-1)}`;
    expect(clip).toMatchObject({
      sourcePack: "Valve historical CS:GO C4 recordings",
      repository: "https://github.com/sourcesounds/csgo",
      commit: "08f1bd6835d4f510d2ccaedeab6bb9f637b388ab",
      source: `sound/weapons/c4/${file}.wav`,
      url: `https://raw.githubusercontent.com/sourcesounds/csgo/08f1bd6835d4f510d2ccaedeab6bb9f637b388ab/sound/weapons/c4/${file}.wav`,
    });
    expect(clip.resourceSha256).toMatch(/^[a-f0-9]{64}$/);
    sources.set(`/audio/source/${name}.ogg`, clip.outputSha256);
  }
  const c4 = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/c4-native.json", "utf8"),
  );
  expect(c4.source).toBe("Read-only installed CS2 via Windows Amp runner");
  expect(c4.soundEventSha256).toBe(
    "43783bf047a6ad803a4bffd6980fc53ec7f4dcefd3a00d674e4c3ba260ff49a1",
  );
  for (const clip of c4.clips) {
    const bytes = readFileSync(`../../packages/assets/public/audio/source/${clip.name}.ogg`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(clip.outputSha256);
    expect(
      manifest.clips.find((entry: { name: string }) => entry.name === clip.name),
    ).toMatchObject(clip);
    sources.set(`/audio/source/${clip.name}.ogg`, clip.outputSha256);
  }
  const breaks = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/mirage-break-sounds.json", "utf8"),
  );
  expect(breaks.source).toBe("Read-only installed CS2 via Windows Amp runner");
  expect(breaks.resourceSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(breaks.clips).toHaveLength(8);
  for (const clip of breaks.clips) {
    expect(breaks.soundEvents[clip.sourceEvent].vsnd_files_track_01).toContain(
      clip.resource.replace(/_c$/, ""),
    );
    expect(clip.resourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(clip.sourceEventResourceSha256).toBe(breaks.resourceSha256);
    expect(
      manifest.clips.find((entry: { name: string }) => entry.name === clip.name),
    ).toMatchObject({
      resource: clip.resource,
      outputSha256: clip.outputSha256,
      sourceEvent: clip.sourceEvent,
    });
    sources.set(`/audio/source/${clip.name}.ogg`, clip.outputSha256);
  }
  // Installed build2000942 native PCM exports, converted once to Opus. Pin the
  // input resources/events independently of the generated packed-audio index.
  const nativeDeathmatch = [
    [
      "healthshot-prepare",
      "sounds/items/healthshot_prepare_01.vsnd_c",
      "Healthshot.Prepare",
      "f3fcd6501af55002feeb4e34dbcd8399d2fb19cfbf6dfe958ecb830a6dab11b6",
      "7725aa4bf3f31b2934db45dd53f592a8fc0c13e976fde3cbce733953439bb4eb",
      1,
    ],
    [
      "healthshot-thud",
      "sounds/items/healthshot_thud_01.vsnd_c",
      "Healthshot.Thud",
      "fdaec4515f2afb40acd16cc92a9e2705ee5911d03c31e05f15d648f1a494dbf8",
      "01077dc85cbd49e2414c40ac8ef5737fab95d5a32cd9db5d40c8cea77d8ba4a3",
      0.599609,
    ],
    [
      "healthshot-success",
      "sounds/items/healthshot_success_01.vsnd_c",
      "Healthshot.Success",
      "b1211b59134f244bf0c7416dee4c0d9ebb8d3276af3489a429316dc422a912e2",
      "aa2e6b6c59aac5f2815a254fef165954b55d3e4244e6cebf14c1ff9f64f62d88",
      0.599609,
    ],
    [
      "dm-bonus-start",
      "sounds/ui/bonus_alert_start.vsnd_c",
      "UI.DeathMatchBonusAlertStart",
      "3205a7137125dee85bab4588ed5e8fd52dfe8fa376e1b1f999de5ed977881043",
      "bf0ddf5f4de779af7a40b01c1fe2a1e9d02e3781423e161acfcaa1bad51c9c69",
      0.2,
    ],
    [
      "dm-bonus-end",
      "sounds/ui/bonus_alert_end.vsnd_c",
      "UI.DeathMatchBonusAlertEnd",
      "ac9b1279298badcd853c76bd935c0ca93a6554efcb4d57ebc34af0879cc52e4f",
      "6d579c58d685dbcc35b9d3feb72e7f5c04e763ce6dfee1bda3d5262211a3ccaf",
      0.1,
    ],
    [
      "dm-bonus-kill",
      "sounds/ui/deathmatch_bonuskill.vsnd_c",
      "UI.DeathMatchBonusKill",
      "aa88eece64421fe48abdc702238abbe87ce30bcd774336abad40cc1641073b56",
      "8fa992c68d12d2de9d37f10eb3e85aeba61c6ff79958ddb3c4b058573b2f736a",
      0.3,
    ],
  ] as const;
  expect(
    manifest.clips.filter((clip: { name: string }) => /^(healthshot-|dm-bonus-)/.test(clip.name)),
  ).toHaveLength(nativeDeathmatch.length);
  for (const [
    name,
    resource,
    sourceEvent,
    resourceSha256,
    outputSha256,
    sourceEventGain,
  ] of nativeDeathmatch) {
    const clip = manifest.clips.find((entry: { name: string }) => entry.name === name);
    expect(clip).toMatchObject({
      resource,
      source: resource,
      sourceEvent,
      resourceSha256,
      outputSha256,
      sourcePack: "Valve CS2 native healthshot and Deathmatch sound events",
      sourceEventResourceSha256: name.startsWith("healthshot-")
        ? "43783bf047a6ad803a4bffd6980fc53ec7f4dcefd3a00d674e4c3ba260ff49a1"
        : "b83fe9d339479c838b3b575cdaf9cb95875f19c4c5509d84336f73a8ee1b8c35",
      sourceEventGain,
      sourceEventPitch: 1,
      sourceCodec: "pcm_s16le",
      sourceSampleRate: 44100,
      sourceChannels: 2,
      outputCodec: "opus",
      outputSampleRate: 48000,
      outputBitrate: 96000,
    });
    const bytes = readFileSync(`../../packages/assets/public/audio/source/${name}.ogg`);
    expect(bytes.subarray(0, 4).toString()).toBe("OggS");
    expect(bytes.length).toBe(clip.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(outputSha256);
    sources.set(`/audio/source/${name}.ogg`, outputSha256);
  }
  expect(bank.clips).toHaveLength(sources.size);
  for (const clip of bank.clips) {
    expect(sources.get(clip.url), clip.url).toBe(clip.sha256);
    expect(
      createHash("sha256")
        .update(readFileSync(`../../packages/assets/public${clip.url}`))
        .digest("hex"),
    ).toBe(clip.sha256);
  }
});
