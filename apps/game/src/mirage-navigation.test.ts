import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { Navigation, type MapNavigation } from "./navigation";
import { buildBotStrategyRoutes } from "./bot-strategy-routes";
import { mapTriggers } from "@cs2go/simulation/buy-zones";

const data = JSON.parse(
  readFileSync(
    new URL("../../../packages/assets/public/models/maps/mirage-nav.json", import.meta.url),
    "utf8",
  ),
) as MapNavigation;
const nav = new Navigation(data);

describe("shipped native Mirage navigation and objectives", () => {
  it("retains directed native topology and both teams' native poses", () => {
    expect(data.mapId).toBe("mirage");
    expect(data.polygons).toBe(true);
    expect(data.areas).toHaveLength(2544);
    expect(data.areas.reduce((count, area) => count + area.links.length, 0)).toBe(6381);
    expect(data.spawns.t).toHaveLength(17);
    expect(data.spawns.ct).toHaveLength(16);
    for (const team of ["t", "ct"] as const) {
      expect(data.spawnAngles![team]).toHaveLength(data.spawns[team].length);
      expect(data.spawnAngles![team].every(Number.isFinite)).toBe(true);
    }
    for (const area of data.areas)
      for (const target of area.links) {
        expect(nav.index.has(target)).toBe(true);
        expect(area.portals?.[target]?.every(Number.isFinite)).toBe(true);
      }
  });
  it("connects every native spawn to grounded A and B plant floors", () => {
    const triggers = mapTriggers({ id: "mirage", triggers: data.triggers });
    for (const index of [0, 1]) {
      const goal = nav.site(index);
      expect(triggers.bombSites.site(goal, { halfWidth: 0.3, height: 1.7 })).toBe(index);
      expect(nav.support(goal.x, goal.z, goal.y + 0.25, goal.y - 0.25)).toBeDefined();
      for (const team of ["t", "ct"] as const)
        for (const spawn of data.spawns[team]) {
          expect(
            triggers.buyZones.contains(new Vector3().fromArray(spawn), team, {
              halfWidth: 0.3,
              height: 1.7,
            }),
          ).toBe(true);
          const route = nav.path(new Vector3().fromArray(spawn), goal);
          expect(route.length, `${team} ${spawn.join(",")} to site ${index}`).toBeGreaterThan(0);
          expect(route.at(-1)!.distanceTo(goal)).toBeLessThan(2);
        }
    }
  });
  it("routes every attack lane and site hold entirely on native Mirage floors", () => {
    const routes = buildBotStrategyRoutes(nav);
    expect(buildBotStrategyRoutes(nav)).toEqual(routes);
    for (const [name, lane] of Object.entries(routes.lanes)) {
      let from = new Vector3().fromArray(data.spawns.t[0]);
      for (const { position } of [
        ...lane,
        { position: routes.sites[name.endsWith("A") ? "a" : "b"] },
      ]) {
        const to = new Vector3().fromArray(position);
        expect(
          nav.areas.some((area) => area.center.every((value, index) => value === position[index])),
        ).toBe(true);
        expect(nav.path(from, to).length).toBeGreaterThan(0);
        from = to;
      }
    }
    const triggers = mapTriggers({ id: "mirage", triggers: data.triggers });
    for (const site of ["a", "b"] as const) {
      expect(routes.anchors[site].length).toBeGreaterThanOrEqual(3);
      for (const position of routes.anchors[site])
        expect(
          triggers.bombSites.site(new Vector3().fromArray(position), {
            halfWidth: 0.3,
            height: 1.7,
          }),
        ).toBe(site === "a" ? 0 : 1);
    }
  });
});
