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

function fixtureSoldier() {
  const group = new T.Group();
  const model = new T.Group();
  group.add(model);
  const names = new Set(data.sets[0].map((box) => box.bone));
  for (const [i, name] of [...names].entries()) {
    const parent = new T.Bone();
    parent.position.set(10 + i, 0, 0);
    model.add(parent);
    const bone = new T.Bone();
    bone.name = name.replace(/_([lr])(?=_|$)/g, (_, side: string) => `_${side.toUpperCase()}`);
    bone.scale.set(0.0254, 0.031, 0.02);
    parent.add(bone);
  }
  const head = model.getObjectByName("head_0")!;
  head.parent!.position.set(0, 1.4, 0);
  const torso = model.getObjectByName("spine_3")!;
  torso.parent!.position.set(0, 0.7, 0);
  return { group, model, team: "ct" as const };
}

// Independent original transform/intersection path: verifies actual contacts,
// including inverse-scaled rays, rather than just cache operation counts.
function referenceHit(soldier: ReturnType<typeof fixtureSoldier>, ray: T.Ray, range: number) {
  soldier.group.updateMatrixWorld(true);
  let nearest = range;
  let hit: { point: T.Vector3; group: number } | null = null;
  for (const box of data.sets[0]) {
    const name = box.bone.replace(/_([lr])(?=_|$)/g, (_, side: string) => `_${side.toUpperCase()}`);
    const world = soldier.model.getObjectByName(name)!.matrixWorld;
    const local = ray.clone().applyMatrix4(world.clone().invert());
    const distance = rayCapsule(
      local,
      new T.Vector3(...box.min),
      new T.Vector3(...box.max),
      box.radius,
    );
    if (!Number.isFinite(distance)) continue;
    const contact = local.at(distance, new T.Vector3()).applyMatrix4(world);
    const worldDistance = contact.distanceTo(ray.origin);
    if (worldDistance > nearest) continue;
    nearest = worldDistance;
    hit = { point: contact, group: box.group };
  }
  return hit;
}

it("shot snapshots preserve nearest scaled contacts and range over multiple pellets", async () => {
  const { createSoldierHitboxShot } = await import("./soldier-hitboxes");
  const soldier = fixtureSoldier();
  soldier.group.position.set(1, 0, -2);
  soldier.model.rotation.set(0.1, 0.4, -0.05);
  const shotHit = createSoldierHitboxShot();
  let contacts = 0;
  for (const height of [0.6, 0.7, 1.3, 1.4, 1.5, 1.7]) {
    for (const x of [0.8, 0.9, 1, 1.1, 1.2]) {
      const ray = new T.Ray(new T.Vector3(x, height, 3), new T.Vector3(0, 0, -1));
      for (const range of [4, 5, 6]) {
        const expected = referenceHit(soldier, ray, range);
        const actual = shotHit(soldier, ray, range);
        expect(actual?.group).toBe(expected?.group);
        if (expected) {
          contacts++;
          expect(actual!.point.distanceTo(expected.point)).toBeLessThan(1e-10);
          expect(actual!.head).toBe(expected.group === 1);
        } else expect(actual).toBeNull();
      }
    }
  }
  expect(contacts).toBeGreaterThan(5);
});

it("a new synchronous shot observes movement without requiring a render", async () => {
  const { createSoldierHitboxShot } = await import("./soldier-hitboxes");
  const soldier = fixtureSoldier();
  const ray = new T.Ray(new T.Vector3(0, 1.4, 3), new T.Vector3(0, 0, -1));
  const shotHit = createSoldierHitboxShot();
  const first = shotHit(soldier, ray, 5)!;
  expect(first.head).toBe(true);
  // Movement between simulation steps must not wait for matrix/render updates.
  soldier.model.getObjectByName("head_0")!.parent!.position.x = 0.7;
  expect(shotHit(soldier, ray, 5)!.point.distanceTo(first.point)).toBe(0);
  const nextShot = createSoldierHitboxShot();
  expect(nextShot(soldier, ray, 5)).toBeNull();
  ray.origin.x = 0.7;
  expect(nextShot(soldier, ray, 5)?.head).toBe(true);
  soldier.group.position.z = -1;
  const moved = createSoldierHitboxShot()(soldier, ray, 5)!;
  expect(moved.point.z).toBeCloseTo(first.point.z - 1);
});

it("snapshots skip decorative descendants and retain manually authored bone matrices", async () => {
  const { createSoldierHitboxShot } = await import("./soldier-hitboxes");
  const soldier = fixtureSoldier();
  const decoration = new T.Object3D();
  soldier.model.add(decoration);
  decoration.updateMatrix = () => {
    throw new Error("Decorative transforms must not be traversed");
  };
  const head = soldier.model.getObjectByName("head_0")!;
  head.matrixAutoUpdate = false;
  head.updateMatrix();
  const ray = new T.Ray(new T.Vector3(0, 1.4, 3), new T.Vector3(0, 0, -1));
  expect(createSoldierHitboxShot()(soldier, ray, 5)?.head).toBe(true);
  head.parent!.position.z = -1;
  expect(createSoldierHitboxShot()(soldier, ray, 3)).toBeNull();
  expect(createSoldierHitboxShot()(soldier, ray, 5)?.head).toBe(true);
});

it("single queries and snapshots preserve manually managed world matrices", async () => {
  const { soldierHit, createSoldierHitboxShot } = await import("./soldier-hitboxes");
  const soldier = fixtureSoldier();
  const head = soldier.model.getObjectByName("head_0")!;
  const ray = new T.Ray(new T.Vector3(0, 1.4, 3), new T.Vector3(0, 0, -1));
  const original = soldierHit(soldier, ray, 5)!;
  head.matrixWorldAutoUpdate = false;
  head.parent!.position.z = -1;
  expect(soldierHit(soldier, ray, 5)!.point.distanceTo(original.point)).toBe(0);
  expect(createSoldierHitboxShot()(soldier, ray, 5)!.point.distanceTo(original.point)).toBe(0);
});
