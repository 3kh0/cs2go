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
