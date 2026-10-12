import { ballistics } from "./ballistics";
// CS2 console defaults, converted from Source inches to the scene's meters.
// Source SDK movement order/formulas and pinned data references: README.md.
export const SOURCE_UNIT = 0.0254;
// Shared by animation phases and gameplay events so hands, audio and ammo agree.
export const WEAPON_ANIMATION_RATE = 0.9;
export const movement = {
  groundAcceleration: 5.5,
  airAcceleration: 12,
  airWishSpeed: 30 * SOURCE_UNIT,
  friction: 5.2,
  stopSpeed: 80 * SOURCE_UNIT,
  gravity: 800 * SOURCE_UNIT,
  jumpImpulse: 301.99338 * SOURCE_UNIT,
  walkModifier: 0.52,
  crouchModifier: 0.34,
  jumpSpeedLimit: 1.1,
} as const;

export function limitJumpSpeed(v: { x: number; z: number }, speed: number) {
  // sv_autobunnyhopping only repeats jumps; sv_enablebunnyhopping is a
  // separate option. Keep the normal 110% takeoff limit in both modes.
  const magnitude = Math.hypot(v.x, v.z);
  const limit = speed * movement.jumpSpeedLimit;
  if (magnitude > limit) {
    v.x *= limit / magnitude;
    v.z *= limit / magnitude;
  }
}

export function fallStep(vertical: number, dt: number) {
  // StartGravity / FinishGravity: half the gravity impulse on either side
  // of movement, so the arc does not lose height to Euler integration.
  return {
    distance: (vertical - movement.gravity * dt * 0.5) * dt,
    vertical: vertical - movement.gravity * dt,
  };
}
export type Wall = { x: number; z: number; w: number; d: number; h: number; y?: number };
export function blocked(
  x: number,
  z: number,
  feet: number,
  walls: Wall[],
  radius = 0.3,
  height = 1.65,
) {
  return walls.some(
    (b) =>
      feet < b.h - 0.05 &&
      feet + height > (b.y ?? 0) &&
      x + radius > b.x - b.w / 2 &&
      x - radius < b.x + b.w / 2 &&
      z + radius > b.z - b.d / 2 &&
      z - radius < b.z + b.d / 2,
  );
}
export function accelerate(
  v: { x: number; z: number },
  dx: number,
  dz: number,
  speed: number,
  dt: number,
  grounded: boolean,
  accelerationSpeed = speed,
) {
  const len = Math.hypot(dx, dz);
  if (grounded) {
    const magnitude = Math.hypot(v.x, v.z);
    const factor = magnitude
      ? Math.max(0, magnitude - Math.max(magnitude, movement.stopSpeed) * movement.friction * dt) /
        magnitude
      : 0;
    v.x *= factor;
    v.z *= factor;
  }
  if (!len) return;
  dx /= len;
  dz /= len;
  const add = Math.max(
    0,
    (grounded ? speed : Math.min(speed, movement.airWishSpeed)) - (v.x * dx + v.z * dz),
  );
  // Source caps only the projected target speed in air, not total velocity
  // or the acceleration's wishspeed. This distinction enables air strafing.
  const amount = Math.min(
    add,
    (grounded ? movement.groundAcceleration : movement.airAcceleration) * accelerationSpeed * dt,
  );
  v.x += dx * amount;
  v.z += dz * amount;
}
export const weapons = [
  {
    name: "AK-47",
    label: "ASSAULT RIFLE",
    mag: 30,
    reserve: 90,
    delay: 0.1,
    damage: ballistics[0].damage,
    head: 4,
    reload: 2.4 / WEAPON_ANIMATION_RATE,
    speed: 215 * SOURCE_UNIT,
    recoil: 0.012,
    auto: true,
  },
  {
    name: "M4A1-S",
    label: "SILENCED RIFLE",
    mag: 25,
    reserve: 75,
    delay: 0.09,
    damage: ballistics[1].damage,
    head: 3.475,
    reload: 2.2 / WEAPON_ANIMATION_RATE,
    speed: 225 * SOURCE_UNIT,
    recoil: 0.009,
    auto: true,
  },
  {
    name: "USP-S",
    label: "SIDEARM",
    mag: 12,
    reserve: 48,
    delay: 0.18,
    damage: ballistics[2].damage,
    head: 4,
    reload: 1.7 / WEAPON_ANIMATION_RATE,
    speed: 240 * SOURCE_UNIT,
    recoil: 0.015,
    auto: false,
  },
  {
    name: "AWP",
    label: "BOLT-ACTION SNIPER",
    mag: 10,
    reserve: 30,
    delay: 1.45 / WEAPON_ANIMATION_RATE,
    damage: ballistics[3].damage,
    head: 4,
    reload: 3.4 / WEAPON_ANIMATION_RATE,
    speed: 200 * SOURCE_UNIT,
    scopedSpeed: 100 * SOURCE_UNIT,
    recoil: 0.055,
    auto: false,
  },
  {
    name: "M9 Bayonet",
    label: "KNIFE",
    mag: 0,
    reserve: 0,
    delay: 0.5,
    damage: 35,
    head: 1,
    reload: 0,
    speed: 250 * SOURCE_UNIT,
    recoil: 0,
    auto: false,
  },
];
