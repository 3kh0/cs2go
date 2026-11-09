import { describe, expect, it } from "vitest";
import { createMatch, createPlayer, joinMatch, stepMatch } from "./match";
import { neutralInput } from "@cs2go/protocol";
import { createMapTriggers, mapTriggers, touchesBuyZone, type TriggerBox } from "./buy-zones";
import { testMap } from "./test-map";

describe("map-local native trigger geometry", () => {
  const diamond: TriggerBox = {
    min: [-2, 0, -2],
    max: [2, 2, 2],
    planes: [
      [1, 0, 1, 2],
      [-1, 0, 1, 2],
      [1, 0, -1, 2],
      [-1, 0, -1, 2],
      [0, 1, 0, 2],
      [0, -1, 0, 0],
    ],
  };
  it("uses the native convex brush rather than its oversized bounding box", () => {
    expect(touchesBuyZone({ x: 1.5, y: 1, z: 1.5 }, diamond)).toBe(false);
    expect(touchesBuyZone({ x: 1, y: 1, z: 1 }, diamond)).toBe(true);
    expect(touchesBuyZone({ x: 1.2, y: 0, z: 1.2 }, diamond, { halfWidth: 0.2, height: 1.7 })).toBe(
      true,
    );
    expect(
      touchesBuyZone({ x: 1.201, y: 0, z: 1.201 }, diamond, { halfWidth: 0.2, height: 1.7 }),
    ).toBe(false);
    expect(
      touchesBuyZone({ x: 0, y: -1.701, z: 0 }, diamond, { halfWidth: 0.2, height: 1.7 }),
    ).toBe(false);
  });
  it("never silently substitutes Dust II triggers for a different map", () => {
    expect(() => mapTriggers({ id: "mirage" })).toThrow("Native triggers are missing");
    const triggers = createMapTriggers({
      zones: [{ ...diamond, team: "t" }],
      sites: [{ site: 1, hulls: [diamond] }],
    });
    expect(triggers.buyZones.contains({ x: 0, y: 0, z: 0 }, "t")).toBe(true);
    expect(triggers.buyZones.contains({ x: 0, y: 0, z: 0 }, "ct")).toBe(false);
    expect(triggers.bombSites.site({ x: 0, y: 0, z: 0 })).toBe(1);
    expect(triggers.bombSites.site({ x: 26, y: 3, z: -64 })).toBe(-1);
  });
  it("uses the selected map for authoritative purchases and planting", () => {
    // Synthetic map at the origin deliberately has no overlap with Dust II's
    // spawn buy zones or bombsites. This proves rules consume map metadata.
    const map = testMap();
    map.id = "mirage";
    map.spawns = { t: [[0, 0, 0]], ct: [[10, 0, 0]] };
    map.triggers = { zones: [{ ...diamond, team: "t" }], sites: [{ site: 0, hulls: [diamond] }] };
    const match = createMatch("casual", map);
    const t = createPlayer("t", "T", "t"),
      ct = createPlayer("ct", "CT", "ct");
    joinMatch(match, t);
    joinMatch(match, ct);
    stepMatch(match, new Map());
    expect(match.ball.mesh).toBeUndefined();
    t.money = 16000;
    stepMatch(match, new Map([[t.id, { ...neutralInput(), buy: 0 }]]));
    expect(t.primary).toBe(0);
    match.state.phase = "live";
    match.state.remaining = 100;
    match.state.bomb.carrier = t.id;
    const held = new Map([[t.id, { ...neutralInput(), use: true }]]);
    for (let i = 0; i < 440; i++) stepMatch(match, held);
    expect(match.state.bomb.planted).toBe(true);
    expect(match.state.bomb.x).toBeCloseTo(0);
    expect(match.state.bomb.z).toBeCloseTo(0);
  });
});
