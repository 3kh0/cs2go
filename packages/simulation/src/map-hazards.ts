import * as T from "three";
import {
  touchesBuyZone,
  type MapTriggerData,
  type NativeMapTrigger,
  type TriggerHull,
} from "./buy-zones";
import type { MapCollision } from "./map-collision";
import { movement } from "./physics";

type Position = { x: number; y: number; z: number };
export type HazardActor<Id> = { id: Id; position: Position; hull: TriggerHull };

function bombSupport(collision: MapCollision, position: Position) {
  const floor = collision.support(
    position.x,
    position.z,
    position.y + 0.1,
    position.y - 0.1,
    movement.hullRadius,
  );
  return Number.isFinite(floor) &&
    Math.abs(floor - position.y) <= 0.1 &&
    !collision.blocked(position.x, position.z, floor, movement.hullRadius, movement.duckHeight)
    ? floor
    : undefined;
}
export function supportedBombPosition(collision: MapCollision, position: Position) {
  return bombSupport(collision, position) !== undefined;
}

export function touchesMapTrigger(
  trigger: NativeMapTrigger,
  position: Position,
  hull?: TriggerHull,
) {
  return trigger.enabled && trigger.hulls.some((brush) => touchesBuyZone(position, brush, hull));
}

/** Current imported hazards use constant-rate DMG_FALL (32), which bypasses
 * armor. Vertigo native SourceTV captures verified 500HP per half-second for
 * its authored 1000 damage/sec trigger. First/last touch reconstruction follows
 * Valve Source SDK triggers.cpp; private CS2 trigger scheduling is not claimed.
 * https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/server/triggers.cpp
 */
export class MapHazards<Id> {
  private states: {
    trigger: NativeMapTrigger;
    active: boolean;
    remaining: number;
    contacts: Set<Id>;
    hurt: Set<Id>;
  }[];

  constructor(triggers: MapTriggerData["hurt"] = []) {
    this.states = triggers.map((trigger) => {
      if (
        trigger.enabled &&
        (trigger.filtername ||
          !Number.isFinite(trigger.damage) ||
          trigger.damage! < 0 ||
          Number(trigger.damagemodel ?? 0) !== 0 ||
          Number(trigger.damagetype ?? 32) !== 32)
      )
        throw new Error(`Unsupported native hurt trigger: ${trigger.entity}`);
      return { trigger, active: false, remaining: 0, contacts: new Set(), hurt: new Set() };
    });
  }

  get hasTriggers() {
    return this.states.length > 0;
  }

  reset() {
    for (const state of this.states) {
      state.active = false;
      state.remaining = 0;
      state.contacts.clear();
      state.hurt.clear();
    }
  }

  update(dt: number, actors: readonly HazardActor<Id>[]) {
    const damage: { actor: Id; damage: number; trigger: string }[] = [];
    for (const state of this.states) {
      const trigger = state.trigger;
      // CS bots are player actors too; the native Clients flag applies to both.
      if (!trigger.enabled || !((trigger.spawnflags ?? 0) & 1) || !(trigger.damage! > 0)) continue;
      const contacts = new Set(
        actors
          .filter((actor) => touchesMapTrigger(trigger, actor.position, actor.hull))
          .map((actor) => actor.id),
      );
      const hurt = (actor: Id) =>
        damage.push({ actor, damage: trigger.damage! * 0.5, trigger: trigger.entity });
      for (const actor of state.contacts)
        if (!contacts.has(actor) && !state.hurt.has(actor)) hurt(actor);
      if (!state.active && contacts.size) {
        state.active = true;
        state.remaining = 0;
      } else if (state.active) state.remaining -= dt;
      if (state.active && state.remaining <= 1e-9) {
        state.hurt.clear();
        for (const actor of contacts) {
          hurt(actor);
          state.hurt.add(actor);
        }
        state.active = contacts.size > 0;
        state.remaining += 0.5;
      }
      state.contacts = contacts;
    }
    return damage;
  }
}

/** Retain only a supported, grounded location reached by the actual carrier.
 * No NAV-nearest teleport or global-height threshold substitutes native brushes. */
export class BombReset {
  private safe?: Position;
  private origin?: Position;
  private dropped = false;
  private velocity = new T.Vector3();
  private previous = new T.Vector3();
  private center = new T.Vector3();
  private delta = new T.Vector3();
  private normal = new T.Vector3();
  private lastPosition = new T.Vector3();
  private triggers: MapTriggerData["bombReset"];
  private hurt: MapTriggerData["hurt"];

  constructor(data?: MapTriggerData) {
    this.triggers = data?.bombReset;
    this.hurt = data?.hurt;
    if (this.triggers?.some((trigger) => trigger.enabled && trigger.filtername))
      throw new Error("Filtered native bomb-reset triggers need a matching filter implementation");
  }

  reset() {
    this.safe = undefined;
    this.origin = undefined;
    this.dropped = false;
    this.velocity.set(0, 0, 0);
  }

  remember(position: Position, grounded: boolean, supported: (position: Position) => boolean) {
    if (
      !this.triggers?.length ||
      !grounded ||
      !Number.isFinite(position.x + position.y + position.z) ||
      this.triggers.some((trigger) => touchesMapTrigger(trigger, position)) ||
      this.hurt?.some((trigger) => touchesMapTrigger(trigger, position)) ||
      !supported(position)
    )
      return;
    this.safe = { x: position.x, y: position.y, z: position.z };
    this.origin ??= { ...this.safe };
  }

  restore(position: Position) {
    if (!this.safe || !this.triggers?.some((trigger) => touchesMapTrigger(trigger, position)))
      return false;
    Object.assign(position, this.safe);
    this.velocity.set(0, 0, 0);
    return true;
  }

  private crossedReset(from: Position, to: Position) {
    return this.triggers?.some(
      (trigger) =>
        trigger.enabled &&
        trigger.hulls.some((hull) => {
          // Clip the swept C4 origin against every native brush plane, so a thin
          // reset brush cannot be skipped between two fixed simulation samples.
          const planes = hull.planes ?? [
            [1, 0, 0, hull.max[0]],
            [-1, 0, 0, -hull.min[0]],
            [0, 1, 0, hull.max[1]],
            [0, -1, 0, -hull.min[1]],
            [0, 0, 1, hull.max[2]],
            [0, 0, -1, -hull.min[2]],
          ];
          let enter = 0,
            exit = 1;
          for (const plane of planes) {
            const a = from.x * plane[0] + from.y * plane[1] + from.z * plane[2] - plane[3];
            const b = to.x * plane[0] + to.y * plane[1] + to.z * plane[2] - plane[3];
            if (a > 0 && b > 0) return false;
            if (a > 0) enter = Math.max(enter, a / (a - b));
            if (b > 0) exit = Math.min(exit, a / (a - b));
            if (enter > exit) return false;
          }
          return true;
        }),
    );
  }

  /** Gravity/sphere reconstruction is restricted to maps declaring native reset
   * brushes. Existing Dust II/Mirage drops keep their established placement.
   * The server alone advances this state in multiplayer. */
  advance(position: Position, dt: number, collision: MapCollision, heldOrPlanted: boolean) {
    if (heldOrPlanted || !this.triggers?.length) {
      this.dropped = false;
      this.velocity.set(0, 0, 0);
      return false;
    }
    // A previously valid prop may have broken since the carrier stood there.
    // Retain the round's first verified safe position as a bounded fallback.
    if (this.safe && !supportedBombPosition(collision, this.safe))
      this.safe =
        this.origin && supportedBombPosition(collision, this.origin) ? this.origin : undefined;
    if (this.restore(position)) {
      this.lastPosition.set(position.x, position.y, position.z);
      return true;
    }
    if (
      !this.dropped ||
      (this.lastPosition.x - position.x) ** 2 +
        (this.lastPosition.y - position.y) ** 2 +
        (this.lastPosition.z - position.z) ** 2 >
        1e-8
    ) {
      this.velocity.set(0, 0, 0);
      this.dropped = true;
    }
    const x = position.x,
      y = position.y,
      z = position.z;
    const steps = Math.max(1, Math.ceil(Math.min(dt, 0.125) * 128));
    const step = Math.min(dt, 0.125) / steps;
    for (let i = 0; i < steps && step > 0; i++) {
      const floor = this.velocity.y <= 0 ? bombSupport(collision, position) : undefined;
      if (floor !== undefined) {
        position.y = floor;
        this.velocity.set(0, 0, 0);
        this.remember(position, true, (point) => supportedBombPosition(collision, point));
        break;
      }
      this.previous.set(position.x, position.y, position.z);
      const radius = 0.05;
      this.center.copy(this.previous).y += radius;
      this.velocity.y -= movement.gravity * step;
      this.delta.copy(this.velocity).multiplyScalar(step);
      const fraction = collision.sweepSphere(this.center, this.delta, radius, this.normal);
      this.center.addScaledVector(
        this.delta,
        fraction >= 0 && fraction <= 1 ? Math.max(0, fraction - 0.001) : 1,
      );
      Object.assign(position, { x: this.center.x, y: this.center.y - radius, z: this.center.z });
      if (fraction >= 0 && fraction <= 1) {
        const inward = this.velocity.dot(this.normal);
        if (inward < 0) this.velocity.addScaledVector(this.normal, -inward);
      }
      if (this.safe && this.crossedReset(this.previous, position)) {
        Object.assign(position, this.safe);
        this.velocity.set(0, 0, 0);
        break;
      }
    }
    this.lastPosition.set(position.x, position.y, position.z);
    return position.x !== x || position.y !== y || position.z !== z;
  }
}
