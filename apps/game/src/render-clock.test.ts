import { describe, expect, it } from "vitest";
import { advanceRenderClock } from "./render-clock";

describe("render cap cadence", () => {
  it("matches the cap across common refresh rates without double-rendering early frames", () => {
    for (const refresh of [60, 120, 144, 165, 240, 360]) {
      for (const cap of [30, 60, 90, 120, 144, 165, 240, 360]) {
        let clock = 0,
          renders = 0;
        for (let frame = 1; frame <= refresh * 10; frame++) {
          const next = advanceRenderClock(clock, (frame * 1000) / refresh, cap);
          if (next === null) continue;
          clock = next;
          renders++;
        }
        expect(Math.abs(renders - Math.min(refresh, cap) * 10)).toBeLessThanOrEqual(1);
      }
    }
  });
  it("advances an early accepted frame and skips its next too-early callback", () => {
    const clock = advanceRenderClock(0, 33, 30)!;
    expect(clock).toBeCloseTo(1000 / 30);
    expect(advanceRenderClock(clock, 33, 30)).toBeNull();
    expect(advanceRenderClock(clock, 50, 30)).toBeNull();
    expect(advanceRenderClock(clock, 66.5, 30)).toBeCloseTo(2000 / 30);
  });
  it("skips missed render deadlines after stalls without a burst of catch-up renders", () => {
    const clock = advanceRenderClock(0, 501, 60)!;
    expect(clock).toBeCloseTo(500);
    expect(advanceRenderClock(clock, 502, 60)).toBeNull();
    expect(advanceRenderClock(clock, 516.4, 60)).toBeCloseTo(500 + 1000 / 60);
    expect(advanceRenderClock(clock, 502, 0)).toBe(502);
  });
});
