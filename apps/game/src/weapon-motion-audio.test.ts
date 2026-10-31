import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as T from "three";
import { loadNativeWeapons, nativeSoundCues } from "./weapon-motion";
import { WeaponAudio } from "./audio";

vi.mock("./knife-motion", () => ({ viewHandsTemplate: undefined }));
vi.mock("./skins", () => ({ registerSkinModel: () => {} }));
vi.mock("./gltf", () => ({
  loadModel: async (url: string) => {
    let events = [];
    if (url === "/models/viewmodels/elite/reload.glb") {
      const bytes = readFileSync(`../../packages/assets/public${url}`);
      const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      events = json.animations[0].extras.events;
    }
    return {
      scene: new T.Group(),
      animations: [new T.AnimationClip("fixture", 1, [])],
      parser: { json: { animations: [{ extras: { events } }] } },
    };
  },
}));

it("routes ELITE slide/left/right phases to distinct recordings without replacing Clipin", async () => {
  await loadNativeWeapons();
  const cues = nativeSoundCues(18, "reload");
  const phases = [0.4247787594795227, 0.44247788190841675, 0.7256637215614319, 0.7433628439903259];
  const selected = phases.map((time) => cues.find((cue) => Math.abs(cue.time - time) < 1e-7));
  expect(selected.map((cue) => cue?.kind)).toEqual([
    "reloadSlide",
    "reloadLeft",
    "reloadSlide",
    "reloadRight",
  ]);
  for (const time of [0.39823007583618164, 0.7168141603469849])
    expect(cues.find((cue) => Math.abs(cue.time - time) < 1e-7)?.kind).toBe("reloadIn");

  const audio = new WeaponAudio();
  for (const name of ["galil_clipin", "elite_lclipin", "elite_rclipin", "elite_leftclipin"])
    audio.buffers.set(name, {} as AudioBuffer);
  const node = { connect: () => node, gain: { value: 0 }, pan: { value: 0 } };
  const context = {
    createBufferSource: () => ({ connect: () => {}, start: () => {} }),
    createGain: () => node,
    createStereoPanner: () => node,
  } as unknown as AudioContext;
  const clips = selected.map((cue) => {
    audio.play(context, cue!.kind, 18, 100);
    return audio.lastClip;
  });
  expect(clips).toEqual(["galil_clipin", "elite_lclipin", "galil_clipin", "elite_rclipin"]);
  audio.play(context, "reloadIn", 18, 100);
  expect(audio.lastClip).toBe("elite_leftclipin");
});
