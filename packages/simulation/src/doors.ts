import * as T from "three";
import type { DoorState } from "@cs2go/protocol";
import type { MapCollision } from "./map-collision";
import type { BreakableDamageKind } from "./breakables";

export type DoorSoundKind = "startOpen" | "startClose" | "move" | "fullOpen" | "fullClose";
export type NativeDoorSound = {
  event: string;
  clips: string[];
  gain: number;
  pitch: number;
  curve: [number, number][];
  offset: readonly [number, number, number];
  occlusionMix: number;
  blockSeconds?: number;
  blockDistance?: number;
  instances?: number;
};
export type NativeDoorDefinition = {
  id: string;
  pivot: readonly [number, number, number];
  axis: readonly [number, number, number];
  distance: number;
  speed: number;
  returnDelay: number;
  startAngle?: number;
  openDirection?: -1 | 0 | 1;
  group?: string;
  locked?: boolean;
  useEnabled?: boolean;
  touchOpen?: boolean;
  sounds?: Partial<Record<DoorSoundKind, NativeDoorSound>>;
  damage?: {
    health: number;
    /** Only source-verified terminal destruction removes the final remnant. */
    destroyOnZero?: boolean;
    damageMultipliers: Partial<Record<BreakableDamageKind, number>>;
    /** Remaining-health transitions require explicit native/capture evidence.
     * The last stage remains a physical leaf; health0 never implies hiding it. */
    stages: {
      belowHealth: number;
      inclusive?: boolean;
      renderNames: string[];
      physicsNames: string[];
      damageMultipliers?: Partial<Record<BreakableDamageKind, number>>;
    }[];
  };
  physicsNames: string[];
  renderNames: string[];
};
export type NativeDoorManifest = {
  version: 1;
  mapId: string;
  doors: NativeDoorDefinition[];
  /** Sidecars are already in the map's closed browser-world coordinate frame. */
  renderModels?: string[];
  physicsModels?: string[];
};
export function nativeDoorDestroyed(
  definition: NativeDoorDefinition,
  state: Pick<DoorState, "health">,
) {
  return definition.damage?.destroyOnZero === true && state.health === 0;
}
function doorPhysicsNames(definition: NativeDoorDefinition) {
  return [
    ...definition.physicsNames,
    ...(definition.damage?.stages.flatMap((stage) => stage.physicsNames) ?? []),
  ];
}
export type DoorPhysics = { id: string; meshes: T.Mesh[]; stages?: T.Mesh[][] };
export type DoorActor = {
  x: number;
  y: number;
  z: number;
  height?: number;
  radius?: number;
  eye?: number;
  health?: number;
};
type Entry = {
  definition: NativeDoorDefinition;
  state: DoorState;
  pivot: T.Vector3;
  axis: T.Vector3;
  center: T.Vector3;
  currentBounds: T.Box3;
  currentBoundsKnown: boolean;
  meshes: T.Mesh[];
  closed: T.Matrix4[];
  stages: { meshes: T.Mesh[]; closed: T.Matrix4[] }[];
};
export function nativeDoorDamageStage(definition: NativeDoorDefinition, health: number) {
  let stage = 0;
  definition.damage?.stages.forEach((entry, index) => {
    if (health < entry.belowHealth || (entry.inclusive && health === entry.belowHealth))
      stage = index + 1;
  });
  return stage;
}
export const DOOR_USE_DISTANCE = 80 * 0.0254;
function inheritDoorCollisionAttributes(source: T.Object3D, target: T.Object3D) {
  for (let owner: T.Object3D | null = source; owner; owner = owner.parent)
    if (owner.userData.nativeCollisionAttributes) {
      target.userData.nativeCollisionAttributes = structuredClone(
        owner.userData.nativeCollisionAttributes,
      );
      return;
    }
}

/** Bind exact native leaves before flattening. Static architecture and door
 * frames must not be included in the manifest's moving physics names. */
export function bindDoorPhysics(root: T.Object3D, definitions: readonly NativeDoorDefinition[]) {
  const names = new Map<string, T.Object3D[]>();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    const matches = names.get(object.name) ?? [];
    matches.push(object);
    names.set(object.name, matches);
  });
  return definitions.map((definition): DoorPhysics => {
    const collect = (physicsNames: readonly string[]) => {
      if (!Array.isArray(physicsNames) || !physicsNames.length)
        throw new Error(`Native door has no physics owners: ${definition.id}`);
      const meshes = new Set<T.Mesh>();
      for (const name of physicsNames) {
        const matches = names.get(name) ?? names.get(T.PropertyBinding.sanitizeNodeName(name));
        if (!matches?.length)
          throw new Error(`Native door physics missing: ${definition.id}/${name}`);
        for (const object of matches)
          object.traverse((child) => {
            if (!(child instanceof T.Mesh)) return;
            child.userData.nativeDoorId = definition.id;
            child.userData.nativePhysicsName = name;
            inheritDoorCollisionAttributes(child, child);
            for (let ancestor: T.Object3D | null = child; ancestor; ancestor = ancestor.parent) {
              if (
                typeof ancestor.userData.SurfaceProperty === "string" &&
                ancestor.userData.SurfaceProperty
              ) {
                child.userData.SurfaceProperty = ancestor.userData.SurfaceProperty;
                break;
              }
            }
            let metadata: T.Object3D = child;
            while (metadata.parent && !metadata.userData.InteractAs) metadata = metadata.parent;
            const surface = String(metadata.userData.SurfaceProperty || "concrete");
            child.userData.bulletMaterial = /glass|chainlink/.test(surface)
              ? "glass"
              : /wood/.test(surface)
                ? "wood"
                : /metal/.test(surface)
                  ? "metal"
                  : "concrete";
            meshes.add(child);
          });
      }
      if (!meshes.size) throw new Error(`Native door has no physics triangles: ${definition.id}`);
      return [...meshes].map((mesh) => {
        const clone = mesh.clone(false);
        clone.matrixAutoUpdate = false;
        clone.matrix.copy(mesh.matrixWorld);
        clone.matrixWorld.copy(mesh.matrixWorld);
        return clone;
      });
    };
    return {
      id: definition.id,
      meshes: collect(definition.physicsNames),
      ...(definition.damage
        ? { stages: definition.damage.stages.map((stage) => collect(stage.physicsNames)) }
        : {}),
    };
  });
}

/** Source-authored pivots, angular travel/speed and groups; interaction and
 * obstruction handling are a shared browser/server reconstruction, not the
 * private Source2 door implementation. Closing waits safely on occupied hulls. */
export class DoorWorld {
  readonly collision: MapCollision;
  readonly definitions: readonly NativeDoorDefinition[];
  readonly states: DoorState[] = [];
  private readonly entries = new Map<string, Entry>();
  private readonly held = new Set<string>();
  private readonly rotation = new T.Matrix4();
  private readonly delta = new T.Matrix4();
  private readonly translate = new T.Matrix4();
  private readonly relative = new T.Vector3();
  private readonly normal = new T.Vector3();
  private readonly damageBounds = new T.Box3();
  private readonly damageMeshBounds = new T.Box3();
  private readonly damageTriangle = new T.Triangle();
  private readonly damagePoint = new T.Vector3();
  private readonly damageClosest = new T.Vector3();
  constructor(
    collision: MapCollision,
    definitions: readonly NativeDoorDefinition[],
    physics: readonly DoorPhysics[],
  ) {
    this.collision = collision;
    this.definitions = definitions;
    const templates = new Map(physics.map((entry) => [entry.id, entry]));
    for (const definition of definitions) {
      if (
        !definition.id ||
        this.entries.has(definition.id) ||
        ![
          ...definition.pivot,
          ...definition.axis,
          definition.distance,
          definition.speed,
          definition.returnDelay,
          definition.startAngle ?? 0,
        ].every(Number.isFinite) ||
        definition.pivot.length !== 3 ||
        definition.axis.length !== 3 ||
        !(definition.distance > 0 && definition.distance <= 180) ||
        definition.speed <= 0 ||
        ![undefined, -1, 0, 1].includes(definition.openDirection)
      )
        throw new Error("Invalid native door parameters");
      const template = templates.get(definition.id);
      if (!template?.meshes.length)
        throw new Error(`Native door physics missing: ${definition.id}`);
      const damage = definition.damage;
      if (
        damage &&
        (!Number.isFinite(damage.health) ||
          damage.health <= 0 ||
          (damage.destroyOnZero !== undefined && typeof damage.destroyOnZero !== "boolean") ||
          !damage.stages.length ||
          damage.stages.length > 8 ||
          Object.values(damage.damageMultipliers).some((v) => !Number.isFinite(v) || v < 0) ||
          damage.stages.some(
            (stage, index) =>
              !Number.isFinite(stage.belowHealth) ||
              stage.belowHealth < 0 ||
              stage.belowHealth > damage.health ||
              (index > 0 && stage.belowHealth >= damage.stages[index - 1].belowHealth) ||
              !stage.renderNames.length ||
              !Array.isArray(stage.physicsNames) ||
              !stage.physicsNames.length ||
              Object.values(stage.damageMultipliers ?? {}).some(
                (v) => !Number.isFinite(v) || v < 0,
              ),
          ) ||
          template.stages?.length !== damage.stages.length ||
          template.stages.some((meshes) => !meshes.length))
      )
        throw new Error(
          `Native door damage geometry/threshold evidence incomplete: ${definition.id}`,
        );
      const axis = new T.Vector3(...definition.axis);
      if (Math.abs(axis.length() - 1) > 0.001)
        throw new Error("Native door axis must be normalized");
      const stages = [template.meshes, ...(damage ? template.stages! : [])].map((templates) => {
        const meshes = templates.map((mesh) => {
          const clone = mesh.clone(false);
          inheritDoorCollisionAttributes(mesh, clone);
          clone.matrixAutoUpdate = false;
          clone.matrix.copy(mesh.matrixWorld);
          clone.matrixWorld.copy(mesh.matrixWorld);
          return clone;
        });
        return { meshes, closed: meshes.map((mesh) => mesh.matrixWorld.clone()) };
      });
      const { meshes, closed } = stages[0];
      const state: DoorState = {
        id: definition.id,
        angle: definition.startAngle ?? 0,
        target: definition.startAngle ?? 0,
        returnTime: -1,
        ...(damage ? { health: damage.health, stage: 0 } : {}),
      };
      const bounds = new T.Box3();
      for (const mesh of meshes) bounds.union(new T.Box3().setFromObject(mesh));
      const entry: Entry = {
        definition,
        state,
        pivot: new T.Vector3(...definition.pivot),
        axis,
        center: bounds.getCenter(new T.Vector3()),
        currentBounds: new T.Box3(),
        currentBoundsKnown: false,
        meshes,
        closed,
        stages,
      };
      this.entries.set(definition.id, entry);
      this.states.push(state);
      for (const name of doorPhysicsNames(definition)) collision.setStaticMeshEnabled(name, false);
      this.pose(entry);
    }
  }
  private pose(entry: Entry) {
    const { pivot, axis, state } = entry;
    entry.currentBounds.makeEmpty();
    entry.currentBoundsKnown = true;
    for (const name of doorPhysicsNames(entry.definition))
      this.collision.setStaticMeshEnabled(name, false);
    if (nativeDoorDestroyed(entry.definition, state)) {
      entry.meshes = [];
      entry.closed = [];
      state.target = state.angle;
      state.returnTime = -1;
      this.collision.removeDynamicMeshes(`door:${entry.definition.id}`);
      return;
    }
    const stage = entry.stages[state.stage ?? 0];
    entry.meshes = stage.meshes;
    entry.closed = stage.closed;
    this.rotation.makeRotationAxis(axis, T.MathUtils.degToRad(state.angle));
    this.delta
      .makeTranslation(pivot.x, pivot.y, pivot.z)
      .multiply(this.rotation)
      .multiply(this.translate.makeTranslation(-pivot.x, -pivot.y, -pivot.z));
    for (const [index, mesh] of entry.meshes.entries()) {
      mesh.matrix.multiplyMatrices(this.delta, entry.closed[index]);
      mesh.matrixWorld.copy(mesh.matrix);
      mesh.userData.nativeDoorId = entry.definition.id;
      // Sample the same transformed Float32 positions as MapCollision. Bounds
      // may include unused vertices, but must never exclude a current leaf.
      // This only runs when its pose/stage changes, not on interaction queries.
      const positions = mesh.geometry.getAttribute("position"),
        e = mesh.matrixWorld.elements;
      if (!positions) {
        entry.currentBoundsKnown = false;
        continue;
      }
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
          y = positions.getY(i),
          z = positions.getZ(i),
          w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]),
          wx = Math.fround((e[0] * x + e[4] * y + e[8] * z + e[12]) * w),
          wy = Math.fround((e[1] * x + e[5] * y + e[9] * z + e[13]) * w),
          wz = Math.fround((e[2] * x + e[6] * y + e[10] * z + e[14]) * w);
        if (!Number.isFinite(wx + wy + wz)) {
          entry.currentBoundsKnown = false;
          continue;
        }
        const { min, max } = entry.currentBounds;
        min.set(Math.min(min.x, wx), Math.min(min.y, wy), Math.min(min.z, wz));
        max.set(Math.max(max.x, wx), Math.max(max.y, wy), Math.max(max.z, wz));
      }
    }
    if (!entry.currentBounds.isEmpty()) entry.currentBounds.expandByScalar(1e-5);
    for (const name of doorPhysicsNames(entry.definition))
      this.collision.setStaticMeshEnabled(name, false);
    this.collision.setDynamicMeshes(`door:${entry.definition.id}`, entry.meshes);
  }
  target(from: T.Vector3, direction: T.Vector3) {
    // Bots ask every movement tick. Most are nowhere near a door: avoid a
    // full-world ray only when every current leaf is provably out of range.
    // Nearby/unknown bounds keep the original first-hit occlusion query.
    let nearby = false;
    for (const entry of this.entries.values())
      if (
        !entry.currentBoundsKnown ||
        !(entry.currentBounds.distanceToPoint(from) > DOOR_USE_DISTANCE)
      ) {
        nearby = true;
        break;
      }
    if (!nearby) return undefined;
    const impact = this.collision.intersections(new T.Ray(from, direction), DOOR_USE_DISTANCE)[0];
    let object: T.Object3D | null = impact?.object ?? null;
    while (object) {
      const id = object.userData.nativeDoorId;
      if (typeof id === "string") return this.entries.get(id)?.definition.id;
      object = object.parent;
    }
    return undefined;
  }
  private swing(entry: Entry, from: T.Vector3) {
    if (entry.definition.openDirection) return entry.definition.openDirection;
    this.relative.subVectors(entry.center, entry.pivot);
    this.normal.crossVectors(entry.axis, this.relative);
    this.relative.subVectors(from, entry.pivot);
    return this.normal.dot(this.relative) > 0 ? -1 : 1;
  }
  private command(entry: Entry, from: T.Vector3, openOnly = false) {
    if (
      nativeDoorDestroyed(entry.definition, entry.state) ||
      entry.definition.locked ||
      entry.definition.useEnabled === false
    )
      return false;
    const closing = !openOnly && Math.abs(entry.state.target) > 0.001;
    for (const peer of this.entries.values()) {
      if (nativeDoorDestroyed(peer.definition, peer.state)) continue;
      if (
        peer !== entry &&
        (!entry.definition.group || peer.definition.group !== entry.definition.group)
      )
        continue;
      peer.state.target = closing ? 0 : this.swing(peer, from) * peer.definition.distance;
      peer.state.returnTime = -1;
    }
    return true;
  }
  use(id: string, held: boolean, from: T.Vector3, direction: T.Vector3, enabled = true) {
    const pressed = held && !this.held.has(id);
    if (held) this.held.add(id);
    else this.held.delete(id);
    if (!pressed || !enabled) return false;
    const target = this.target(from, direction),
      entry = target ? this.entries.get(target) : undefined;
    return entry ? this.command(entry, from) : false;
  }
  release(id: string) {
    this.held.delete(id);
  }
  damage(id: string, amount: number, kind: BreakableDamageKind) {
    const entry = this.entries.get(id),
      damage = entry?.definition.damage;
    if (!entry || !damage || !Number.isFinite(amount) || amount <= 0 || !entry.state.health)
      return undefined;
    const previousStage = entry.state.stage ?? 0;
    const scale =
      damage.stages[previousStage - 1]?.damageMultipliers?.[kind] ?? damage.damageMultipliers[kind];
    if (typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0) return undefined;
    entry.state.health = Math.max(0, entry.state.health - amount * scale);
    entry.state.stage = nativeDoorDamageStage(entry.definition, entry.state.health);
    const destroyed = nativeDoorDestroyed(entry.definition, entry.state);
    if (previousStage !== entry.state.stage || destroyed) this.pose(entry);
    return {
      id,
      health: entry.state.health,
      stage: entry.state.stage,
      stageChanged: previousStage !== entry.state.stage,
      destroyed,
    };
  }
  damageHit(object: T.Object3D | undefined, amount: number, kind: BreakableDamageKind) {
    for (let node: T.Object3D | null | undefined = object; node; node = node.parent) {
      if (typeof node.userData.nativeDoorId === "string")
        return this.damage(node.userData.nativeDoorId, amount, kind);
    }
    return undefined;
  }
  idForImpact(impact: T.Intersection) {
    for (let node: T.Object3D | null = impact.object; node; node = node.parent) {
      const id = node.userData.nativeDoorId;
      if (typeof id === "string" && this.entries.has(id)) return id;
    }
    return undefined;
  }
  damageImpact(impact: T.Intersection, amount: number, kind: BreakableDamageKind) {
    const id = this.idForImpact(impact);
    return id ? this.damage(id, amount, kind) : undefined;
  }
  /** Resolve exposure against the current actual leaf surfaces before mutating
   * any stages; one blast cannot tunnel through cover by iteration order. */
  damageRadius(
    origin: T.Vector3,
    radius: number,
    damage: (distance: number, point: T.Vector3) => number,
    kind: BreakableDamageKind,
    occlusion = true,
  ) {
    if (
      Number.isNaN(radius) ||
      radius <= 0 ||
      ![origin.x, origin.y, origin.z].every(Number.isFinite)
    )
      return [];
    const pending: { id: string; amount: number }[] = [];
    for (const entry of this.entries.values()) {
      if (!entry.definition.damage || !entry.state.health) continue;
      this.damageBounds.makeEmpty();
      for (const mesh of entry.meshes)
        this.damageBounds.union(this.damageMeshBounds.setFromObject(mesh));
      if (this.damageBounds.distanceToPoint(origin) > radius) continue;
      let distanceSquared = Infinity;
      for (const mesh of entry.meshes) {
        const position = mesh.geometry.getAttribute("position"),
          index = mesh.geometry.index;
        if (!position) continue;
        const count = index?.count ?? position.count;
        for (let i = 0; i + 2 < count; i += 3) {
          this.damageTriangle.a
            .fromBufferAttribute(position, index ? index.getX(i) : i)
            .applyMatrix4(mesh.matrixWorld);
          this.damageTriangle.b
            .fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1)
            .applyMatrix4(mesh.matrixWorld);
          this.damageTriangle.c
            .fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2)
            .applyMatrix4(mesh.matrixWorld);
          this.damageTriangle.closestPointToPoint(origin, this.damagePoint);
          const next = this.damagePoint.distanceToSquared(origin);
          if (next < distanceSquared) {
            distanceSquared = next;
            this.damageClosest.copy(this.damagePoint);
          }
        }
      }
      const distance = Math.sqrt(distanceSquared);
      if (distance > radius) continue;
      if (occlusion && distance > 0.002) {
        const ray = new T.Ray(
          origin,
          this.damagePoint.copy(this.damageClosest).sub(origin).normalize(),
        );
        if (
          this.collision
            .intersections(ray, distance - 0.001)
            .some((hit) => this.idForImpact(hit) !== entry.state.id)
        )
          continue;
      }
      pending.push({ id: entry.state.id, amount: damage(distance, this.damageClosest.clone()) });
    }
    return pending.flatMap(({ id, amount }) => {
      const change = this.damage(id, amount, kind);
      return change ? [change] : [];
    });
  }
  /** Navigation may request opening a reachable leaf but must never toggle an
   * already open door closed while a bot continues along its native route. */
  openAhead(from: T.Vector3, direction: T.Vector3) {
    const id = this.target(from, direction),
      entry = id ? this.entries.get(id) : undefined;
    return entry && Math.abs(entry.state.target) < 0.001 ? this.command(entry, from, true) : false;
  }
  step(dt: number, actors: readonly DoorActor[] = []) {
    if (!Number.isFinite(dt) || dt <= 0) return false;
    let changed = false;
    for (const entry of this.entries.values()) {
      const state = entry.state;
      if (nativeDoorDestroyed(entry.definition, state)) continue;
      if (state.returnTime >= 0) {
        state.returnTime = Math.max(0, state.returnTime - dt);
        if (!state.returnTime) {
          state.target = 0;
          state.returnTime = -1;
        }
      }
      const travel = state.target - state.angle;
      if (Math.abs(travel) < 1e-6) continue;
      const distance = Math.min(Math.abs(travel), entry.definition.speed * dt),
        steps = Math.ceil(distance / 2),
        increment = (Math.sign(travel) * distance) / steps;
      for (let i = 0; i < steps; i++) {
        const previous = state.angle;
        state.angle += increment;
        this.pose(entry);
        if (
          actors.some(
            (actor) =>
              (actor.health === undefined || actor.health > 0) &&
              this.collision.dynamicBlocked(
                `door:${state.id}`,
                actor.x,
                actor.z,
                actor.y,
                actor.radius ?? 0.3,
                actor.height ?? (actor.eye ?? 1.45) + 0.2,
              ),
          )
        ) {
          state.angle = previous;
          this.pose(entry);
          break;
        }
        changed = true;
      }
      if (
        Math.abs(state.angle - state.target) < 1e-6 &&
        state.target &&
        entry.definition.returnDelay >= 0
      )
        state.returnTime = entry.definition.returnDelay;
    }
    return changed;
  }
  restore(states: readonly DoorState[]) {
    const byId = new Map(states.map((state) => [state.id, state]));
    for (const entry of this.entries.values()) {
      for (const name of doorPhysicsNames(entry.definition))
        this.collision.setStaticMeshEnabled(name, false);
      const state = byId.get(entry.definition.id),
        distance = entry.definition.distance;
      if (
        state &&
        [state.angle, state.target, state.returnTime].every(Number.isFinite) &&
        Math.abs(state.angle) <= distance + 0.001 &&
        Math.abs(state.target) <= distance + 0.001 &&
        ((!entry.definition.damage && state.health === undefined && state.stage === undefined) ||
          (entry.definition.damage &&
            Number.isFinite(state.health) &&
            state.health! >= 0 &&
            state.health! <= entry.definition.damage.health &&
            state.stage === nativeDoorDamageStage(entry.definition, state.health!)))
      ) {
        const changed =
          entry.state.angle !== state.angle ||
          entry.state.stage !== state.stage ||
          nativeDoorDestroyed(entry.definition, entry.state) !==
            nativeDoorDestroyed(entry.definition, state);
        Object.assign(entry.state, state);
        if (nativeDoorDestroyed(entry.definition, entry.state)) {
          entry.state.target = entry.state.angle;
          entry.state.returnTime = -1;
        }
        if (changed) this.pose(entry);
      } else {
        entry.state.angle = entry.state.target = entry.definition.startAngle ?? 0;
        entry.state.returnTime = -1;
        if (entry.definition.damage) {
          entry.state.health = entry.definition.damage.health;
          entry.state.stage = 0;
        }
        this.pose(entry);
      }
    }
  }
  reset() {
    // A new round must not manufacture a fresh +use press from a key held
    // across reset. Disconnect/session changes release their own actor IDs.
    this.restore([]);
  }
}
