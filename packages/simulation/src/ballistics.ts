import { isKnife, weapons } from "./physics";
// Current shipped CS2 weapons.vdata, pinned provenance in the imported snapshot.
export const SOURCE_UNITS_PER_METER = 1 / 0.0254;
export const ballistics = weapons.map(({ damage, power, range, modifier }, index) =>
  // Knife vdata inherits firearm defaults that do not describe melee tracing.
  isKnife(index)
    ? { damage: 35, power: 0, range: 0, modifier: 1 }
    : { damage, power, range, modifier },
);
export type BulletMaterial = "flesh" | "wood" | "metal" | "concrete" | "glass";
export function rangeDamage(damage: number, distanceMeters: number, modifier: number) {
  return damage * Math.pow(modifier, (distanceMeters * SOURCE_UNITS_PER_METER) / 500);
}
export function penetrate(
  damage: number,
  power: number,
  thicknessMeters: number,
  material: BulletMaterial,
) {
  // Same-material wood/cardboard = 3, metal = .5, concrete = .4,
  // flesh = 1; glass/grate use 3 and lose 5% rather than 16%.
  const modifier = { flesh: 1, wood: 3, metal: 0.5, concrete: 0.4, glass: 3 }[material];
  const thickness = thicknessMeters * SOURCE_UNITS_PER_METER;
  if (thickness > 90 || power <= 0) return 0;
  const loss =
    damage * (material === "glass" ? 0.05 : 0.16) +
    (3 / power) * 1.25 * (3 / modifier) +
    (thickness * thickness) / (24 * modifier);
  return Math.max(0, damage - Math.max(0, loss));
}
