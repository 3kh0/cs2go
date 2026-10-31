import { Vector3 } from "three";
import shipped from "./data/utility.json";

/** Shipped parameters with explicitly reconstructed solver/falloff behavior. */
export const grenadeTypes = ["he", "flash", "smoke", "molotov", "incendiary", "decoy"] as const;
export type GrenadeKind = (typeof grenadeTypes)[number];
export const grenadeIcons: Record<GrenadeKind, string> = {
  flash: "flashbang",
  smoke: "smokegrenade",
  he: "hegrenade",
  molotov: "molotov",
  incendiary: "incgrenade",
  decoy: "decoy",
};
export const grenadeData = {
  he: {
    name: "HE Grenade",
    price: shipped.weapons.he.m_nPrice,
    color: 0x557340,
    fuse: 1.5,
    duration: 1.0,
    radius: 8.9,
  },
  flash: {
    name: "Flashbang",
    price: shipped.weapons.flash.m_nPrice,
    color: 0xb4b8ac,
    fuse: 1.5,
    duration: 0.15,
    radius: 30,
  },
  smoke: {
    name: "Smoke Grenade",
    price: shipped.weapons.smoke.m_nPrice,
    color: 0x939b8c,
    fuse: 1.5,
    duration: 20,
    radius: 3.6,
  },
  molotov: {
    name: "Molotov",
    price: shipped.weapons.molotov.m_nPrice,
    color: 0x86603a,
    fuse: shipped.convars.molotov_throw_detonate_time,
    duration: shipped.convars.inferno_flame_lifetime,
    radius: shipped.convars.inferno_max_range * 0.0254,
  },
  incendiary: {
    name: "Incendiary",
    price: shipped.weapons.incendiary.m_nPrice,
    color: 0xa44d3d,
    fuse: shipped.convars.molotov_throw_detonate_time,
    duration: shipped.convars.inferno_flame_lifetime_incendiary,
    radius: shipped.convars.inferno_max_range_ct * 0.0254,
  },
  decoy: {
    name: "Decoy",
    price: shipped.weapons.decoy.m_nPrice,
    color: 0x797c60,
    fuse: 1.5,
    duration: 15,
    radius: 2,
  },
} as const;
export type GrenadeInventory = Record<GrenadeKind, number>;
export function emptyGrenades(): GrenadeInventory {
  return { he: 0, flash: 0, smoke: 0, molotov: 0, incendiary: 0, decoy: 0 };
}
export function canCarryGrenade(
  inventory: GrenadeInventory,
  kind: GrenadeKind,
  competitive = true,
) {
  return (
    Object.values(inventory).reduce((a, b) => a + b, 0) < (competitive ? 4 : 3) &&
    inventory[kind] < (kind === "flash" && competitive ? 2 : 1) &&
    (!(kind === "molotov" || kind === "incendiary") ||
      inventory.molotov + inventory.incendiary === 0)
  );
}
export function grenadeAvailable(kind: GrenadeKind, team: "t" | "ct") {
  return !(kind === "molotov" && team === "ct") && !(kind === "incendiary" && team === "t");
}
export function segmentNearSphere(from: Vector3, to: Vector3, center: Vector3, radius: number) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dz = to.z - from.z;
  const length = dx * dx + dy * dy + dz * dz;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((center.x - from.x) * dx + (center.y - from.y) * dy + (center.z - from.z) * dz) / length,
        ),
      )
    : 0;
  return (
    (from.x + t * dx - center.x) ** 2 +
      (from.y + t * dy - center.y) ** 2 +
      (from.z + t * dz - center.z) ** 2 <
    radius * radius
  );
}
export function flashExposure(distance: number, facingDot: number) {
  return Math.max(0, 1 - distance / 30) * (0.22 + 0.78 * Math.max(0, facingDot));
}
export function heDamage(distance: number) {
  return distance >= 8.9 ? 0 : 105 * Math.exp(-((Math.max(0, distance - 0.6) / 3.5) ** 2));
}

export const fireParameters = {
  interval: shipped.convars.inferno_damage_timer,
  maxCells: shipped.convars.inferno_max_flames,
  spacing: shipped.convars.inferno_flame_spacing * 0.0254,
  slopeDegrees: shipped.convars.weapon_molotov_maxdetonateslope,
} as const;
export function fireImpactAllowed(normalY: number) {
  return normalY >= Math.cos((fireParameters.slopeDegrees * Math.PI) / 180) - 1e-10;
}
export function fireTickDamage(kind: "molotov" | "incendiary") {
  const dps =
    kind === "incendiary" ? shipped.convars.inferno_damage_ct : shipped.convars.inferno_damage;
  return dps * fireParameters.interval;
}
export function grenadeThrowSpeed(kind: GrenadeKind, strength: number) {
  // Historical Source launch scaling, applied to the pinned native parameter.
  return (
    shipped.weapons[kind].m_flThrowVelocity *
    0.0254 *
    0.9 *
    (0.3 + 0.7 * Math.max(0, Math.min(1, strength)))
  );
}
export function utilityDamageScale(
  mode: "casual" | "competitive",
  kind: GrenadeKind,
  self: boolean,
  teammate: boolean,
) {
  const rules = shipped.modes[mode];
  // These coefficients are native data; inferno damage-flag dispatch is still
  // reconstructed (other for teammates, unchanged full damage for self).
  const blast = kind === "he" || kind === "decoy";
  if (self) return blast ? rules.ff_damage_reduction_grenade_self : 1;
  if (!teammate) return 1;
  if (kind === "decoy" && !shipped.convars.ff_damage_decoy_explosion) return 0;
  return blast ? rules.ff_damage_reduction_grenade : rules.ff_damage_reduction_other;
}
/** Existing grid reconstruction, constrained by native spacing/range/count. */
export function fireCellCandidates(kind: "molotov" | "incendiary") {
  const radius = grenadeData[kind].radius;
  const reach = Math.ceil(radius / fireParameters.spacing);
  const offsets: Vector3[] = [];
  for (let x = -reach; x <= reach; x++)
    for (let z = -reach; z <= reach; z++) {
      const offset = new Vector3(x * fireParameters.spacing, 0.3, z * fireParameters.spacing);
      if (Math.hypot(offset.x, offset.z) <= radius) offsets.push(offset);
    }
  // Fill near the ignition first so the node cap does not leave a central hole.
  return offsets.sort((a, b) => a.lengthSq() - b.lengthSq());
}
