import type { AnimationClip } from "three";
import data from "@cs2go/simulation/knife-animations";

export type KnifeTiming = { duration: number; timeScale: number; inspectBlockedUntil?: number };
const timings = data.clips as Record<string, KnifeTiming>;
const restored = new WeakSet<AnimationClip>();
// Native clip nodes use a 1.0 base speed. Firearms retain their separate rate.
export const KNIFE_ANIMATION_RATE = 1;

export function knifeTiming(index: number, action: string) {
  const timing = timings[`${index}/${action}`];
  if (!timing) throw new Error(`Missing native knife timing: ${index}/${action}`);
  return timing;
}
export function knifeAttackMotion(
  index: number,
  stab: boolean,
  alternate: boolean,
  contact = false,
) {
  const prefix = stab ? "heavy" : "light";
  const variant = stab ? 1 : alternate ? 2 : 1;
  const hit = `${prefix}_hit${variant}`;
  return contact && timings[`${index}/${hit}`] ? hit : `${prefix}_miss${variant}`;
}
export function knifeInspectBlockDuration(
  index: number,
  stab: boolean,
  alternate: boolean,
  contact: boolean,
) {
  return (
    knifeTiming(index, knifeAttackMotion(index, stab, alternate, contact)).inspectBlockedUntil ?? 0
  );
}

export function restoreKnifeTiming(clip: AnimationClip, timing: KnifeTiming) {
  if (restored.has(clip)) return clip;
  const arrays = new Set<Float32Array | number[]>();
  for (const track of clip.tracks) {
    if (arrays.has(track.times)) continue;
    arrays.add(track.times);
    for (let i = 0; i < track.times.length; i++) track.times[i] *= timing.timeScale;
  }
  // Constant trailing keys can be optimized away. The native duration still
  // includes that held pose, so it must not be inferred from the final key.
  clip.duration = timing.duration;
  restored.add(clip);
  return clip;
}
