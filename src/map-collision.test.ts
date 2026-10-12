import { describe, expect, it } from "vite-plus/test";
import * as T from "three";
import { MapCollision } from "./map-collision";
function surface(points: number[]) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  return new T.Mesh(g, new T.MeshBasicMaterial());
}
describe("imported map collision", () => {
  it("uses invisible brushes for movement without blocking sight or bullets", () => {
    const ramp = new T.Mesh(new T.BoxGeometry(4, 1, 4));
    ramp.position.y = 0.5;
    const wall = new T.Mesh(new T.BoxGeometry(0.2, 3, 4));
    wall.position.set(3, 1.5, 0);
    const c = new MapCollision([], [ramp, wall]);
    expect(c.floor(0, 0, 2)).toBeCloseTo(1);
    expect(c.floor(0, 0, 0.5)).toBe(-Infinity);
    expect(c.ceiling(0, 0, -1, 2)).toBeCloseTo(0);
    expect(c.blocked(0, 0, 1)).toBe(false);
    expect(c.blocked(2.8, 0, 0)).toBe(true);
    const from = new T.Vector3(2, 1, 0),
      to = new T.Vector3(4, 1, 0);
    expect(c.visible(from, to)).toBe(true);
    expect(c.intersections(new T.Ray(from, new T.Vector3(1, 0, 0)), 2)).toEqual([]);
    const solid = new MapCollision([wall], [ramp]);
    expect(solid.visible(from, to)).toBe(false);
    expect(solid.intersections(new T.Ray(from, new T.Vector3(1, 0, 0)), 2).length).toBeGreaterThan(
      0,
    );
  });
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
  it("slides a falling player clear of a ledge's side without changing their height", () => {
    const c = new MapCollision([
      surface([0, 0, -2, 0, 1, -2, 0, 1, 2, 0, 0, -2, 0, 1, 2, 0, 0, 2]),
    ]);
    const p = new T.Vector3(0.2, 1, 0);
    expect(c.blocked(p.x, p.z, p.y)).toBe(false);
    p.y = 0.5;
    expect(c.blocked(p.x, p.z, p.y)).toBe(true);
    expect(c.resolveHorizontal(p)).toBe(true);
    expect(p.y).toBe(0.5);
    expect(p.x).toBeGreaterThan(0.2);
    expect(p.x).toBeLessThan(0.31);
    expect(c.blocked(p.x, p.z, p.y)).toBe(false);
    expect(c.blocked(p.x + 0.05, p.z, p.y)).toBe(false);
  });
  it("resolves both sides of a corner and refuses to eject through a narrow gap", () => {
    const wall = surface([0, 0, -2, 0, 3, -2, 0, 3, 2, 0, 0, -2, 0, 3, 2, 0, 0, 2]);
    const cross = wall.clone();
    cross.rotation.y = Math.PI / 2;
    const c = new MapCollision([wall, cross]),
      p = new T.Vector3(0.29, 0, 0.29);
    expect(c.resolveHorizontal(p)).toBe(true);
    expect(p.x).toBeGreaterThanOrEqual(0.3);
    expect(p.z).toBeGreaterThanOrEqual(0.3);
    expect(c.blocked(p.x, p.z, p.y)).toBe(false);
    const opposite = wall.clone();
    opposite.position.x = 0.4;
    const narrow = new MapCollision([wall, opposite]);
    p.set(0.2, 0, 0);
    expect(narrow.resolveHorizontal(p)).toBe(false);
    expect(p.toArray()).toEqual([0.2, 0, 0]);
  });
  it("keeps a rising player on the same side of a sloped wall", () => {
    const c = new MapCollision([
      surface([0, 0, -2, 0.6, 3, -2, 0.6, 3, 2, 0, 0, -2, 0.6, 3, 2, 0, 0, 2]),
    ]);
    const p = new T.Vector3(0.59, 0, 0);
    expect(c.blocked(p.x, p.z, p.y)).toBe(false);
    p.y = 0.2;
    expect(c.blocked(p.x, p.z, p.y)).toBe(true);
    expect(c.resolveHorizontal(p)).toBe(true);
    expect(p.x).toBeGreaterThan(0.59);
    expect(p.y).toBe(0.2);
    expect(c.blocked(p.x, p.z, p.y)).toBe(false);
  });
});
describe("map collision geometry input", () => {
  // Quantized glTF positions: normalized int16 with the node scale restoring metres.
  function quantized(points: number[], extent: number) {
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.Int16BufferAttribute(
        points.map((v) => Math.round((v / extent) * 32767)),
        3,
        true,
      ),
    );
    const mesh = new T.Mesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide }));
    mesh.scale.setScalar(extent);
    return mesh;
  }
  function random(seed: number) {
    return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
  }
  it("matches brute-force raycasts on transformed, quantized and indexed meshes", () => {
    const next = random(7),
      parent = new T.Group();
    parent.position.set(4, 1, -3);
    parent.rotation.set(0.3, 0.8, -0.2);
    // Small detail triangles exercise per-cell height culling; large ones span cells.
    const a = quantized(
      Array.from({ length: 400 }, () => {
        const center = [next() * 5, next() * 3, next() * 5];
        return [0, 1, 2].flatMap(() => center.map((v) => v + next() * 0.6));
      }).flat(),
      6,
    );
    a.position.set(-2, 0.5, 1);
    a.rotation.y = 0.6;
    const indexed = new T.BufferGeometry();
    indexed.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        Array.from({ length: 60 }, () => next() * 5),
        3,
      ),
    );
    indexed.setIndex(Array.from({ length: 45 }, (_, i) => (i * 7) % 20));
    const b = new T.Mesh(indexed, new T.MeshBasicMaterial({ side: T.DoubleSide }));
    parent.add(b);
    const scene = new T.Scene().add(a, parent);
    scene.updateMatrixWorld(true);
    const c = new MapCollision([a, b]),
      raycaster = new T.Raycaster();
    let compared = 0;
    for (let i = 0; i < 600; i++) {
      const from = new T.Vector3(next() * 12, next() * 6, next() * 12),
        to = new T.Vector3(next() * 12, next() * 6, next() * 12);
      const far = from.distanceTo(to),
        direction = to.clone().sub(from).normalize();
      raycaster.set(from, direction);
      raycaster.far = far;
      const expected = raycaster.intersectObjects([a, b], false).filter((h) => h.distance >= 0.002);
      const hits = c.intersections(new T.Ray(from, direction), far);
      expect(hits.map((h) => h.distance)).toEqual(
        expected.map((h) => expect.closeTo(h.distance, 3)),
      );
      hits.forEach((hit, j) => {
        expect(hit.object).toBe(expected[j].object);
        expect(hit.point.distanceTo(expected[j].point)).toBeLessThan(1e-3);
        const normal = expected[j]
          .face!.normal.clone()
          .transformDirection(expected[j].object.matrixWorld);
        expect(Math.abs(hit.face!.normal.dot(normal))).toBeCloseTo(1, 3);
      });
      expect(c.visible(from, to)).toBe(expected.length === 0);
      compared += expected.length;
    }
    expect(compared).toBeGreaterThan(200);
  });
  it("supports, blocks and measures a rotated quantized floor and wall in world space", () => {
    const floor = quantized([-4, 0, -4, 4, 0, -4, 4, 0, 4, -4, 0, -4, 4, 0, 4, -4, 0, 4], 4);
    floor.position.set(10, 2, -6);
    floor.rotation.y = Math.PI / 4;
    const wall = quantized([0, 0, -3, 0, 3, -3, 0, 3, 3, 0, 0, -3, 0, 3, 3, 0, 0, 3], 3);
    wall.position.set(10, 2, -6);
    const back = wall.clone();
    back.position.x = 10.2;
    const c = new MapCollision([floor, wall, back]);
    expect(c.floor(9, -5, 4)).toBeCloseTo(2, 3);
    expect(c.floor(16, -6, 4)).toBe(-Infinity);
    expect(c.floor(500, 500, 4)).toBe(-Infinity);
    expect(c.ceiling(9, -5, 0, 4)).toBeCloseTo(2, 3);
    expect(c.blocked(10.2, -6, 2)).toBe(true);
    expect(c.blocked(11, -6, 2)).toBe(false);
    const hit = c.intersections(new T.Ray(new T.Vector3(8, 3, -6), new T.Vector3(1, 0, 0)), 10)[0];
    expect(hit.object).toBe(wall);
    expect(hit.distance).toBeCloseTo(2, 3);
    expect(Math.abs(hit.face!.normal.x)).toBeCloseTo(1, 3);
    expect(c.thickness(hit, new T.Vector3(1, 0, 0))).toBeCloseTo(0.2, 3);
    expect(c.visible(new T.Vector3(8, 3, -6), new T.Vector3(12, 3, -6))).toBe(false);
    expect(c.visible(new T.Vector3(8, 6, -6), new T.Vector3(12, 6, -6))).toBe(true);
  });
});
