import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh, Vector3 } from "three";
import { MapCollision } from "@cs2go/simulation/map-collision";
import { mapTriggers } from "@cs2go/simulation/buy-zones";
import { movement } from "@cs2go/simulation/physics";
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
  it("preserves the original raw route and ties through reconverging congested lanes", () => {
    const lane = (id: number, x: number, z: number, links: number[]): NavArea => ({
      ...area(id, x, 0, links),
      center: [x, 0, z],
      rect: [x - 0.25, z - 0.25, x + 0.25, z + 0.25],
    });
    const nav = new Navigation({
      areas: [
        lane(1, 0, 0, [2, 3]),
        lane(2, 2, 1, [4]),
        lane(3, 2, -1, [4]),
        lane(4, 4, 0, [5]),
        lane(5, 6, 0, []),
      ],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    const from = new Vector3(),
      goal = new Vector3(6, 0, 0),
      neighbour = new Vector3(2, 0, 1),
      avoid = [neighbour];
    const route = (points: Vector3[]) =>
      nav.path(from, goal, points, undefined, false).map((point) => point.toArray());
    // Exact outputs captured from the original per-edge congestion sums.
    const expected = (z: number) => [
      [2, 0, z],
      [4, 0, 0],
      [6, 0, 0],
      [6, 0, 0],
      [6, 0, 0],
    ];
    expect(route(avoid)).toEqual(expected(-1));
    // The same avoid array and vector are mutable between searches.
    neighbour.z = -1;
    expect(route(avoid)).toEqual(expected(1));
    neighbour.z = 8;
    expect(route(avoid)).toEqual(expected(-1));
    expect(route([])).toEqual(expected(-1));
    neighbour.z = 1;
    expect(route(avoid)).toEqual(expected(-1));
    avoid.push(new Vector3(2, 0, -1), new Vector3(2, 0, -1));
    expect(route(avoid)).toEqual(expected(1));
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
  it("takes a walking route around a portal climb above the bot's jump apex", () => {
    const start = area(1, 0, 0, [2, 3]),
      prop = area(2, 2, 1.6, [4]),
      around = { ...area(3, 2, 0, [4]), center: [2, 0, 3], rect: [1, 2, 3, 4] };
    start.portals = { 2: [1, 0, 0] };
    const nav = new Navigation({
      areas: [start, prop, around, area(4, 4, 0, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    const route = nav.path(new Vector3(0, 0, 0), new Vector3(4, 0, 0));
    expect(route.some((point) => point.z === 3)).toBe(true);
    expect(route.every((point) => point.y === 0)).toBe(true);
  });
  it("keeps a feasible jump shortcut with distinct takeoff and landing edges", () => {
    const start = area(1, 0, 0, [2, 3]),
      prop = { ...area(2, 2, 1.24, [4]), portals: { 1: [1.5, 1.24, 0] } },
      around = { ...area(3, 2, 0, [4]), center: [2, 0, 6], rect: [1, 5, 3, 7] };
    start.portals = { 2: [1, 0, 0] };
    const nav = new Navigation({
      areas: [start, prop, around, area(4, 4, 0, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    const route = nav.path(new Vector3(), new Vector3(4, 0, 0));
    expect(route.some((point) => point.x === 2 && point.y === 1.24)).toBe(true);
    expect(route.some((point) => point.z === 6)).toBe(false);
  });
  it("allows a ramp crossing whose floors meet at the portal", () => {
    const ramp = {
      ...area(1, 0, 1, [2]),
      corners: [
        [-1, 0, 1],
        [1, 2, 1],
        [1, 2, -1],
        [-1, 0, -1],
      ],
      portals: { 2: [1, 2, 0] },
    };
    const nav = new Navigation({
      areas: [ramp, area(2, 2, 2, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    expect(
      nav
        .path(new Vector3(-0.5, 0.5, 0), new Vector3(2, 2, 0))
        .at(-1)
        ?.toArray(),
    ).toEqual([2, 2, 0]);
  });
  it("can retain adjacent area waypoints for blocked-connection recovery", () => {
    const nav = new Navigation({
      areas: [area(1, 0, 0, [2]), area(2, 2, 0, [3]), area(3, 4, 0, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    expect(
      nav.path(new Vector3(), new Vector3(4, 0, 0), [], undefined, false).some((p) => p.x === 2),
    ).toBe(true);
  });
  it("retains the physical start connection at a polygon edge and ignores hints on another floor", () => {
    const start = area(1, 0, 0, [3]);
    const nav = new Navigation({
      areas: [start, area(2, 2, 0, [4]), area(3, 4, 0, []), area(4, 2, 0, [])],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [],
    });
    expect(nav.path(new Vector3(1.2, 0, 0), new Vector3(4, 0, 0))).toEqual([]);
    expect(
      nav.path(new Vector3(1.2, 0, 0), new Vector3(4, 0, 0), [], undefined, true, start).length,
    ).toBeGreaterThan(0);
    expect(
      nav.path(new Vector3(1.2, 3, 0), new Vector3(4, 0, 0), [], undefined, true, start),
    ).toEqual([]);
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

it.each([false, true])(
  "preserves polygon edge tolerance and planes with repeated corners (reversed=%s)",
  (reversed) => {
    const corners = [
      [10, 4, 20],
      [10, 4, 20],
      [14, 6, 20],
      [10, 5, 24],
    ];
    const ramp = {
      ...area(1, 0, 0, []),
      rect: [10, 20, 14, 24],
      center: [11, 4.75, 21],
      corners: reversed ? corners.slice().reverse() : corners,
    };
    const nav = new Navigation({
      polygons: true,
      areas: [ramp],
      spawns: { t: [], ct: [] },
      sites: [],
      bounds: [10, 20, 14, 24],
    });
    expect(nav.support(11, 21, 8, 0)?.height).toBe(4.75);
    expect(nav.support(12, 22.02, 8, 0)?.height).toBeCloseTo(5.505);
    expect(nav.support(12, 22.08, 8, 0)).toBeUndefined();
  },
);

describe("physical native plant goals", () => {
  function fixture(mapId: "nuke" | "dust2" = "nuke") {
    const floor = new Mesh(new BoxGeometry(20, 0.5, 20));
    floor.position.y = -0.25;
    const fixture = new Mesh(new BoxGeometry(0.6, 3, 0.6));
    fixture.position.y = 1.5;
    floor.updateMatrixWorld(true);
    fixture.updateMatrixWorld(true);
    const collision = new MapCollision([floor, fixture]);
    const areas = [
      { ...area(1, 0, 0.1, [2, 3, 4]), place: "BombsiteA" },
      { ...area(2, 2, 0.1, [1]), place: "BombsiteA" },
      { ...area(3, -1.2, 0.1, [1]), place: "BombsiteA" },
      { ...area(4, 4, 0.1, [1]), place: "BombsiteA" },
    ];
    const data = {
      mapId,
      areas,
      spawns: { t: [[2, 0.1, 0]], ct: [[4, 0.1, 0]] },
      sites: [[0, 1.5, 0]],
      triggers: {
        zones: [],
        sites: [{ site: 0, hulls: [{ min: [-0.4, -0.1, -2], max: [6, 3, 2] }] }],
      },
      bounds: [-5, -5, 7, 5],
    };
    return { data, collision };
  }
  it("rejects a blocked labelled center and a closer clear point outside the native trigger", () => {
    const { data, collision } = fixture();
    const nav = new Navigation(data, collision);
    const goal = nav.site(0);
    expect(goal.toArray()).toEqual([2, 0, 0]);
    expect(
      collision.blocked(
        goal.x,
        goal.z,
        goal.y + 0.001,
        movement.hullRadius,
        movement.standingHeight,
      ),
    ).toBe(false);
    expect(
      mapTriggers({ id: "nuke", triggers: data.triggers }).bombSites.site(goal, {
        halfWidth: movement.hullRadius,
        height: movement.standingHeight,
      }),
    ).toBe(0);
    expect(nav.site(0, 4).toArray()).toEqual([4, 0, 0]);
    expect(data.sites).toEqual([[0, 1.5, 0]]);
  });
  it("uses a clear ordinary native floor in the trigger when labelled samples are all blocked", () => {
    const { data, collision } = fixture();
    for (const area of data.areas.slice(1)) area.place = "";
    const nav = new Navigation(data);
    nav.bindCollision(collision);
    expect(nav.site(0).toArray()).toEqual([2, 0, 0]);
  });
  it("preserves legacy Dust II site and offset selection", () => {
    const { data, collision } = fixture("dust2");
    const nav = new Navigation(data, collision);
    expect(nav.site(0).toArray()).toEqual([0, 0.1, 0]);
    expect(nav.site(0, 4).toArray()).toEqual([4, 0.1, 0]);
  });
});
