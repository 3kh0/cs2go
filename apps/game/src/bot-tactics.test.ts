import { expect, it } from "vitest";
import * as T from "three";
import {
  botAimSpread,
  botBodyHit,
  botRegroupGoal,
  botSearchGoal,
  botShouldMove,
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

it("advances a carrier or retaker through distant contact without interrupting interactions", () => {
  const state = {
    distance: 20,
    arrival: 0.6,
    targetDistance: 25,
    suppressing: true,
    reposition: false,
    committed: true,
    interacting: false,
  };
  expect(botShouldMove(state)).toBe(true);
  expect(botShouldMove({ ...state, targetDistance: null })).toBe(true);
  expect(botShouldMove({ ...state, targetDistance: 4 })).toBe(false);
  expect(botShouldMove({ ...state, committed: false })).toBe(false);
  expect(botShouldMove({ ...state, interacting: true })).toBe(false);
  expect(botShouldMove({ ...state, distance: 0.5 })).toBe(false);
  expect(botShouldMove({ ...state, committed: false, reposition: true })).toBe(true);
});

it("searches different connected lanes over time and avoids stacked floors and isolated props", () => {
  const areas = [
    { center: [0, 0, 6], links: [1] },
    { center: [6, 0, 0], links: [0] },
    { center: [0, 0, -6], links: [1] },
    { center: [-6, 0, 0], links: [0] },
    { center: [0, 4, 6], links: [1] },
    { center: [0, 0, 6.01], links: [] },
  ];
  const anchor = new T.Vector3();
  expect(botSearchGoal(areas, anchor, 0, 0).toArray()).toEqual([0, 0, 6]);
  expect(botSearchGoal(areas, anchor, 0, 6).toArray()).toEqual([6, 0, 0]);
  expect(botSearchGoal(areas, anchor, 0, 12).toArray()).toEqual([0, 0, -6]);
  expect(botSearchGoal(areas, anchor, 1, 0).equals(botSearchGoal(areas, anchor, 0, 0))).toBe(false);
  expect(botSearchGoal([], anchor, 0, 0)).toEqual(anchor);
  expect(botSearchGoal([], anchor, 0, 0)).not.toBe(anchor);
});

it("catches up with a pushing squad and keeps going through distant contact until regrouped", () => {
  const leader = new T.Vector3(0, 2, 20);
  const position = new T.Vector3(0, 0, 0);
  const goal = botRegroupGoal(position, leader, 1);
  expect(goal?.toArray()).toEqual([0, 2, 17]);
  expect(leader.toArray()).toEqual([0, 2, 20]);
  expect(
    botShouldMove({
      distance: position.distanceTo(goal!),
      arrival: 1.3,
      targetDistance: 30,
      suppressing: true,
      reposition: false,
      committed: goal !== null,
      interacting: false,
    }),
  ).toBe(true);
  expect(botRegroupGoal(new T.Vector3(0, 2, 10), leader, 1)).toBeNull();
  expect(botRegroupGoal(new T.Vector3(0, 2, 10), leader, 1, true)).not.toBeNull();
  expect(botRegroupGoal(new T.Vector3(0, 2, 12), leader, 1, true)).toBeNull();
  expect(botRegroupGoal(position, null, 1)).toBeNull();
});

it("spreads escorts behind their leader instead of sending every follower to the same point", () => {
  const leader = new T.Vector3(20, 0, 0);
  const position = new T.Vector3();
  const goals = [0, 1, 2].map((index) => botRegroupGoal(position, leader, index)!);
  expect(goals.every((goal) => goal.x < leader.x && goal.x > position.x)).toBe(true);
  expect(new Set(goals.map((goal) => goal.z)).size).toBe(3);
});

it("widens a prolonged quiet search beyond an empty site without enemy position knowledge", () => {
  const areas = [
    { center: [0, 0, -6], links: [1] },
    { center: [0, 0, -22], links: [0] },
    { center: [0, 0, -40], links: [1] },
  ];
  const anchor = new T.Vector3();
  expect(botSearchGoal(areas, anchor, 0, 12).z).toBe(-6);
  expect(botSearchGoal(areas, anchor, 0, 36).z).toBe(-22);
  expect(botSearchGoal(areas, anchor, 0, 60).z).toBe(-40);
});
