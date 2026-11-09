import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { Navigation, type MapNavigation, type NavArea } from "./navigation";
import { buildBotStrategyRoutes } from "./bot-strategy-routes";
import { createMapTriggers } from "@cs2go/simulation/buy-zones";

function unlabeledMap(): MapNavigation {
  // A translated synthetic graph proves tactics use the selected NAV graph,
  // not Dust II's hardcoded landmark coordinates or optional place labels.
  const areas: NavArea[] = [];
  for (let z = 0; z < 8; z++)
    for (let x = 0; x < 8; x++) {
      const id = z * 8 + x;
      areas.push({
        id,
        flags: 0,
        center: [100 + x + 0.5, 0, 200 + z + 0.5],
        rect: [100 + x, 200 + z, 101 + x, 201 + z],
        corners: [
          [100 + x, 0, 201 + z],
          [101 + x, 0, 201 + z],
          [101 + x, 0, 200 + z],
          [100 + x, 0, 200 + z],
        ],
        links: [
          x > 0 ? id - 1 : -1,
          x < 7 ? id + 1 : -1,
          z > 0 ? id - 8 : -1,
          z < 7 ? id + 8 : -1,
        ].filter((value) => value >= 0),
        cover: [],
        place: "",
      });
    }
  return {
    mapId: "mirage",
    areas,
    spawns: { t: [[100.5, 0, 204.5]], ct: [[107.5, 0, 204.5]] },
    sites: [
      [105.5, 1, 201.5],
      [105.5, 1, 206.5],
    ],
    bounds: [100, 200, 108, 208],
    triggers: {
      zones: [],
      sites: [
        { site: 0, hulls: [{ min: [104, 0, 200], max: [107, 2, 203] }] },
        { site: 1, hulls: [{ min: [104, 0, 205], max: [107, 2, 208] }] },
      ],
    },
  };
}

describe("map-independent native navigation strategies", () => {
  it("grounds unlabeled bombsites and routes every selected-map lane to its objective", () => {
    const data = unlabeledMap(),
      nav = new Navigation(data),
      routes = buildBotStrategyRoutes(nav);
    expect(nav.site(0).y).toBe(0);
    expect(nav.site(1).y).toBe(0);
    for (const [name, lane] of Object.entries(routes.lanes)) {
      let previous = new Vector3().fromArray(data.spawns.t[0]);
      for (const step of [
        ...lane.map(({ position }) => position),
        routes.sites[name.endsWith("A") ? "a" : "b"],
      ]) {
        const goal = new Vector3().fromArray(step);
        expect(goal.x).toBeGreaterThanOrEqual(100);
        expect(goal.z).toBeGreaterThanOrEqual(200);
        expect(nav.path(previous, goal).length).toBeGreaterThan(0);
        previous = goal;
      }
    }
    const triggers = createMapTriggers(data.triggers!);
    for (const site of ["a", "b"] as const)
      for (const [x, y, z] of routes.anchors[site])
        expect(triggers.bombSites.site({ x, y, z })).toBe(site === "a" ? 0 : 1);
    expect(routes.ctRotate).toEqual([]);
  });
});
