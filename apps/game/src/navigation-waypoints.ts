import type { Vector3 } from "three";
import type { Navigation } from "./navigation";

type WaypointArea = { x: number; y: number; z: number; area: number };
const waypointAreas = new WeakMap<Navigation, WeakMap<Vector3, WaypointArea>>();

// Route points usually outlive many movement steps. Keep the exact nearest-area
// result while their coordinates are unchanged; moving actors still query NAV.
// Both keys are weak so discarded routes and maps release their cached entries.
export function nearestWaypointArea(nav: Navigation, point: Vector3): number {
  let points = waypointAreas.get(nav);
  if (!points) {
    points = new WeakMap();
    waypointAreas.set(nav, points);
  }
  const cached = points.get(point);
  if (cached && cached.x === point.x && cached.y === point.y && cached.z === point.z)
    return cached.area;
  const area = nav.nearest(point);
  points.set(point, { x: point.x, y: point.y, z: point.z, area });
  return area;
}
