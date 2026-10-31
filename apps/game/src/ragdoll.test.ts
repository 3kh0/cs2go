import { expect, it } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";
import { Ragdoll } from "./ragdoll";

it("a moving corpse settles with finite joints over collapsed imported floor triangles", () => {
  const root = new T.Group();
  // Same joint order as the sampled soldier, with an ordinary running/falling
  // impulse. The feet initially intersect the degenerate face's bounds.
  const positions = [
    [0.5, 1, 0],
    [0.5, 1.4, 0],
    [0.5, 1.65, 0],
    [0.2, 1.4, 0],
    [0, 1.1, 0],
    [0.1, 0.9, 0],
    [0.8, 1.4, 0],
    [1, 1.1, 0],
    [0.9, 0.9, 0],
    [0.35, 0.95, 0],
    [0.35, 0.5, 0],
    [0.35, 0.04, 0],
    [0.65, 0.95, 0],
    [0.65, 0.5, 0],
    [0.65, 0.04, 0],
  ];
  const bones = positions.map((position) => {
    const bone = new T.Bone();
    bone.position.fromArray(position);
    root.add(bone);
    return bone;
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [0, 0, 0, 0, 0, 0, 1, 0, 0, -8, 0, -8, 8, 0, 8, 8, 0, -8, -8, 0, -8, -8, 0, 8, 8, 0, 8],
      3,
    ),
  );
  const collision = new MapCollision([new T.Mesh(geometry, new T.MeshBasicMaterial())]);
  const ragdoll = new Ragdoll(bones, new T.Vector3(2, -5, 1), 0.7);
  for (let frame = 0; frame < 512; frame++) {
    ragdoll.step(1 / 128, { collision, walls: [] });
    if (frame % 4 === 0) ragdoll.apply();
    expect(ragdoll.points.every((point) => Number.isFinite(point.position.lengthSq()))).toBe(true);
  }
  expect(Math.max(...ragdoll.points.map((point) => point.position.y))).toBeLessThan(0.8);
  expect(ragdoll.points.every((point) => point.position.y >= point.radius - 0.01)).toBe(true);
  expect(bones.every((bone) => bone.quaternion.toArray().every(Number.isFinite))).toBe(true);
});
