import * as T from "three";
import { penetrate, rangeDamage, SOURCE_UNITS_PER_METER } from "./ballistics";
import type { BulletMaterial } from "./ballistics";
import { hitRegion, hitRegionMultiplier } from "./damage";

export type BulletStats = { damage: number; power: number; range: number; modifier: number };
export type BulletSurface<Data> = {
  distance: number;
  thickness: number | (() => number);
  material: BulletMaterial;
  // Actor IDs deduplicate overlapping hit meshes; standalone range props also
  // have IDs. The map's shared collision proxy intentionally has no ID.
  id?: string;
  stop?: boolean;
  exit?: boolean;
  data: Data;
};
export type BulletContact<Data> = {
  surface: BulletSurface<Data>;
  damage: number;
  passed: boolean;
};

// One invocation per pellet, shared by human and bot shots. Geometry adapters
// supply sorted intersections; the solver owns traversal and damage state.
export function solveBullet<Data>(stats: BulletStats, surfaces: BulletSurface<Data>[]) {
  const far = stats.range / SOURCE_UNITS_PER_METER;
  const contacts: BulletContact<Data>[] = [];
  const seen = new Set<string>();
  let damage = stats.damage;
  let previousEntry = 0;
  let solidExit = 0;
  let remaining = 4;
  let passed = false;
  let endDistance = Math.min(90, far);
  for (const surface of [...surfaces].sort((a, b) => a.distance - b.distance)) {
    const { distance, material, id } = surface;
    if (!Number.isFinite(distance) || distance < 0 || distance > far) continue;
    if (
      distance < solidExit - 0.001 ||
      (surface.exit && distance <= solidExit + 0.002) ||
      (id !== undefined && seen.has(id))
    )
      continue;
    if (id !== undefined) seen.add(id);
    // Entry-to-entry distance includes travel through the previous body/wall.
    damage = rangeDamage(damage, Math.max(0, distance - previousEntry), stats.modifier);
    previousEntry = distance;
    if (damage < 1) break;
    contacts.push({ surface, damage, passed });
    endDistance = distance;
    if (surface.stop || !remaining || distance * SOURCE_UNITS_PER_METER > 3000) break;
    const thickness =
      typeof surface.thickness === "function" ? surface.thickness() : surface.thickness;
    if (!Number.isFinite(thickness) || thickness < 0) break;
    damage = penetrate(damage, stats.power, thickness, material);
    if (damage < 1) break;
    remaining--;
    passed = true;
    endDistance = Math.min(far, distance + thickness);
    // Flesh deduplicates by actor rather than suppressing other geometry in
    // its volume: a wall touching a player's back must still stop the bullet.
    if (material !== "flesh") solidExit = distance + thickness;
  }
  return { contacts, endDistance, remaining };
}

export function hitgroupMultiplier(
  head: boolean,
  height: number,
  headMultiplier: number,
  crouch = false,
) {
  return hitRegionMultiplier(hitRegion(head, height, crouch), headMultiplier);
}

export function fleshThickness(direction: T.Vector3, yaw: number, head: boolean) {
  const localZ = direction.x * Math.sin(yaw) + direction.z * Math.cos(yaw);
  return Math.min(head ? 0.23 : 0.28 / Math.max(0.2, Math.abs(localZ)), 0.44);
}

// The local range uses simple boxes; imported maps provide their own triangle
// entry/exit probes. Keep this approximation identical for player and bots.
export function meshThickness(impact: T.Intersection, ray: T.Ray) {
  const mesh = impact.object as T.Mesh;
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
  let exit = Infinity;
  for (const axis of ["x", "y", "z"] as const) {
    if (Math.abs(ray.direction[axis]) > 1e-8)
      exit = Math.min(
        exit,
        ((ray.direction[axis] > 0 ? bounds.max[axis] : bounds.min[axis]) - ray.origin[axis]) /
          ray.direction[axis],
      );
  }
  return Math.max(0, exit - impact.distance);
}
