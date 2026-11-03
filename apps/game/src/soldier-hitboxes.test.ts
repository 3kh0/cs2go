import { expect, it } from "vitest";
import * as T from "three";
import { rayCapsule } from "./soldier-hitboxes";

const start = new T.Vector3(0, -1, 0);
const end = new T.Vector3(0, 1, 0);
it("traces capsule body, endcaps, misses and origins inside the volume", () => {
  expect(
    rayCapsule(new T.Ray(new T.Vector3(0, 0, 5), new T.Vector3(0, 0, -1)), start, end, 0.5),
  ).toBeCloseTo(4.5);
  expect(
    rayCapsule(new T.Ray(new T.Vector3(0, 5, 0), new T.Vector3(0, -1, 0)), start, end, 0.5),
  ).toBeCloseTo(3.5);
  expect(
    rayCapsule(new T.Ray(new T.Vector3(0.51, 5, 0), new T.Vector3(0, -1, 0)), start, end, 0.5),
  ).toBe(Infinity);
  expect(rayCapsule(new T.Ray(new T.Vector3(), new T.Vector3(1, 0, 0)), start, end, 0.5)).toBe(0);
  expect(
    rayCapsule(new T.Ray(new T.Vector3(0, 0, 5), new T.Vector3(0, 0, 1)), start, end, 0.5),
  ).toBe(Infinity);
});
it("is invariant under rotations and handles a capsule collapsed to a sphere", () => {
  const rotation = new T.Quaternion().setFromEuler(new T.Euler(0.7, 1.4, -0.5));
  const ray = new T.Ray(
    new T.Vector3(0, 0, 5).applyQuaternion(rotation),
    new T.Vector3(0, 0, -1).applyQuaternion(rotation),
  );
  expect(
    rayCapsule(
      ray,
      start.clone().applyQuaternion(rotation),
      end.clone().applyQuaternion(rotation),
      0.5,
    ),
  ).toBeCloseTo(4.5);
  expect(rayCapsule(ray, new T.Vector3(), new T.Vector3(), 0.5)).toBeCloseTo(4.5);
});

it("fitted agent hitboxes follow bones, respect range, and never pick skinned triangles", async () => {
  const { soldierHit, prepareSoldierHitboxes } = await import("./soldier-hitboxes");
  const torso = new T.Bone();
  torso.name = "spine_3";
  const head = new T.Bone();
  head.name = "head_0";
  head.position.y = 1.4;
  torso.add(head);
  const vertices: number[] = [],
    indices: number[] = [],
    weights: number[] = [];
  for (const [bone, y, radius] of [
    [0, 0.7, 0.3],
    [1, 1.4, 0.13],
  ]) {
    for (const x of [-radius, radius])
      for (const dy of [-radius, radius])
        for (const z of [-radius, radius]) {
          vertices.push(x, y + dy, z);
          indices.push(bone, 0, 0, 0);
          weights.push(1, 0, 0, 0);
        }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new T.Float32BufferAttribute(weights, 4));
  const mesh = new T.SkinnedMesh(geometry, new T.MeshBasicMaterial());
  mesh.add(torso);
  mesh.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton([torso, head]));
  mesh.raycast = () => {
    throw new Error("Triangle picking must not run");
  };
  const model = new T.Group(),
    group = new T.Group();
  model.add(mesh);
  group.add(model);
  const soldier = { group, model, team: "ct" as const };
  prepareSoldierHitboxes(soldier);
  const ray = new T.Ray(new T.Vector3(0, 1.4, 3), new T.Vector3(0, 0, -1));
  expect(soldierHit(soldier, ray, 4)?.head).toBe(true);
  expect(soldierHit(soldier, ray, 2)).toBeNull();
  head.position.set(0.7, 0.8, 0);
  expect(soldierHit(soldier, ray, 4)).toBeNull();
  ray.origin.set(0.7, 0.8, 3);
  expect(soldierHit(soldier, ray, 4)?.head).toBe(true);
  ray.origin.set(0, 0.7, 3);
  expect(soldierHit(soldier, ray, 4)?.group).toBe(2);
});
