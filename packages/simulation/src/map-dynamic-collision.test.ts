import { expect, test } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";

function leaf(angle = 0) {
  const mesh = new T.Mesh(new T.BoxGeometry(2, 2.4, 0.12).translate(1, 1.2, 0));
  mesh.name = "native-door-leaf";
  mesh.userData.bulletMaterial = "wood";
  mesh.rotation.y = angle;
  return mesh;
}
function box(x: number, y: number, z: number, width: number, height: number, depth: number) {
  const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth));
  mesh.position.set(x, y, z);
  return mesh;
}
const from = new T.Vector3(1, 1, 1),
  to = new T.Vector3(1, 1, -3),
  ray = new T.Ray(from, new T.Vector3(0, 0, -1));

test("a moving leaf preserves its exact rotated obstruction, ray identity and penetration thickness", () => {
  const collision = new MapCollision([]),
    door = leaf();
  collision.setDynamicMeshes("door", [door]);
  expect(collision.visible(from, to)).toBe(false);
  const hit = collision.intersections(ray, 4)[0];
  expect(hit.object).toBe(door);
  expect(hit.object.userData.bulletMaterial).toBe("wood");
  expect(hit.distance).toBeCloseTo(0.94, 6);
  expect(collision.thickness(hit, ray.direction)).toBeCloseTo(0.12, 6);
  const position = new T.Vector3(1, 0, 1);
  collision.moveHorizontal(position, { x: 0, z: -4 }, 1);
  expect(position.z).toBeCloseTo(0.36, 4);

  // Changing an Object3D alone cannot silently change any room's collision.
  door.rotation.y = Math.PI / 2;
  expect(collision.visible(from, to)).toBe(false);
  collision.setDynamicMeshes("door", [door]);
  expect(collision.visible(from, to)).toBe(true);
  expect(collision.intersections(ray, 4)).toEqual([]);
  position.set(1, 0, 1);
  collision.moveHorizontal(position, { x: 0, z: -4 }, 1);
  expect(position.z).toBeCloseTo(-3);
  position.set(1, 0, -1);
  collision.moveHorizontal(position, { x: -4, z: 0 }, 1);
  expect(position.x).toBeCloseTo(0.36, 4);
});

test("static and moving surfaces select the same swept contacts as one flattened exact pose", () => {
  const wall = box(2.4, 1.5, 0, 0.12, 3, 6),
    door = leaf(),
    combined = new MapCollision([wall]);
  for (const angle of [0, 0.2, Math.PI / 4, Math.PI / 2, -Math.PI / 3]) {
    door.rotation.y = angle;
    combined.setDynamicMeshes("door", [door]);
    const flattened = new MapCollision([wall, door]);
    for (let i = 0; i < 12; i++) {
      const start = new T.Vector3(0.4 + i * 0.12, 0, 1.8),
        moving = start.clone(),
        expected = start.clone(),
        velocity = { x: 2.4, z: -5 },
        expectedVelocity = { ...velocity };
      combined.moveHorizontal(moving, velocity, 0.7);
      flattened.moveHorizontal(expected, expectedVelocity, 0.7);
      expect(moving.distanceTo(expected)).toBeLessThan(1e-5);
      expect(velocity.x).toBeCloseTo(expectedVelocity.x, 5);
      expect(velocity.z).toBeCloseTo(expectedVelocity.z, 5);
      expect(combined.blocked(moving.x, moving.z, moving.y)).toBe(false);
    }
  }
});

test("moving platforms and roofs participate in support, floor, headroom and step queries outside static bounds", () => {
  const collision = new MapCollision([box(-20, -0.1, 0, 2, 0.2, 2)]),
    platform = box(10, 0.3, 0, 2, 0.2, 2),
    roof = box(10, 1.5, 0, 2, 0.2, 2);
  collision.setDynamicMeshes("platform", [platform]);
  expect(collision.floor(10, 0, 1)).toBeCloseTo(0.4);
  expect(collision.support(8.8, 0, 1, 0)).toBeCloseTo(0.4);
  const position = new T.Vector3(10, 0, 0);
  expect(collision.followGround(position)).toBe(true);
  expect(position.y).toBeCloseTo(0.4);
  collision.setDynamicMeshes("roof", [roof]);
  expect(collision.ceiling(10, 0, 1, 2)).toBeCloseTo(1.4);
  expect(collision.ceiling(8.8, 0, 1, 2, 0.3)).toBeCloseTo(1.4);
  expect(collision.blocked(10, 0, 0)).toBe(true);
  position.set(10, 0, 0);
  expect(collision.followGround(position)).toBe(false);
  expect(position.y).toBe(0);
  collision.removeDynamicMeshes("roof");
  expect(collision.ceiling(10, 0, 1, 2)).toBe(Infinity);
  position.set(10, 0.35, 0);
  expect(collision.recoverGround(position)).toBe(true);
  expect(position.y).toBeCloseTo(0.4);
});

test("grenade sweeps retain the earliest static or dynamic hit and its own normal", () => {
  const door = leaf(),
    collision = new MapCollision([box(1, 1.2, -1, 2, 2.4, 0.1)]),
    delta = new T.Vector3(0, 0, -3),
    normal = new T.Vector3();
  collision.setDynamicMeshes("door", [door]);
  expect(collision.sweepSphere(from, delta, 0.1, normal)).toBeCloseTo(0.84 / 3, 6);
  expect(normal.z).toBeCloseTo(1);
  door.rotation.y = Math.PI / 2;
  collision.setDynamicMeshes("door", [door]);
  expect(collision.sweepSphere(from, delta, 0.1, normal)).toBeCloseTo(1.85 / 3, 6);
  expect(normal.z).toBeCloseTo(1);
});

test("cached static sphere candidates refresh moving islands as leaves enter and leave the region", () => {
  const collision = new MapCollision([]),
    candidates: number[] = [],
    center = new T.Vector3(1, 1, 0.1),
    door = leaf();
  collision.sphereTriangles(center, 0.4, candidates);
  expect(candidates).toEqual([]);
  collision.setDynamicMeshes("door", [door]);
  const point = center.clone();
  collision.resolveSphere(point, 0.2, candidates);
  expect(point.z).toBeGreaterThan(0.259);
  collision.sphereTriangles(center, 0.4, candidates);
  expect(candidates.some((id) => id < 0)).toBe(true);
  point.copy(center);
  collision.resolveSphere(point, 0.2, candidates);
  expect(point.z).toBeGreaterThan(0.259);
  door.position.x = 20;
  collision.setDynamicMeshes("door", [door]);
  point.copy(center);
  collision.resolveSphere(point, 0.2, candidates);
  expect(point.equals(center)).toBe(true);
});

test("forked rooms own dynamic poses, enable masks and removals without mutating shared startup collision", () => {
  const door = leaf(),
    original = new MapCollision([]);
  original.setDynamicMeshes("door", [door]);
  const a = original.fork(),
    b = original.fork();
  door.rotation.y = Math.PI / 2;
  a.setDynamicMeshes("door", [door]);
  expect(a.visible(from, to)).toBe(true);
  expect(b.visible(from, to)).toBe(false);
  expect(original.visible(from, to)).toBe(false);
  expect(b.setMeshEnabled(door.name, false)).toBe(true);
  expect(b.visible(from, to)).toBe(true);
  door.rotation.y = 0;
  b.setDynamicMeshes("door", [door]);
  expect(b.visible(from, to)).toBe(true);
  expect(b.setMeshEnabled(door.name, true)).toBe(true);
  expect(b.visible(from, to)).toBe(false);
  expect(original.visible(from, to)).toBe(false);
  expect(a.removeDynamicMeshes("door")).toBe(true);
  expect(original.visible(from, to)).toBe(false);
  const late = original.fork();
  expect(late.visible(from, to)).toBe(false);
  expect(late.setMeshEnabled(door.name, false)).toBe(true);
  expect(original.visible(from, to)).toBe(false);
});

test("movement-only dynamic meshes block players without creating bullet, sight or grenade obstructions", () => {
  const collision = new MapCollision([]);
  collision.setDynamicMeshes("clip", [], [leaf()]);
  expect(collision.blocked(1, 0, 0)).toBe(true);
  expect(collision.visible(from, to)).toBe(true);
  expect(collision.intersections(ray, 4)).toEqual([]);
  expect(collision.sweepSphere(from, new T.Vector3(0, 0, -2), 0.1, new T.Vector3())).toBe(Infinity);
  collision.setDynamicMeshes("clip", []);
  expect(collision.blocked(1, 0, 0)).toBe(false);
});
