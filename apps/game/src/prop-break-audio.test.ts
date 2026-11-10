import { expect, test, vi } from "vitest";
import { Vector3 } from "three";
import type { NativeBreakableDefinition } from "@cs2go/simulation/breakables";
import type { Soundscape } from "./soundscape";
import { NativePropBreakAudio } from "./prop-break-audio";
const pottery = {
  clips: ["pottery1", "pottery2", "pottery3"],
  gain: 0.7,
  pitch: 1.07,
  pitchRandom: [-0.01, 0.01],
  curve: [
    [1.016, 1],
    [5.5734857796, 0.332226],
    [15.24, 0],
  ],
  occlusionMix: 0.8,
};
const audio = new NativePropBreakAudio({
  "Pottery.Break": pottery,
  "Cardboard.Break": { ...pottery, clips: [null] },
});
const definition: NativeBreakableDefinition = {
  id: "prop",
  health: 10,
  material: "metal",
  bounds: [
    [0, 0, 0],
    [1, 1, 1],
  ],
  physicsNames: [],
  renderNames: [],
};
function listener() {
  const play = vi.fn();
  return {
    play,
    soundscape: { play, spatial: { position: new Vector3() } } as unknown as Soundscape,
  };
}

test("undefined legacy metadata preserves old behavior while explicit empty/native-null events stay silent", () => {
  const { play, soundscape } = listener();
  audio.play(soundscape, definition, new Vector3());
  expect(play.mock.calls[0][0]).toBe("map-break-metal");
  audio.play(soundscape, { ...definition, material: "wood" }, new Vector3());
  expect(play.mock.calls[1][0]).toBe("map-break-wood");
  play.mockClear();
  audio.play(soundscape, { ...definition, breakSoundEvent: "" }, new Vector3());
  audio.play(soundscape, { ...definition, breakSoundEvent: "Cardboard.Break" }, new Vector3());
  expect(play).not.toHaveBeenCalled();
});
test("explicit native event selects its exact variant/gain/pitch/envelope regardless of coarse material", () => {
  const { play, soundscape } = listener();
  const values = [0.99, 0.75];
  audio.play(
    soundscape,
    { ...definition, breakSoundEvent: "Pottery.Break" },
    new Vector3(2, 0, 0),
    () => values.shift()!,
  );
  const args = play.mock.calls[0];
  expect(args[0]).toBe("prop-break-Pottery.Break");
  expect(args[4]).toMatchObject({
    clip: "pottery3",
    gain: 0.7,
    pitch: 1.075,
    range: { maxDistance: 15.24, occlusionMix: 0.8, curve: pottery.curve },
  });
});
test("inaudible prop sounds do not consume bounded spatial voices", () => {
  const { play, soundscape } = listener();
  audio.play(
    soundscape,
    { ...definition, breakSoundEvent: "Pottery.Break" },
    new Vector3(16, 0, 0),
  );
  expect(play).not.toHaveBeenCalled();
});
test("unimported explicit events fail rather than falling back to a fabricated material cue", () => {
  expect(() => audio.validate([{ ...definition, breakSoundEvent: "Concrete.Break" }])).toThrow(
    "not imported",
  );
  expect(() =>
    audio.play(
      listener().soundscape,
      { ...definition, breakSoundEvent: "Concrete.Break" },
      new Vector3(),
    ),
  ).toThrow("not imported");
  expect(
    () =>
      new NativePropBreakAudio({
        bad: {
          ...pottery,
          curve: [
            [1, 1],
            [1, 0],
          ],
        },
      }),
  ).toThrow("Invalid native");
});

test("shipped native prop catalog covers map events and retains original PCM frames and silence contracts", async () => {
  const { readFileSync, readdirSync } = await import("node:fs"),
    { createHash } = await import("node:crypto");
  const { parseAudioPack } = await import("./audio-pack"),
    { default: catalog } = await import("./data/prop-break-audio.json");
  const native = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/prop-break-sounds.json", "utf8"),
  );
  const source = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/manifest.json", "utf8"),
  );
  const runtime = new NativePropBreakAudio(catalog);
  const directory = "../../packages/assets/public/models/maps/";
  for (const file of readdirSync(directory).filter((name) => name.endsWith("-breakables.json")))
    runtime.validate(JSON.parse(readFileSync(directory + file, "utf8")).breakables);
  const resources = new Map<string, string | null>(
    [...native.clips, ...native.legacyBindings].map((clip) => [
      clip.resource.replace(/_c$/, ""),
      clip.name,
    ]),
  );
  for (const silent of native.silentClips) {
    expect(silent.allSamplesZero).toBe(true);
    expect(
      createHash("sha256")
        .update(new Uint8Array(silent.sampleFrames * silent.channels * 2))
        .digest("hex"),
    ).toBe(silent.pcmSha256);
    expect(source.clips.some((clip: { name: string }) => clip.name === silent.name)).toBe(false);
    resources.set(silent.resource.replace(/_c$/, ""), null);
  }
  for (const [name, cue] of Object.entries(catalog)) {
    const event = native.events[name],
      track = event.vsnd_files_track_01,
      tracks = typeof track === "string" ? [track] : track;
    expect(cue.clips).toEqual(tracks.map((resource: string) => resources.get(resource)));
    expect(cue.gain).toBe(event.volume);
    expect(cue.pitch).toBe(event.pitch);
    expect(cue.pitchRandom).toEqual([event.pitch_random_min, event.pitch_random_max]);
    expect(cue.curve).toEqual(
      event.distance_volume_mapping_curve.map((row: number[]) => [row[0] * 0.0254, row[1]]),
    );
  }
  const bank = readFileSync("../../packages/assets/public/audio/startup.bin");
  const packed = parseAudioPack(
    bank.buffer.slice(bank.byteOffset, bank.byteOffset + bank.byteLength),
  );
  for (const clip of native.clips) {
    const bytes = packed.get(clip.path)!;
    expect(bytes, clip.name).toBeDefined();
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(clip.outputSha256);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint16(22, true)).toBe(clip.channels);
    expect(view.getUint32(24, true)).toBe(clip.sampleRate);
    let data: Uint8Array | undefined;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const size = view.getUint32(offset + 4, true);
      if (String.fromCharCode(...bytes.slice(offset, offset + 4)) === "data") {
        data = bytes.slice(offset + 8, offset + 8 + size);
        break;
      }
      offset += 8 + size + (size % 2);
    }
    expect(data?.length).toBe(clip.sampleFrames * clip.channels * 2);
    expect(createHash("sha256").update(data!).digest("hex")).toBe(clip.pcmSha256);
  }
});
