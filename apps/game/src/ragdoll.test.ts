import { expect, it } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";
import { Ragdoll } from "./ragdoll";
import native from "./data/native-ragdoll.json";

function body(height = 1.2) {
  const profile = native.profiles.ct,
    root = new T.Group();
  const bones = profile.bodies.map((data) => {
    const b = new T.Bone();
    b.name = data.bone;
    root.add(b);
    return b;
  });
  const pelvis = bones[5];
  pelvis.position.set(0, height, 0);
  pelvis.quaternion
    .setFromRotationMatrix(new T.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1))
    .premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2));
  for (const j of profile.joints) {
    const a = bones[j.a],
      b = bones[j.b];
    b.quaternion
      .copy(a.quaternion)
      .multiply(new T.Quaternion().fromArray(j.frameA, 4))
      .multiply(new T.Quaternion().fromArray(j.frameB, 4).invert());
    b.position
      .copy(a.position)
      .add(new T.Vector3().fromArray(j.frameA).multiplyScalar(0.0254).applyQuaternion(a.quaternion))
      .sub(
        new T.Vector3().fromArray(j.frameB).multiplyScalar(0.0254).applyQuaternion(b.quaternion),
      );
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}

it("a moving corpse settles with finite joints over collapsed imported floor triangles", () => {
  const { bones } = body();
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

it("inherits real motion without a fabricated forward launch and uses native relative masses", () => {
  const { bones } = body(4);
  const r = new Ragdoll(bones, new T.Vector3(2, -1, 0), 2);
  expect(r.points.find((p) => p.bone.name === "pelvis")!.inverseMass).toBe(1 / 50);
  expect(r.points.find((p) => p.bone.name === "hand_l")!.inverseMass).toBe(1 / 3);
  for (const p of r.points) {
    expect(
      p.position
        .clone()
        .sub(p.previous)
        .multiplyScalar(128)
        .distanceTo(new T.Vector3(2, -1, 0)),
    ).toBeLessThan(1e-10);
  }
  const initial = bones.map((b) => b.matrixWorld.clone());
  r.apply();
  for (let i = 0; i < bones.length; i++)
    expect(
      Math.max(
        ...bones[i].matrixWorld.elements.map((v, k) => Math.abs(v - initial[i].elements[k])),
      ),
    ).toBeLessThan(1e-6);
});

it("fixed native-body integration is independent of 30,60 and144Hz render calls", () => {
  const results = [30, 60, 144].map((hz) => {
    const r = new Ragdoll(body(3).bones, new T.Vector3(2, -2, 1), 0);
    for (let i = 0; i < hz; i++) r.step(1 / hz, { walls: [] });
    return r.points.map((p) => p.position.clone());
  });
  for (let h = 1; h < results.length; h++)
    for (let i = 0; i < results[0].length; i++)
      expect(results[0][i].distanceTo(results[h][i])).toBeLessThan(1e-8);
});

it("native hinge axes and joint anchors remain constrained after impact", () => {
  const r = new Ragdoll(body(3).bones, new T.Vector3(3, -5, 1), 0);
  for (let i = 0; i < 512; i++) r.step(1 / 128, { walls: [] });
  for (const j of r.joints) {
    const a = j.anchorA.clone().applyQuaternion(j.a.rotation).add(j.a.position),
      b = j.anchorB.clone().applyQuaternion(j.b.rotation).add(j.b.position);
    expect(a.distanceTo(b)).toBeLessThan(0.012);
    const q = j.a.rotation
      .clone()
      .multiply(j.frameA)
      .invert()
      .multiply(j.b.rotation.clone().multiply(j.frameB));
    if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    const t = new T.Quaternion(0, 0, q.z, q.w).normalize();
    const swing = q.clone().multiply(t.clone().invert());
    expect(2 * Math.acos(T.MathUtils.clamp(swing.w, -1, 1))).toBeLessThan(j.swing + 0.08);
    const angle = 2 * Math.atan2(t.z, t.w);
    expect(angle).toBeGreaterThan(j.twist[0] - 0.08);
    expect(angle).toBeLessThan(j.twist[1] + 0.08);
  }
});

it("fast12m falls cannot tunnel the native small foot capsules through a thin floor", () => {
  const floor = new T.Mesh(new T.BoxGeometry(100, 0.05, 100), new T.MeshBasicMaterial());
  floor.position.y = -0.025;
  floor.updateMatrixWorld(true);
  const collision = new MapCollision([floor]);
  const r = new Ragdoll(body(12).bones, new T.Vector3(), 0);
  for (let i = 0; i < 1024; i++) r.step(1 / 128, { collision, walls: [] });
  for (const p of r.points)
    for (const end of p.ends)
      expect(end.clone().applyQuaternion(p.rotation).add(p.position).y - p.radius).toBeGreaterThan(
        -0.002,
      );
  expect(r.sleeping).toBe(true);
  floor.geometry.dispose();
  (floor.material as T.Material).dispose();
});
