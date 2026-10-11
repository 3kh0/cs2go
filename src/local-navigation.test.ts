import { expect, it } from "vite-plus/test";
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
