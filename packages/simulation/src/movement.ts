import type { Input, PlayerState } from "@cs2go/protocol";
import { accelerate, fallStep, limitJumpSpeed, movement, weapons } from "./physics";
import type { DustMap } from "./dust-map";
import * as T from "three";
import { actorLanding, actorSupport, slideActors } from "./actor-collision";
const position = new T.Vector3();
/** The same native Dust II hull queries run in prediction and authority. */
export function movePlayer(
  player: PlayerState,
  input: Input,
  dt: number,
  map: DustMap,
  others: readonly PlayerState[] = [],
) {
  if (player.health <= 0 || player.waiting) return;
  const collision = map.collision;
  position.set(player.x, player.y, player.z);
  if (
    collision.recoverGround(
      position,
      movement.hullRadius,
      player.eye + movement.standingHeight - movement.standingEye,
    )
  ) {
    player.y = position.y;
    player.grounded = player.vertical <= 0;
    if (player.grounded) player.vertical = 0;
  }
  const start = { x: player.x, y: player.y, z: player.z };
  const actors = others
    .filter((other) => other.id !== player.id && other.health > 0 && !other.waiting)
    .map((other) => ({
      x: other.x,
      y: other.y,
      z: other.z,
      height: other.eye + movement.standingHeight - movement.standingEye,
      radius: movement.hullRadius,
    }));
  player.yaw = input.yaw;
  player.pitch = input.pitch;
  const radius = movement.hullRadius;
  let hull = player.eye + movement.standingHeight - movement.standingEye;
  const velocity = { x: player.vx, z: player.vz };
  player.scope = Math.min(weapons[player.weapon].zoomLevels, input.scope);
  const maxSpeed =
    (player.scope && weapons[player.weapon].scopedSpeed) || weapons[player.weapon].speed;
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
  const floor = Math.max(
    actorSupport(player.x, player.z, oldY, position.y, actors, radius, follow),
    collision.support(player.x, player.z, oldY + (follow ? 0.46 : 0.001), position.y - 0.2, radius),
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
  if (actors.length) {
    const hit = slideActors(start, position, hull, actors, radius);
    if (hit.hitX) velocity.x = 0;
    if (hit.hitZ) velocity.z = 0;
    const landing = actorLanding(start, position, actors, radius);
    const support = actorSupport(position.x, position.z, oldY, position.y, actors, radius, follow);
    const actorFloor = Math.max(landing, support);
    if (player.vertical <= 0 && position.y <= actorFloor + 0.04 && Number.isFinite(actorFloor)) {
      position.y = actorFloor;
      player.vertical = 0;
      player.grounded = true;
    }
  }
  const eye =
    player.eye +
    ((input.duck ? movement.duckEye : movement.standingEye) - player.eye) *
      (1 - Math.exp(-15 * dt));
  const feet = position.y + (player.grounded ? 0 : player.eye - eye);
  hull = eye + movement.standingHeight - movement.standingEye;
  const floorInExtension =
    !player.grounded && feet < position.y
      ? collision.support(position.x, position.z, position.y, feet, radius)
      : -Infinity;
  if (
    eye <= player.eye ||
    (!Number.isFinite(floorInExtension) &&
      !collision.blocked(position.x, position.z, feet, radius, hull) &&
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
  if (
    collision.recoverGround(
      position,
      radius,
      player.eye + movement.standingHeight - movement.standingEye,
    )
  ) {
    player.grounded = player.vertical <= 0;
    if (player.grounded) player.vertical = 0;
  }
  player.x = position.x;
  player.y = position.y;
  player.z = position.z;
  player.vx = velocity.x;
  player.vz = velocity.z;
}
