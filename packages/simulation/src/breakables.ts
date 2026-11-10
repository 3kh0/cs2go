import * as T from "three";
import type { BreakableState } from "@cs2go/protocol";
import type { BulletMaterial } from "./ballistics";
import type { MapCollision } from "./map-collision";

export type BreakableDamageKind = "bullet" | "melee" | "explosion" | "fire";
export type NativeBreakableDefinition = {
  id: string;
  health: number;
  /** Physical debris family, separate from the bullet penetration model. */
  material: BulletMaterial | "plastic" | "paper" | "fruit";
  bounds: [[number, number, number], [number, number, number]];
  physicsNames: string[];
  renderNames: string[];
  /** Exact inherited VSURF event; empty explicitly disables sound. */
  breakSoundEvent?: string;
  damageKinds?: BreakableDamageKind[];
  damageMultipliers?: Partial<Record<BreakableDamageKind, number>>;
  /** Authored OnBreak -> Enable targets, retained in collision but initially disabled. */
  onBreakEnable?: string[];
};
export type BreakableChange = BreakableState & { broken: boolean };
export type NativeBreakableRemainder = {
  id: string;
  physicsNames: string[];
  renderNames: string[];
};

/** Bind original entity/part identity before collision triangles are flattened.
 * Geometry and permanent frames/nails are not inferred from a material name.
 */
export function bindBreakablePhysics(
  root: T.Object3D,
  definitions: readonly NativeBreakableDefinition[],
  enabledRemainders: readonly NativeBreakableRemainder[] = [],
) {
  const objects = new Map<string, T.Object3D[]>();
  root.traverse((object) => {
    const list = objects.get(object.name) ?? [];
    list.push(object);
    objects.set(object.name, list);
  });
  const bind = (name: string, id?: string, toggleId?: string) => {
    const matches = objects.get(name) ?? objects.get(T.PropertyBinding.sanitizeNodeName(name));
    for (const object of matches ?? [])
      object.traverse((child) => {
        if (!(child instanceof T.Mesh)) return;
        child.userData.nativePhysicsName = name;
        if (id) child.userData.nativeBreakableId = id;
        if (toggleId) child.userData.nativeToggleId = toggleId;
      });
  };
  for (const definition of definitions) {
    for (const name of definition.physicsNames) bind(name, definition.id);
    for (const name of definition.onBreakEnable ?? []) bind(name);
  }
  for (const remainder of enabledRemainders)
    for (const name of remainder.physicsNames) bind(name, undefined, remainder.id);
}

/** Authoritative native-object health and obstruction state shared by local/server games. */
export class BreakableWorld {
  readonly collision: MapCollision;
  readonly definitions: readonly NativeBreakableDefinition[];
  readonly states: BreakableState[];
  private readonly byId = new Map<
    string,
    { definition: NativeBreakableDefinition; state: BreakableState; bounds: T.Box3 }
  >();
  private readonly physicsIds = new Map<string, string>();
  constructor(collision: MapCollision, definitions: readonly NativeBreakableDefinition[]) {
    this.collision = collision;
    this.definitions = definitions;
    this.states = [];
    for (const definition of definitions) {
      if (
        !definition.id ||
        this.byId.has(definition.id) ||
        !Number.isFinite(definition.health) ||
        definition.health <= 0
      )
        throw new Error("Invalid native breakable identity/health");
      if (definition.bounds.some((v) => v.length !== 3 || v.some((n) => !Number.isFinite(n))))
        throw new Error("Invalid native breakable bounds");
      const bounds = new T.Box3(
        new T.Vector3(...definition.bounds[0]),
        new T.Vector3(...definition.bounds[1]),
      );
      if (bounds.isEmpty()) throw new Error("Invalid native breakable bounds");
      const state = { id: definition.id, health: definition.health };
      this.states.push(state);
      this.byId.set(definition.id, { definition, state, bounds });
      for (const name of definition.physicsNames) {
        this.physicsIds.set(name, definition.id);
        this.physicsIds.set(T.PropertyBinding.sanitizeNodeName(name), definition.id);
      }
    }
    this.syncCollision();
  }
  health(id: string) {
    return this.byId.get(id)?.state.health;
  }
  idForImpact(impact: T.Intersection) {
    let object: T.Object3D | null = impact.object;
    while (object) {
      const id = object.userData.nativeBreakableId;
      if (typeof id === "string" && this.byId.has(id)) return id;
      const found = this.physicsIds.get(object.name);
      if (found) return found;
      object = object.parent;
    }
    return undefined;
  }
  damageImpact(impact: T.Intersection, amount: number, kind: BreakableDamageKind) {
    const id = this.idForImpact(impact);
    return id ? this.damage(id, amount, kind) : null;
  }
  damage(id: string, amount: number, kind: BreakableDamageKind): BreakableChange | null {
    const entry = this.byId.get(id);
    if (
      !entry ||
      entry.state.health <= 0 ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !(entry.definition.damageKinds ?? ["bullet", "melee", "explosion"]).includes(kind)
    )
      return null;
    const authored = entry.definition.damageMultipliers?.[kind];
    // Negative native prop_data values mean inheritance, never immunity. The
    // importer resolves verified bases; older inputs retain ordinary damage.
    const multiplier =
      authored !== undefined && Number.isFinite(authored) && authored >= 0 ? authored : 1;
    amount *= multiplier;
    if (amount <= 0) return null;
    entry.state.health = Math.max(0, entry.state.health - amount);
    if (!entry.state.health) {
      this.collision.setMeshEnabled(id, false);
      for (const name of entry.definition.physicsNames) this.collision.setMeshEnabled(name, false);
      for (const name of entry.definition.onBreakEnable ?? [])
        this.collision.setMeshEnabled(name, true);
    }
    return { ...entry.state, broken: entry.state.health === 0 };
  }
  restore(states: readonly BreakableState[]) {
    const values = new Map(states.map((state) => [state.id, state.health]));
    for (const { definition, state } of this.byId.values()) {
      const value = values.get(state.id);
      state.health =
        value !== undefined && Number.isFinite(value)
          ? Math.max(0, Math.min(definition.health, value))
          : definition.health;
    }
    this.syncCollision();
  }
  reset() {
    this.restore([]);
  }
  private syncCollision() {
    for (const { definition, state } of this.byId.values()) {
      this.collision.setMeshEnabled(state.id, state.health > 0);
      for (const name of definition.physicsNames)
        this.collision.setMeshEnabled(name, state.health > 0);
      for (const name of definition.onBreakEnable ?? []) this.collision.setMeshEnabled(name, false);
    }
    for (const { definition, state } of this.byId.values())
      if (!state.health)
        for (const name of definition.onBreakEnable ?? [])
          this.collision.setMeshEnabled(name, true);
  }
  /** Determine exposure before changing any panels, so iteration order cannot let
   * one explosion tunnel through several initially occluding pieces of cover.
   */
  damageRadius(
    origin: T.Vector3,
    radius: number,
    damage: (distance: number, point: T.Vector3) => number,
    kind: BreakableDamageKind,
    occlusion = true,
  ) {
    if (!(radius > 0)) return [];
    const pending: { id: string; amount: number }[] = [];
    for (const { definition, state, bounds } of this.byId.values()) {
      if (!state.health) continue;
      const point = bounds.clampPoint(origin, new T.Vector3());
      const distance = point.distanceTo(origin);
      if (distance > radius) continue;
      if (occlusion && distance > 0.002) {
        const ray = new T.Ray(origin, point.clone().sub(origin).normalize());
        if (
          this.collision
            .intersections(ray, distance - 0.001)
            .some((hit) => this.idForImpact(hit) !== state.id)
        )
          continue;
      }
      pending.push({ id: definition.id, amount: damage(distance, point) });
    }
    return pending.flatMap(({ id, amount }) => {
      const change = this.damage(id, amount, kind);
      return change ? [change] : [];
    });
  }
}
