import type { Vector2 } from "three";

// Offsets point from this bot to its teammate, in world X/Z. Keep the
// preferred motion's forward component while passing on the bot's right.
// Reciprocal traffic then chooses opposite world sides without an ID-based
// tie break, and a teammate directly ahead cannot cancel movement to zero.
export function steerAroundTeammate(
  desired: Vector2,
  offsetX: number,
  offsetZ: number,
  headingX: number,
  headingZ: number,
): void {
  const speed = desired.length(),
    headingLength = Math.hypot(headingX, headingZ);
  if (speed < 0.001 || headingLength < 0.001) return;
  const forwardX = headingX / headingLength,
    forwardZ = headingZ / headingLength,
    ahead = offsetX * forwardX + offsetZ * forwardZ,
    side = offsetX * forwardZ - offsetZ * forwardX;
  const lookAhead = 1.8,
    clearance = 0.9;
  if (ahead < 0 || ahead >= lookAhead || Math.abs(side) >= clearance) return;
  const influence = (1 - ahead / lookAhead) * (1 - Math.abs(side) / clearance),
    forward = 1 - influence * 0.75,
    right = influence * 1.5;
  // Use the same original route heading for every neighbour. Keep the
  // strongest deflection instead of adding turns that curl a crowd around.
  const currentForward = desired.x * forwardX + desired.y * forwardZ,
    currentRight = desired.x * forwardZ - desired.y * forwardX;
  if (currentForward > 0 && currentRight * forward >= right * currentForward) return;
  const scale = speed / Math.hypot(forward, right);
  desired.set(
    (forwardX * forward + forwardZ * right) * scale,
    (forwardZ * forward - forwardX * right) * scale,
  );
}
