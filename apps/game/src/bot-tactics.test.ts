import { expect, it } from "vitest";
import * as T from "three";
import {
  botAimSpread,
  botBodyHit,
  burstLength,
  inBotView,
  nearestDefuser,
  targetPriority,
} from "./bot-tactics";

it("cannot acquire a distant enemy behind it even when alerted", () => {
  expect(inBotView(0, 0, -20, true)).toBe(false);
  expect(inBotView(0, 10, 10, false)).toBe(true);
  expect(inBotView(0, 0, -1, false)).toBe(true);
});
it("keeps its current engagement unless a substantially closer threat appears", () => {
  expect(targetPriority(15, true, false)).toBeLessThan(targetPriority(12, false, false));
  expect(targetPriority(2, false, true)).toBeLessThan(targetPriority(15, true, false));
});
it("requires a real body intersection and resolves headshots and crouch height", () => {
  const feet = new T.Vector3(0, 0, -10);
  expect(
    botBodyHit(new T.Ray(new T.Vector3(0, 1.53, 0), new T.Vector3(0, 0, -1)), feet)?.head,
  ).toBe(true);
  expect(botBodyHit(new T.Ray(new T.Vector3(0, 1.2, 0), new T.Vector3(0, 0, -1)), feet)?.head).toBe(
    false,
  );
  expect(botBodyHit(new T.Ray(new T.Vector3(1, 1.2, 0), new T.Vector3(0, 0, -1)), feet)).toBeNull();
  expect(
    botBodyHit(new T.Ray(new T.Vector3(0, 1.53, 0), new T.Vector3(0, 0, -1)), feet, true),
  ).toBeNull();
});
it("settled short bursts are more accurate than running sprays", () => {
  expect(botAimSpread(20, 0, 1, 0)).toBeLessThan(botAimSpread(20, 4, 7, 0.2));
  expect(burstLength(30, true)).toBeLessThan(burstLength(5, true));
  expect(burstLength(5, false)).toBe(1);
});
it("assigns one free CT to defuse and preserves an active defuser", () => {
  const candidates = [
    { index: 1, distance: 3, busy: true },
    { index: 2, distance: 5, busy: false },
  ];
  expect(nearestDefuser(candidates, null)).toBe(2);
  expect(nearestDefuser(candidates, 1)).toBe(1);
  expect(nearestDefuser(candidates, "player")).toBe("player");
  expect(nearestDefuser([], null)).toBeNull();
});
