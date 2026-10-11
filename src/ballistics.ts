// Archived 2021 CS:GO items_game attributes. 1 Source unit = 1 inch.
export const SOURCE_UNITS_PER_METER = 1 / 0.0254;
export const ballistics = [
  { damage: 36, power: 2, range: 8192, modifier: 0.98 },
  { damage: 38, power: 2, range: 8192, modifier: 0.99 },
  { damage: 35, power: 1, range: 4096, modifier: 0.91 },
  { damage: 115, power: 2.5, range: 8192, modifier: 0.99 },
] as const;
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
