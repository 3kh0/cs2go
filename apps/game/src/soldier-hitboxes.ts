import * as T from "three";
import data from "./data/agent-hitboxes.json";
import type { Soldier } from "./soldier";

const axis = new T.Vector3();
const fromStart = new T.Vector3();
const closest = new T.Vector3();
const sphere = new T.Sphere();
const spherePoint = new T.Vector3();

/** Nearest forward ray intersection with the union of a cylinder and its end caps. */
export function rayCapsule(ray: T.Ray, start: T.Vector3, end: T.Vector3, radius: number) {
  axis.subVectors(end, start);
  fromStart.subVectors(ray.origin, start);
  const lengthSq = axis.lengthSq();
  const along = lengthSq ? Math.max(0, Math.min(1, fromStart.dot(axis) / lengthSq)) : 0;
  closest.copy(start).addScaledVector(axis, along);
  if (closest.distanceToSquared(ray.origin) <= radius * radius) return 0;
  let nearest = Infinity;
  if (lengthSq > 1e-12) {
    const axisDirection = axis.dot(ray.direction);
    const axisOrigin = axis.dot(fromStart);
    const a = lengthSq - axisDirection * axisDirection;
    const b = lengthSq * ray.direction.dot(fromStart) - axisOrigin * axisDirection;
    const c =
      lengthSq * fromStart.lengthSq() - axisOrigin * axisOrigin - radius * radius * lengthSq;
    const discriminant = b * b - a * c;
    if (a > 1e-12 && discriminant >= 0) {
      const distance = (-b - Math.sqrt(discriminant)) / a;
      const height = axisOrigin + distance * axisDirection;
      if (distance >= 0 && height >= 0 && height <= lengthSq) nearest = distance;
    }
  }
  for (let cap = 0; cap < 2; cap++) {
    sphere.set(cap ? end : start, radius);
    if (ray.intersectSphere(sphere, spherePoint))
      nearest = Math.min(nearest, ray.origin.distanceTo(spherePoint));
  }
  return nearest;
}

const cache = new WeakMap<
  T.Object3D,
  { bone: T.Object3D; start: T.Vector3; end: T.Vector3; radius: number; group: number }[]
>();
const inverse = new T.Matrix4();
const localRay = new T.Ray();
const point = new T.Vector3();

type HitboxSoldier = Pick<Soldier, "model" | "group" | "team">;
/** Only the native Ground Rebel rig matches this imported hitbox set. */
export function nativeSoldierHit(soldier: HitboxSoldier, ray: T.Ray, maxDistance = Infinity) {
  if (soldier.team !== "t") return null;
  let boxes = cache.get(soldier.model);
  if (!boxes) {
    boxes = data.hitboxes.map((box) => {
      const name = box.bone.replace(
        /_([lr])(?=_|$)/g,
        (_, side: string) => `_${side.toUpperCase()}`,
      );
      const bone = soldier.model.getObjectByName(name);
      if (!bone) throw new Error(`Native hitbox bone missing: ${name}`);
      return {
        bone,
        start: new T.Vector3(...box.min),
        end: new T.Vector3(...box.max),
        radius: box.radius,
        group: box.group,
      };
    });
    cache.set(soldier.model, boxes);
  }
  soldier.group.updateMatrixWorld(true);
  let nearest = maxDistance;
  let hit: { point: T.Vector3; head: boolean; height: number; group: number } | null = null;
  for (const box of boxes) {
    inverse.copy(box.bone.matrixWorld).invert();
    localRay.copy(ray).applyMatrix4(inverse);
    const distance = rayCapsule(localRay, box.start, box.end, box.radius);
    if (!Number.isFinite(distance)) continue;
    localRay.at(distance, point).applyMatrix4(box.bone.matrixWorld);
    const worldDistance = point.distanceTo(ray.origin);
    if (worldDistance > nearest) continue;
    nearest = worldDistance;
    // Canonical standing heights adapt native groups to the shared armor/damage API.
    hit = {
      point: point.clone(),
      head: box.group === 1,
      height: box.group === 3 ? 1 : box.group === 6 || box.group === 7 ? 0.6 : 1.2,
      group: box.group,
    };
  }
  return hit;
}
