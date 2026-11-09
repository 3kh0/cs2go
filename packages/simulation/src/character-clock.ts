import type { PlayerAnimation } from "@cs2go/protocol";
/** Evaluate replicated clocks at the same delayed time as the actor transform.
 * A newer action's age identifies its start within the snapshot interval. */
export function interpolateCharacterClock(
  a: PlayerAnimation,
  b: PlayerAnimation,
  t: number,
  seconds: number,
): PlayerAnimation {
  const age = (previous: number | null, next: number | null) => {
    if (t >= 1) return next;
    if (next !== null && (previous === null || next < previous)) {
      const elapsed = next - (1 - t) * seconds;
      return elapsed >= 0 ? elapsed : previous === null ? null : previous + t * seconds;
    }
    return previous === null
      ? null
      : next === null
        ? previous + t * seconds
        : previous + (next - previous) * t;
  };
  return {
    plant: (a.plant ?? 0) + ((b.plant ?? 0) - (a.plant ?? 0)) * t,
    phase: (a.phase + ((b.phase - a.phase + 1) % 1) * t) % 1,
    air:
      (a.air === 0 && b.air === 0) || (b.air === 0 && t >= 1)
        ? 0
        : a.air + (b.air === 0 ? seconds : b.air - a.air) * t,
    shot: age(a.shot, b.shot),
    draw: age(a.draw, b.draw),
    reload: age(a.reload, b.reload),
  };
}
