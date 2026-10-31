import { describe, expect, it } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";
function surface(points: number[]) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  return new T.Mesh(g, new T.MeshBasicMaterial());
}
describe("imported map collision", () => {
  it("follows walkable ramps and steps but releases support at a ledge", () => {
    const ramp = surface([-4, -2, -4, 4, 2, 4, 4, 2, -4, -4, -2, -4, -4, -2, 4, 4, 2, 4]);
    const collision = new MapCollision([ramp]);
    const position = new T.Vector3(0, 0, 0);
    for (const direction of [-1, 1]) {
      position.set(0, 0, 0);
      for (let step = 0; step < 32; step++) {
        position.x += direction * 0.05;
        expect(collision.followGround(position)).toBe(true);
        expect(position.y).toBeCloseTo((position.x + 0.3) * 0.5, 6);
      }
    }
    position.set(4.31, 2, 0);
    expect(collision.followGround(position)).toBe(false);
    expect(position.y).toBe(2);
    position.set(0, 0.7, 0);
    expect(collision.followGround(position)).toBe(false);
    expect(position.y).toBe(0.7);
  });
  it("supports narrow ledges and corners anywhere under the foot rectangle", () => {
    const ledge = surface([0, 1, -2, 0.08, 1, 2, 0.08, 1, -2, 0, 1, -2, 0, 1, 2, 0.08, 1, 2]);
    const collision = new MapCollision([ledge]);
    expect(collision.floor(-0.2, 0, 1.1, 0.9)).toBe(-Infinity);
    expect(collision.support(-0.2, 0, 1.1, 0.9)).toBeCloseTo(1);
    expect(collision.support(-0.2, 2.2, 1.1, 0.9)).toBeCloseTo(1);
    expect(collision.support(-0.31, 0, 1.1, 0.9)).toBe(-Infinity);
    expect(collision.support(-0.2, 2.31, 1.1, 0.9)).toBe(-Infinity);
    expect(collision.support(-0.2, 0, 0.9, 0)).toBe(-Infinity);
    expect(collision.ceiling(-0.2, 0, 0.9, 1.1)).toBe(Infinity);
    expect(collision.ceiling(-0.2, 0, 0.9, 1.1, 0.3)).toBeCloseTo(1);
    expect(collision.ceiling(-0.31, 0, 0.9, 1.1, 0.3)).toBe(Infinity);
  });
  it("does not snap onto a steep face or step through a low ceiling", () => {
    const steep = new MapCollision([surface([-2, -2.2, -2, 2, 2.2, 2, 2, 2.2, -2])]);
    expect(steep.followGround(new T.Vector3(0, 0, 0))).toBe(false);
    const floor = surface([-2, 0.3, -2, 2, 0.3, 2, 2, 0.3, -2]);
    const ceiling = surface([-2, 1.8, -2, 2, 1.8, 2, 2, 1.8, -2]);
    const position = new T.Vector3(0, 0, 0);
    expect(new MapCollision([floor, ceiling]).followGround(position)).toBe(false);
    expect(position.y).toBe(0);
  });
  it("steps onto a ramp edge before resolving its side as a wall", () => {
    const ramp = surface([0, 0, -2, 4, 2.4, 2, 4, 2.4, -2, 0, 0, -2, 0, 0, 2, 4, 2.4, 2]);
    const c = new MapCollision([ramp]);
    const p = new T.Vector3(-0.31, 0, 0);
    for (let i = 0; i < 64; i++) {
      c.moveHorizontal(p, { x: 4, z: 0 }, 1 / 128, 0.3, 1.65, true);
      c.followGround(p);
    }
    expect(p.x).toBeCloseTo(1.69, 4);
    expect(p.y).toBeCloseTo((p.x + 0.3) * 0.6, 4);
  });
  it("does not step in air, through a ceiling, or above the stair allowance", () => {
    const ramp = surface([0, 0, -2, 4, 2.4, 2, 4, 2.4, -2, 0, 0, -2, 0, 0, 2, 4, 2.4, 2]);
    const air = new MapCollision([ramp]);
    const p = new T.Vector3(-0.31, 0, 0);
    for (let i = 0; i < 32; i++) air.moveHorizontal(p, { x: 4, z: 0 }, 1 / 128);
    expect(p.y).toBe(0);
    expect(p.x).toBeLessThan(0);
    const roof = surface([-2, 1.7, -2, 4, 1.7, 2, 4, 1.7, -2, -2, 1.7, -2, -2, 1.7, 2, 4, 1.7, 2]);
    const low = new MapCollision([ramp, roof]);
    p.set(-0.31, 0, 0);
    for (let i = 0; i < 32; i++) low.moveHorizontal(p, { x: 4, z: 0 }, 1 / 128, 0.3, 1.65, true);
    expect(p.y + 1.65).toBeLessThanOrEqual(1.7);
    expect(p.x).toBeLessThan(0);
    const tall = new T.Mesh(new T.BoxGeometry(2, 1.2, 4));
    tall.position.set(1, 0, 0);
    const obstacle = new MapCollision([tall]);
    p.set(-0.31, 0, 0);
    for (let i = 0; i < 32; i++)
      obstacle.moveHorizontal(p, { x: 4, z: 0 }, 1 / 128, 0.3, 1.65, true);
    expect(p.y).toBe(0);
    expect(p.x).toBeLessThan(0);
  });
  it("blocks thin trim between body samples and respects square hull corners", () => {
    const trim = new T.Mesh(new T.BoxGeometry(0.02, 0.02, 4));
    trim.position.y = 1.0875;
    const collision = new MapCollision([trim]);
    expect(collision.blocked(-0.29, 0, 0)).toBe(true);
    expect(collision.blocked(-0.311, 0, 0)).toBe(false);
    const pillar = new T.Mesh(new T.BoxGeometry(1, 3, 1));
    pillar.position.y = 1.5;
    const corner = new MapCollision([pillar]);
    expect(corner.blocked(-0.75, -0.75, 0)).toBe(true);
    expect(corner.blocked(-0.801, -0.75, 0)).toBe(false);
  });
  it("stops both velocity components in a two-wall corner", () => {
    const a = new T.Mesh(new T.BoxGeometry(0.02, 4, 8));
    const b = new T.Mesh(new T.BoxGeometry(8, 4, 0.02));
    a.position.y = b.position.y = 2;
    const collision = new MapCollision([a, b]);
    const position = new T.Vector3(-0.32, 0, -0.32);
    const velocity = { x: 4, z: 2 };
    for (let i = 0; i < 16; i++) collision.moveHorizontal(position, velocity, 1 / 128);
    expect(position.x).toBeLessThanOrEqual(-0.31);
    expect(position.z).toBeLessThanOrEqual(-0.31);
    expect(velocity.x).toBeCloseTo(0, 8);
    expect(velocity.z).toBeCloseTo(0, 8);
    expect(collision.blocked(position.x, position.z, 0)).toBe(false);
  });
  it("sweeps fast movement against thin walls and retains tangential speed", () => {
    const wall = new T.Mesh(new T.BoxGeometry(0.02, 4, 20));
    wall.position.y = 2;
    const collision = new MapCollision([wall]);
    const position = new T.Vector3(-1, 0, 0);
    const velocity = { x: 200, z: 4 };
    collision.moveHorizontal(position, velocity, 1 / 128);
    expect(position.x).toBeLessThan(-0.29);
    expect(position.z).toBeCloseTo(4 / 128, 4);
    expect(velocity.x).toBeCloseTo(0, 4);
    expect(velocity.z).toBeCloseTo(4, 4);
    expect(collision.blocked(position.x, position.z, 0)).toBe(false);
  });
  it("sweeps a full high-speed displacement without tunneling or truncating tangential travel", () => {
    const wall = surface([0, 0, -4, 0, 4, -4, 0, 4, 4, 0, 0, -4, 0, 4, 4, 0, 0, 4]);
    const collision = new MapCollision([wall]);
    const position = new T.Vector3(-10, 0, 0);
    const velocity = { x: 20000, z: 4 };
    collision.moveHorizontal(position, velocity, 1 / 128);
    expect(position.x).toBeCloseTo(-0.3, 4);
    expect(position.z).toBeCloseTo(4 / 128, 5);
    expect(velocity).toEqual({ x: 0, z: 4 });
    expect(collision.blocked(position.x, position.z, 0)).toBe(false);
    // The opposite face is also solid; triangle winding must not change it.
    position.set(10, 0, 0);
    velocity.x = -20000;
    collision.moveHorizontal(position, velocity, 1 / 128);
    expect(position.x).toBeCloseTo(0.3, 4);
    expect(position.z).toBeCloseTo(4 / 128, 5);
  });
  it("stops continuously at a concave seam and allows immediate retreat without ejection", () => {
    const a = surface([0, 0, -4, 0, 4, -4, 0, 4, 4, 0, 0, -4, 0, 4, 4, 0, 0, 4]);
    const b = a.clone();
    b.rotation.y = Math.PI / 3;
    const collision = new MapCollision([a, b]);
    const position = new T.Vector3(-1, 0, -1);
    const velocity = { x: 80, z: 100 };
    collision.moveHorizontal(position, velocity, 0.1);
    expect(position.x).toBeLessThanOrEqual(-0.3);
    expect(collision.blocked(position.x, position.z, 0)).toBe(false);
    const corner = position.clone();
    for (let i = 0; i < 128; i++) {
      collision.moveHorizontal(position, { x: -3, z: -3 }, 1 / 128);
      expect(collision.blocked(position.x, position.z, 0)).toBe(false);
    }
    expect(position.x).toBeLessThan(corner.x - 2.9);
    expect(position.z).toBeLessThan(corner.z - 2.9);
  });
  it("does not catch a tangent hull on the diagonal seam of a triangulated face", () => {
    const face = surface([0, 0, -4, 0, 4, -4, 0, 4, 4, 0, 0, -4, 0, 4, 4, 0, 0, 4]);
    const collision = new MapCollision([face]);
    const position = new T.Vector3(-0.3, 0, -3);
    const velocity = { x: 0, z: 6 };
    collision.moveHorizontal(position, velocity, 1);
    expect(position.toArray()).toEqual([-0.3, 0, 3]);
    expect(velocity).toEqual({ x: 0, z: 6 });
  });
  it("slides diagonally along oblique walls instead of zeroing both axes", () => {
    const wall = new T.Mesh(new T.BoxGeometry(0.02, 4, 20));
    wall.position.y = 2;
    wall.rotation.y = Math.PI / 4;
    const collision = new MapCollision([wall]);
    const position = new T.Vector3(-0.4, 0, 0);
    const velocity = { x: 4, z: 0 };
    for (let i = 0; i < 128; i++) collision.moveHorizontal(position, velocity, 1 / 128);
    expect(position.x).toBeGreaterThan(1);
    expect(position.z).toBeGreaterThan(1);
    expect(velocity.x).toBeCloseTo(2, 2);
    expect(velocity.z).toBeCloseTo(2, 2);
    expect(collision.blocked(position.x, position.z, 0)).toBe(false);
  });
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
  it("allows a walkable slope beneath the hull instead of treating it as a wall", () => {
    const c = new MapCollision([
      surface([-2, 0, -2, 2, 3.2, -2, 2, 3.2, 2, -2, 0, -2, 2, 3.2, 2, -2, 0, 2]),
    ]);
    expect(c.floor(0, 0, 3)).toBeCloseTo(1.6);
    expect(c.blocked(0, 0, 1.6, 0.35)).toBe(false);
  });
  it("does not classify slopes steeper than the Source standable normal as ground", () => {
    const c = new MapCollision([
      surface([-2, 0, -2, 2, 4.4, -2, 2, 4.4, 2, -2, 0, -2, 2, 4.4, 2, -2, 0, 2]),
    ]);
    expect(c.floor(0, 0, 3)).toBe(-Infinity);
    expect(c.blocked(0, 0, 2.2, 0.35)).toBe(true);
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
  it("blocks a hull and sight line at a wall while allowing a doorway", () => {
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
    const p = new T.Vector3(0.64, 0, 0);
    expect(c.blocked(p.x, p.z, p.y)).toBe(false);
    p.y = 0.2;
    expect(c.blocked(p.x, p.z, p.y)).toBe(true);
    expect(c.resolveHorizontal(p)).toBe(true);
    expect(p.x).toBeGreaterThan(0.64);
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

describe("ragdoll sphere contacts", () => {
  it("ignores collapsed native triangles without losing neighboring floor contacts", () => {
    const collapsed = surface([0, 0, 0, 0, 0, 0, 1, 0, 0]);
    const point = new T.Vector3(0.5, 0.05, 0);
    new MapCollision([collapsed]).resolveSphere(point, 0.1);
    expect(point.toArray()).toEqual([0.5, 0.05, 0]);
    const floor = surface([-4, 0, -4, 4, 0, 4, 4, 0, -4, -4, 0, -4, -4, 0, 4, 4, 0, 4]);
    const collision = new MapCollision([collapsed, floor]);
    collision.resolveSphere(point, 0.1);
    expect(point.y).toBeCloseTo(0.1, 3);
    expect(Number.isFinite(point.lengthSq())).toBe(true);
  });
  it("supports joints on floors and slopes without the player step exemption", () => {
    const flat = new MapCollision([
      surface([-4, 0, -4, 4, 0, 4, 4, 0, -4, -4, 0, -4, -4, 0, 4, 4, 0, 4]),
    ]);
    const point = new T.Vector3(0, 0.04, 0);
    flat.resolveSphere(point, 0.1);
    expect(point.y).toBeCloseTo(0.1, 3);
    const ramp = new MapCollision([
      surface([-4, -2, -4, 4, 2, 4, 4, 2, -4, -4, -2, -4, -4, -2, 4, 4, 2, 4]),
    ]);
    point.set(0, 0.04, 0);
    ramp.resolveSphere(point, 0.1);
    expect((point.y - point.x * 0.5) / Math.sqrt(1.25)).toBeCloseTo(0.1, 3);
  });
  it("pushes joints off low wall faces and leaves unsupported joints free to fall", () => {
    const ledge = new T.Mesh(new T.BoxGeometry(2, 0.3, 2));
    ledge.position.y = 0.15;
    const collision = new MapCollision([ledge]);
    const point = new T.Vector3(1.04, 0.15, 0);
    collision.resolveSphere(point, 0.1);
    expect(point.x).toBeCloseTo(1.1, 3);
    point.set(1.5, 0.15, 0);
    collision.resolveSphere(point, 0.1);
    expect(point.toArray()).toEqual([1.5, 0.15, 0]);
  });
});
