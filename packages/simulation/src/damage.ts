export type HitRegion = "head" | "chest" | "stomach" | "arm" | "leg";

export function hitRegion(head: boolean, height: number, crouch = false): HitRegion {
  const standingHeight = crouch ? height * (1.65 / 1.1) : height;
  return head
    ? "head"
    : standingHeight < 0.85
      ? "leg"
      : standingHeight < 1.08
        ? "stomach"
        : "chest";
}

export function hitRegionMultiplier(region: HitRegion, headMultiplier = 4) {
  return region === "head"
    ? headMultiplier
    : region === "stomach"
      ? 1.25
      : region === "leg"
        ? 0.75
        : 1;
}

/** damage already includes range, penetration and hit-region scaling.
 * Standard armor: weapon armor ratio / 2 reaches health; half of absorbed
 * damage spends armor. A depleted vest can absorb only twice its remaining AP.
 * Both human and bot hits must use this same calculation.
 */
export function applyArmorDamage(
  damage: number,
  region: HitRegion,
  armor: number,
  helmet: boolean,
  armorRatio: number,
) {
  const incoming = Math.max(0, damage);
  const availableArmor = Math.max(0, armor);
  const protectedHit = region !== "leg" && (region !== "head" || helmet);
  if (!protectedHit || availableArmor === 0)
    return { healthDamage: incoming, armorDamage: 0, armor: availableArmor };
  const ratio = Math.min(1, Math.max(0, armorRatio * 0.5));
  const armorDamage = Math.min(availableArmor, (incoming - incoming * ratio) * 0.5);
  return {
    healthDamage: incoming - armorDamage * 2,
    armorDamage,
    armor: availableArmor - armorDamage,
  };
}

export function friendlyFireScale(mode: "casual" | "competitive", kind: "bullet" | "other") {
  return mode === "casual" ? 0 : kind === "bullet" ? 0.33 : 0.4;
}
