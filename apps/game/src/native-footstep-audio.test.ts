import { expect, test, vi } from "vitest";
import { Vector3 } from "three";
import type { Soundscape } from "./soundscape";
import {
  NativeFootstepAudio,
  type NativeFootstepCue,
  type FootstepEvent,
} from "./native-footstep-audio";
// Authored table spelling matters: CT carpet right explicitly selects the T
// event; both concrete feet intentionally select the literal StepLeft event.
const cue: NativeFootstepCue = {
  clips: ["ct-1", "ct-2"],
  gain: 0.9,
  gainRandom: [-0.1, 0],
  pitch: 1,
  pitchRandom: [-0.02, 0.01],
  height: 20 * 0.0254,
  blockSeconds: 0.15,
  curve: [
    [1, 0.45],
    [3, 1],
    [10, 0],
  ],
  occlusionMix: 0.375,
};
function fixture() {
  const audio = new NativeFootstepAudio({
    bindings: {
      carpet: {
        ct: ["CT_Carpet.StepLeft", "T_Carpet.StepLeft"],
        t: ["T_Carpet.StepLeft", "T_Carpet.StepLeft"],
      },
      concrete: {
        ct: ["CT_Concrete.StepLeft", "CT_Concrete.StepLeft"],
        t: ["T_Carpet.StepLeft", "T_Carpet.StepLeft"],
      },
    },
    events: {
      "CT_Carpet.StepLeft": cue,
      "T_Carpet.StepLeft": { ...cue, clips: ["t-1"] },
      "CT_Concrete.StepLeft": cue,
    },
  });
  const play = vi.fn<Soundscape["play"]>(() => ({}) as AudioBufferSourceNode);
  const soundscape = {
    play,
    context: { currentTime: 1 },
    spatial: { position: new Vector3() },
  } as unknown as Soundscape;
  const event: FootstepEvent = {
    actor: "one",
    team: "ct",
    side: "left",
    surface: "carpet",
    point: { x: 2, y: -1, z: 0 },
  };
  return { audio, play, soundscape, event };
}
test("exact authored team/foot names select source clips, offset and native settings without another randomization", () => {
  const { audio, play, soundscape, event } = fixture();
  audio.play(soundscape, event, false, () => 0.5);
  expect(play.mock.calls[0][3]).toEqual(new Vector3(2, -1 + 20 * 0.0254, 0));
  expect(play.mock.calls[0][4]).toMatchObject({
    clip: "ct-2",
    pitch: 0.995,
    range: { curve: cue.curve, occlusionMix: 0.375 },
  });
  expect(play.mock.calls[0][4]!.gain).toBeCloseTo(0.85);
  audio.play(soundscape, { ...event, side: "right" }, false, () => 0.5);
  expect(play.mock.calls[1][4]).toMatchObject({ clip: "t-1" });
});
test("distance and actor-event blocking bound remote voices while local presentation preserves near envelope gain", () => {
  const { audio, play, soundscape, event } = fixture();
  audio.play(soundscape, { ...event, point: { x: 11, y: 0, z: 0 } });
  expect(play).not.toHaveBeenCalled();
  audio.play(soundscape, event, true, () => 0);
  expect(play.mock.calls[0][3]).toBeUndefined();
  expect(play.mock.calls[0][4]).toMatchObject({ clip: "ct-1", gain: 0.8 * 0.45 });
  audio.play(soundscape, event, true);
  expect(play).toHaveBeenCalledTimes(1);
  audio.play(soundscape, { ...event, actor: "two" }, true);
  expect(play).toHaveBeenCalledTimes(2);
  audio.reset();
  audio.play(soundscape, event, true);
  expect(play).toHaveBeenCalledTimes(3);
});
test("missing surface/default never invents a name; unimported explicit bindings fail at load", () => {
  const { audio, play, soundscape, event } = fixture();
  audio.play(soundscape, { ...event, surface: "unmapped" });
  expect(play).not.toHaveBeenCalled();
  expect(
    () =>
      new NativeFootstepAudio({
        events: {},
        bindings: { metal: { ct: ["missing", "missing"], t: ["missing", "missing"] } },
      }),
  ).toThrow("no imported event");
});
