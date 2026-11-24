import * as T from "three";
import { assetFetch } from "./asset-url";
import type { NavArea, Navigation } from "./navigation";

/** Baked potentially-visible sets for static opaque scenery, one row per NAV
 * area. Units are individual draws: a mesh name plus its material slot. */
export type MapVisibilityData = {
  version: 1;
  map: string;
  /** Scenery asset paths and SHA-256 hashes the bake rendered. */
  sources: Record<string, string>;
  /** Eye heights above the NAV floor that were sampled. */
  heights: number[];
  units: string[];
  areas: number[];
  /** Base64 bitsets: one row of ceil(units / 8) bytes per area. */
  sets: string;
};

/** `exempt` draws keep their baked key but are never culled and never occlude
 * in a bake: their shader moves vertices (`userData.visibilityExempt`). */
export type VisibilityUnit = { mesh: T.Mesh; slot: number; key: string; exempt: boolean };
type Groups = T.BufferGeometry["groups"];
type Plan = { hide: T.Mesh[]; groups: [T.BufferGeometry, Groups][] };
type CulledMesh = {
  mesh: T.Mesh;
  units: { slot: number; bit: number }[];
  groups: Groups;
  ownsGeometry: boolean;
};

/** Crouched eye height through a jump apex, in metres above the floor. */
export const VISIBILITY_HEIGHTS = [1.17, 1.63, 2.35, 3.05];
const FLOOR_CLEARANCE = 0.5;
const OFF_NAV_REACH = 0.6;

export const seeThroughMaterial = (material: T.Material) =>
  !material.visible ||
  !material.colorWrite ||
  !material.depthWrite ||
  material.transparent ||
  material.alphaTest > 0 ||
  material.alphaHash;

/** Static, uniquely named opaque draws. Doors, breakables and anything
 * see-through stay out: they neither occlude in the bake nor get culled. */
export function visibilityUnits(scenery: T.Object3D, dynamic: Iterable<T.Object3D>) {
  const moving = new Set<T.Object3D>();
  for (const root of dynamic) root.traverse((object) => moving.add(object));
  const names = new Map<string, number>();
  scenery.traverse((object) => names.set(object.name, (names.get(object.name) ?? 0) + 1));
  const units: VisibilityUnit[] = [];
  const visit = (object: T.Object3D) => {
    if (!object.visible || moving.has(object)) return;
    if (
      object instanceof T.Mesh &&
      !(object instanceof T.InstancedMesh) &&
      !(object instanceof T.SkinnedMesh) &&
      !(object as { isBatchedMesh?: boolean }).isBatchedMesh &&
      object.frustumCulled &&
      object.name &&
      names.get(object.name) === 1
    ) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!Array.isArray(object.material) || object.geometry.groups.length)
        materials.forEach((material, slot) => {
          if (!seeThroughMaterial(material))
            units.push({
              mesh: object,
              slot,
              key: `${object.name}#${slot}`,
              exempt: object.userData.visibilityExempt === true,
            });
        });
    }
    for (const child of object.children) visit(child);
  };
  visit(scenery);
  return units;
}

export function mapDynamicObjects(world: {
  doorView: { objects(): Iterable<T.Object3D> };
  breakableView: { objects(): Iterable<T.Object3D> };
}) {
  return [...world.doorView.objects(), ...world.breakableView.objects()];
}

/** Optional asset: maps without a bake, or with an unreadable one, render
 * without occlusion culling. */
export async function loadMapVisibility(id: string) {
  try {
    const response = await assetFetch(`/models/maps/${id}-visibility.json`);
    if (!response.ok) return undefined;
    const data = (await response.json()) as MapVisibilityData;
    return data.version === 1 && data.map === id ? data : undefined;
  } catch {
    return undefined;
  }
}

export function encodeVisibilityBits(bits: Uint8Array) {
  let text = "";
  for (let i = 0; i < bits.length; i += 0x8000)
    text += String.fromCharCode(...bits.subarray(i, i + 0x8000));
  return btoa(text);
}

export function decodeVisibilityBits(text: string) {
  const binary = atob(text);
  const bits = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bits[i] = binary.charCodeAt(i);
  return bits;
}

/** Hides baked-invisible draws for the duration of one main-view render.
 * Nothing persists between renders, so gameplay visibility, raycasts and
 * cached shadow maps never observe culled state. */
export class MapVisibility {
  private readonly rows = new Map<number, number>();
  private readonly bits: Uint8Array;
  private readonly stride: number;
  private readonly meshes: CulledMesh[] = [];
  private readonly bitsByKey = new Map<string, number>();
  private readonly plans = new Map<number, Plan>();
  private readonly hidden: T.Mesh[] = [];
  private readonly swapped: [T.BufferGeometry, Groups][] = [];
  private readonly reach: number;
  private readonly navigation: Navigation;
  private active = false;
  /** Draws removed in the most recent culled render. */
  culled = 0;

  private constructor(
    data: MapVisibilityData,
    units: VisibilityUnit[],
    scenery: T.Object3D,
    navigation: Navigation,
  ) {
    this.navigation = navigation;
    this.bits = decodeVisibilityBits(data.sets);
    this.stride = Math.ceil(data.units.length / 8);
    data.areas.forEach((id, row) => this.rows.set(id, row));
    this.reach = Math.max(...data.heights) + 0.35;
    const geometryUsers = new Map<T.BufferGeometry, number>();
    scenery.traverse((object) => {
      if (object instanceof T.Mesh)
        geometryUsers.set(object.geometry, (geometryUsers.get(object.geometry) ?? 0) + 1);
    });
    const byKey = new Map(units.map((unit) => [unit.key, unit]));
    const byMesh = new Map<T.Mesh, CulledMesh>();
    data.units.forEach((key, bit) => {
      this.bitsByKey.set(key, bit);
      const unit = byKey.get(key)!;
      if (unit.exempt) return;
      let entry = byMesh.get(unit.mesh);
      if (!entry) {
        entry = {
          mesh: unit.mesh,
          units: [],
          groups: unit.mesh.geometry.groups,
          ownsGeometry: geometryUsers.get(unit.mesh.geometry) === 1,
        };
        byMesh.set(unit.mesh, entry);
        this.meshes.push(entry);
      }
      entry.units.push({ slot: unit.slot, bit });
    });
  }

  /** Returns undefined unless every baked occluder still exists as a static
   * opaque draw; a changed scenery set could otherwise expose culled holes. */
  static create(
    data: MapVisibilityData,
    scenery: T.Object3D,
    navigation: Navigation,
    dynamic: Iterable<T.Object3D>,
  ) {
    if (data.version !== 1 || !data.units.length || !data.heights.length) return undefined;
    const units = visibilityUnits(scenery, dynamic);
    const keys = new Set(units.map((unit) => unit.key));
    const missing = data.units.filter((key) => !keys.has(key));
    const stride = Math.ceil(data.units.length / 8);
    if (missing.length || decodeVisibilityBits(data.sets).length !== stride * data.areas.length) {
      if (import.meta.env.DEV)
        console.warn(`${data.map} visibility is stale; culling disabled`, missing.slice(0, 8));
      return undefined;
    }
    return new MapVisibility(data, units, scenery, navigation);
  }

  /** The NAV area whose baked row covers this eye position, if any. */
  area(position: T.Vector3): NavArea | undefined {
    const ceiling = position.y - FLOOR_CLEARANCE,
      bottom = position.y - this.reach;
    const found = (x: number, z: number) => {
      const area = this.navigation.support(x, z, ceiling, bottom)?.area;
      return area && this.rows.has(area.id) ? area : undefined;
    };
    return (
      found(position.x, position.z) ??
      found(position.x + OFF_NAV_REACH, position.z) ??
      found(position.x - OFF_NAV_REACH, position.z) ??
      found(position.x, position.z + OFF_NAV_REACH) ??
      found(position.x, position.z - OFF_NAV_REACH)
    );
  }

  /** Whether a baked draw may be visible from this area; undefined if unknown. */
  visible(area: NavArea, key: string) {
    const row = this.rows.get(area.id),
      bit = this.bitsByKey.get(key);
    if (row === undefined || bit === undefined) return undefined;
    return this.bit(row, bit);
  }

  private bit(row: number, bit: number) {
    return (this.bits[row * this.stride + (bit >> 3)] & (1 << (bit & 7))) !== 0;
  }

  private plan(row: number) {
    let plan = this.plans.get(row);
    if (plan) return plan;
    plan = { hide: [], groups: [] };
    for (const entry of this.meshes) {
      const hiddenSlots = new Set<number>();
      for (const unit of entry.units) if (!this.bit(row, unit.bit)) hiddenSlots.add(unit.slot);
      if (!hiddenSlots.size) continue;
      if (!Array.isArray(entry.mesh.material)) {
        plan.hide.push(entry.mesh);
        continue;
      }
      const kept = entry.groups.filter((group) => !hiddenSlots.has(group.materialIndex ?? 0));
      if (!kept.length) plan.hide.push(entry.mesh);
      else if (entry.ownsGeometry) plan.groups.push([entry.mesh.geometry, kept]);
    }
    this.plans.set(row, plan);
    return plan;
  }

  render<Value>(position: T.Vector3, draw: () => Value): Value {
    const area = this.active ? undefined : this.area(position);
    if (!area) {
      this.culled = 0;
      return draw();
    }
    const plan = this.plan(this.rows.get(area.id)!);
    let culled = 0;
    for (const mesh of plan.hide)
      if (mesh.visible) {
        mesh.visible = false;
        this.hidden.push(mesh);
        culled += Array.isArray(mesh.material) ? mesh.geometry.groups.length : 1;
      }
    for (const [geometry, groups] of plan.groups) {
      culled += geometry.groups.length - groups.length;
      this.swapped.push([geometry, geometry.groups]);
      geometry.groups = groups;
    }
    this.culled = culled;
    this.active = true;
    try {
      return draw();
    } finally {
      this.active = false;
      for (const mesh of this.hidden) mesh.visible = true;
      for (const [geometry, groups] of this.swapped) geometry.groups = groups;
      this.hidden.length = this.swapped.length = 0;
    }
  }
}
