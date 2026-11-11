import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "three";
import { Navigation, type NavArea } from "./navigation";
import { nearestWaypointArea } from "./navigation-waypoints";

const area = (id: number, x: number, y: number, z: number, links: number[]): NavArea => ({
  id,
  center: [x, y, z],
  rect: [x - 1, z - 1, x + 1, z + 1],
  corners: [],
  flags: 0,
  cover: [],
  place: "",
  links,
});
const navigation = (areas: NavArea[]) =>
  new Navigation({ areas, spawns: { t: [], ct: [] }, sites: [], bounds: [] });

describe("route waypoint area queries", () => {
  it("reuses an unchanged route point without rerunning the NAV query", () => {
    const nav = navigation([area(1, 0, 0, 0, [])]);
    const nearest = vi.spyOn(nav, "nearest");
    const point = new Vector3();
    for (let step = 0; step < 128; step++) expect(nearestWaypointArea(nav, point)).toBe(0);
    expect(nearest).toHaveBeenCalledTimes(1);
    expect(nearestWaypointArea(nav, point.clone())).toBe(0);
    expect(nearest).toHaveBeenCalledTimes(2);
  });

  it("requeries every changed coordinate, including vertically stacked floors", () => {
    const nav = navigation([
      area(1, 0, 0, 0, [2]),
      area(2, 0, 5, 0, [1, 3]),
      area(3, 8, 5, 0, [2, 4]),
      area(4, 8, 5, 8, [3]),
    ]);
    const point = new Vector3();
    expect(nearestWaypointArea(nav, point)).toBe(0);
    point.y = 5;
    expect(nearestWaypointArea(nav, point)).toBe(1);
    point.x = 8;
    expect(nearestWaypointArea(nav, point)).toBe(2);
    point.z = 8;
    expect(nearestWaypointArea(nav, point)).toBe(3);
    point.set(0, 0, 0);
    expect(nearestWaypointArea(nav, point)).toBe(0);
  });

  it("keeps the same point independent across map navigation instances", () => {
    const point = new Vector3();
    const first = navigation([area(1, 0, 0, 0, []), area(2, 8, 0, 0, [])]);
    const second = navigation([area(1, 8, 0, 0, []), area(2, 0, 0, 0, [])]);
    expect(nearestWaypointArea(first, point)).toBe(0);
    expect(nearestWaypointArea(second, point)).toBe(1);
    expect(nearestWaypointArea(first, point)).toBe(0);
  });

  it("preserves connected-area preference and equal-distance index ties", () => {
    const nav = navigation([area(1, 0, 0, 0, []), area(2, -1, 0, 0, [3]), area(3, 1, 0, 0, [2])]);
    const point = new Vector3();
    expect(nav.nearest(point)).toBe(1);
    expect(nearestWaypointArea(nav, point)).toBe(1);
    expect(nearestWaypointArea(nav, point)).toBe(1);
  });
});
