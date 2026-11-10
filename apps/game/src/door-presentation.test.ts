import { expect, test } from "vitest";
import type { DoorState } from "@cs2go/protocol";
import { interpolateDoorStates } from "./door-presentation";

test("door presentation moves continuously between authorized snapshots while keeping physics snapshots immutable", () => {
  const before = [{ id: "door", angle: -60, target: -90, returnTime: -1 }],
    after = [{ ...before[0], angle: -72 }],
    result: DoorState[] = [];
  expect(interpolateDoorStates(before, after, 0.25, true, result)[0].angle).toBe(-63);
  const reused = result[0];
  expect(interpolateDoorStates(before, after, 0.75, true, result)[0].angle).toBe(-69);
  expect(result[0]).toBe(reused);
  expect(before[0].angle).toBe(-60);
  expect(after[0].angle).toBe(-72);
});
test("round resets and late joins snap to their own source state instead of blending through doors", () => {
  const before = [{ id: "door", angle: 90, target: 90, returnTime: -1 }],
    after = [{ ...before[0], angle: 0, target: 0 }];
  expect(interpolateDoorStates(before, after, 0.5, false, [])[0].angle).toBe(0);
  expect(interpolateDoorStates([], before, 0.5, true, [])[0].angle).toBe(90);
  expect(interpolateDoorStates(before, after, 2, true, [])[0].angle).toBe(0);
});

test("damage stages are discrete on the delayed timeline and stale optional fields cannot leak", () => {
  const before = [{ id: "door", angle: 0, target: 90, returnTime: -1, health: 900, stage: 1 }];
  const after = [{ id: "door", angle: 90, target: 90, returnTime: -1, health: 175, stage: 4 }];
  const result: DoorState[] = [];
  interpolateDoorStates(before, after, 0.5, true, result);
  expect(result[0]).toMatchObject({ angle: 45, health: 900, stage: 1 });
  interpolateDoorStates(before, after, 1, true, result);
  expect(result[0]).toMatchObject({ angle: 90, health: 175, stage: 4 });
  interpolateDoorStates(
    after,
    [{ id: "door", angle: 0, target: 0, returnTime: -1 }],
    0,
    false,
    result,
  );
  expect(result[0].stage).toBeUndefined();
  expect(result[0].health).toBeUndefined();
});
