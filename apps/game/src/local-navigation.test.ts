import { expect, it } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";
import { detour } from "./local-navigation";
function mesh(vertices: number[]) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  return new T.Mesh(geometry, new T.MeshBasicMaterial());
}
const ground = () => mesh([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, -5, 5, 0, 5, -5, 0, 5]);
it("finds a capsule-clear detour around a prop blocking the native route", () => {
  const collision = new MapCollision([
    ground(),
    mesh([0, 0, -1, 0, 3, -1, 0, 3, 1, 0, 0, -1, 0, 3, 1, 0, 0, 1]),
  ]);
  const goal = new T.Vector3(2, 0, 0);
  const route = detour(collision, new T.Vector3(-2, 0, 0), goal);
  expect(route.at(-1)!.distanceTo(goal)).toBeLessThan(0.65);
  expect(route.some((p) => Math.abs(p.z) > 1.3)).toBe(true);
  expect(route.every((p) => !collision.blocked(p.x, p.z, p.y, 0.35))).toBe(true);
});
it("does not teleport onto a disconnected upper floor", () => {
  const collision = new MapCollision([
    ground(),
    mesh([-5, 4, -5, 5, 4, -5, 5, 4, 5, -5, 4, -5, 5, 4, 5, -5, 4, 5]),
  ]);
  expect(detour(collision, new T.Vector3(-2, 0, 0), new T.Vector3(2, 4, 0))).toEqual([]);
});
it("walks around a low prop instead of routing onto its top", () => {
  const geometry = new T.BoxGeometry(1, 0.8, 2);
  geometry.translate(0, 0.4, 0);
  const collision = new MapCollision([ground(), new T.Mesh(geometry, new T.MeshBasicMaterial())]);
  const goal = new T.Vector3(2, 0, 0);
  const route = detour(collision, new T.Vector3(-2, 0, 0), goal);
  expect(route.at(-1)!.distanceTo(goal)).toBeLessThan(0.65);
  expect(route.every((point) => Math.abs(point.y) < 0.01)).toBe(true);
  expect(route.some((point) => Math.abs(point.z) > 1.3)).toBe(true);
});
it("makes bounded clear progress toward a distant smoothed waypoint", () => {
  const collision = new MapCollision([
    mesh([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, -20, 20, 0, 20, -20, 0, 20]),
    mesh([0, 0, -1, 0, 3, -1, 0, 3, 1, 0, 0, -1, 0, 3, 1, 0, 0, 1]),
  ]);
  const from = new T.Vector3(-2, 0, 0),
    goal = new T.Vector3(14, 0, 0),
    route = detour(collision, from, goal);
  expect(route.at(-1)!.distanceTo(goal)).toBeLessThan(from.distanceTo(goal) - 1);
  expect(route.some((point) => Math.abs(point.z) > 1.3)).toBe(true);
  expect(route.every((point) => !collision.blocked(point.x, point.z, point.y, 0.35))).toBe(true);
  expect(
    route.every((point) => Math.abs(point.x - from.x) <= 8 && Math.abs(point.z - from.z) <= 8),
  ).toBe(true);
});
it("does not return progress toward a distant disconnected upper floor", () => {
  const collision = new MapCollision([ground()]);
  expect(detour(collision, new T.Vector3(-2, 0, 0), new T.Vector3(14, 4, 0))).toEqual([]);
});
it("rechecks nodes and swept midpoints when an obstruction changes between searches", () => {
  const collision = new MapCollision([ground()]);
  const from = new T.Vector3(-2, 0, -2),
    goal = new T.Vector3(2, 0, 2),
    open = detour(collision, from, goal);
  for (const obstacle of [
    mesh([0, 0, -1, 0, 3, -1, 0, 3, 1, 0, 0, -1, 0, 3, 1, 0, 0, 1]),
    // Both diagonal endpoints clear this thin edge; only the midpoint hits it.
    mesh([
      -1.75, 0, -1.751, -1.75, 3, -1.751, -1.75, 3, -1.749, -1.75, 0, -1.751, -1.75, 3, -1.749,
      -1.75, 0, -1.749,
    ]),
  ]) {
    collision.setDynamicMeshes("obstruction", [obstacle]);
    const route = detour(collision, from, goal);
    expect(route).not.toEqual(open);
    expect(route.at(-1)!.distanceTo(goal)).toBeLessThan(0.65);
    for (const [index, point] of route.entries()) {
      const previous = route[index - 1] ?? from,
        midpoint = previous.clone().lerp(point, 0.5);
      expect(collision.blocked(point.x, point.z, point.y, 0.35)).toBe(false);
      expect(collision.blocked(midpoint.x, midpoint.z, midpoint.y, 0.35)).toBe(false);
    }
    collision.removeDynamicMeshes("obstruction");
    expect(detour(collision, from, goal)).toEqual(open);
  }
});
