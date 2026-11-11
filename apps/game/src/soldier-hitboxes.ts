import * as T from "three";
import data from "./data/agent-hitboxes.json";
import type { Soldier } from "./soldier";

export const agentBounds = new T.Sphere(new T.Vector3(0, 0.9, 0), 1.5);
const broadBounds = new T.Sphere();

import { rayCapsule } from "@cs2go/simulation/ray-capsule";
export { rayCapsule } from "@cs2go/simulation/ray-capsule";

type BoundCapsule = {
  bone: T.Object3D;
  start: T.Vector3;
  end: T.Vector3;
  radius: number;
  group: number;
};
type BoundHitboxes = { boxes: BoundCapsule[]; transforms: T.Object3D[] };
const cache = new WeakMap<T.Object3D, BoundHitboxes>();
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
  // Parent-first union of capsule ancestors. Equipment and decorative meshes
  // need no transform update for capsule picking.
  const transforms = new Set<T.Object3D>();
  const addAncestors = (object: T.Object3D) => {
    if (object === soldier.group || transforms.has(object)) return;
    if (object.parent) addAncestors(object.parent);
    transforms.add(object);
  };
  for (const box of boxes) addAncestors(box.bone);
  cache.set(soldier.model, { boxes, transforms: [...transforms] });
}
/** The actual bound volumes, also used by the development comparison view. */
export function soldierHitboxes(soldier: HitboxSoldier): readonly BoundCapsule[] {
  prepareSoldierHitboxes(soldier);
  return cache.get(soldier.model)!.boxes;
}
type CapsuleSnapshot = Omit<BoundCapsule, "bone"> & { world: T.Matrix4; inverse: T.Matrix4 };
function refreshSoldier(soldier: HitboxSoldier) {
  prepareSoldierHitboxes(soldier);
  const { boxes, transforms } = cache.get(soldier.model)!;
  soldier.group.updateWorldMatrix(true, false, true);
  for (const object of transforms) object.updateWorldMatrix(false, false, true);
  return boxes;
}
function snapshotSoldier(soldier: HitboxSoldier): CapsuleSnapshot[] {
  return refreshSoldier(soldier).map(({ bone, ...shape }) => ({
    ...shape,
    world: bone.matrixWorld.clone(),
    inverse: bone.matrixWorld.clone().invert(),
  }));
}
function hitBoxes(
  boxes: readonly (BoundCapsule | CapsuleSnapshot)[],
  ray: T.Ray,
  maxDistance: number,
) {
  let nearest = maxDistance;
  let hit: { point: T.Vector3; head: boolean; height: number; group: number } | null = null;
  for (const box of boxes) {
    const world = "bone" in box ? box.bone.matrixWorld : box.world;
    const inverseWorld = "bone" in box ? inverse.copy(world).invert() : box.inverse;
    localRay.copy(ray).applyMatrix4(inverseWorld);
    const distance = rayCapsule(localRay, box.start, box.end, box.radius);
    if (!Number.isFinite(distance)) continue;
    localRay.at(distance, point).applyMatrix4(world);
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
/** Capsule transforms are shared only by the pellets of one synchronous shot.
 * Create a new picker for every shot, including separate shots within one
 * 128 Hz simulation/render interval. Callers retain live health filtering.
 */
export function createSoldierHitboxShot() {
  const snapshots = new WeakMap<T.Object3D, CapsuleSnapshot[]>();
  return (soldier: HitboxSoldier, ray: T.Ray, maxDistance = Infinity) => {
    if (!reachesSoldier(soldier, ray, maxDistance)) return null;
    let boxes = snapshots.get(soldier.model);
    if (!boxes) {
      boxes = snapshotSoldier(soldier);
      snapshots.set(soldier.model, boxes);
    }
    return hitBoxes(boxes, ray, maxDistance);
  };
}
/** Animated actor picking without CPU skinning or decorative equipment hits. */
export function nativeSoldierHit(soldier: HitboxSoldier, ray: T.Ray, maxDistance = Infinity) {
  if (!reachesSoldier(soldier, ray, maxDistance)) return null;
  return hitBoxes(refreshSoldier(soldier), ray, maxDistance);
}

export { nativeSoldierHit as soldierHit };
