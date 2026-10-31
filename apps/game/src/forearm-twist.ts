import * as T from "three";

// The imported viewmodel clips omit Source's procedural forearm helpers.
// Reconstruct wrist roll on the skin's two twist bones while leaving the hand
// (and therefore its weapon contact) at the sampled source transform. This is
// authored support, not a conversion of Source's model-specific constraints.
export function forearmTwists(arms: T.Group) {
  return ["L", "R"].map((side) => {
    const hand = arms.getObjectByName(`hand_${side}`)!;
    return {
      hand,
      restInverse: hand.quaternion.clone().invert(),
      helpers: ["twist", "twist1"].map((suffix, i) => {
        const bone = arms.getObjectByName(`arm_lower_${side}_${suffix}`)!;
        return { bone, rest: bone.quaternion.clone().normalize(), weight: (i + 1) / 3 };
      }),
    };
  });
}
const delta = new T.Quaternion(),
  roll = new T.Quaternion(),
  axis = new T.Vector3(1, 0, 0);
export function updateForearmTwists(bindings: ReturnType<typeof forearmTwists>) {
  for (const { hand, restInverse, helpers } of bindings) {
    delta.copy(hand.quaternion).multiply(restInverse).normalize();
    // Swing/twist decomposition around the forearm's local X axis.
    if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    const angle = 2 * Math.atan2(delta.x, delta.w);
    for (const { bone, rest, weight } of helpers) {
      roll.setFromAxisAngle(axis, angle * weight);
      bone.quaternion.copy(roll).multiply(rest).normalize();
    }
  }
}
