import * as T from "three";
import type { MapCollision } from "./map-collision";
import type { Wall } from "./physics";

export type RagdollWorld = { collision?: MapCollision; walls: Wall[] };
type Point = {
  bone: T.Object3D;
  position: T.Vector3;
  previous: T.Vector3;
  start: T.Vector3;
  rotation: T.Quaternion;
  localPosition: T.Vector3;
  localRotation: T.Quaternion;
  radius: number;
  child: number;
};
const delta = new T.Vector3();
const normal = new T.Vector3();
const velocity = new T.Vector3();
const before = new T.Vector3();
const direction = new T.Vector3();
const rotation = new T.Quaternion();
const parentRotation = new T.Quaternion();
const box = new T.Box3();
const closest = new T.Vector3();
const sweep = new T.Vector3();
const sweepStart = new T.Vector3();
const torsoX = new T.Vector3();
const torsoY = new T.Vector3();
const torsoZ = new T.Vector3();
const torsoMatrix = new T.Matrix4();
const torsoRotation = new T.Quaternion();

// Position-based articulated body. Distances keep bones connected; a braced
// torso preserves volume while elbows and knees remain free to fold.
export class Ragdoll {
  points: Point[];
  links: { a: number; b: number; length: number; minimum: boolean }[] = [];
  ordered: Point[];
  separated: [Point, Point][] = [];
  torsoInverse: T.Quaternion;
  sleeping = false;
  quiet = 0;
  dirty = true;
  constructor(bones: T.Object3D[], motion: T.Vector3, yaw: number) {
    this.points = bones.map((bone, i) => {
      const position = bone.getWorldPosition(new T.Vector3());
      // A small upper-body impulse breaks the standing equilibrium. The
      // inherited locomotion still determines where a running body travels.
      const impulse = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
        .multiplyScalar(i < 3 ? 1.5 : 0.35)
        .add(motion);
      return {
        bone,
        position,
        previous: position.clone().addScaledVector(impulse, -1 / 128),
        start: position.clone(),
        rotation: bone.getWorldQuaternion(new T.Quaternion()),
        localPosition: bone.position.clone(),
        localRotation: bone.quaternion.clone(),
        radius: i === 0 ? 0.16 : i === 1 ? 0.19 : i === 2 ? 0.12 : 0.075,
        child: -1,
      };
    });
    this.torsoInverse = this.torsoFrame(new T.Quaternion()).invert();
    this.ordered = [...this.points].sort((a, b) => depth(a.bone) - depth(b.bone));
    const link = (a: number, b: number, minimum = false, fraction = 1) => {
      this.links.push({
        a,
        b,
        length: bones[a].getWorldPosition(delta).distanceTo(this.points[b].start) * fraction,
        minimum,
      });
      if (!minimum && this.points[a].child < 0) this.points[a].child = b;
    };
    // pelvis, chest, head, left arm, right arm, left leg, right leg
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
      [4, 5],
      [1, 6],
      [6, 7],
      [7, 8],
      [0, 9],
      [9, 10],
      [10, 11],
      [0, 12],
      [12, 13],
      [13, 14],
    ])
      link(a, b);
    const torso = [0, 1, 3, 6, 9, 12];
    for (let a = 0; a < torso.length; a++)
      for (let b = a + 1; b < torso.length; b++) link(torso[a], torso[b]);
    // Limit extreme folding without prescribing a fixed death pose.
    for (const [a, b] of [
      [3, 5],
      [6, 8],
      [9, 11],
      [12, 14],
      [0, 2],
    ])
      link(a, b, true, a === 9 || a === 12 ? 0.78 : 0.55);
    for (let a = 0; a < this.points.length; a++) {
      for (let b = a + 1; b < this.points.length; b++) {
        if (this.links.some((link) => link.a === a && link.b === b)) continue;
        const p = this.points[a],
          q = this.points[b];
        if (p.start.distanceTo(q.start) > p.radius + q.radius + 0.04) this.separated.push([p, q]);
      }
    }
  }
  step(dt: number, world: RagdollWorld) {
    if (this.sleeping) return;
    this.dirty = true;
    for (const p of this.points) {
      velocity.subVectors(p.position, p.previous).multiplyScalar(Math.exp(-0.7 * dt));
      p.previous.copy(p.position);
      p.position.add(velocity);
      p.position.y -= 20.32 * dt * dt;
      // Sample fast falls before constraint solving, so a joint cannot cross
      // a thin floor between ticks. Ordinary resting motion needs no sweep.
      if (world.collision) {
        const travel = p.previous.distanceTo(p.position);
        const samples = Math.ceil(travel / (p.radius * 0.5));
        if (samples > 1) {
          for (let i = 1; i <= samples; i++) {
            sweep.lerpVectors(p.previous, p.position, i / samples);
            sweepStart.copy(sweep);
            world.collision.resolveSphere(sweep, p.radius);
            if (sweep.distanceToSquared(sweepStart) < 1e-12) continue;
            p.position.copy(sweep);
            p.previous.copy(sweep);
            break;
          }
        }
      }
    }
    for (let iteration = 0; iteration < 8; iteration++) {
      for (const link of this.links) {
        const a = this.points[link.a].position,
          b = this.points[link.b].position;
        delta.subVectors(b, a);
        const length = delta.length();
        if (length < 1e-8 || (link.minimum && length >= link.length)) continue;
        delta.multiplyScalar(((length - link.length) / length) * 0.5);
        a.add(delta);
        b.sub(delta);
      }
      for (const [a, b] of this.separated) {
        delta.subVectors(b.position, a.position);
        const length = delta.length(),
          minimum = a.radius + b.radius;
        if (length < 1e-8 || length >= minimum) continue;
        delta.multiplyScalar(((minimum - length) / length) * 0.5);
        a.position.sub(delta);
        b.position.add(delta);
      }
      for (const p of this.points) {
        before.copy(p.position);
        if (world.collision) world.collision.resolveSphere(p.position, p.radius);
        else {
          p.position.y = Math.max(p.radius, p.position.y);
          for (const wall of world.walls) {
            box.min.set(wall.x - wall.w / 2, wall.y ?? 0, wall.z - wall.d / 2);
            box.max.set(wall.x + wall.w / 2, wall.h, wall.z + wall.d / 2);
            box.clampPoint(p.position, closest);
            normal.subVectors(p.position, closest);
            const distance = normal.length();
            if (distance > 1e-8 && distance < p.radius)
              p.position.addScaledVector(normal, (p.radius - distance) / distance);
          }
        }
        normal.subVectors(p.position, before);
        if (normal.lengthSq() < 1e-12) continue;
        normal.normalize();
        velocity.subVectors(p.position, p.previous);
        // Inelastic impact and tangential friction; do not turn positional
        // contact corrections into a fresh outward velocity.
        velocity.addScaledVector(normal, -velocity.dot(normal)).multiplyScalar(0.7);
        p.previous.copy(p.position).sub(velocity);
      }
    }
    let speed = 0;
    for (const p of this.points)
      speed = Math.max(speed, p.position.distanceToSquared(p.previous) / (dt * dt));
    this.quiet = speed < 0.015 ? this.quiet + dt : 0;
    this.sleeping = this.quiet > 0.6;
  }
  apply() {
    if (!this.dirty) return;
    this.dirty = false;
    // Apply in skeleton hierarchy order, since each local transform depends
    // on the already-updated parent. Preserve the captured twist of each bone.
    this.torsoFrame(torsoRotation).multiply(this.torsoInverse);
    for (const p of this.ordered) {
      const parent = p.bone.parent!;
      parent.updateWorldMatrix(true, false);
      p.bone.position.copy(parent.worldToLocal(delta.copy(p.position)));
      if (p === this.points[0] || p === this.points[1]) {
        rotation.copy(torsoRotation).multiply(p.rotation);
        parent.getWorldQuaternion(parentRotation).invert();
        p.bone.quaternion.copy(parentRotation).multiply(rotation);
      } else if (p.child >= 0) {
        const child = this.points[p.child];
        direction.subVectors(child.start, p.start).normalize();
        normal.subVectors(child.position, p.position).normalize();
        rotation.setFromUnitVectors(direction, normal).multiply(p.rotation);
        parent.getWorldQuaternion(parentRotation).invert();
        p.bone.quaternion.copy(parentRotation).multiply(rotation);
      } else p.bone.quaternion.copy(p.localRotation);
      p.bone.updateMatrixWorld(true);
    }
  }
  private torsoFrame(target: T.Quaternion) {
    torsoX.subVectors(this.points[12].position, this.points[9].position).normalize();
    torsoY.subVectors(this.points[1].position, this.points[0].position).normalize();
    torsoZ.crossVectors(torsoX, torsoY).normalize();
    torsoX.crossVectors(torsoY, torsoZ).normalize();
    return target.setFromRotationMatrix(torsoMatrix.makeBasis(torsoX, torsoY, torsoZ));
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
