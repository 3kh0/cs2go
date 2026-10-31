import { Vector3 } from "three";
import { SOURCE_UNIT, movement } from "./physics";
import { grenadeThrowSpeed, type GrenadeKind } from "./utility";

export const grenadePhysics = {
  radius: 2 * SOURCE_UNIT,
  gravity: movement.gravity * 0.4,
  elasticity: 0.45,
  stopSpeed: 20 * SOURCE_UNIT,
} as const;

/** Historical Source throw construction; not a claim of native subtick parity. */
export function grenadeLaunch(
  kind: GrenadeKind,
  strength: number,
  eye: Vector3,
  direction: Vector3,
  playerVelocity: Vector3,
) {
  strength = Math.max(0, Math.min(1, strength));
  const pitch = Math.asin(Math.max(-1, Math.min(1, direction.y)));
  const launchPitch =
    pitch + ((((90 - Math.abs((pitch * 180) / Math.PI)) * 10) / 90) * Math.PI) / 180;
  const yaw = Math.atan2(direction.x, direction.z);
  const aim = new Vector3(
    Math.sin(yaw) * Math.cos(launchPitch),
    Math.sin(launchPitch),
    Math.cos(yaw) * Math.cos(launchPitch),
  );
  return {
    position: eye.clone().add(new Vector3(0, (strength * 12 - 12) * SOURCE_UNIT, 0)),
    direction: aim,
    velocity: aim
      .clone()
      .multiplyScalar(grenadeThrowSpeed(kind, strength))
      .addScaledVector(playerVelocity, 1.25),
  };
}

export function bounceGrenade(velocity: Vector3, normal: Vector3) {
  const impact = Math.max(0, -velocity.dot(normal));
  if (impact > 0) velocity.addScaledVector(normal, impact * 2);
  velocity.multiplyScalar(grenadePhysics.elasticity);
  for (const axis of ["x", "y", "z"] as const)
    if (Math.abs(velocity[axis]) < 0.1 * SOURCE_UNIT) velocity[axis] = 0;
  const resting = normal.y > 0.7 && velocity.lengthSq() < grenadePhysics.stopSpeed ** 2;
  if (resting) velocity.set(0, 0, 0);
  return { impact, resting };
}
