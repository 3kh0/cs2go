import { expect, test } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as T from "three";
import data from "@cs2go/simulation/knife-animations";
import { KNIFE_ANIMATION_RATE, knifeTiming, restoreKnifeTiming } from "./knife-timing";

test("native timing pins cover every bundled knife action and match its actual GLB", () => {
  const fingerprints = new Map<string, string>();
  expect(Object.keys(data.clips)).toHaveLength(225);
  for (const clip of Object.values(data.clips)) {
    let fingerprint = fingerprints.get(clip.input);
    if (!fingerprint) {
      fingerprint = createHash("sha256")
        .update(readFileSync(new URL(`../../../${clip.input}`, import.meta.url)))
        .digest("hex");
      fingerprints.set(clip.input, fingerprint);
    }
    expect(fingerprint, clip.input).toBe(clip.inputSha256);
    expect(clip.nativeSha256).toMatch(/^[0-9a-f]{64}$/);
  }
  expect(KNIFE_ANIMATION_RATE).toBe(1);
  expect(knifeTiming(4, "draw").duration).toBe(1.1667);
  expect(knifeTiming(4, "lookat01").duration).toBe(6.2);
  expect(knifeTiming(46, "heavy_miss1").duration).toBe(0.7667);
});

test("Bayonet restores the native sample interval without stretching its optimized heavy tail", () => {
  const timing = knifeTiming(4, "heavy_miss1");
  // These are the actual old export's 35 surviving sample times. Native source
  // has 36 samples; its final two poses are identical, so the last key was omitted.
  const times = Float32Array.from({ length: 35 }, (_, frame) => (frame * 1.1667) / 36);
  const values = Float32Array.from(times, (_, frame) => frame);
  const primary = new T.NumberKeyframeTrack("hand_R.position[x]", times, values);
  const secondary = new T.NumberKeyframeTrack("weapon_offset.position[x]", times, values);
  secondary.times = primary.times;
  const clip = new T.AnimationClip("heavy", -1, [primary, secondary]);
  restoreKnifeTiming(clip, timing);
  expect(clip.duration).toBe(1.1667);
  expect(primary.times[15]).toBeCloseTo((15 * 1.1667) / 35, 6);
  expect(primary.times[34]).toBeCloseTo((34 * 1.1667) / 35, 6);
  expect(primary.times[34]).toBeLessThan(clip.duration);
  expect(Array.from(primary.values)).toEqual(Array.from(values));
  const once = Array.from(primary.times);
  restoreKnifeTiming(clip, timing);
  expect(Array.from(primary.times)).toEqual(once);
});
