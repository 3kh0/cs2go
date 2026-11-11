import { expect, test } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";

test("rays approaching the grid from outside retain axis, diagonal and corner contacts", () => {
  const mesh = new T.Mesh(
    new T.BoxGeometry(3, 3, 3),
    new T.MeshBasicMaterial({ side: T.DoubleSide }),
  );
  mesh.position.y = 1.5;
  mesh.updateMatrixWorld(true);
  const collision = new MapCollision([mesh]),
    caster = new T.Raycaster();
  // Adjacent corner triangles can report duplicate contacts in Three's ray
  // test. Compare their geometric contact distances rather than duplicate IDs.
  const distances = (hits: T.Intersection[]) =>
    hits
      .map((hit) => hit.distance)
      .filter((distance, index, all) => index === 0 || Math.abs(distance - all[index - 1]) > 1e-8);
  caster.far = 1000;
  for (const [x, z] of [
    [-9, 0],
    [9, 0],
    [0, -9],
    [0, 9],
    [-9, -9],
    [9, -9],
    [-9, 9],
    [9, 9],
    [-1.5, -9],
    [1.5, 9],
    [-9, -1.5],
    [9, 1.5],
  ]) {
    const origin = new T.Vector3(x, 1, z),
      target = new T.Vector3(Math.abs(x) === 1.5 ? x : 0, 1, Math.abs(z) === 1.5 ? z : 0),
      direction = target.sub(origin).normalize();
    caster.set(origin, direction);
    const expected = caster.intersectObject(mesh, false),
      hits = collision.intersections(caster.ray, caster.far);
    expect(distances(hits), `${x},${z}`).toEqual(
      distances(expected).map((distance) => expect.closeTo(distance, 10)),
    );
    for (const hit of hits) {
      expect(hit.object).toBe(mesh);
      expect(expected.some((reference) => hit.point.distanceTo(reference.point) < 1e-10)).toBe(
        true,
      );
    }
    expect(collision.visible(origin, origin.clone().addScaledVector(direction, 1000))).toBe(false);
  }
});

test("outward rays retain preceding contacts and empty tails remain misses", () => {
  const mesh = new T.Mesh(new T.BoxGeometry(3, 3, 3));
  const collision = new MapCollision([mesh]);
  for (const [x, z] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, 1],
  ]) {
    const direction = new T.Vector3(x, 0, z).normalize(),
      inside = new T.Vector3(),
      outside = direction.clone().multiplyScalar(9);
    const hits = collision.intersections(new T.Ray(inside, direction), 1000);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].distance).toBeCloseTo(
      1.5 / Math.max(Math.abs(direction.x), Math.abs(direction.z)),
    );
    expect(collision.visible(inside, outside)).toBe(false);
    expect(collision.intersections(new T.Ray(outside, direction), 1000)).toEqual([]);
    expect(collision.visible(outside, outside.clone().addScaledVector(direction, 1000))).toBe(true);
  }
});

test("dynamic islands outside static bounds retain ray hits, visibility and penetration exits", () => {
  const staticMesh = new T.Mesh(new T.BoxGeometry(2, 3, 2));
  staticMesh.position.set(-20, 1.5, -20);
  const moving = new T.Mesh(new T.BoxGeometry(2, 3, 0.125));
  moving.position.set(10, 1.5, 10);
  const origin = new T.Vector3(10, 1, 12),
    direction = new T.Vector3(0, 0, -1);
  for (const meshes of [[], [staticMesh]]) {
    const collision = new MapCollision(meshes);
    collision.setDynamicMeshes("outside", [moving]);
    const hits = collision.intersections(new T.Ray(origin, direction), 1000);
    expect(hits[0].object).toBe(moving);
    expect(hits[0].distance).toBeCloseTo(1.9375, 10);
    expect(collision.visible(origin, new T.Vector3(10, 1, 0))).toBe(false);
    expect(collision.thickness(hits[0], direction)).toBeCloseTo(0.125, 10);
  }
});
