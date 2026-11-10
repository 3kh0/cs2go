import { expect, test } from "vitest";
import { Vector3 } from "three";
import type { DoorState } from "@cs2go/protocol";
import type { NativeDoorDefinition, DoorSoundKind } from "@cs2go/simulation/doors";
import { DoorAudio } from "./door-audio";

const cue = {
  event: "Source.Test",
  clips: ["test"],
  gain: 1,
  pitch: 1,
  curve: [
    [0, 1],
    [35, 0],
  ] as [number, number][],
  offset: [0, 0, 0] as const,
  occlusionMix: 0.8,
};
const definition: NativeDoorDefinition = {
  id: "test",
  pivot: [0, 0, 0],
  axis: [0, 1, 0],
  distance: 90,
  speed: 200,
  returnDelay: -1,
  physicsNames: [],
  renderNames: [],
  sounds: { move: cue, fullOpen: cue, fullClose: cue },
};
function track(native = definition) {
  const audio = new DoorAudio(),
    events: DoorSoundKind[] = [];
  return {
    audio,
    events,
    pose: (angle: number, target: number, silent = false) =>
      audio.observe(
        [native],
        [{ id: native.id, angle, target, returnTime: -1 } satisfies DoorState],
        (_, kind) => events.push(kind),
        silent,
      ),
  };
}

test("door movement and arrival cues do not repeat while moving or blocked", () => {
  const { pose, events } = track();
  pose(0, 0);
  pose(0, 90);
  pose(30, 90);
  pose(30, 90);
  pose(90, 90);
  pose(90, 90);
  pose(90, 0);
  pose(40, 0);
  pose(0, 0);
  expect(events).toEqual(["move", "fullOpen", "move", "fullClose"]);
});

test("late join, map reset and round snapshots stay silent; sparse arrivals still sound", () => {
  const { pose, audio, events } = track();
  pose(45, 90);
  pose(45, 0, true);
  pose(0, 0, true);
  expect(events).toEqual([]);
  pose(90, 90);
  expect(events).toEqual(["fullOpen"]);
  audio.reset();
  pose(0, 0);
  expect(events).toEqual(["fullOpen"]);
});

test("authored brush start cues override generic movement and reversed poses close correctly", () => {
  const { pose, events } = track({
    ...definition,
    startAngle: 15,
    sounds: { ...definition.sounds, startOpen: cue, startClose: cue },
  });
  pose(15, 15);
  pose(14, -75);
  pose(-75, -75);
  pose(-70, 15);
  pose(15, 15);
  expect(events).toEqual(["startOpen", "fullOpen", "startClose", "fullClose"]);
});

test("door event instances and range guard bound voices before shared spatial playback", () => {
  const audio = new DoorAudio();
  let played = 0,
    stopped = 0;
  const context = { currentTime: 1 };
  const soundscape = {
    context,
    spatial: { position: new Vector3(0, 0, 0) },
    play: () => {
      played++;
      return { stop: () => stopped++, addEventListener: () => {} };
    },
  } as unknown as import("./soundscape").Soundscape;
  const native = {
    ...definition,
    sounds: { move: { ...cue, instances: 1, blockSeconds: 0.3, blockDistance: 2.54 } },
  };
  audio.play(soundscape, native, "move");
  context.currentTime = 1.1;
  audio.play(soundscape, native, "move");
  expect(played).toBe(1);
  context.currentTime = 1.4;
  audio.play(soundscape, native, "move");
  expect(played).toBe(2);
  expect(stopped).toBe(1);
  soundscape.spatial.position.x = 100;
  context.currentTime = 2;
  audio.play(soundscape, native, "move");
  expect(played).toBe(2);
  audio.reset();
  expect(stopped).toBe(2);
});

test("terminal destruction cancels movement state without synthesizing an arrival cue", () => {
  const audio = new DoorAudio(),
    events: DoorSoundKind[] = [];
  const native = {
    ...definition,
    damage: {
      health: 100,
      destroyOnZero: true,
      damageMultipliers: { explosion: 1 },
      stages: [{ belowHealth: 100, renderNames: ["residue"], physicsNames: ["residue"] }],
    },
  };
  const pose = (angle: number, target: number, health: number) =>
    audio.observe(
      [native],
      [{ id: native.id, angle, target, health, stage: 1, returnTime: -1 }],
      (_, kind) => events.push(kind),
    );
  pose(0, 0, 100);
  pose(30, 90, 10);
  expect(events).toEqual(["move"]);
  pose(30, 30, 0);
  pose(30, 30, 0);
  expect(events).toEqual(["move"]);
});
