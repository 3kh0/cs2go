import { expect, test } from "vitest";
import { interpolateCharacterClock } from "./character-clock";
import type { PlayerAnimation } from "@cs2go/protocol";
const clock = (phase: number, shot: number | null = null): PlayerAnimation => ({
  phase,
  air: 0,
  shot,
  draw: null,
  reload: null,
});
test("replicated native phase interpolates through wrap without reversing a stride", () => {
  const middle = interpolateCharacterClock(clock(0.98), clock(0.02), 0.5, 1 / 32);
  expect(middle.phase).toBeCloseTo(0, 8);
  expect(middle.air).toBe(0);
  expect(interpolateCharacterClock(clock(0.2), clock(0.3), 0.5, 0.03).phase).toBeCloseTo(0.25);
});
test("action ages start at the authoritative event time inside a snapshot interval", () => {
  expect(interpolateCharacterClock(clock(0.1), clock(0.2, 0.01), 0.25, 0.04).shot).toBeNull();
  expect(interpolateCharacterClock(clock(0.1), clock(0.2, 0.01), 0.9, 0.04).shot).toBeCloseTo(
    0.006,
  );
  expect(interpolateCharacterClock(clock(0.1, 0.2), clock(0.2, 0.01), 0.25, 0.04).shot).toBeCloseTo(
    0.21,
  );
  expect(interpolateCharacterClock(clock(0.1, 0.2), clock(0.2, null), 1, 0.04).shot).toBeNull();
  expect(
    JSON.stringify(interpolateCharacterClock(clock(0.1), clock(0.2), 0.5, 0.04)),
  ).not.toContain("Infinity");
});
