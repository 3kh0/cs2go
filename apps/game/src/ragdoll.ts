import * as T from "three";
import type { MapCollision } from "./map-collision";
import type { Wall } from "./physics";
import native from "./data/native-ragdoll.json";

export type RagdollWorld = { collision?: MapCollision; walls: Wall[] };
type Point = {
  bone: T.Object3D;
  position: T.Vector3;
  previous: T.Vector3;
  start: T.Vector3;
  rotation: T.Quaternion;
  previousRotation: T.Quaternion;
  localPosition: T.Vector3;
  localRotation: T.Quaternion;
  center: T.Vector3;
  ends: [T.Vector3, T.Vector3];
  radius: number;
  bound: number;
  triangles: number[];
  region: T.Vector3;
  regionRadius: number;
  collision?: MapCollision;
  inverseMass: number;
  inverseInertia: number;
  damping: number;
  angularDamping: number;
  contact: T.Vector3;
};
type Joint = {
  a: Point;
  b: Point;
  anchorA: T.Vector3;
  anchorB: T.Vector3;
  frameA: T.Quaternion;
  frameB: T.Quaternion;
  swing: number;
  twist: number[];
};
const unit = 0.0254,
  fixedStep = 1 / 128;
const identity = new T.Quaternion();
const delta = new T.Vector3(),
  normal = new T.Vector3(),
  before = new T.Vector3();
const ra = new T.Vector3(),
  rb = new T.Vector3(),
  pa = new T.Vector3(),
  pb = new T.Vector3();
const torqueA = new T.Vector3(),
  torqueB = new T.Vector3(),
  axis = new T.Vector3();
const qa = new T.Quaternion(),
  qb = new T.Quaternion(),
  relative = new T.Quaternion();
const twist = new T.Quaternion(),
  swing = new T.Quaternion(),
  desired = new T.Quaternion();
const correction = new T.Quaternion(),
  parentRotation = new T.Quaternion();
const box = new T.Box3(),
  closest = new T.Vector3();
const u = new T.Vector3(),
  v = new T.Vector3(),
  w = new T.Vector3();
const a0 = new T.Vector3(),
  a1 = new T.Vector3(),
  b0 = new T.Vector3(),
  b1 = new T.Vector3();
const axes = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1)];

function turn(p: Point, rotationAxis: T.Vector3, angle: number) {
  if (Math.abs(angle) < 1e-10) return;
  correction.setFromAxisAngle(rotationAxis, angle);
  p.rotation.premultiply(correction).normalize();
}
function worldEnd(p: Point, end: number, out: T.Vector3) {
  return out.copy(p.ends[end]).applyQuaternion(p.rotation).add(p.position);
}
// A scalar position constraint includes its rotational lever arm. Native
// inertiaScale is retained; the capsule inertia tensor is isotropically bounded
// here for stable browser contacts, rather than claiming the Rubikon solver.
function translate(p: Point, lever: T.Vector3, n: T.Vector3, impulse: number) {
  p.position.addScaledVector(n, impulse * p.inverseMass);
  torqueA.crossVectors(lever, n);
  const length = torqueA.length();
  if (length > 1e-10)
    turn(p, torqueA.multiplyScalar(1 / length), impulse * length * p.inverseInertia);
}
function weight(p: Point, lever: T.Vector3, n: T.Vector3) {
  torqueB.crossVectors(lever, n);
  return p.inverseMass + torqueB.lengthSq() * p.inverseInertia;
}
function resolve(
  world: RagdollWorld,
  position: T.Vector3,
  radius: number,
  candidates?: readonly number[],
) {
  if (world.collision) {
    world.collision.resolveSphere(position, radius, candidates);
    return;
  }
  position.y = Math.max(radius, position.y);
  for (const wall of world.walls) {
    box.min.set(wall.x - wall.w / 2, wall.y ?? 0, wall.z - wall.d / 2);
    box.max.set(wall.x + wall.w / 2, wall.h, wall.z + wall.d / 2);
    box.clampPoint(position, closest);
    normal.subVectors(position, closest);
    const distance = normal.length();
    if (distance > 1e-8 && distance < radius)
      position.addScaledVector(normal, (radius - distance) / distance);
  }
}

// Authored Source 2 rigid bodies and joint frames, solved with bounded position
// and quaternion constraints. This is a browser reconstruction, not a port of
// Valve's private contact/constraint solver. No artificial death kick or pose.
export class Ragdoll {
  points: Point[];
  ordered: Point[];
  joints: Joint[];
  separated: [Point, Point][] = [];
  sleeping = false;
  quiet = 0;
  accumulator = 0;
  dirty = true;
  constructor(bones: T.Object3D[], motion: T.Vector3, _yaw: number, team: "t" | "ct" = "ct") {
    const profile = native.profiles[team];
    const byName = new Map(bones.map((bone) => [bone.name.toLowerCase(), bone]));
    const bodies = profile.bodies.map((data) => {
      const bone = byName.get(data.bone);
      if (!bone) throw new Error(`Native ragdoll bone missing: ${data.bone}`);
      const ends = data.centers.map((p) => new T.Vector3().fromArray(p).multiplyScalar(unit));
      const center = ends[0].clone().add(ends[1]).multiplyScalar(0.5);
      const rotation = bone.getWorldQuaternion(new T.Quaternion());
      const position = bone
        .getWorldPosition(new T.Vector3())
        .add(center.clone().applyQuaternion(rotation));
      const radius = data.radius * unit;
      const bound = ends[0].distanceTo(ends[1]) * 0.5 + radius;
      // Spherical upper bound on capsule inertia avoids an unstable tiny axial
      // moment while preserving native relative masses and inertiaScale.
      const inertia =
        data.mass *
        (ends[0].distanceToSquared(ends[1]) / 12 + 0.4 * radius * radius) *
        data.inertiaScale;
      return {
        bone,
        position,
        previous: position.clone().addScaledVector(motion, -fixedStep),
        start: position.clone(),
        rotation,
        previousRotation: rotation.clone(),
        localPosition: bone.position.clone(),
        localRotation: bone.quaternion.clone(),
        center,
        ends: ends.map((p) => p.sub(center)) as [T.Vector3, T.Vector3],
        radius,
        bound,
        triangles: [],
        region: new T.Vector3(),
        regionRadius: 0,
        inverseMass: 1 / data.mass,
        inverseInertia: 1 / inertia,
        damping: data.linearDamping,
        angularDamping: data.angularDamping,
        contact: new T.Vector3(),
      };
    });
    this.points = bones.map((bone) => bodies.find((p) => p.bone === bone)!);
    this.ordered = [...bodies].sort((a, b) => depth(a.bone) - depth(b.bone));
    this.joints = profile.joints.map((j) => ({
      a: bodies[j.a],
      b: bodies[j.b],
      anchorA: new T.Vector3().fromArray(j.frameA).multiplyScalar(unit).sub(bodies[j.a].center),
      anchorB: new T.Vector3().fromArray(j.frameB).multiplyScalar(unit).sub(bodies[j.b].center),
      frameA: new T.Quaternion().fromArray(j.frameA, 4).normalize(),
      frameB: new T.Quaternion().fromArray(j.frameB, 4).normalize(),
      swing: j.swing,
      twist: j.twist,
    }));
    for (let a = 0; a < bodies.length; a++)
      for (let b = a + 1; b < bodies.length; b++)
        if (
          !profile.joints.some(
            (j) => !j.collision && ((j.a === a && j.b === b) || (j.a === b && j.b === a)),
          )
        )
          this.separated.push([bodies[a], bodies[b]]);
  }
  private anchor(j: Joint) {
    for (const n of axes) {
      ra.copy(j.anchorA).applyQuaternion(j.a.rotation);
      rb.copy(j.anchorB).applyQuaternion(j.b.rotation);
      delta.copy(j.b.position).add(rb).sub(j.a.position).sub(ra);
      const impulse = delta.dot(n) / (weight(j.a, ra, n) + weight(j.b, rb, n));
      translate(j.a, ra, n, impulse);
      translate(j.b, rb, n, -impulse);
    }
  }
  private angular(j: Joint) {
    qa.copy(j.a.rotation).multiply(j.frameA);
    qb.copy(j.b.rotation).multiply(j.frameB);
    relative.copy(qa).invert().multiply(qb).normalize();
    if (relative.w < 0) relative.set(-relative.x, -relative.y, -relative.z, -relative.w);
    // Native hinge frames' Z axes are the lateral knee axes. The other joints
    // use the same frame convention for cone swing and signed twist.
    twist.set(0, 0, relative.z, relative.w).normalize();
    swing.copy(relative).multiply(desired.copy(twist).invert()).normalize();
    const twistAngle = 2 * Math.atan2(twist.z, twist.w);
    const swingAngle = 2 * Math.acos(T.MathUtils.clamp(swing.w, -1, 1));
    if (swingAngle > j.swing) swing.slerp(identity, 1 - j.swing / swingAngle);
    twist.setFromAxisAngle(axes[2], T.MathUtils.clamp(twistAngle, j.twist[0], j.twist[1]));
    desired.copy(swing).multiply(twist).multiply(relative.invert()).normalize();
    if (desired.w < 0) desired.set(-desired.x, -desired.y, -desired.z, -desired.w);
    const angle = 2 * Math.acos(T.MathUtils.clamp(desired.w, -1, 1));
    axis.set(desired.x, desired.y, desired.z);
    if (axis.lengthSq() < 1e-14) return;
    axis.normalize().applyQuaternion(qa);
    const total = j.a.inverseInertia + j.b.inverseInertia;
    turn(j.a, axis, (-angle * j.a.inverseInertia) / total);
    turn(j.b, axis, (angle * j.b.inverseInertia) / total);
  }
  private region(p: Point, world: RagdollWorld, travel = 0) {
    if (!world.collision) return;
    if (
      world.collision === p.collision &&
      p.position.distanceTo(p.region) + p.bound + travel <= p.regionRadius
    )
      return;
    p.collision = world.collision;
    p.region.copy(p.position);
    p.regionRadius = p.bound + travel + 0.1;
    world.collision.sphereTriangles(p.region, p.regionRadius, p.triangles);
  }
  private sweep(p: Point, world: RagdollWorld) {
    const count = Math.max(1, Math.ceil(p.ends[0].distanceTo(p.ends[1]) / p.radius));
    for (let i = 0; i <= count; i++) {
      ra.lerpVectors(p.ends[0], p.ends[1], i / count);
      a0.copy(ra).applyQuaternion(p.previousRotation).add(p.previous);
      a1.copy(ra).applyQuaternion(p.rotation).add(p.position);
      const samples = Math.ceil(a0.distanceTo(a1) / (p.radius * 0.5));
      if (samples <= 1) continue;
      for (let sample = 1; sample <= samples; sample++) {
        before.lerpVectors(a0, a1, sample / samples);
        pa.copy(before);
        resolve(world, pa, p.radius, world.collision ? p.triangles : undefined);
        delta.subVectors(pa, before);
        if (delta.lengthSq() < 1e-12) continue;
        p.contact.add(delta.normalize());
        p.position.add(pa.sub(a1));
        break;
      }
    }
  }
  private contacts(p: Point, world: RagdollWorld) {
    this.region(p, world);
    // Sample the authored capsule, including both caps. Sampling is bounded by
    // radius; the native full capsule/triangle manifold is not reproduced.
    const count = Math.max(1, Math.ceil(p.ends[0].distanceTo(p.ends[1]) / p.radius));
    for (let i = 0; i <= count; i++) {
      ra.lerpVectors(p.ends[0], p.ends[1], i / count).applyQuaternion(p.rotation);
      before.copy(p.position).add(ra);
      pa.copy(before);
      resolve(world, pa, p.radius, world.collision ? p.triangles : undefined);
      delta.subVectors(pa, before);
      const distance = delta.length();
      if (distance < 1e-9) continue;
      normal.copy(delta).multiplyScalar(1 / distance);
      translate(p, ra, normal, distance / weight(p, ra, normal));
      p.contact.add(normal);
    }
  }
  private separate(a: Point, b: Point) {
    if (a.position.distanceToSquared(b.position) >= (a.bound + b.bound) ** 2) return;
    worldEnd(a, 0, a0);
    worldEnd(a, 1, a1);
    worldEnd(b, 0, b0);
    worldEnd(b, 1, b1);
    u.subVectors(a1, a0);
    v.subVectors(b1, b0);
    w.subVectors(a0, b0);
    const aa = u.dot(u),
      bb = u.dot(v),
      cc = v.dot(v),
      dd = u.dot(w),
      ee = v.dot(w);
    const determinant = aa * cc - bb * bb;
    let s = determinant > 1e-12 ? T.MathUtils.clamp((bb * ee - cc * dd) / determinant, 0, 1) : 0;
    let t = cc > 1e-12 ? (bb * s + ee) / cc : 0;
    if (t < 0 || t > 1) {
      t = T.MathUtils.clamp(t, 0, 1);
      s = aa > 1e-12 ? T.MathUtils.clamp((bb * t - dd) / aa, 0, 1) : 0;
    }
    pa.copy(a0).addScaledVector(u, s);
    pb.copy(b0).addScaledVector(v, t);
    delta.subVectors(pb, pa);
    const distance = delta.length(),
      overlap = a.radius + b.radius - distance;
    if (overlap <= 0 || distance < 1e-9) return;
    normal.copy(delta).multiplyScalar(1 / distance);
    ra.subVectors(pa, a.position);
    rb.subVectors(pb, b.position);
    const impulse = overlap / (weight(a, ra, normal) + weight(b, rb, normal));
    translate(a, ra, normal, -impulse);
    translate(b, rb, normal, impulse);
  }
  step(dt: number, world: RagdollWorld) {
    if (this.sleeping || dt <= 0) return;
    this.dirty = true;
    this.accumulator = Math.min(0.25, this.accumulator + dt);
    while (this.accumulator + 1e-10 >= fixedStep) {
      const h = fixedStep;
      this.accumulator -= h;
      for (const p of this.points) {
        p.contact.set(0, 0, 0);
        delta.subVectors(p.position, p.previous).multiplyScalar(Math.exp(-p.damping * h));
        this.region(p, world, delta.length() + 20.32 * h * h);
        p.previous.copy(p.position);
        p.position.add(delta);
        p.position.y -= 20.32 * h * h;
        relative.copy(p.rotation).multiply(qa.copy(p.previousRotation).invert());
        p.previousRotation.copy(p.rotation);
        relative.slerp(identity, 1 - Math.exp(-p.angularDamping * h));
        p.rotation.premultiply(relative).normalize();
        this.sweep(p, world);
      }
      for (let iteration = 0; iteration < 8; iteration++) {
        for (const j of this.joints) {
          this.angular(j);
          this.anchor(j);
        }
        for (const [a, b] of this.separated) this.separate(a, b);
        for (const p of this.points) this.contacts(p, world);
      }
      // Inelastic browser contact policy; native angular damping is separate.
      for (const p of this.points) {
        if (p.contact.lengthSq() < 1e-12) continue;
        normal.copy(p.contact).normalize();
        delta.subVectors(p.position, p.previous);
        const outward = Math.max(0, delta.dot(normal));
        delta.addScaledVector(normal, -delta.dot(normal)).multiplyScalar(0.85);
        delta.addScaledVector(normal, outward);
        p.previous.copy(p.position).sub(delta);
      }
      let speed = 0;
      for (const p of this.points) {
        const angular = p.rotation.angleTo(p.previousRotation) * p.bound;
        speed = Math.max(speed, p.position.distanceToSquared(p.previous), angular * angular);
      }
      this.quiet = speed / (fixedStep * fixedStep) < 0.015 ? this.quiet + fixedStep : 0;
      this.sleeping = this.quiet > 0.6;
      if (this.sleeping) break;
    }
  }

  apply() {
    if (!this.dirty) return;
    this.dirty = false;
    for (const p of this.ordered) {
      const parent = p.bone.parent!;
      parent.updateWorldMatrix(true, false);
      delta.copy(p.center).applyQuaternion(p.rotation);
      p.bone.position.copy(parent.worldToLocal(delta.negate().add(p.position)));
      parent.getWorldQuaternion(parentRotation).invert();
      p.bone.quaternion.copy(parentRotation).multiply(p.rotation);
      p.bone.updateMatrixWorld(true);
    }
  }
  reset() {
    for (const p of this.points) {
      p.bone.position.copy(p.localPosition);
      p.bone.quaternion.copy(p.localRotation);
    }
  }
}
function depth(bone: T.Object3D) {
  let n = 0;
  for (let parent = bone.parent; parent; parent = parent.parent) n++;
  return n;
}
