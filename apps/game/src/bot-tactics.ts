import * as T from "three";

// Perception stays independent of pathfinding: an alert never grants wall vision.
export function inBotView(facing: number, dx: number, dz: number, alert: boolean) {
  const distance = Math.hypot(dx, dz);
  return distance < 2.5 || Math.cos(Math.atan2(dx, dz) - facing) > (alert ? -0.35 : 0.05);
}

export function targetPriority(distance: number, current: boolean, attacking: boolean) {
  // Keep a fight instead of flicking to a new target each think, but prioritize
  // a close threat or the enemy shooting a teammate.
  return distance - (current ? 8 : 0) - (attacking ? 4 : 0);
}

export function burstLength(distance: number, automatic: boolean) {
  return automatic ? (distance > 24 ? 2 : distance > 12 ? 4 : 7) : 1;
}

export function botAimSpread(distance: number, speed: number, shots: number, reaction: number) {
  return (
    0.0035 +
    Math.min(distance, 60) * 0.00008 +
    speed * 0.008 +
    shots * 0.0015 +
    Math.max(0, reaction) * 0.045
  );
}

// Analytic body volumes avoid decorative gun/gear meshes counting as flesh.
// Returns the actual nearest intersection, so teammates physically block shots.
export function botBodyHit(ray: T.Ray, feet: T.Vector3, crouch = false) {
  const height = crouch ? 1.1 : 1.65;
  const head = new T.Sphere(new T.Vector3(feet.x, feet.y + height - 0.12, feet.z), 0.15);
  const headPoint = ray.intersectSphere(head, new T.Vector3());
  const body = new T.Box3(
    new T.Vector3(feet.x - 0.24, feet.y + 0.12, feet.z - 0.24),
    new T.Vector3(feet.x + 0.24, feet.y + height - 0.25, feet.z + 0.24),
  );
  const bodyPoint = ray.intersectBox(body, new T.Vector3());
  if (
    headPoint &&
    (!bodyPoint ||
      headPoint.distanceToSquared(ray.origin) < bodyPoint.distanceToSquared(ray.origin))
  )
    return { point: headPoint, head: true };
  return bodyPoint ? { point: bodyPoint, head: false } : null;
}

export function nearestDefuser(
  candidates: { index: number; distance: number; busy: boolean }[],
  current: number | "player" | null,
) {
  if (current === "player") return "player";
  if (typeof current === "number" && candidates.some((candidate) => candidate.index === current))
    return current;
  return (
    candidates.filter((candidate) => !candidate.busy).sort((a, b) => a.distance - b.distance)[0]
      ?.index ??
    candidates.sort((a, b) => a.distance - b.distance)[0]?.index ??
    null
  );
}
