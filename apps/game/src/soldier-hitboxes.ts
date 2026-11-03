import * as T from "three";
import data from "./data/agent-hitboxes.json";
import type { Soldier } from "./soldier";
import { botBodyHit } from "./bot-tactics";

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

const cache = new WeakMap<
  T.Object3D,
  { bone: T.Object3D; start: T.Vector3; end: T.Vector3; radius: number; group: number }[]
>();
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
/** Only the native Ground Rebel rig matches this imported hitbox set. */
export function nativeSoldierHit(soldier: HitboxSoldier, ray: T.Ray, maxDistance = Infinity) {
  if (soldier.team !== "t" || !reachesSoldier(soldier, ray, maxDistance)) return null;
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

type FittedBox = { name: string; bounds: T.Box3; group: number };
type BoundBox = FittedBox & { bone: T.Object3D };
type GeometryFit = {
  names: string[];
  inverses: T.Matrix4[];
  bind: T.Matrix4;
  boxes: FittedBox[];
};
const geometryFits = new WeakMap<T.BufferGeometry, GeometryFit>();
const fittedRigs = new WeakMap<T.Object3D, BoundBox[]>();
const canonicalGroups = new Map(
  data.hitboxes.map((box) => [
    box.bone.replace(/_([lr])(?=_|$)/g, (_, side: string) => `_${side.toUpperCase()}`),
    box.group,
  ]),
);
const vertex = new T.Vector3(),
  size = new T.Vector3();

// Other agents do not have an imported native hitbox set. Fit conservative
// bone-local boxes once from their bind-pose skin data, never from posed triangles
// during an attack. Shared geometry reuses the fit across all cloned actors.
function fitGeometry(mesh: T.SkinnedMesh): FittedBox[] {
  const skeleton = mesh.skeleton,
    cached = geometryFits.get(mesh.geometry);
  if (
    cached &&
    cached.bind.equals(mesh.bindMatrix) &&
    cached.names.length === skeleton.bones.length &&
    cached.names.every(
      (name, i) =>
        name === skeleton.bones[i].name && cached.inverses[i].equals(skeleton.boneInverses[i]),
    )
  )
    return cached.boxes;
  const position = mesh.geometry.getAttribute("position"),
    indices = mesh.geometry.getAttribute("skinIndex"),
    weights = mesh.geometry.getAttribute("skinWeight");
  if (!position || !indices || !weights) return [];
  const owners = skeleton.bones.map((bone) => {
    let owner: T.Object3D | null = bone;
    while (owner && !canonicalGroups.has(owner.name)) owner = owner.parent;
    return owner ? skeleton.bones.indexOf(owner as T.Bone) : -1;
  });
  const transforms = skeleton.boneInverses.map((inverse) =>
    new T.Matrix4().multiplyMatrices(inverse, mesh.bindMatrix),
  );
  const boxes = new Map<number, FittedBox>();
  for (let i = 0; i < position.count; i++) {
    let dominant = 0,
      weight = 0;
    for (let component = 0; component < 4; component++) {
      const next = weights.getComponent(i, component);
      if (next > weight) {
        weight = next;
        dominant = indices.getComponent(i, component);
      }
    }
    const owner = owners[dominant];
    if (!weight || owner === undefined || owner < 0) continue;
    let box = boxes.get(owner);
    if (!box) {
      const name = skeleton.bones[owner].name;
      box = { name, bounds: new T.Box3(), group: canonicalGroups.get(name)! };
      boxes.set(owner, box);
    }
    vertex.fromBufferAttribute(position, i).applyMatrix4(transforms[owner]);
    box.bounds.expandByPoint(vertex);
  }
  const result = [...boxes.values()];
  for (const box of result)
    box.bounds.expandByScalar(Math.max(box.bounds.getSize(size).length() * 0.005, 1e-4));
  geometryFits.set(mesh.geometry, {
    names: skeleton.bones.map((bone) => bone.name),
    inverses: skeleton.boneInverses.map((matrix) => matrix.clone()),
    bind: mesh.bindMatrix.clone(),
    boxes: result,
  });
  return result;
}
export function prepareSoldierHitboxes(soldier: HitboxSoldier) {
  if (
    (soldier.team === "t" && (!soldier.agentId || soldier.agentId === "default-t")) ||
    fittedRigs.has(soldier.model)
  )
    return;
  const boxes: BoundBox[] = [];
  const bones = new Map<string, T.Object3D>();
  soldier.model.traverseVisible((object) => {
    if (!(object instanceof T.SkinnedMesh)) return;
    for (const fitted of fitGeometry(object)) {
      let bone = bones.get(fitted.name);
      if (!bone) {
        bone = soldier.model.getObjectByName(fitted.name);
        if (bone) bones.set(fitted.name, bone);
      }
      // Keep separate mesh regions separate. Unioning their boxes can create
      // empty torso volume in front of the head or between disconnected gear.
      if (bone) boxes.push({ ...fitted, bone });
    }
  });
  fittedRigs.set(soldier.model, boxes);
}

/** Animated actor picking without CPU skinning or decorative equipment hits. */
export function soldierHit(soldier: HitboxSoldier, ray: T.Ray, maxDistance = Infinity) {
  if (soldier.team === "t" && (!soldier.agentId || soldier.agentId === "default-t"))
    return nativeSoldierHit(soldier, ray, maxDistance);
  if (!reachesSoldier(soldier, ray, maxDistance)) return null;
  prepareSoldierHitboxes(soldier);
  const boxes = fittedRigs.get(soldier.model)!;
  if (!boxes.length) {
    const hit = botBodyHit(ray, soldier.group.position, (soldier.crouch ?? 0) > 0.5);
    return hit && hit.point.distanceTo(ray.origin) <= maxDistance
      ? { ...hit, height: hit.point.y - soldier.group.position.y, group: hit.head ? 1 : 2 }
      : null;
  }
  soldier.group.updateMatrixWorld(true);
  let nearest = maxDistance;
  let hit: { point: T.Vector3; head: boolean; height: number; group: number } | null = null;
  for (const box of boxes) {
    inverse.copy(box.bone.matrixWorld).invert();
    localRay.copy(ray).applyMatrix4(inverse);
    if (box.bounds.containsPoint(localRay.origin)) point.copy(localRay.origin);
    else if (!localRay.intersectBox(box.bounds, point)) continue;
    point.applyMatrix4(box.bone.matrixWorld);
    const distance = point.distanceTo(ray.origin);
    if (distance > nearest) continue;
    nearest = distance;
    hit = {
      point: point.clone(),
      head: box.group === 1,
      height: box.group === 3 ? 1 : box.group === 6 || box.group === 7 ? 0.6 : 1.2,
      group: box.group,
    };
  }
  return hit;
}
