import * as T from "three";
import type { MapCollision } from "./map-collision";
const previous = new T.Vector3();
/** Existing local drop integrator, shared with the authoritative match. */
export function advanceDroppedWeapon(
  position: T.Vector3,
  velocity: T.Vector3,
  rotation: { x: number; z: number },
  state: { age: number; sleeping: boolean; tossed: boolean },
  dt: number,
  collision?: MapCollision,
) {
  state.age += dt;
  if (state.sleeping || state.age > 5) return;
  if (state.tossed) {
    rotation.x += dt * 5;
    rotation.z += dt * 2;
  }
  velocity.y -= 20.32 * dt;
  previous.copy(position);
  position.addScaledVector(velocity, dt);
  const floor =
    collision?.support(position.x, position.z, previous.y + 0.1, position.y - 0.2, 0.08) ?? 0;
  if (Number.isFinite(floor) && position.y <= floor + 0.06) {
    position.y = floor + 0.06;
    velocity.set(0, 0, 0);
    state.sleeping = true;
    rotation.x = rotation.z = 0;
  }
  if (collision && !collision.resolveHorizontal(position, 0.1, 0.15)) {
    position.copy(previous);
    velocity.x = velocity.z = 0;
  }
}

const pickupFrom = new T.Vector3(),
  pickupTo = new T.Vector3();
export function canPickupDroppedWeapon(
  drop: { x: number; y: number; z: number },
  age: number,
  own: boolean,
  player: { x: number; y: number; z: number },
  visible: (from: T.Vector3, to: T.Vector3) => boolean,
) {
  if (
    age <= 0.4 ||
    (own && age <= 1.5) ||
    Math.hypot(drop.x - player.x, drop.y - player.y - 0.3, drop.z - player.z) >= 1.5
  )
    return false;
  pickupFrom.set(player.x, player.y + 0.6, player.z);
  pickupTo.set(drop.x, drop.y + 0.15, drop.z);
  return visible(pickupFrom, pickupTo);
}
