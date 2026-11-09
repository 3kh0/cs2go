import { interpolateCharacterClock } from "./character-clock";
import * as T from "three";
import {
  TICK_RATE,
  SNAPSHOT_RATE,
  type PlayerAnimation,
  type PlayerState,
  type RoundState,
} from "@cs2go/protocol";
import {
  PlayerHitboxes,
  playerHitgroups,
  tracePlayerCapsules,
  type PlayerCapsule,
  type HitboxPlayer,
} from "./player-hitboxes";

// Browser policy, not an extracted native sv_maxunlag value. History rewinds
// only server-owned damage geometry; health, weapons and cover remain current.
export const MAX_REWIND_TICKS = Math.ceil(TICK_RATE * 0.25);
const capacity = MAX_REWIND_TICKS + 1,
  fields = [
    "x",
    "y",
    "z",
    "yaw",
    "eye",
    "weapon",
    "vx",
    "vz",
    "vertical",
    "grounded",
    "spawn",
    "health",
  ] as const;
type Pose = HitboxPlayer & Pick<PlayerState, "spawn" | "health"> & { animation: PlayerAnimation };
type Frame = { tick: number; pose: Pose; plant: number; capsules: Float32Array; ready: boolean };
type Ring = { frames: Frame[]; head: number; size: number; spawn: number; spawnAt: number };
function frame(): Frame {
  return {
    tick: -1,
    pose: {
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      eye: 0,
      weapon: 0,
      vx: 0,
      vz: 0,
      vertical: 0,
      grounded: true,
      spawn: 0,
      health: 0,
      animation: { phase: 0, air: 0, shot: null, draw: null, reload: null },
    },
    plant: 0,
    capsules: new Float32Array(19 * 7),
    ready: false,
  };
}
export class HitboxHistory {
  private players = new Map<string, Ring>();
  private center = new T.Vector3();
  private yaw = 0;
  private pose = frame().pose;
  private scratch: PlayerCapsule[] = Array.from({ length: 19 }, () => ({
    start: new T.Vector3(),
    end: new T.Vector3(),
    radius: 0,
    group: 0,
  }));
  get playerCount() {
    return this.players.size;
  }
  record(
    tick: number,
    players: ReadonlyMap<string, PlayerState>,
    rigs: ReadonlyMap<string, { hitboxes: PlayerHitboxes }>,
    bomb: RoundState["bomb"],
  ) {
    for (const id of this.players.keys()) if (!players.has(id)) this.players.delete(id);
    for (const player of players.values()) {
      let ring = this.players.get(player.id);
      if (!ring) {
        ring = {
          frames: Array.from({ length: capacity }, frame),
          head: 0,
          size: 0,
          spawn: player.spawn,
          spawnAt: tick,
        };
        this.players.set(player.id, ring);
      }
      if (ring.spawn !== player.spawn) {
        ring.head = ring.size = 0;
        ring.spawn = player.spawn;
        ring.spawnAt = tick;
      }
      const target = ring.frames[ring.head];
      ring.head = (ring.head + 1) % capacity;
      ring.size = Math.min(capacity, ring.size + 1);
      target.tick = tick;
      target.ready = false;
      for (const field of fields)
        (target.pose as unknown as Record<string, unknown>)[field] = player[field];
      if (player.ladder) {
        const ladder = (target.pose.ladder ??= { id: null, detachTime: 0 });
        ladder.id = player.ladder.id;
        ladder.detachTime = player.ladder.detachTime;
      } else target.pose.ladder = undefined;
      rigs.get(player.id)!.hitboxes.clock(target.pose.animation);
      target.plant = bomb.carrier === player.id ? bomb.plantProgress / 3.2 : 0;
      target.pose.animation.plant = target.plant;
    }
  }
  private materialize(value: Frame, rig: PlayerHitboxes) {
    if (value.ready) return;
    rig.capsules(value.pose, value.plant, value.pose.animation).forEach((capsule, i) => {
      capsule.start.toArray(value.capsules, i * 7);
      capsule.end.toArray(value.capsules, i * 7 + 3);
      value.capsules[i * 7 + 6] = capsule.radius;
    });
    value.ready = true;
  }
  /** undefined means no complete history: callers use the current pose. null is
   * a genuine historical miss or a request from before this victim's new life. */
  hit(
    player: PlayerState,
    rig: PlayerHitboxes,
    ray: T.Ray,
    maxDistance: number,
    viewTick: number,
    currentTick: number,
  ) {
    const capsules = this.sample(player, rig, viewTick, currentTick, ray, maxDistance);
    const hit =
      capsules === undefined
        ? undefined
        : capsules === null
          ? null
          : tracePlayerCapsules(capsules, ray, maxDistance);
    return hit
      ? {
          ...hit,
          yaw: this.yaw,
          position: { x: this.center.x, y: this.center.y - 0.9, z: this.center.z },
        }
      : hit;
  }
  capsulesAt(player: PlayerState, rig: PlayerHitboxes, viewTick: number, currentTick: number) {
    return this.sample(player, rig, viewTick, currentTick);
  }
  private sample(
    player: PlayerState,
    rig: PlayerHitboxes,
    viewTick: number,
    currentTick: number,
    ray?: T.Ray,
    maxDistance = Infinity,
  ) {
    if (!Number.isFinite(viewTick)) return undefined;
    const ring = this.players.get(player.id);
    if (!ring?.size) return undefined;
    const period = TICK_RATE / SNAPSHOT_RATE;
    // A visible pose needs both snapshot boundaries. At a non-snapshot server
    // tick, the oldest partial bracket is outside the allowed rewind window.
    const oldest = Math.ceil((currentTick - MAX_REWIND_TICKS) / period) * period;
    const tick = Math.max(oldest, Math.min(currentTick, viewTick));
    if (player.spawn !== ring.spawn || tick < ring.spawnAt) return null;
    const lower = Math.floor(tick / period) * period,
      upper = Math.ceil(tick / period) * period;
    let before: Frame | undefined, after: Frame | undefined, exact: Frame | undefined;
    for (let i = 0; i < ring.size; i++) {
      const value = ring.frames[(ring.head - ring.size + i + capacity) % capacity];
      if (value.tick === lower) before = value;
      if (value.tick === upper) after = value;
      if (value.tick === tick) exact = value;
    }
    if ((!before || !after) && exact) before = after = exact;
    if (!before || !after) return undefined;
    if (
      before.pose.spawn !== player.spawn ||
      after.pose.spawn !== player.spawn ||
      before.pose.health <= 0 ||
      after.pose.health <= 0
    )
      return null;
    const t = after.tick === before.tick ? 0 : (tick - before.tick) / (after.tick - before.tick);
    this.yaw =
      before.pose.yaw +
      Math.atan2(
        Math.sin(after.pose.yaw - before.pose.yaw),
        Math.cos(after.pose.yaw - before.pose.yaw),
      ) *
        t;
    this.center.set(
      T.MathUtils.lerp(before.pose.x, after.pose.x, t),
      T.MathUtils.lerp(before.pose.y, after.pose.y, t) + 0.9,
      T.MathUtils.lerp(before.pose.z, after.pose.z, t),
    );
    if (
      ray &&
      (ray.distanceSqToPoint(this.center) > 2.25 ||
        this.center.distanceTo(ray.origin) > maxDistance + 1.5)
    )
      return null;
    if (before !== after) {
      const pose = this.pose,
        a = before.pose,
        b = after.pose,
        discrete = t < 1 ? a : b;
      pose.x = this.center.x;
      pose.y = this.center.y - 0.9;
      pose.z = this.center.z;
      pose.yaw = this.yaw;
      pose.eye = T.MathUtils.lerp(a.eye, b.eye, t);
      pose.vx = T.MathUtils.lerp(a.vx, b.vx, t);
      pose.vz = T.MathUtils.lerp(a.vz, b.vz, t);
      pose.vertical = discrete.vertical;
      pose.grounded = discrete.grounded;
      pose.ladder = discrete.ladder;
      pose.weapon = b.weapon;
      pose.animation = interpolateCharacterClock(
        a.animation,
        b.animation,
        t,
        (after.tick - before.tick) / TICK_RATE,
      );
      return rig.capsules(pose, pose.animation.plant ?? 0, pose.animation);
    }
    this.materialize(before, rig);
    for (let i = 0; i < 19; i++) {
      const c = this.scratch[i],
        a = before.capsules,
        k = i * 7;
      c.start.fromArray(a, k);
      c.end.fromArray(a, k + 3);
      c.radius = a[k + 6];
      c.group = playerHitgroups[i];
    }
    return this.scratch;
  }
}
