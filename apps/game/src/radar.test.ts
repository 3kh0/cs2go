import { describe, expect, it } from "vitest";
import { radarEdge, radarView } from "./radar";

const projection = { px: (x: number) => x, pz: (z: number) => z };
const position = { x: 150, y: 20, z: 130 };

describe("radar presentation projection", () => {
  it("uses one heading-up transform for map, contacts, and facing", () => {
    const view = radarView(256, 256, projection, position, Math.PI / 2, 3, true, true);
    expect(view.point(position)).toEqual({ x: 128, y: 128 });
    // A player looking west sees the western teammate directly ahead.
    const ahead = view.point({ x: 140, y: 20, z: 130 });
    expect(ahead.x).toBeCloseTo(128);
    expect(ahead.y).toBeCloseTo(98);
    expect(view.heading(Math.PI / 2)).toBeCloseTo(0);
    // A north-facing teammate points to the right of that observer.
    expect(view.heading(0)).toBeCloseTo(Math.PI / 2);
  });

  it("keeps the full north-up map centered independently of observer position", () => {
    const view = radarView(256, 256, projection, position, 2, 1, false, false);
    expect(view.point({ x: 0, y: -5, z: 0 })).toEqual({ x: 0, y: 0 });
    expect(view.point({ x: 256, y: 100, z: 256 })).toEqual({ x: 256, y: 256 });
    expect(view.heading(0)).toBe(0);
  });

  it("lets an uncentered observer approach the edge without exposing empty map", () => {
    const view = radarView(256, 256, projection, { x: 0, y: 0, z: 256 }, 0, 2, false, false);
    expect(view.originX).toBe(64);
    expect(view.originY).toBe(192);
    expect(view.point({ x: 0, y: 0, z: 256 })).toEqual({ x: 0, y: 256 });
  });

  it("clamps off-map contacts to circular or square edges without changing direction", () => {
    const circular = radarEdge({ x: 512, y: -256 }, 256, 256, false, 10);
    expect(circular.clamped).toBe(true);
    expect(Math.hypot(circular.x - 128, circular.y - 128)).toBeCloseTo(118);
    expect(circular.x - 128).toBeCloseTo(128 - circular.y);
    const square = radarEdge({ x: 512, y: -256 }, 256, 256, true, 10);
    expect(square.clamped).toBe(true);
    expect(square.x).toBeCloseTo(246);
    expect(square.y).toBeCloseTo(10);
    expect(square.angle).toBeCloseTo(Math.PI / 4);
    expect(radarEdge({ x: 128, y: 128 }, 256, 256, false, 10)).toMatchObject({
      x: 128,
      y: 128,
      clamped: false,
    });
  });
});
