import * as T from "three";
import type { MapCollision } from "./map-collision";
import type { NavAreaData as NavArea } from "./dust-map";
import { isKnife, movement, weapons } from "./physics";

// Installed CS2 build2000942 server.dll, CCSGameModeRules_Deathmatch virtual
// scorer RVA0x922080; price/type branches RVA0x92266d..0x9226c2. The observed
// mp_dm_kill_base_score is8. Price is m_nPrice, not the cash m_nKillAward.
// server.dll SHA-256: 70c66e850b2ce72c8c7ca026de6989ef4de7f12dad64ec503645fbd2a7f06d9f.
const priceAwards = [
  [200, 18],
  [500, 16],
  [700, 14],
  [1400, 13],
  [2500, 11],
  [3500, 10],
] as const;

/** Ordinary enemy-kill points; bonus weapon windows are a separate system. */
export function deathmatchKillPoints(index: number) {
  const weapon = weapons[index];
  if (!weapon) return 0;
  if (isKnife(index)) return 25;
  for (const [ceiling, points] of priceAwards) if (weapon.price <= ceiling) return points;
  return 8;
}

/** Seconds a dead deathmatch player waits before respawning. */
export const DEATHMATCH_RESPAWN_DELAY = 2;
/** Spawn protection, ended early by moving or firing; also the buy window. */
export const DEATHMATCH_PROTECTION = 10;

/** Server-side counterpart of the browser NAV spawn pool. Keeps standing,
 * connected NAV area centres reachable from team spawns. Runs once per map at
 * startup; the authoritative server has no Navigation graph helpers. */
export function deathmatchSpawnPoints(
  areas: readonly NavArea[],
  spawns: Record<"ct" | "t", number[][]>,
  collision: MapCollision,
): [number, number, number][] {
  const byId = new Map(areas.map((area) => [area.id, area]));
  const nearest = (point: number[]) => {
    let best: NavArea | undefined,
      distance = Infinity;
    for (const area of areas) {
      const d = Math.hypot(
        area.center[0] - point[0],
        (area.center[1] - point[1]) * 2,
        area.center[2] - point[2],
      );
      if (d < distance) {
        distance = d;
        best = area;
      }
    }
    return best;
  };
  const reachable = new Set<number>();
  const queue = [...spawns.ct, ...spawns.t].flatMap((point) => nearest(point) ?? []);
  for (let i = 0; i < queue.length; i++) {
    const area = queue[i];
    if (reachable.has(area.id)) continue;
    reachable.add(area.id);
    for (const id of area.links) {
      const next = byId.get(id);
      if (next && !reachable.has(id)) queue.push(next);
    }
  }
  const points: [number, number, number][] = [];
  for (const area of areas) {
    if (!reachable.has(area.id) || !area.links.length || area.flags & 0x10000) continue;
    const [x, y, z] = area.center;
    if (points.some((p) => Math.hypot(p[0] - x, p[2] - z) < 2 && Math.abs(p[1] - y) < 2)) continue;
    const floor = collision.floor(x, z, y + 0.5, y - 0.75);
    if (!Number.isFinite(floor) || Math.abs(floor - y) > 0.5) continue;
    const point = new T.Vector3(x, floor, z);
    if (!collision.followGround(point, movement.hullRadius, movement.standingHeight)) continue;
    const settled = point.clone();
    if (
      !collision.followGround(settled, movement.hullRadius, movement.standingHeight) ||
      settled.distanceToSquared(point) > 0.025 ** 2
    )
      continue;
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
    points.push([point.x, point.y, point.z]);
  }
  return points;
}

/** Prefer far, unseen spawns. Traces are bounded to 48 sampled candidates. */
export function chooseDeathmatchSpawnPoint(
  candidates: readonly (readonly number[])[],
  actors: readonly { x: number; y: number; z: number }[],
  visible: (from: T.Vector3, to: T.Vector3) => boolean,
  random: () => number = Math.random,
) {
  if (!candidates.length) return undefined;
  const start = Math.floor(random() * candidates.length) % candidates.length;
  const count = Math.min(48, candidates.length);
  const eye = new T.Vector3(),
    target = new T.Vector3();
  let selected = candidates[start],
    best = -Infinity;
  for (let i = 0; i < count; i++) {
    const point =
      candidates[(start + Math.floor((i * candidates.length) / count)) % candidates.length];
    let nearest = Infinity;
    for (const actor of actors)
      nearest = Math.min(
        nearest,
        (actor.x - point[0]) ** 2 + (actor.y - point[1]) ** 2 + (actor.z - point[2]) ** 2,
      );
    if (nearest < 1.5 ** 2) continue;
    let score = Math.min(Math.sqrt(nearest), 24) + random();
    eye.set(point[0], point[1] + movement.standingEye, point[2]);
    for (const actor of actors) {
      target.set(actor.x, actor.y + movement.standingEye, actor.z);
      if (eye.distanceToSquared(target) > 35 ** 2) continue;
      if (visible(eye, target)) score -= 100;
    }
    if (score > best) {
      best = score;
      selected = point;
    }
  }
  return selected;
}
