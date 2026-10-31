import type { Input, PlayerState } from "@cs2go/protocol";
import { accelerate, blocked, fallStep, limitJumpSpeed, movement, weapons } from "./physics";
import { yardWalls } from "./yard";

/** Browser prediction and server authority execute this identical fixed step.
 * Yard uses its original AABB collision; Dust II's triangle controller is separate. */
export function movePlayer(player: PlayerState, input: Input, dt: number) {
  if (player.health <= 0) return;
  player.yaw = input.yaw;
  player.pitch = input.pitch;
  const crouchEye = input.duck ? movement.duckEye : movement.standingEye;
  const nextEye = player.eye + (crouchEye - player.eye) * (1 - Math.exp(-15 * dt));
  const height = nextEye + movement.standingHeight - movement.standingEye;
  const radius = movement.hullRadius;
  if (nextEye <= player.eye || !blocked(player.x, player.z, player.y, yardWalls, radius, height))
    player.eye = nextEye;
  const hull = player.eye + movement.standingHeight - movement.standingEye;
  const maxSpeed = weapons[0].speed;
  const speed =
    maxSpeed *
    (player.eye < 1.4 ? movement.crouchModifier : input.walk ? movement.walkModifier : 1);
  const velocity = { x: player.vx, z: player.vz };
  if (input.jump && player.grounded) {
    limitJumpSpeed(velocity, maxSpeed);
    player.vertical = movement.jumpImpulse;
    player.grounded = false;
  }
  const dx = input.right * Math.cos(input.yaw) - input.forward * Math.sin(input.yaw);
  const dz = -input.right * Math.sin(input.yaw) - input.forward * Math.cos(input.yaw);
  accelerate(velocity, dx, dz, speed, dt, player.grounded, player.grounded ? maxSpeed : speed);
  const oldY = player.y;
  const falling = fallStep(player.vertical, dt);
  player.y += falling.distance;
  player.vertical = falling.vertical;
  let floor = 0;
  for (const wall of yardWalls) {
    if (
      Math.abs(player.x - wall.x) >= wall.w / 2 + radius ||
      Math.abs(player.z - wall.z) >= wall.d / 2 + radius
    )
      continue;
    if (oldY >= wall.h - 0.05) floor = Math.max(floor, wall.h);
    if (player.vertical > 0 && wall.y && oldY + hull <= wall.y && player.y + hull > wall.y) {
      player.y = wall.y - hull;
      player.vertical = 0;
    }
  }
  player.grounded = player.vertical <= 0 && player.y <= floor;
  if (player.grounded) {
    player.y = floor;
    player.vertical = 0;
  }
  const nextX = player.x + velocity.x * dt;
  if (!blocked(nextX, player.z, player.y, yardWalls, radius, hull)) player.x = nextX;
  else velocity.x = 0;
  const nextZ = player.z + velocity.z * dt;
  if (!blocked(player.x, nextZ, player.y, yardWalls, radius, hull)) player.z = nextZ;
  else velocity.z = 0;
  player.vx = velocity.x;
  player.vz = velocity.z;
}
