import { describe, expect, it } from "vitest";
import { dust2BuyZones, dust2BombSites, touchesBuyZone, type TriggerHull } from "./buy-zones";

const standing: TriggerHull = { halfWidth: 16 * 0.0254, height: 72 * 0.0254 };
const crouched: TriggerHull = { halfWidth: 16 * 0.0254, height: 54 * 0.0254 };

describe("native Dust II buy trigger geometry", () => {
  it("uses each team's actual trigger, including vertical boundaries", () => {
    // Native trigger centroids, converted from Source X/Y/Z into meters X/Z/-Y.
    const t = { x: -754 * 0.0254, y: 144 * 0.0254, z: 824 * 0.0254 };
    const ct = { x: 200 * 0.0254, y: -80 * 0.0254, z: -2272 * 0.0254 };
    expect(dust2BuyZones.contains(t, "t")).toBe(true);
    expect(dust2BuyZones.contains(t, "ct", standing)).toBe(false);
    expect(dust2BuyZones.contains(ct, "ct")).toBe(true);
    expect(dust2BuyZones.contains(ct, "t", standing)).toBe(false);
    expect(dust2BuyZones.contains({ ...ct, y: 0 }, "ct", standing)).toBe(false);
    expect(dust2BuyZones.contains({ ...t, y: 8 }, "t", standing)).toBe(false);
  });

  it("allows contact at every face and rejects separated hulls", () => {
    for (const zone of dust2BuyZones.zones) {
      const center = {
        x: (zone.min[0] + zone.max[0]) / 2,
        y: (zone.min[1] + zone.max[1]) / 2,
        z: (zone.min[2] + zone.max[2]) / 2,
      };
      const faces = [
        { key: "x", value: zone.min[0] - standing.halfWidth, direction: -1 },
        { key: "x", value: zone.max[0] + standing.halfWidth, direction: 1 },
        { key: "y", value: zone.min[1] - standing.height, direction: -1 },
        { key: "y", value: zone.max[1], direction: 1 },
        { key: "z", value: zone.min[2] - standing.halfWidth, direction: -1 },
        { key: "z", value: zone.max[2] + standing.halfWidth, direction: 1 },
      ];
      for (const face of faces) {
        const touching = { ...center, [face.key]: face.value };
        expect(touchesBuyZone(touching, zone, standing)).toBe(true);
        expect(
          touchesBuyZone(
            { ...touching, [face.key]: face.value + face.direction * 0.001 },
            zone,
            standing,
          ),
        ).toBe(false);
      }
    }
  });

  it("tests the supplied posture rather than an eye position or spawn radius", () => {
    const zone = dust2BuyZones.zones[0];
    const below = { x: -19, y: zone.min[1] - 1.5, z: 20 };
    expect(touchesBuyZone(below, zone, standing)).toBe(true);
    expect(touchesBuyZone(below, zone, crouched)).toBe(false);
    // Body overlaps the east face although its origin is outside the brush.
    const edge = { x: zone.max[0] + 0.2, y: 1, z: 20 };
    expect(dust2BuyZones.contains(edge, "t")).toBe(false);
    expect(dust2BuyZones.contains(edge, "t", standing)).toBe(true);
    // The rectangular corner is inside despite being >8 m from its centroid.
    expect(dust2BuyZones.contains({ x: -30, y: 1, z: 25 }, "t")).toBe(true);
  });

  it("rejects nonfinite positions and invalid collision hulls", () => {
    const point = { x: -19, y: 1, z: 20 };
    expect(dust2BuyZones.contains({ ...point, y: NaN }, "t", standing)).toBe(false);
    expect(dust2BuyZones.contains(point, "t", { halfWidth: -1, height: 2 })).toBe(false);
  });
});

describe("native Dust II bomb-target hull unions", () => {
  const sourcePoint = (x: number, y: number, z: number) => ({
    x: x * 0.0254,
    y: z * 0.0254,
    z: -y * 0.0254,
  });

  it("includes both A hulls but excludes their missing corner", () => {
    expect(dust2BombSites.site(sourcePoint(1000, 2500, 110))).toBe(0);
    expect(dust2BombSites.site(sourcePoint(1150, 2400, 110))).toBe(0);
    // Inside the combined AABB, but outside both actual brushes.
    expect(dust2BombSites.contains(sourcePoint(1000, 2400, 110))).toBe(false);
    expect(dust2BombSites.contains(sourcePoint(1000, 2500, 150))).toBe(false);
    expect(dust2BombSites.site(sourcePoint(1150, 2500, 150))).toBe(0);
  });

  it("identifies B and respects vertical boundaries and hull contact", () => {
    expect(dust2BombSites.site(sourcePoint(-1500, 2700, 50))).toBe(1);
    expect(dust2BombSites.site(sourcePoint(-1500, 2700, 97))).toBe(-1);
    expect(dust2BombSites.site(sourcePoint(-1330, 2700, 50))).toBe(-1);
    expect(dust2BombSites.site(sourcePoint(-1330, 2700, 50), standing)).toBe(1);
    expect(dust2BombSites.site(sourcePoint(0, 0, 0), standing)).toBe(-1);
  });
});
