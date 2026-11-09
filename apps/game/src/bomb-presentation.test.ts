import { afterEach, expect, test, vi } from "vitest";
import { PLANT_DURATION } from "./bomb-presentation";
import { Soundscape } from "./soundscape";

afterEach(() => vi.unstubAllGlobals());
test("plant marker crossings play once across fixed steps and sparse snapshots, and restart after cancellation", () => {
  vi.stubGlobal(
    "Audio",
    class {
      preload = "";
    },
  );
  const sound = new Soundscape(),
    played: string[] = [];
  sound.play = vi.fn((cue) => {
    played.push(cue);
    return undefined;
  });
  for (let i = 0; i < 410; i++)
    sound.playBombPlant(i / 128, Math.min(PLANT_DURATION, (i + 1) / 128));
  const expected = ["bomb-initiate", ...Array.from({ length: 7 }, (_, i) => `bomb-key-${i + 1}`)];
  expect(played).toEqual(expected);
  played.length = 0;
  sound.playBombPlant(0, 0.13);
  sound.playBombPlant(0.13, 0.93);
  sound.playBombPlant(0.93, PLANT_DURATION);
  expect(played).toEqual(expected);
  played.length = 0;
  sound.playBombPlant(0, 0.9);
  sound.playBombPlant(0.9, 0);
  sound.playBombPlant(0, PLANT_DURATION);
  expect(played.filter((c) => c === "bomb-initiate")).toHaveLength(2);
  expect(played.slice(-8)).toEqual(expected);
});
