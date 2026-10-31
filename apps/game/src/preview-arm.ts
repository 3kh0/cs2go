import * as T from "three";

/** Two-bone correction for bulky showcase bodies. Keep wrist orientation and
 * finger poses intact while moving both contacts clear of the vest. */
export function reachPreviewHand(hand: T.Object3D, offset: T.Vector3) {
  const lower = hand.parent!,
    upper = lower.parent!;
  // Native rigs have wrist/forearm helpers as siblings, not arm-chain parents.
  if (!/arm_lower|Forearm/.test(lower.name) || !/arm_upper|UpperArm/.test(upper.name)) return;
  upper.updateWorldMatrix(true, true);
  const shoulder = upper.getWorldPosition(new T.Vector3());
  const elbow = lower.getWorldPosition(new T.Vector3());
  const wrist = hand.getWorldPosition(new T.Vector3());
  const wristRotation = hand.getWorldQuaternion(new T.Quaternion());
  const target = wrist.clone().add(offset);
  const a = shoulder.distanceTo(elbow),
    b = elbow.distanceTo(wrist);
  const direction = target.clone().sub(shoulder);
  const distance = T.MathUtils.clamp(direction.length(), Math.abs(a - b) + 0.0001, a + b - 0.0001);
  direction.normalize();
  target.copy(shoulder).addScaledVector(direction, distance);
  const bend = elbow.clone().sub(shoulder);
  bend.addScaledVector(direction, -bend.dot(direction)).normalize();
  const along = (a * a - b * b + distance * distance) / (2 * distance);
  const nextElbow = shoulder
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
  const rotate = (bone: T.Object3D, from: T.Vector3, to: T.Vector3) => {
    const world = bone.getWorldQuaternion(new T.Quaternion());
    world.premultiply(new T.Quaternion().setFromUnitVectors(from.normalize(), to.normalize()));
    bone.quaternion.copy(
      bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world),
    );
    bone.updateWorldMatrix(false, true);
  };
  rotate(upper, elbow.clone().sub(shoulder), nextElbow.clone().sub(shoulder));
  rotate(
    lower,
    hand.getWorldPosition(new T.Vector3()).sub(nextElbow),
    target.clone().sub(nextElbow),
  );
  hand.quaternion.copy(
    lower.getWorldQuaternion(new T.Quaternion()).invert().multiply(wristRotation),
  );
  hand.updateWorldMatrix(false, true);
}
