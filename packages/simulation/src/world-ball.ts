import * as T from "three";
import type { MapCollision } from "./map-collision";
import native from "./data/world-ball.json";
import { SOURCE_UNIT, movement } from "./physics";
export class WorldBallPhysics {
  mesh?: T.Object3D;
  velocity = new T.Vector3();
  origin = new T.Vector3();
  radius = native.sphereRadiusSource * SOURCE_UNIT;
  sleeping = true;
  private next = new T.Vector3();
  private normal = new T.Vector3();
  private axis = new T.Vector3();
  private sphere = new T.Sphere();
  private hit = new T.Vector3();
  private quiet = 0;
  private collision: MapCollision;
  constructor(collision: MapCollision, origin: T.Vector3) {
    this.collision = collision;
    this.origin.copy(origin);
    this.mesh = new T.Object3D();
    this.mesh.position.copy(origin);
  }
  reset() {
    this.mesh?.position.copy(this.origin);
    this.mesh?.quaternion.identity();
    this.velocity.set(0, 0, 0);
    this.sleeping = true;
    this.quiet = 0;
  }
  shoot(ray: T.Ray, distance: number) {
    if (!this.mesh) return false;
    this.sphere.set(this.mesh.position, this.radius);
    if (
      !ray.intersectSphere(this.sphere, this.hit) ||
      this.hit.distanceTo(ray.origin) > distance + 0.001
    )
      return false;
    this.velocity.addScaledVector(ray.direction, 4).clampLength(0, 12);
    this.sleeping = false;
    return true;
  }
  touch(position: T.Vector3, x: number, z: number, dt: number) {
    if (!this.mesh || Math.hypot(x, z) < 0.1) return;
    const p = this.mesh.position;
    if (Math.abs(p.y - position.y) > this.radius + 0.4) return;
    const dx = p.x - position.x,
      dz = p.z - position.z,
      distance = Math.hypot(dx, dz);
    if (distance > this.radius + 0.35 || distance < 1e-5) return;
    const toward = (x * dx + z * dz) / distance;
    if (toward <= 0) return;
    this.velocity.x += (dx / distance) * toward * dt * 30;
    this.velocity.z += (dz / distance) * toward * dt * 30;
    this.velocity.clampLength(0, 12);
    this.sleeping = false;
  }
  update(dt: number) {
    const mesh = this.mesh;
    if (!mesh || this.sleeping) return;
    const steps = Math.max(1, Math.ceil((this.velocity.length() * dt) / (this.radius * 0.5)));
    const step = dt / Math.min(steps, 8);
    for (let i = 0; i < Math.min(steps, 8); i++) {
      this.velocity.y -= movement.gravity * step;
      mesh.position.addScaledVector(this.velocity, step);
      this.next.copy(mesh.position);
      this.collision.resolveSphere(mesh.position, this.radius);
      this.normal.subVectors(mesh.position, this.next);
      if (this.normal.lengthSq() > 1e-12) {
        this.normal.normalize();
        const inward = this.velocity.dot(this.normal);
        if (inward < 0)
          this.velocity.addScaledVector(
            this.normal,
            -inward * (Math.abs(inward) > 0.7 ? 1 + native.surface.elasticity : 1),
          );
        this.velocity.multiplyScalar(Math.exp(-4 * step));
      }
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (speed > 0.001) {
        this.axis.set(this.velocity.z, 0, -this.velocity.x).normalize();
        mesh.rotateOnWorldAxis(this.axis, (speed * step) / this.radius);
      }
    }
    this.quiet = this.velocity.lengthSq() < 0.01 ? this.quiet + dt : 0;
    if (this.quiet > 0.5) {
      this.velocity.set(0, 0, 0);
      this.sleeping = true;
    }
    if (mesh.position.y < -50) this.reset();
  }
}
