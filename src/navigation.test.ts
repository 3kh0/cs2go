import { describe, expect, it } from "vite-plus/test";
import { Vector3 } from "three";
import { Navigation } from "./navigation";
import type { NavArea } from "./navigation";
const area = (id: number, x: number, y: number, links: number[]): NavArea => ({
  id,
  center: [x, y, 0],
  rect: [x - 1, -1, x + 1, 1],
  corners: [],
  flags: 0,
  cover: [],
  place: "",
  links,
});
describe("Source navigation", () => {
  it("smooths a connected level corridor into continuous movement", () => {
    const nav = new Navigation({
      areas: [area(1, 0, 0, [2]), area(2, 2, 0, [3]), area(3, 4, 0, [4]), area(4, 6, 0, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    const route = nav.path(new Vector3(0, 0, 0), new Vector3(6, 0, 0));
    expect(route).toHaveLength(1);
    expect(route[0].toArray()).toEqual([6, 0, 0]);
  });
  it("samples smooth ramp heights and restricts transitions to linked floors", () => {
    const ramp = {
      ...area(1, 0, 1, [2]),
      corners: [
        [-1, 0, 1],
        [1, 2, 1],
        [1, 2, -1],
        [-1, 0, -1],
      ],
    };
    const nav = new Navigation({
      areas: [ramp, area(2, 2, 2, []), area(3, 0, 5, [4]), area(4, 2, 5, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    expect(nav.support(0.5, 0, 2, -1)?.height).toBeCloseTo(1.5);
    expect(nav.support(2, 0, 2.1, 0, ramp)?.height).toBe(2);
    expect(nav.support(0, 0, 6, 4, ramp)).toBeUndefined();
    expect(nav.support(0, 0, 6, 4)?.height).toBe(5);
  });
  it("reroutes around a reported blocked connection", () => {
    const nav = new Navigation({
      areas: [area(1, 0, 0, [2, 3]), area(2, 2, 0, [4]), area(3, 3, 0, [4]), area(4, 4, 0, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    const route = nav.path(new Vector3(0, 0, 0), new Vector3(4, 0, 0), [], new Set([2]));
    expect(route.some((p) => p.x === 3)).toBe(true);
    expect(route.some((p) => p.x === 2)).toBe(false);
  });
  it("escapes an orphaned spawn area overlapping the connected floor", () => {
    const nav = new Navigation({
      areas: [area(1, 0, -0.1, []), area(2, 0, 0, [3]), area(3, 2, 0, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    expect(nav.path(new Vector3(0, -0.1, 0), new Vector3(2, 0, 0)).at(-1)?.x).toBe(2);
  });
  it("reaches an interaction position inside the final area, beyond its center", () => {
    const nav = new Navigation({
      areas: [area(1, 0, 0, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    expect(
      nav
        .path(new Vector3(-0.8, 0, 0), new Vector3(0.8, 0, 0))
        .at(-1)
        ?.toArray(),
    ).toEqual([0.8, 0, 0]);
  });
  it("uses connected ramps rather than a nearby disconnected upper floor", () => {
    const nav = new Navigation({
      areas: [area(1, 0, 0, [2]), area(2, 2, 0.7, [3]), area(3, 4, 1.4, []), area(4, 0, 4, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    const path = nav.path(new Vector3(0, 0, 0), new Vector3(4, 1.4, 0));
    expect(path.some((p) => p.x === 2 && p.y === 0.7)).toBe(true);
    expect(path.at(-1)?.toArray()).toEqual([4, 1.4, 0]);
    expect(nav.path(new Vector3(0, 0, 0), new Vector3(0, 4, 0))).toEqual([]);
  });
  it("respects one-way drops and rejects an unwalkable vertical jump", () => {
    const nav = new Navigation({
      areas: [area(1, 0, 3, [2]), area(2, 0, 0, [1])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    expect(nav.path(new Vector3(0, 3, 0), new Vector3(0, 0, 0)).length).toBeGreaterThan(0);
    expect(nav.path(new Vector3(0, 0, 0), new Vector3(0, 3, 0))).toEqual([]);
  });
});

// Source 2 uses convex polygons, including sloped triangles, not NAV16 rectangles.
it("keeps CS2 triangular ramps inside their actual polygon", () => {
  const ramp = {
    ...area(1, 0, 0, []),
    rect: [0, 0, 2, 2],
    center: [2 / 3, 2 / 3, 2 / 3],
    corners: [
      [0, 0, 0],
      [2, 2, 0],
      [0, 0, 2],
    ],
  };
  const nav = new Navigation({
    polygons: true,
    areas: [ramp],
    spawns: { t: [], ct: [] },
    sites: [],
    bounds: [0, 0, 2, 2],
  });
  expect(nav.support(0.5, 0.5, 3, -1)?.height).toBeCloseTo(0.5);
  expect(nav.support(1.8, 1.8, 3, -1)).toBeUndefined();
});
