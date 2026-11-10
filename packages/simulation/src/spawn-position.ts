import type { Vector3 } from "three";
import type { MapCollision } from "./map-collision";
import { movement } from "./physics";

/** Authored player starts may float above sloped ground. Settle the standing
 * footprint before the first snapshot, using the same support as movement. */
export function groundSpawn(position: Vector3, collision: MapCollision) {
  const authoredY = position.y;
  const floor = collision.floor(position.x, position.z, authoredY + 0.5);
  if (!Number.isFinite(floor)) return false;
  position.y = floor;
  if (!collision.followGround(position, movement.hullRadius, movement.standingHeight)) {
    position.y = authoredY;
    return false;
  }
  return true;
}
