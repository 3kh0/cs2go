import { Vector3 } from "three";
import type { MapCollision } from "@cs2go/simulation/map-collision";
import { movement } from "./physics";
import type { Navigation } from "./navigation";

const pools = new WeakMap<Navigation, readonly Vector3[]>();

// Source's runtime spawn manager is not available in the browser. Build a
// reusable set of standing, connected NAV positions against the actual map hull.
// This runs once per loaded map, never during the per-frame simulation.
export function deathmatchSpawnPool(navigation: Navigation, collision: MapCollision) {
  const cached = pools.get(navigation);
  if (cached) return cached;
  const candidates: Vector3[] = [];
  const reachable = new Set<number>();
  const queue = [...navigation.data.spawns.ct, ...navigation.data.spawns.t].map((position) =>
    navigation.nearest(new Vector3().fromArray(position)),
  );
  for (let i = 0; i < queue.length; i++) {
    const area = navigation.areas[queue[i]];
    if (!area || reachable.has(area.id)) continue;
    reachable.add(area.id);
    for (const id of area.links) {
      const index = navigation.index.get(id);
      if (index !== undefined && !reachable.has(id)) queue.push(index);
    }
  }
  for (const area of navigation.areas) {
    if (!reachable.has(area.id)) continue;
    if (!area.links.length || area.flags & 0x10000) continue;
    const [x, y, z] = area.center;
    if (
      candidates.some(
        (point) => Math.hypot(point.x - x, point.z - z) < 2 && Math.abs(point.y - y) < 2,
      )
    )
      continue;
    const floor = collision.floor(x, z, y + 0.5, y - 0.75);
    if (!Number.isFinite(floor) || Math.abs(floor - y) > 0.5) continue;
    const point = new Vector3(x, floor, z);
    // Match the actual player footprint now, while loading. A centre ray can
    // sit below the step touching the hull edge and pop upward on the first tick.
    if (!collision.followGround(point, movement.hullRadius, movement.standingHeight)) continue;
    const settled = point.clone();
    if (
      !collision.followGround(settled, movement.hullRadius, movement.standingHeight) ||
      settled.distanceToSquared(point) > 0.025 ** 2 ||
      !navigation.support(x, z, point.y + 0.5, point.y - 0.5)
    )
      continue;
    // A valid support beneath the centre alone can straddle a narrow ledge.
    if (
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].some(
        ([dx, dz]) =>
          !Number.isFinite(
            collision.floor(
              x + dx * movement.hullRadius,
              z + dz * movement.hullRadius,
              floor + 0.25,
              floor - 0.25,
            ),
          ),
      )
    )
      continue;
    candidates.push(point);
  }
  pools.set(navigation, candidates);
  return candidates;
}

export function chooseDeathmatchSpawn(
  candidates: readonly Vector3[],
  actors: readonly Vector3[],
  previous: Vector3,
  visible: (from: Vector3, to: Vector3) => boolean,
  random: () => number = Math.random,
) {
  if (!candidates.length) return undefined;
  const start = Math.floor(random() * candidates.length) % candidates.length;
  let selected = candidates[start],
    best = -Infinity;
  // Bound traces even on a large NAV graph. Randomize the starting point and
  // stride through the entire map, avoiding dependence on native area ordering.
  const count = Math.min(48, candidates.length);
  const eye = new Vector3(),
    target = new Vector3();
  for (let i = 0; i < count; i++) {
    const point =
      candidates[(start + Math.floor((i * candidates.length) / count)) % candidates.length];
    const nearest = actors.reduce(
      (distance, actor) => Math.min(distance, point.distanceToSquared(actor)),
      Infinity,
    );
    if (nearest < 1.5 ** 2) continue;
    let score = Math.min(Math.sqrt(nearest), 24);
    if (point.distanceToSquared(previous) < 6 ** 2) score -= 12;
    eye.copy(point).y += movement.standingEye;
    for (const actor of actors) {
      if (point.distanceToSquared(actor) > 35 ** 2) continue;
      target.copy(actor).y += movement.standingEye;
      if (visible(eye, target)) score -= 100;
    }
    if (score > best) {
      best = score;
      selected = point;
    }
  }
  return selected.clone();
}
