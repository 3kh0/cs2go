import { readFileSync } from "node:fs";
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { Navigation, type MapNavigation } from "./navigation";
import { buildBotStrategyRoutes } from "./bot-strategy-routes";

const data = JSON.parse(
  readFileSync(
    new URL("../../../packages/assets/public/models/maps/dust2-nav.json", import.meta.url),
    "utf8",
  ),
) as MapNavigation;
const nav = new Navigation(data),
  routes = buildBotStrategyRoutes(nav);

describe("authored Dust II strategy lanes", () => {
  it("uses stable connected native floor centers for every lane and site anchor", () => {
    expect(buildBotStrategyRoutes(nav)).toEqual(routes);
    const points = [
      ...Object.values(routes.lanes)
        .flat()
        .map((waypoint) => waypoint.position),
      ...routes.anchors.a,
      ...routes.anchors.b,
      ...routes.ctRotate!.map((waypoint) => waypoint.position),
      ...routes.retakeAnchors!.a,
      ...routes.retakeAnchors!.b,
    ];
    for (const point of points) {
      expect(nav.areas.some((area) => area.center.every((value, i) => value === point[i]))).toBe(
        true,
      );
      expect(nav.support(point[0], point[2], point[1] + 0.25, point[1] - 0.25)).toBeDefined();
    }
  });
  it("separates long, catwalk, tunnels and mid through distinct real map corridors", () => {
    expect(routes.lanes.longA.some(({ position: [x, , z] }) => x > 35 && z < -25)).toBe(true);
    expect(
      routes.lanes.shortA.some(({ position: [x, y, z] }) => x > 7 && x < 15 && y > 2 && z < -45),
    ).toBe(true);
    expect(routes.lanes.tunnelsB.some(({ position: [x, , z] }) => x < -45 && z < -40)).toBe(true);
    expect(routes.lanes.midB.some(({ position: [, y, z] }) => y < -2 && z < -50)).toBe(true);
  });
  it("connects every T spawn through each ordered lane to its intended site", () => {
    for (const spawn of data.spawns.t) {
      for (const [name, waypoints] of Object.entries(routes.lanes)) {
        let from = new Vector3().fromArray(spawn);
        const site = routes.sites[name.endsWith("A") ? "a" : "b"];
        for (const { position } of [...waypoints, { position: site }]) {
          const goal = new Vector3().fromArray(position);
          expect(
            nav.path(from, goal).length,
            `${name}: ${from.toArray().join(",")} → ${goal.toArray().join(",")}`,
          ).toBeGreaterThan(0);
          from = goal;
        }
      }
    }
  });
  it("keeps site holds on source-labeled bombsite floors and allows CT rotation to either site", () => {
    for (const site of ["a", "b"] as const) {
      expect(routes.anchors[site].length).toBeGreaterThanOrEqual(3);
      const label = site === "a" ? "BombsiteA" : "BombsiteB";
      for (const point of routes.anchors[site]) {
        expect(
          nav.areas.some(
            (area) => area.place === label && area.center.every((value, i) => value === point[i]),
          ),
        ).toBe(true);
      }
      for (const spawn of data.spawns.ct) {
        let from = new Vector3().fromArray(spawn);
        for (const { position } of [...routes.ctRotate!, { position: routes.sites[site] }]) {
          const goal = new Vector3().fromArray(position);
          expect(nav.path(from, goal).length).toBeGreaterThan(0);
          from = goal;
        }
      }
    }
  });
  it("spreads retake reserves across connected CT-side staging floors", () => {
    const holds = [...routes.retakeAnchors!.a, ...routes.retakeAnchors!.b];
    expect(routes.retakeAnchors!.a.length).toBeGreaterThanOrEqual(3);
    expect(routes.retakeAnchors!.b.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < holds.length; i++) {
      const goal = new Vector3().fromArray(holds[i]);
      expect(goal.z).toBeLessThan(-50);
      expect(goal.y).toBeLessThan(0);
      for (let j = 0; j < i; j++) {
        expect(
          Math.hypot(holds[i][0] - holds[j][0], holds[i][2] - holds[j][2]),
        ).toBeGreaterThanOrEqual(2);
      }
      for (const spawn of data.spawns.ct) {
        expect(nav.path(new Vector3().fromArray(spawn), goal).length).toBeGreaterThan(0);
      }
      for (const site of Object.values(routes.sites)) {
        expect(nav.path(goal, new Vector3().fromArray(site)).length).toBeGreaterThan(0);
      }
    }
  });
});
