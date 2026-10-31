/** Source-style combat reconstruction; timing is simulation time, not animation speed. */
export const REVOLVER_COCK_TIME = 0.234375;
export function knifeRange(stab: boolean) {
  return (stab ? 32 : 48) * 0.0254;
}
export function knifeDamage(stab: boolean, firstSwing: boolean, back: boolean) {
  return back ? (stab ? 180 : 90) : stab ? 65 : firstSwing ? 40 : 25;
}
export function knifeBackstab(
  attacker: { x: number; z: number },
  victim: { x: number; z: number },
  facing: number,
) {
  const dx = victim.x - attacker.x,
    dz = victim.z - attacker.z;
  const distance = Math.hypot(dx, dz);
  // Soldier rigs face local +Z. A rear attacker points toward the victim's front.
  return distance > 0 && (dx * Math.sin(facing) + dz * Math.cos(facing)) / distance > 0.475;
}
