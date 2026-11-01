import stats from "./data/weapon-stats.json";
import { isKnife, knifeDefinitions } from "@cs2go/protocol";
export { isKnife, knifeDefinitions } from "@cs2go/protocol";
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
  hullRadius: 16 * SOURCE_UNIT,
  standingHeight: 72 * SOURCE_UNIT,
  duckHeight: 54 * SOURCE_UNIT,
  standingEye: 64 * SOURCE_UNIT,
  duckEye: 46 * SOURCE_UNIT,
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
// Saved inventory IDs 0–36 are stable; new entries append to the catalog.
export const weaponIcons = [
  "ak-47",
  "m4a1-s",
  "usp-s",
  "awp",
  "bayonet",
  "butterfly",
  "karambit",
  "glock",
  "deagle",
  "m4a4",
  "nova",
  "mp9",
  "hkp2000",
  "p250",
  "fiveseven",
  "tec9",
  "cz75a",
  "revolver",
  "elite",
  "famas",
  "galilar",
  "aug",
  "sg556",
  "ssg08",
  "scar20",
  "g3sg1",
  "mac10",
  "mp7",
  "mp5sd",
  "ump45",
  "p90",
  "bizon",
  "xm1014",
  "mag7",
  "sawedoff",
  "m249",
  "negev",
];
weaponIcons.push(...knifeDefinitions.filter((knife) => knife.id >= 37).map((knife) => knife.icon));
export function weaponSlot(index: number): 1 | 2 | 3 {
  return isKnife(index)
    ? 3
    : index === 2 || index === 7 || index === 8 || (index >= 12 && index <= 18)
      ? 2
      : 1;
}
// All cosmetic knife variants share weapon_knife's pinned vdata. Preserve the
// original snapshot and append variants without renumbering guns or saved skins.
const roster = [
  ...stats.weapons,
  ...knifeDefinitions
    .filter((knife) => knife.id >= 37)
    .map((knife) => ({
      ...stats.weapons[4],
      id: knife.id,
      name: knife.name,
    })),
];
export const weapons = roster.map((weapon, index) => {
  const knife = isKnife(index);
  const shell = index === 10 || index === 32 || index === 34;
  const speed = Array.isArray(weapon.maxSpeed)
    ? weapon.maxSpeed
    : [weapon.maxSpeed, weapon.maxSpeed];
  const spread = Array.isArray(weapon.spread) ? weapon.spread[0] : weapon.spread;
  return {
    ...weapon,
    slot: weaponSlot(index),
    label: knife
      ? "KNIFE"
      : weaponSlot(index) === 2
        ? "SIDEARM"
        : weapon.pellets > 1
          ? "SHOTGUN"
          : weapon.zoomLevels > 1
            ? "SNIPER RIFLE"
            : (index >= 26 && index <= 31) || index === 11
              ? "SUBMACHINE GUN"
              : index >= 35
                ? "MACHINE GUN"
                : "ASSAULT RIFLE",
    reserve: weapon.reserveAsClips ? weapon.reserveCount * weapon.mag : weapon.reserveCount,
    reserveClips: weapon.reserveAsClips ? weapon.reserveCount : 0,
    damage: knife ? 35 : weapon.damage,
    head: knife ? 1 : weapon.head,
    delay: knife ? 0.5 : Array.isArray(weapon.delay) ? weapon.delay[0] : weapon.delay,
    alternateDelay: knife ? 0.85 : Array.isArray(weapon.delay) ? weapon.delay[1] : weapon.delay,
    reload: knife ? 0 : weapon.reload,
    speed: speed[0]! * SOURCE_UNIT,
    scopedSpeed: weapon.zoomLevels > 0 ? speed[1]! * SOURCE_UNIT : undefined,
    suppressed: index === 1 || index === 2 || index === 28,
    pelletSpread: weapon.pellets > 1 ? spread : 0,
    reloadStyle: shell ? ("shell" as const) : ("magazine" as const),
  };
});

/** Reserve remains expressed as bullets for the HUD. Current magazine-fed
 * weapons discard their remaining magazine and spend one complete spare. */
export function reloadMagazine(id: number, ammo: number, reserve: number) {
  const weapon = weapons[id];
  if (!weapon || ammo >= weapon.mag || reserve <= 0) return { ammo, reserve };
  const transfer = Math.min(weapon.reserveAsClips ? weapon.mag : weapon.mag - ammo, reserve);
  return { ammo: weapon.reserveAsClips ? transfer : ammo + transfer, reserve: reserve - transfer };
}
