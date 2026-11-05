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

export function botShouldMove({
  distance,
  arrival,
  targetDistance,
  suppressing,
  reposition,
  committed,
  interacting,
}: {
  distance: number;
  arrival: number;
  targetDistance: number | null;
  suppressing: boolean;
  reposition: boolean;
  committed: boolean;
  interacting: boolean;
}) {
  if (interacting || distance <= arrival) return false;
  // A distant engagement must not consume the entire plant/retake window.
  // Nearby threats still require stopping to fire accurately.
  if (committed && (targetDistance === null || targetDistance > 8)) return true;
  return targetDistance !== null || suppressing ? reposition : true;
}

export function botRegroupGoal(
  position: T.Vector3,
  leader: T.Vector3 | null | undefined,
  index: number,
  regrouping = false,
) {
  if (!leader) return null;
  const dx = position.x - leader.x;
  const dz = position.z - leader.z;
  const distance = Math.hypot(dx, dz);
  // Hysteresis keeps a moving squad from alternating between combat holds and
  // catch-up at the boundary. Teammate positions never reveal an enemy.
  if (distance <= (regrouping ? 8 : 12)) return null;
  const behindX = dx / distance;
  const behindZ = dz / distance;
  const side = ((index % 3) - 1) * 1.5;
  return new T.Vector3(
    leader.x + behindX * 3 - behindZ * side,
    leader.y,
    leader.z + behindZ * 3 + behindX * side,
  );
}

export function botSearchGoal(
  areas: readonly { center: readonly number[]; links: readonly number[] }[],
  anchor: T.Vector3,
  index: number,
  elapsed: number,
) {
  // Widen quiet searches from the site to the lanes, then the wider map.
  // NAV centers avoid decorative props; staggered phases spread teammates.
  const quiet = Math.max(0, elapsed);
  const phase = Math.floor(quiet / 6);
  const angle = index * 2.399963229728653 + phase * (Math.PI / 2);
  const radius = (quiet >= 60 ? 40 : quiet >= 35 ? 22 : 6) + (index % 3) * 2;
  const x = anchor.x + Math.sin(angle) * radius;
  const z = anchor.z + Math.cos(angle) * radius;
  let best: readonly number[] | undefined;
  let score = Infinity;
  for (const area of areas) {
    const center = area.center;
    const horizontal = Math.hypot(center[0] - anchor.x, center[2] - anchor.z);
    const vertical = Math.abs(center[1] - anchor.y);
    if (
      !area.links.length ||
      horizontal < 2 ||
      horizontal > radius + 8 ||
      vertical > (quiet >= 35 ? 12 : 2.5)
    )
      continue;
    const cost = (center[0] - x) ** 2 + (center[2] - z) ** 2 + vertical * vertical * 4;
    if (cost < score) {
      score = cost;
      best = center;
    }
  }
  return best ? new T.Vector3().fromArray(best) : anchor.clone();
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
