import * as T from "three";
import data from "./data/agent-hitboxes.json";
import type { Soldier } from "./soldier";

export const agentBounds = new T.Sphere(new T.Vector3(0, 0.9, 0), 1.5);
const broadBounds = new T.Sphere();

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

type BoundCapsule = {
  bone: T.Object3D;
  start: T.Vector3;
  end: T.Vector3;
  radius: number;
  group: number;
};
const cache = new WeakMap<T.Object3D, BoundCapsule[]>();
const sets = data.sets.map((boxes) =>
  boxes.map((box) => ({
    name: box.bone.replace(/_([lr])(?=_|$)/g, (_, side: string) => `_${side.toUpperCase()}`),
    start: new T.Vector3(...box.min),
    end: new T.Vector3(...box.max),
    radius: box.radius,
    group: box.group,
  })),
);
const inverse = new T.Matrix4();
const localRay = new T.Ray();
const point = new T.Vector3();

type HitboxSoldier = Pick<Soldier, "model" | "group" | "team"> &
  Partial<Pick<Soldier, "agentId" | "crouch">>;
function reachesSoldier(soldier: HitboxSoldier, ray: T.Ray, maxDistance: number) {
  broadBounds.copy(agentBounds).center.add(soldier.group.position);
  return (
    ray.intersectsSphere(broadBounds) &&
    ray.origin.distanceToSquared(broadBounds.center) <= (maxDistance + broadBounds.radius) ** 2
  );
}
/** Bind the model's authored damage capsules once, before entering play.
 * All installed agents currently share the same set; retain model coverage so a
 * future asset cannot silently acquire an unrelated model's hitboxes.
 */
export function prepareSoldierHitboxes(soldier: HitboxSoldier) {
  if (cache.has(soldier.model)) return;
  const path: string =
    soldier.model.userData.agentModel ??
    (soldier.team === "ct"
      ? "/models/agents/roster/ctm-sas.glb"
      : "/models/agents/ground-rebel-native.glb");
  const source = (data.models as Record<string, { set: number }>)[path];
  if (!source) throw new Error(`Native hitboxes missing for agent model: ${path}`);
  const boxes = sets[source.set].map(({ name, ...shape }) => {
    const bone = soldier.model.getObjectByName(name);
    if (!bone) throw new Error(`Native hitbox bone missing in ${path}: ${name}`);
    return { ...shape, bone };
  });
  cache.set(soldier.model, boxes);
}
/** The actual bound volumes, also used by the development comparison view. */
export function soldierHitboxes(soldier: HitboxSoldier): readonly BoundCapsule[] {
  prepareSoldierHitboxes(soldier);
  return cache.get(soldier.model)!;
}
/** Animated actor picking without CPU skinning or decorative equipment hits. */
export function nativeSoldierHit(soldier: HitboxSoldier, ray: T.Ray, maxDistance = Infinity) {
  if (!reachesSoldier(soldier, ray, maxDistance)) return null;
  const boxes = soldierHitboxes(soldier);
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

export { nativeSoldierHit as soldierHit };
