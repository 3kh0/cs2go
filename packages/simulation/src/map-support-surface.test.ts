import { expect, test } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";
function floor(name: string, y: number, size = 4) {
  const mesh = new T.Mesh(new T.PlaneGeometry(size, size).rotateX(-Math.PI / 2));
  mesh.name = name;
  mesh.position.y = y;
  mesh.userData.SurfaceProperty = name;
  mesh.updateMatrixWorld(true);
  return mesh;
}

test("support material follows native owner at negative altitude and uses the full supported footprint", () => {
  const metal = floor("metal", -10, 1),
    roof = floor("concrete", 0),
    collision = new MapCollision([metal, roof]);
  expect(collision.supportingSurface(0.6, 0, -10, 0.3)).toMatchObject({
    height: -10,
    object: metal,
    surface: "metal",
  });
  expect(collision.supportingSurface(0.6, 0, -9, 0.3)).toBeUndefined();
  expect(collision.supportingSurface(0, 0, 0)).toMatchObject({ object: roof, surface: "concrete" });
  expect(collision.supportingSurface(0, 0, -10)!.height).toBe(collision.support(0, 0, -9.9, -10.1));
});
test("player-excluded decorations and disabled owners cannot override the actual supporting surface", () => {
  const ground = floor("wood", -10),
    decoration = floor("paper", -9.98),
    parent = new T.Group();
  parent.userData.nativeCollisionAttributes = { m_InteractExcludeStrings: ["player"] };
  parent.add(decoration);
  parent.updateMatrixWorld(true);
  const collision = new MapCollision([ground, decoration]);
  expect(collision.supportingSurface(0, 0, -10)?.surface).toBe("wood");
  const other = collision.fork();
  other.setMeshEnabled("wood", false);
  expect(other.supportingSurface(0, 0, -10)).toBeUndefined();
  expect(collision.supportingSurface(0, 0, -10)?.surface).toBe("wood");
});
test("moving islands retain exact support surface metadata and stay room independent", () => {
  const leaf = floor("metalgrate", -10),
    root = new T.Group();
  delete leaf.userData.SurfaceProperty;
  root.userData.SurfaceProperty = "metalgrate";
  root.add(leaf);
  root.updateMatrixWorld(true);
  const collision = new MapCollision([]);
  collision.setDynamicMeshes("door", [leaf]);
  const other = collision.fork();
  expect(collision.supportingSurface(0, 0, -10)).toMatchObject({
    surface: "metalgrate",
    height: -10,
  });
  collision.removeDynamicMeshes("door");
  expect(collision.supportingSurface(0, 0, -10)).toBeUndefined();
  expect(other.supportingSurface(0, 0, -10)?.surface).toBe("metalgrate");
});
test("support query keeps missing metadata explicit and rejects distant or invalid contacts", () => {
  const ground = floor("floor", 0);
  delete ground.userData.SurfaceProperty;
  const collision = new MapCollision([ground]);
  expect(collision.supportingSurface(0, 0, 0)).toMatchObject({
    object: ground,
    surface: undefined,
  });
  expect(collision.supportingSurface(0, 0, 1)).toBeUndefined();
  expect(collision.supportingSurface(NaN, 0, 0)).toBeUndefined();
});
