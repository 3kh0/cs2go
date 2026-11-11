import { expect, test } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";

function plane(name: string, height: number) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [-2, height, -2, 2, height, 2, 2, height, -2, -2, height, -2, -2, height, 2, 2, height, 2],
      3,
    ),
  );
  const mesh = new T.Mesh(geometry);
  mesh.name = name;
  mesh.userData.SurfaceProperty = name;
  return mesh;
}

test("overlapping support and roofs keep bounded extrema and first-owner ties after toggles", () => {
  const low = plane("low", 0),
    high = plane("high", 0.25),
    same = plane("same", 0.25),
    roof = plane("roof", 2),
    upper = plane("upper", 2.25),
    collision = new MapCollision([low, high, same, roof, upper]);
  expect(collision.support(0, 0, 0.5, -0.5)).toBe(0.25);
  expect(collision.support(0, 0, 0.1, -0.5)).toBe(0);
  expect(collision.ceiling(0, 0, 1.5, 2.5, 0.3)).toBe(2);
  expect(collision.ceiling(0, 0, 2.1, 2.5, 0.3)).toBe(2.25);
  expect(collision.supportingSurface(0, 0, 0.25)?.object).toBe(high);
  collision.setMeshEnabled("high", false);
  expect(collision.supportingSurface(0, 0, 0.25)?.object).toBe(same);
  collision.setMeshEnabled("same", false);
  expect(collision.support(0, 0, 0.5, -0.5)).toBe(0);
  collision.setMeshEnabled("roof", false);
  expect(collision.ceiling(0, 0, 1.5, 2.5, 0.3)).toBe(2.25);
  // A moving island initializes the winning height before static triangles.
  const moving = plane("moving", 0.3);
  collision.setDynamicMeshes("platform", [moving]);
  expect(collision.support(0, 0, 0.5, -0.5)).toBeCloseTo(0.3);
  expect(collision.supportingSurface(0, 0, 0.3)?.object).toBe(moving);
  moving.position.y = -0.5;
  collision.setDynamicMeshes("platform", [moving]);
  expect(collision.support(0, 0, 0.5, -0.5)).toBe(0);
});
