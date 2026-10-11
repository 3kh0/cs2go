import { ballistics } from "./ballistics";
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
) {
  const len = Math.hypot(dx, dz);
  if (grounded) {
    const magnitude = Math.hypot(v.x, v.z);
    const factor = magnitude
      ? Math.max(0, magnitude - Math.max(magnitude, 1.7) * 5.2 * dt) / magnitude
      : 0;
    v.x *= factor;
    v.z *= factor;
  }
  if (!len) return;
  dx /= len;
  dz /= len;
  const add = Math.max(0, (grounded ? speed : Math.min(speed, 0.8)) - (v.x * dx + v.z * dz));
  const amount = Math.min(add, (grounded ? 11 : 12) * speed * dt);
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
    reload: 2.4,
    speed: 5.2,
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
    reload: 2.2,
    speed: 5.4,
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
    reload: 1.7,
    speed: 5.9,
    recoil: 0.015,
    auto: false,
  },
  {
    name: "AWP",
    label: "BOLT-ACTION SNIPER",
    mag: 10,
    reserve: 30,
    delay: 1.45,
    damage: ballistics[3].damage,
    head: 4,
    reload: 3.4,
    speed: 4.5,
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
    speed: 6.25,
    recoil: 0,
    auto: false,
  },
];
