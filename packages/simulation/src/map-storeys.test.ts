import * as T from "three";
import { expect, test } from "vitest";
import { MapCollision } from "./map-collision";

test("stacked storeys retain exact edge support, headroom and vertical ray contacts", () => {
  const floors = Array.from({ length: 96 }, (_, i) => {
    const mesh = new T.Mesh(new T.PlaneGeometry(4, 4).rotateX(-Math.PI / 2));
    mesh.position.y = i * 4;
    mesh.name = `floor-${i}`;
    return mesh;
  });
  const collision = new MapCollision(floors);
  for (let i = 1; i < floors.length - 1; i++) {
    const y = i * 4;
    // The center is outside the floor; part of the square hull still rests on it.
    expect(collision.support(2.2, 0, y + 0.1, y - 0.1)).toBe(y);
    expect(collision.support(2.31, 0, y + 0.1, y - 0.1)).toBe(-Infinity);
    expect(collision.ceiling(0, 0, y + 0.1, y + 4.1, 0.3)).toBe(y + 4);
    expect(collision.blocked(0, 0, y)).toBe(false);
    expect(collision.blocked(0, 0, y + 3)).toBe(true);
    const origin = new T.Vector3(0.2, y + 0.1, 0.3);
    const hits = collision.intersections(new T.Ray(origin, new T.Vector3(0, 1, 0)), 4);
    expect(hits[0].distance).toBeCloseTo(3.9, 10);
    expect(hits[0].object).toBe(floors[i + 1]);
    expect(collision.visible(origin, origin.clone().add(new T.Vector3(0, 3, 0)))).toBe(true);
    expect(collision.visible(origin, origin.clone().add(new T.Vector3(0, 4, 0)))).toBe(false);
  }
  const fork = collision.fork();
  collision.setMeshEnabled("floor-40", false);
  expect(collision.support(0, 0, 160.1, 155.9)).toBe(156);
  expect(fork.support(0, 0, 160.1, 155.9)).toBe(160);
});
