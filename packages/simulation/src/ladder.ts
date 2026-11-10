import * as T from "three";
import { movement, SOURCE_UNIT } from "./physics";
import type { MapCollision } from "./map-collision";
import {
  actorCeiling,
  actorLanding,
  actorSupport,
  slideActors,
  type ActorHull,
} from "./actor-collision";

export type NativeLadder = {
  id: number;
  width: number;
  top: readonly number[];
  bottom: readonly number[];
  length: number;
  direction: number;
  areaConnections: readonly number[];
  exitTop?: readonly number[];
  exitBottom?: readonly number[];
};
export type LadderState = { id: number | null; detachTime: number; exit?: 1 | -1 };
export const createLadderState = (): LadderState => ({ id: null, detachTime: 0 });
export type LadderInput = {
  yaw: number;
  /** Source input convention: positive looks down. */
  pitch: number;
  forward: number;
  right: number;
  jump: boolean;
  /** Bot-only intent along a native ladder connection. */
  climb?: number;
};
// Authored NAV directions are Source N/E/S/W, converted to browser X/Z.
const normals = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const;
export function ladderNormal(ladder: NativeLadder) {
  const normal = normals[ladder.direction];
  if (!normal) throw new Error(`Unknown native ladder direction ${ladder.direction}`);
  return new T.Vector3(normal[0], 0, normal[1]);
}

/** Source-style ladder projection on native dimensions; the browser hull solver
 * replaces Source's trace movement. Published SDK climb/jump values are a
 * reconstruction until independently verified against the installed CS2.
 * https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/shared/gamemovement.cpp
 */
export function stepLadder(
  position: T.Vector3,
  input: LadderInput,
  dt: number,
  ladders: readonly NativeLadder[] | undefined,
  collision: MapCollision,
  hullHeight: number,
  state: LadderState,
  radius = movement.hullRadius,
  actors: readonly ActorHull[] | (() => readonly ActorHull[]) = [],
): { velocity: T.Vector3; grounded: boolean } | undefined {
  state.detachTime = Math.max(0, state.detachTime - dt);
  if (!ladders?.length || state.detachTime > 0) {
    state.id = null;
    state.exit = undefined;
    return undefined;
  }
  const wish = new T.Vector3(
    input.right * Math.cos(input.yaw) - input.forward * Math.sin(input.yaw) * Math.cos(input.pitch),
    -input.forward * Math.sin(input.pitch),
    -input.right * Math.sin(input.yaw) -
      input.forward * Math.cos(input.yaw) * Math.cos(input.pitch),
  );
  let selected: NativeLadder | undefined;
  let selectionScore = -Infinity;
  for (const ladder of ladders) {
    const normal = normals[ladder.direction];
    if (!normal) continue;
    const dy = ladder.top[1] - ladder.bottom[1];
    const fraction = T.MathUtils.clamp((position.y - ladder.bottom[1]) / Math.max(0.001, dy), 0, 1);
    const x = T.MathUtils.lerp(ladder.bottom[0], ladder.top[0], fraction);
    const z = T.MathUtils.lerp(ladder.bottom[2], ladder.top[2], fraction);
    const distance = (position.x - x) * normal[0] + (position.z - z) * normal[1];
    const side = (position.x - x) * -normal[1] + (position.z - z) * normal[0];
    if (
      position.y < ladder.bottom[1] - 0.46 ||
      position.y > ladder.top[1] + 0.1 ||
      Math.abs(side) > ladder.width / 2 + radius ||
      distance < -radius * 0.5 ||
      distance > radius + 2 * SOURCE_UNIT + 0.025
    )
      continue;
    const alreadyAttached = state.id === ladder.id;
    if (!alreadyAttached && !input.climb && wish.x * normal[0] + wish.z * normal[1] >= -0.05)
      continue;
    // Adjacent stacked NAV ladders share the same face at their joint.
    // Retain an attached ladder until its physical exit completes; a new
    // attachment prefers vertical room in the requested climb direction.
    const intent = input.climb ?? wish.y - wish.x * normal[0] - wish.z * normal[1];
    const room = intent >= 0 ? ladder.top[1] - position.y : position.y - ladder.bottom[1];
    const score = (alreadyAttached ? 10000 : 0) + Math.min(1, Math.max(-1, room));
    if (score > selectionScore) {
      selected = ladder;
      selectionScore = score;
    }
  }
  if (!selected) {
    state.id = null;
    state.exit = undefined;
    return undefined;
  }
  state.id = selected.id;
  const normal = ladderNormal(selected);
  const speed = 200 * SOURCE_UNIT;
  let velocity: T.Vector3;
  if (input.jump) {
    velocity = normal.multiplyScalar(270 * SOURCE_UNIT);
    state.id = null;
    state.exit = undefined;
    state.detachTime = 0.2;
  } else if (input.climb) {
    velocity = new T.Vector3(0, Math.sign(input.climb) * speed, 0);
  } else {
    const into = wish.dot(normal);
    velocity = wish.clone().addScaledVector(normal, -into);
    // CS ladder damping reduces accidental lateral motion while facing into
    // the face. The into-face component becomes upward movement.
    const sideways = Math.hypot(velocity.x, velocity.z);
    if (into / Math.max(1e-8, Math.hypot(into, sideways)) < -0.707) {
      velocity.x *= 0.2;
      velocity.z *= 0.2;
    }
    velocity.y -= into;
    velocity.multiplyScalar(speed).clampLength(0, speed);
  }
  if (!input.jump && velocity.y) {
    const rise = Math.max(0.001, selected.top[1] - selected.bottom[1]);
    velocity.x += ((selected.top[0] - selected.bottom[0]) / rise) * velocity.y;
    velocity.z += ((selected.top[2] - selected.bottom[2]) / rise) * velocity.y;
  }
  // At either end, walk onto the actual connected native floor. This remains
  // collision-constrained and never snaps/teleports through the ladder lip.
  if (!input.jump && !state.exit) {
    if (velocity.y > 0 && position.y >= selected.top[1] - 0.02) state.exit = 1;
    else if (
      velocity.y < 0 &&
      position.y <= Math.max(selected.bottom[1], selected.exitBottom?.[1] ?? -Infinity) + 0.02
    )
      state.exit = -1;
  }
  const exitingTop = state.exit === 1;
  const exitingBottom = state.exit === -1;
  const exit = exitingTop ? selected.exitTop : exitingBottom ? selected.exitBottom : undefined;
  if (exit) {
    velocity.set(exit[0] - position.x, 0, exit[2] - position.z).clampLength(0, speed);
    if (Math.hypot(velocity.x, velocity.z) < radius) {
      state.id = null;
      state.exit = undefined;
      state.detachTime = 0.2;
      return undefined;
    }
    velocity.setLength(speed);
  }
  const previous = position.clone();
  const requestedY = position.y + velocity.y * dt;
  if (velocity.y > 0) {
    const ceiling = collision.ceiling(
      position.x,
      position.z,
      position.y + hullHeight,
      requestedY + hullHeight,
      radius,
    );
    position.y = Number.isFinite(ceiling) ? Math.min(requestedY, ceiling - hullHeight) : requestedY;
    if (position.y < requestedY) velocity.y = 0;
  } else {
    const floor = collision.support(position.x, position.z, position.y + 0.01, requestedY, radius);
    position.y = Number.isFinite(floor) ? Math.max(requestedY, floor) : requestedY;
  }
  // A fixed step can cross an endpoint between intent samples. Commit that
  // exit now, before a bot's remaining vertical error becomes its zero-intent
  // dead zone on the next tick.
  if (!input.jump && !state.exit) {
    if (velocity.y > 0 && position.y >= selected.top[1] - 0.02) state.exit = 1;
    else if (
      velocity.y < 0 &&
      position.y <= Math.max(selected.bottom[1], selected.exitBottom?.[1] ?? -Infinity) + 0.02
    )
      state.exit = -1;
  }
  const horizontal = { x: velocity.x, z: velocity.z };
  collision.moveHorizontal(position, horizontal, dt, radius, hullHeight, !!exit);
  // Resolve other players at the swept contact, not just static ladder/wall
  // geometry. Collect crowded bot hulls only after a ladder actually attaches.
  const hulls = typeof actors === "function" ? actors() : actors;
  let actorGrounded = false;
  if (hulls.length) {
    const ceiling = actorCeiling(previous, position, hullHeight, hulls, radius);
    if (velocity.y > 0 && Number.isFinite(ceiling)) {
      position.y = Math.min(position.y, ceiling - hullHeight);
      velocity.y = 0;
    }
    const floor = actorLanding(previous, position, hulls, radius);
    if (velocity.y <= 0 && Number.isFinite(floor)) {
      position.y = Math.max(position.y, floor);
      velocity.y = 0;
      actorGrounded = true;
    }
    const hit = slideActors(previous, position, hullHeight, hulls, radius);
    if (hit.hitX) velocity.x = 0;
    if (hit.hitZ) velocity.z = 0;
  }
  if (!collision.resolveHorizontal(position, radius, hullHeight)) {
    position.copy(previous);
    velocity.set(0, 0, 0);
    actorGrounded = false;
  }
  const floor = Math.max(
    collision.support(position.x, position.z, position.y + 0.02, position.y - 0.03, radius),
    actorSupport(position.x, position.z, previous.y, position.y, hulls, radius, actorGrounded),
  );
  const grounded = Number.isFinite(floor) && Math.abs(position.y - floor) < 0.03 && velocity.y <= 0;
  if (grounded && (exitingBottom || state.id === null)) {
    state.id = null;
    state.exit = undefined;
    state.detachTime = 0.2;
  }
  return { velocity, grounded };
}
