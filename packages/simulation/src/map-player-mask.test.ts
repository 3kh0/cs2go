import { expect, test } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";

function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number) {
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d));
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}
function fixture(dynamic = false) {
  const floor = box("floor", 0, -0.1, 0, 6, 0.2, 6),
    wall = box("cup", 0, 1, 0, 0.1, 2, 4),
    roof = box("plate", 0, 2.5, 0, 4, 0.1, 4);
  const native = new T.Group();
  native.userData.nativeCollisionAttributes = { m_InteractExcludeStrings: ["player"] };
  native.add(wall, roof);
  native.updateMatrixWorld(true);
  floor.updateMatrixWorld(true);
  const collision = new MapCollision(dynamic ? [floor] : [floor, wall, roof]);
  if (dynamic) collision.setDynamicMeshes("native-cups", [wall, roof]);
  return { collision, wall, floor, roof };
}
for (const dynamic of [false, true])
  test(`native player exclusion preserves bullet and grenade contact (${dynamic ? "moving" : "static"})`, () => {
    const { collision, wall } = fixture(dynamic);
    expect(collision.blocked(0, 0, 0, 0.3, 1.8)).toBe(false);
    expect(collision.floor(0, 0, 3)).toBeCloseTo(0);
    expect(collision.support(0, 0, 3, -0.2, 0.3)).toBeCloseTo(0);
    expect(collision.ceiling(0, 0, 2, 3, 0.3)).toBe(Infinity);
    const position = new T.Vector3(-1, 0, 0);
    collision.moveHorizontal(position, { x: 2, z: 0 }, 1, 0.3, 1.8);
    expect(position.x).toBeCloseTo(1);
    const origin = new T.Vector3(1, 1, 0),
      direction = new T.Vector3(-1, 0, 0);
    expect(collision.intersections(new T.Ray(origin, direction), 2)[0].object).toBe(wall);
    expect(collision.visible(origin, origin.clone().addScaledVector(direction, 2))).toBe(false);
    expect(
      collision.sweepSphere(origin, direction.clone().multiplyScalar(2), 0.05, new T.Vector3()),
    ).toBeLessThan(0.5);
    const other = collision.fork();
    collision.setMeshEnabled("cup", false);
    expect(other.intersections(new T.Ray(origin, direction), 2)[0].object).toBe(wall);
    expect(collision.intersections(new T.Ray(origin, direction), 2)).toEqual([]);
  });
