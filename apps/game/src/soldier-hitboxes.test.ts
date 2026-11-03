import { expect, it } from "vitest";
import * as T from "three";
import { rayCapsule } from "./soldier-hitboxes";
import data from "./data/agent-hitboxes.json";
import roster from "../../../packages/assets/public/models/agents/roster/catalog.json";

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

it("every roster alias has an audited native damage set", () => {
  for (const agent of roster) {
    const source = (data.models as Record<string, { set: number; source: string; sha256: string }>)[
      agent.model
    ];
    expect(source?.source, agent.id).toBe(agent.nativeModel);
    expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(data.sets[source.set]).toHaveLength(19);
  }
  expect(Object.keys(data.models)).toHaveLength(
    new Set(roster.map((agent) => agent.model)).size + 1,
  );
});

it("native CT capsules follow bones, respect range and reject missing model coverage", async () => {
  const { soldierHit, prepareSoldierHitboxes } = await import("./soldier-hitboxes");
  const model = new T.Group(),
    group = new T.Group();
  group.add(model);
  for (const [i, box] of data.sets[0].entries()) {
    const bone = new T.Bone();
    bone.name = box.bone.replace(/_([lr])(?=_|$)/g, (_, side: string) => `_${side.toUpperCase()}`);
    bone.position.set(10 + i, 0, 0);
    bone.scale.setScalar(0.0254);
    model.add(bone);
  }
  const head = model.getObjectByName("head_0")!;
  const torso = model.getObjectByName("spine_3")!;
  head.position.set(0, 1.4, 0);
  torso.position.set(0, 0.7, 0);
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
  model.userData.agentModel = "/models/agents/not-audited.glb";
  const unknown = { ...soldier, model: model.clone(true) };
  expect(() => prepareSoldierHitboxes(unknown)).toThrow("Native hitboxes missing");
});
