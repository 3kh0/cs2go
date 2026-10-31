import type { Input, PlayerState } from "@cs2go/protocol";
import { accelerate, fallStep, limitJumpSpeed, movement, weapons } from "./physics";
import type { DustMap } from "./dust-map";
import * as T from "three";
const position = new T.Vector3();
/** The same native Dust II hull queries run in prediction and authority. */
export function movePlayer(player: PlayerState, input: Input, dt: number, map: DustMap) {
  if (player.health <= 0 || player.waiting) return;
  const collision = map.collision;
  player.yaw = input.yaw;
  player.pitch = input.pitch;
  const radius = movement.hullRadius;
  let hull = player.eye + movement.standingHeight - movement.standingEye;
  const velocity = { x: player.vx, z: player.vz };
  const maxSpeed = weapons[player.weapon].speed;
  const speed =
    maxSpeed *
    (player.eye < 1.4 ? movement.crouchModifier : input.walk ? movement.walkModifier : 1);
  if (input.jump && player.grounded) {
    limitJumpSpeed(velocity, maxSpeed);
    player.vertical = movement.jumpImpulse;
    player.grounded = false;
  }
  const follow = player.grounded;
  accelerate(
    velocity,
    input.right * Math.cos(input.yaw) - input.forward * Math.sin(input.yaw),
    -input.right * Math.sin(input.yaw) - input.forward * Math.cos(input.yaw),
    speed,
    dt,
    player.grounded,
    player.grounded ? maxSpeed : speed,
  );
  const oldY = player.y,
    falling = fallStep(player.vertical, dt);
  position.set(player.x, player.y + falling.distance, player.z);
  player.vertical = falling.vertical;
  if (player.vertical > 0) {
    const ceiling = collision.ceiling(player.x, player.z, oldY + hull, position.y + hull, radius);
    if (Number.isFinite(ceiling)) {
      position.y = ceiling - hull;
      player.vertical = 0;
    }
  }
  const floor = collision.support(
    player.x,
    player.z,
    oldY + (follow ? 0.46 : 0.001),
    position.y - 0.2,
    radius,
  );
  player.grounded = player.vertical <= 0 && position.y <= floor;
  if (player.grounded) {
    position.y = floor;
    player.vertical = 0;
  }
  if (!collision.resolveHorizontal(position, radius, hull)) {
    position.y = oldY;
    player.vertical = 0;
  }
  collision.moveHorizontal(
    position,
    velocity,
    dt,
    radius,
    hull,
    player.vertical <= 0 && (follow || player.grounded),
  );
  if (player.vertical <= 0 && (follow || player.grounded)) {
    player.grounded = collision.followGround(position, radius, hull);
    if (player.grounded) player.vertical = 0;
  }
  const eye =
    player.eye +
    ((input.duck ? movement.duckEye : movement.standingEye) - player.eye) *
      (1 - Math.exp(-15 * dt));
  const feet = position.y + (player.grounded ? 0 : player.eye - eye);
  hull = eye + movement.standingHeight - movement.standingEye;
  if (
    eye <= player.eye ||
    (!collision.blocked(position.x, position.z, feet, radius, hull) &&
      !Number.isFinite(
        collision.ceiling(
          position.x,
          position.z,
          position.y + player.eye + movement.standingHeight - movement.standingEye,
          feet + hull,
          radius,
        ),
      ))
  ) {
    position.y = feet;
    player.eye = eye;
  }
  player.x = position.x;
  player.y = position.y;
  player.z = position.z;
  player.vx = velocity.x;
  player.vz = velocity.z;
}
