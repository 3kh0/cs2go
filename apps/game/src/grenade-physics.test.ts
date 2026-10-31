import { expect, test } from "vitest";
import { Vector3 } from "three";
import { sweepSphereTriangle } from "./sphere-sweep";
import { bounceGrenade, grenadeLaunch, grenadePhysics } from "./grenade-physics";
const face = new Float32Array([-2, 0, -2, 2, 0, -2, 0, 0, 2]);
test("continuous grenade hull catches faces, edges and vertices while ignoring separation", () => {
  const normal = new Vector3();
  expect(
    sweepSphereTriangle(new Vector3(0, 2, 0), new Vector3(0, -20, 0), 0.05, face, 0, normal),
  ).toBeCloseTo(0.0975, 8);
  expect(normal.y).toBeCloseTo(1);
  // The center ray misses this edge; the spherical hull must still touch it.
  const edge = sweepSphereTriangle(
    new Vector3(0, 1, -2.04),
    new Vector3(0, -2, 0),
    0.05,
    face,
    0,
    normal,
  );
  expect(edge).toBeCloseTo(0.485, 7);
  expect(normal.z).toBeLessThan(-0.7);
  expect(
    sweepSphereTriangle(new Vector3(-2.03, 1, -2.03), new Vector3(0, -2, 0), 0.05, face, 0, normal),
  ).toBeLessThan(0.5);
  expect(
    sweepSphereTriangle(new Vector3(0, 0.05, 0), new Vector3(0, 1, 0), 0.05, face, 0, normal),
  ).toBe(Infinity);
});
test("throw strength changes native speed, hand height and pitch without a fixed upward shove", () => {
  const eye = new Vector3(0, 1.65, 0),
    aim = new Vector3(0, 0, -1);
  const strong = grenadeLaunch("he", 1, eye, aim, new Vector3());
  const weak = grenadeLaunch("he", 0, eye, aim, new Vector3());
  expect(strong.velocity.length()).toBeCloseTo(750 * 0.0254 * 0.9);
  expect(weak.velocity.length() / strong.velocity.length()).toBeCloseTo(0.3);
  expect(strong.direction.y).toBeCloseTo(Math.sin(Math.PI / 18));
  expect(weak.position.y).toBeCloseTo(eye.y - 12 * 0.0254);
  const moving = grenadeLaunch("he", 1, eye, aim, new Vector3(3, 2, 1));
  expect(moving.velocity.sub(strong.velocity).toArray()).toEqual([3.75, 2.5, 1.25]);
  expect(eye.y).toBe(1.65);
});
test("bounces lose energy, slide off walls and settle without repeated impact sounds", () => {
  const velocity = new Vector3(4, -3, 0);
  const result = bounceGrenade(velocity, new Vector3(0, 1, 0));
  expect(result.impact).toBe(3);
  expect(result.resting).toBe(false);
  expect(velocity.toArray()).toEqual([1.8, 1.35, 0]);
  const slow = new Vector3(0.1, -0.2, 0);
  expect(bounceGrenade(slow, new Vector3(0, 1, 0)).resting).toBe(true);
  expect(slow.length()).toBe(0);
  expect(grenadePhysics.gravity).toBeCloseTo(8.128);
});
test("native player-only clips do not stop a grenade hull", async () => {
  const { MapCollision } = await import("./map-collision");
  const { Mesh, MeshBasicMaterial, BoxGeometry } = await import("three");
  const solid = new Mesh(new BoxGeometry(0.01, 2, 2), new MeshBasicMaterial());
  solid.position.set(0.4, 1, 0);
  solid.updateMatrixWorld(true);
  const clip = solid.clone();
  clip.position.x = 0.2;
  clip.updateMatrixWorld(true);
  const collision = new MapCollision([solid], [clip]),
    normal = new Vector3();
  const fraction = collision.sweepSphere(new Vector3(0, 1, 0), new Vector3(1, 0, 0), 0.05, normal);
  expect(fraction).toBeCloseTo(0.345, 5);
  expect(normal.x).toBeCloseTo(-1);
});
