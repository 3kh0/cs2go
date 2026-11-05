import type { BotStrategyRoutes, StrategyPoint } from "./bot-strategy";
import type { NavArea, Navigation } from "./navigation";

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
