/** Advance the ideal render clock, independently of simulation time.
 * The half-millisecond tolerance absorbs rAF timestamp jitter. When accepting
 * an early frame, advance at least one full interval instead of leaving the
 * clock unchanged through a near-interval modulo remainder.
 */
export function advanceRenderClock(previous: number, now: number, fpsCap: number): number | null {
  if (!fpsCap) return now;
  const interval = 1000 / fpsCap;
  const elapsed = now - previous;
  if (elapsed < interval - 0.5) return null;
  return previous + Math.max(1, Math.floor((elapsed + 0.5) / interval)) * interval;
}
