import { describe, expect, it } from "vite-plus/test";
import * as T from "three";
import { MapCollision } from "./map-collision";
function surface(points: number[]) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  return new T.Mesh(g, new T.MeshBasicMaterial());
}
describe("imported map collision", () => {
  it("orders diagonal ray hits across cells in both directions", () => {
    const c = new MapCollision([
      surface([0, 0, -4, 0, 3, -4, 0, 3, 4, 0, 0, -4, 0, 3, 4, 0, 0, 4]),
      surface([3, 0, -5, 3, 3, -5, 3, 3, 5, 3, 0, -5, 3, 3, 5, 3, 0, 5]),
    ]);
    const from = new T.Vector3(-3, 1, -3),
      to = new T.Vector3(6, 1, 6);
    for (const [a, b] of [
      [from, to],
      [to, from],
    ]) {
      const hits = c.intersections(new T.Ray(a, b.clone().sub(a).normalize()), a.distanceTo(b));
      expect(hits[0].distance).toBeCloseTo(3 * Math.SQRT2);
      expect(hits.at(-1)!.distance).toBeCloseTo(6 * Math.SQRT2);
      expect(c.visible(a, b)).toBe(false);
    }
  });
  it("handles a vertical ray without walking horizontal cells", () => {
    const c = new MapCollision([
      surface([-2, 0, -2, 2, 0, -2, 2, 0, 2, -2, 0, -2, 2, 0, 2, -2, 0, 2]),
    ]);
    expect(
      c.intersections(new T.Ray(new T.Vector3(0, 5, 0), new T.Vector3(0, -1, 0)), 8)[0].distance,
    ).toBeCloseTo(5);
    expect(c.visible(new T.Vector3(0, 2, 0), new T.Vector3(0, -2, 0))).toBe(false);
  });
  it("allows a walkable slope beneath the capsule instead of treating it as a wall", () => {
    const c = new MapCollision([
      surface([-2, 0, -2, 2, 4.4, -2, 2, 4.4, 2, -2, 0, -2, 2, 4.4, 2, -2, 0, 2]),
    ]);
    expect(c.floor(0, 0, 3)).toBeCloseTo(2.2);
    expect(c.blocked(0, 0, 2.2, 0.35)).toBe(false);
  });
  it("finds ramps below the feet and keeps stacked floors separate", () => {
    const c = new MapCollision([
      surface([-2, 0, -2, 2, 1, -2, 2, 1, 2, -2, 0, -2, 2, 1, 2, -2, 0, 2]),
      surface([-2, 4, -2, 2, 4, -2, 2, 4, 2]),
    ]);
    expect(c.floor(0, 0, 1)).toBeCloseTo(0.5);
    expect(c.floor(0, 0, 5)).toBeCloseTo(4);
    expect(c.ceiling(0, 0, 1.7, 4.1)).toBeCloseTo(4);
    expect(c.ceiling(0, 0, 1.7, 3)).toBe(Infinity);
    expect(c.blocked(0, 0, 0.5)).toBe(false);
  });
  it("blocks a capsule and sight line at a wall while allowing a doorway", () => {
    const c = new MapCollision([
      surface([0, 0, -3, 0, 3, -3, 0, 3, -1, 0, 0, -3, 0, 3, -1, 0, 0, -1]),
    ]);
    expect(c.blocked(0.2, -2, 0)).toBe(true);
    expect(c.blocked(0.2, 0, 0)).toBe(false);
    expect(c.visible(new T.Vector3(-2, 1, -2), new T.Vector3(2, 1, -2))).toBe(false);
    expect(c.visible(new T.Vector3(-2, 1, 0), new T.Vector3(2, 1, 0))).toBe(true);
  });
});
