import type { DoorState } from "@cs2go/protocol";

/** Door visuals use the same delayed snapshot pair as remote actors. Physics
 * remains at the authoritative pose used by prediction and hit queries. */
export function interpolateDoorStates(
  before: readonly DoorState[],
  after: readonly DoorState[],
  fraction: number,
  sameRound: boolean,
  result: DoorState[],
) {
  const t = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 1;
  result.length = after.length;
  for (let i = 0; i < after.length; i++) {
    const next = after[i],
      previous = before.find((state) => state.id === next.id);
    const state = (result[i] ??= { ...next });
    Object.assign(state, next);
    state.health = next.health;
    state.stage = next.stage;
    if (sameRound && previous) {
      state.angle = previous.angle + (next.angle - previous.angle) * t;
      // Damage changes geometry discretely on this delayed actor timeline.
      // Never synthesize an intermediate stage, or reveal a future hole early.
      if (t < 1) {
        state.stage = previous.stage;
        state.health = previous.health;
      }
    }
  }
  return result;
}
