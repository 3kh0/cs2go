import { expect, test } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";
import { createLadderState, stepLadder, type NativeLadder } from "./ladder";
import { movement } from "./physics";

const ladder: NativeLadder = {
  id: 1,
  width: 0.6,
  bottom: [0, 0, 0],
  top: [0, 1, 0],
  length: 1,
  direction: 0,
  areaConnections: [],
  exitTop: [0, 1.1, 1.3],
  exitBottom: [0, 0, 1.3],
};
const input = (climb: number) => ({ yaw: 0, pitch: 0, forward: 0, right: 0, jump: false, climb });
function floor(y: number, z = 0) {
  return new T.Mesh(
    new T.PlaneGeometry(6, 6).rotateX(-Math.PI / 2).translate(0, y, z),
    new T.MeshBasicMaterial(),
  );
}

test("a stacked ladder joint attaches to the segment with room in the requested direction", () => {
  const upper = { ...ladder, id: 2, bottom: [0, 1, 0], top: [0, 3, 0], length: 2 };
  const collision = new MapCollision([floor(-3)]);
  for (const climb of [1, -1]) {
    const state = createLadderState(),
      position = new T.Vector3(0, 1, 0.42);
    stepLadder(
      position,
      input(climb),
      1 / 128,
      [ladder, upper],
      collision,
      movement.standingHeight,
      state,
    );
    expect(state.id).toBe(climb > 0 ? 2 : 1);
    expect(Math.sign(position.y - 1)).toBe(climb);
  }
});

test("crossing the top commits a physical exit before the bot vertical-intent dead zone", () => {
  const collision = new MapCollision([floor(0), floor(1.1, 3.6)]);
  const position = new T.Vector3(0, 0.979, 0.42),
    state = createLadderState();
  stepLadder(position, input(1), 1 / 128, [ladder], collision, movement.standingHeight, state);
  expect(position.y).toBeGreaterThan(1);
  expect(state.exit).toBe(1);
  const before = position.clone();
  const result = stepLadder(
    position,
    input(0),
    1 / 128,
    [ladder],
    collision,
    movement.standingHeight,
    state,
  )!;
  expect(result.velocity.z).toBeGreaterThan(0);
  expect(position.z).toBeGreaterThan(before.z);
  expect(position.y).toBeCloseTo(1.1, 5);
  expect(position.y - before.y).toBeLessThanOrEqual(18 * 0.0254);
  expect(
    collision.blocked(
      position.x,
      position.z,
      position.y,
      movement.hullRadius,
      movement.standingHeight,
    ),
  ).toBe(false);
});

test("crossing the bottom completes the exit despite zero or reversed residual bot intent", () => {
  const collision = new MapCollision([floor(0)]);
  const position = new T.Vector3(0, 0.025, 0.42),
    state = createLadderState();
  stepLadder(position, input(-1), 1 / 128, [ladder], collision, movement.standingHeight, state);
  expect(state.exit).toBe(-1);
  const before = position.clone();
  stepLadder(position, input(1), 1 / 128, [ladder], collision, movement.standingHeight, state);
  expect(position.z).toBeGreaterThan(before.z);
  expect(position.y).toBeCloseTo(0, 10);
  expect(state.id).toBeNull();
  expect(state.detachTime).toBeGreaterThan(0);
  expect(
    stepLadder(position, input(1), 1 / 128, [ladder], collision, movement.standingHeight, state),
  ).toBeUndefined();
});
