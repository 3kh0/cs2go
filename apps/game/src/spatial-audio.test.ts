import { expect, test } from "vitest";
import { audibleGain } from "./spatial-audio";
import { weaponSoundRange } from "./audio";

test("suppressed weapon ranges fade continuously to silence and respect attachment state", () => {
  const quiet = weaponSoundRange(2, true),
    loud = weaponSoundRange(2, false);
  expect(quiet.maxDistance).toBeLessThan(loud.maxDistance);
  expect(quiet.maxDistance).toBeCloseTo(35.56);
  expect(audibleGain(30 * 0.0254, quiet)).toBe(1);
  const gains = [3, 8, 16, 24, 35.56, 70].map((distance) => audibleGain(distance, quiet));
  expect(gains).toEqual([...gains].sort((a, b) => b - a));
  expect(gains.slice(-2)).toEqual([0, 0]);
  expect(audibleGain(50, loud)).toBeGreaterThan(0);
  expect(weaponSoundRange(1, true).maxDistance).toBeLessThan(
    weaponSoundRange(1, false).maxDistance,
  );
  // Inherently suppressed MP5-SD stays quiet regardless of the optional flag.
  expect(weaponSoundRange(28, false)).toEqual(weaponSoundRange(28, true));
});
