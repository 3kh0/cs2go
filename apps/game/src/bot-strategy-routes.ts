import type { BotStrategyRoutes, StrategyPoint } from "./bot-strategy";
import type { NavArea, Navigation } from "./navigation";
import { Vector3 } from "three";
import { touchesBuyZone } from "@cs2go/simulation/buy-zones";

type Landmark = readonly [number, number, number];

const landmarks = {
  longA: [
    [28, 0.3, -10],
    [40, 0, -30],
    [34, 0, -50],
  ],
  shortA: [
    [-6, 0.1, -16],
    [8, 0.1, -37],
    [10.5, 2.5, -53],
  ],
  tunnelsB: [
    [-42, 0.9, -21],
    [-49, 0.6, -46],
  ],
  midB: [
    [-6, 0.1, -16],
    [-9, -3.15, -54],
    [-25, 0.1, -64],
  ],
} as const;

function point(area: NavArea): StrategyPoint {
  return [area.center[0], area.center[1], area.center[2]];
}

export function buildBotStrategyRoutes(nav: Navigation): BotStrategyRoutes {
  if (nav.data.mapId && nav.data.mapId !== "dust2") return buildNativeStrategyRoutes(nav);
  const floors = nav.areas.filter((area) => {
    const [x, y, z] = area.center;
    return (
      area.links.length >= 2 &&
      !(area.flags & 2) &&
      (area.rect[2] - area.rect[0]) * (area.rect[3] - area.rect[1]) >= 0.8 &&
      !!nav.support(x, z, y + 0.25, y - 0.25)
    );
  });
  const snap = (target: Landmark, avoid: readonly StrategyPoint[] = []) => {
    let best = floors[0] ?? nav.areas[0],
      score = Infinity;
    for (const area of floors.length ? floors : nav.areas) {
      const [x, y, z] = area.center;
      if (avoid.some((chosen) => (chosen[0] - x) ** 2 + (chosen[2] - z) ** 2 < 4)) continue;
      const distance = (x - target[0]) ** 2 + (z - target[2]) ** 2 + (y - target[1]) ** 2 * 9;
      if (distance < score) {
        best = area;
        score = distance;
      }
    }
    return point(best);
  };
  const lane = (targets: readonly Landmark[]) =>
    targets.map((target) => ({
      position: snap(target),
      radius: 2.5,
      timeout: 18,
    }));
  const a = nav.site(0).toArray() as [number, number, number],
    b = nav.site(1).toArray() as [number, number, number];
  const anchors = (label: string, site: StrategyPoint) => {
    const candidates = floors.filter(
      (area) => area.place === label && Math.abs(area.center[1] - site[1]) < 1,
    );
    const selected: StrategyPoint[] = [site];
    while (selected.length < 5 && candidates.length) {
      let best = 0,
        separation = -Infinity;
      for (let i = 0; i < candidates.length; i++) {
        const center = candidates[i].center;
        const distance = Math.min(
          ...selected.map((chosen) => (chosen[0] - center[0]) ** 2 + (chosen[2] - center[2]) ** 2),
        );
        if (distance > separation) {
          separation = distance;
          best = i;
        }
      }
      if (separation < 1) break;
      selected.push(point(candidates.splice(best, 1)[0]));
    }
    return selected;
  };
  // Retake reserves stage on separate CT-side floors instead of all piling
  // onto the rotation waypoint while waiting for a confirmed attack.
  const reserves = (targets: readonly Landmark[], occupied: readonly StrategyPoint[] = []) => {
    const selected: StrategyPoint[] = [];
    for (const target of targets) selected.push(snap(target, [...occupied, ...selected]));
    return selected;
  };
  const reserveA = reserves([
    [8, -2.8, -53],
    [11, -2.8, -57],
    [11, -2.8, -62],
    [5, -2.8, -58],
    [6, -2.8, -64],
  ]);
  const reserveB = reserves(
    [
      [1, -2.8, -60],
      [-4, -3, -59],
      [-9, -2.6, -60],
      [-13, -2.4, -61],
      [-18, -1.5, -61],
    ],
    reserveA,
  );
  return {
    lanes: {
      longA: lane(landmarks.longA),
      shortA: lane(landmarks.shortA),
      tunnelsB: lane(landmarks.tunnelsB),
      midB: lane(landmarks.midB),
    },
    sites: { a, b },
    anchors: { a: anchors("BombsiteA", a), b: anchors("BombsiteB", b) },
    ctRotate: lane([[-8, -2.6, -60]]),
    retakeAnchors: { a: reserveA, b: reserveB },
  };
}

/** Reconstructed tactics on native navigation, never Dust II world coordinates. */
function buildNativeStrategyRoutes(nav: Navigation): BotStrategyRoutes {
  const start = new Vector3().fromArray(nav.data.spawns.t[0]);
  const ct = new Vector3().fromArray(nav.data.spawns.ct[0]);
  const sites = {
    a: point(nav.areas[nav.nearest(nav.site(0))]),
    b: point(nav.areas[nav.nearest(nav.site(1))]),
  };
  const floors = nav.areas.filter((area) => area.links.length >= 2 && !(area.flags & 2));
  const length = (from: Vector3, route: readonly Vector3[]) => {
    let total = 0,
      previous = from;
    for (const current of route) {
      total += previous.distanceTo(current);
      previous = current;
    }
    return total;
  };
  const waypoints = (route: readonly Vector3[], terminal = true) => {
    const selected: NavArea[] = [];
    // Native graph paths are already walkable. Keep intermediate floors spaced
    // apart so strategy stages do not multiply every individual NAV portal.
    for (let i = 0; i < route.length - (terminal ? 1 : 0); i++) {
      const area = nav.areas[nav.nearest(route[i])];
      const last = selected.at(-1);
      if (
        !last ||
        Math.hypot(last.center[0] - area.center[0], last.center[2] - area.center[2]) >= 5
      )
        selected.push(area);
    }
    return selected.map((area) => ({ position: point(area), radius: 1.5, timeout: 24 }));
  };
  const lanes = (site: StrategyPoint) => {
    const goal = new Vector3().fromArray(site);
    const direct = nav.path(start, goal);
    if (!direct.length)
      throw new Error("Mirage T spawn cannot reach a bombsite on its native navigation");
    const directLength = length(start, direct);
    // Penalize the actual first corridor on the same native graph. This finds
    // Palace versus A ramp and middle versus B apartments without making up
    // landmark positions. A geometric "far from the line" target can send a
    // B attack all the way through A and CT spawn before it reaches its site.
    const alternate = nav.path(start, goal, direct);
    const alternative =
      alternate.length && length(start, alternate) <= directLength * 1.4 ? alternate : direct;
    return [waypoints(direct), waypoints(alternative)];
  };
  const aLanes = lanes(sites.a),
    bLanes = lanes(sites.b);
  const spread = (candidates: NavArea[], first: StrategyPoint, count = 5) => {
    const selected = [first];
    const remaining = [...candidates];
    while (remaining.length && selected.length < count) {
      let best = -1,
        separation = 1;
      for (let i = 0; i < remaining.length; i++) {
        const p = remaining[i].center;
        const distance = Math.min(...selected.map((q) => (q[0] - p[0]) ** 2 + (q[2] - p[2]) ** 2));
        if (distance > separation) {
          best = i;
          separation = distance;
        }
      }
      if (best < 0) break;
      selected.push(point(remaining.splice(best, 1)[0]));
    }
    return selected;
  };
  const anchors = (index: number, site: StrategyPoint) => {
    const trigger = nav.data.triggers?.sites.find((entry) => entry.site === index);
    const candidates = floors.filter((area) => {
      const [x, y, z] = area.center;
      return (
        Math.abs(y - site[1]) < 1 &&
        (trigger
          ? trigger.hulls.some((hull) =>
              touchesBuyZone({ x, y, z }, hull, { halfWidth: 0.3, height: 1.7 }),
            )
          : Math.hypot(x - site[0], z - site[2]) < 6)
      );
    });
    return spread(candidates, site);
  };
  const reserves = (site: StrategyPoint) => {
    const route = nav.path(ct, new Vector3().fromArray(site));
    const mid = route[Math.floor(route.length * 0.45)] ?? ct;
    const candidates = floors.filter(
      (area) =>
        Math.hypot(area.center[0] - mid.x, area.center[2] - mid.z) < 4 &&
        Math.abs(area.center[1] - mid.y) < 1,
    );
    return spread(candidates, point(nav.areas[nav.nearest(mid)]));
  };
  return {
    directRotations: true,
    lanes: { longA: aLanes[0], shortA: aLanes[1], tunnelsB: bLanes[0], midB: bLanes[1] },
    sites,
    anchors: { a: anchors(0, sites.a), b: anchors(1, sites.b) },
    retakeAnchors: { a: reserves(sites.a), b: reserves(sites.b) },
    // Each CT already paths from its actual position; no Dust II rotation point.
    ctRotate: [],
  };
}
