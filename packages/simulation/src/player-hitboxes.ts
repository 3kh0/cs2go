import * as T from "three";
import { orderCharacterLayers } from "./character-layers";
import { TICK_RATE, type PlayerState, type PlayerAnimation } from "@cs2go/protocol";
import source from "./data/player-hitboxes.json";
import { movement, weaponSlot, isKnife } from "./physics";
import { rayCapsuleInterval } from "./ray-capsule";
import type { HitRegion } from "./damage";
import { characterLocomotion, characterPhase } from "./character-locomotion";

type Track = { name: string; times: number[]; values: number[] };
type Clip = { name: string; duration: number; tracks: Track[] };
const floats = new Float32Array(Uint8Array.from(atob(source.data), (c) => c.charCodeAt(0)).buffer);
function clip(data: Clip) {
  return new T.AnimationClip(
    data.name,
    data.duration,
    data.tracks.map((t) => {
      const values = floats.subarray(t.values[0], t.values[0] + t.values[1]);
      const times = floats.subarray(t.times[0], t.times[0] + t.times[1]);
      return t.name.endsWith(".quaternion")
        ? new T.QuaternionKeyframeTrack(t.name, times, values)
        : new T.VectorKeyframeTrack(t.name, times, values);
    }),
  );
}
function complete(data: T.AnimationClip) {
  const tracks = data.tracks.slice(),
    names = new Set(tracks.map((t) => t.name));
  for (const bone of source.bones) {
    if (!names.has(bone.name + ".position"))
      tracks.push(new T.VectorKeyframeTrack(bone.name + ".position", [0], bone.p));
    if (!names.has(bone.name + ".quaternion"))
      tracks.push(new T.QuaternionKeyframeTrack(bone.name + ".quaternion", [0], bone.q));
  }
  return new T.AnimationClip(data.name, data.duration, tracks, data.blendMode);
}

const clips = Object.fromEntries(
  Object.entries(source.clips).map(([name, data]) => [name, complete(clip(data))]),
);
const weaponClips = Object.fromEntries(
  Object.entries(source.actions).map(([weapon, actions]) => [
    weapon,
    Object.fromEntries(Object.entries(actions).map(([name, data]) => [name, clip(data)])),
  ]),
);
const grips = source.grips as Record<
  string,
  {
    stand: { bones: Record<string, { p: number[]; q: number[] }> };
    crouch: { bones: Record<string, { p: number[]; q: number[] }> };
  }
>;
const shapes = source.shapes.map((s) => ({
  ...s,
  start: new T.Vector3().fromArray(s.min),
  end: new T.Vector3().fromArray(s.max),
}));
export const playerHitgroups = shapes.map((shape) => shape.group);
function region(group: number): HitRegion {
  return group === 1
    ? "head"
    : group === 3
      ? "stomach"
      : group === 4 || group === 5
        ? "arm"
        : group === 6 || group === 7
          ? "leg"
          : "chest";
}
export type HitboxPlayer = Pick<
  PlayerState,
  "x" | "y" | "z" | "yaw" | "eye" | "weapon" | "vx" | "vz" | "vertical" | "grounded" | "ladder"
>;
export type PlayerCapsule = { start: T.Vector3; end: T.Vector3; radius: number; group: number };
export function tracePlayerCapsules(
  capsules: readonly PlayerCapsule[],
  ray: T.Ray,
  maxDistance = Infinity,
) {
  const intervals = capsules
    .flatMap((shape) => {
      const interval = rayCapsuleInterval(ray, shape.start, shape.end, shape.radius);
      return interval && interval.entry <= maxDistance ? [{ ...interval, group: shape.group }] : [];
    })
    .sort((a, b) => a.entry - b.entry);
  const first = intervals[0];
  if (!first) return null;
  let exit = first.exit;
  for (const interval of intervals)
    if (interval.entry <= exit + 1e-6) exit = Math.max(exit, interval.exit);
  return {
    distance: first.entry,
    point: ray.at(first.entry, new T.Vector3()),
    head: first.group === 1,
    region: region(first.group),
    group: first.group,
    thickness: Math.max(0, exit - first.entry),
  };
}
/** Native bone-local capsules and exported animation channels, evaluated headlessly.
 * The graph selection/blending policy is shared with the browser soldier playback;
 * this does not implement Valve's private animation graph or historical rewind. */
export class PlayerHitboxes {
  private root = new T.Group();
  private bones = source.bones.map((b) => {
    const bone = new T.Bone();
    bone.name = b.name;
    bone.position.fromArray(b.p);
    bone.quaternion.fromArray(b.q);
    bone.scale.fromArray(b.s);
    return bone;
  });
  private mixer = new T.AnimationMixer(this.root);
  private actions = new Map<string, T.AnimationAction>();
  private active = new Set<T.AnimationAction>();
  private weapon = -1;
  private previousWeapon = -1;
  private time = 0;
  private version = 0;
  private evaluated = "";
  private bound = shapes.map((s) => ({
    start: new T.Vector3(),
    end: new T.Vector3(),
    radius: 0,
    group: s.group,
    bone: source.bones.findIndex((b) => b.name === s.bone),
  }));
  private phase = 0;
  private air = 0;
  private shot = Infinity;
  private draw = Infinity;
  private reload = Infinity;
  private previousReload = 0;
  constructor() {
    source.bones.forEach((b, i) =>
      (b.parent < 0 ? this.root : this.bones[b.parent]).add(this.bones[i]),
    );
    for (const [name, data] of Object.entries(clips))
      this.actions.set(name, this.mixer.clipAction(data));
  }
  advance(player: PlayerState, dt: number) {
    const speed = Math.hypot(player.vx, player.vz),
      yaw = player.yaw + Math.PI;
    const x = player.vx * Math.cos(yaw) - player.vz * Math.sin(yaw),
      z = player.vx * Math.sin(yaw) + player.vz * Math.cos(yaw);
    const c = (movement.standingEye - player.eye) / (movement.standingEye - movement.duckEye);
    this.version++;
    this.time += dt;
    this.phase = characterPhase(this.phase, dt, characterLocomotion(speed, x, z, c));
    this.air = !player.grounded && player.ladder?.id == null ? this.air + dt : 0;
    this.shot += dt;
    this.draw += dt;
    this.reload += dt;
    this.sync(player, dt);
  }
  sync(player: PlayerState, dt = 1 / TICK_RATE) {
    if (player.weapon !== this.previousWeapon) {
      this.previousWeapon = player.weapon;
      this.draw = 0;
      this.shot = this.reload = Infinity;
      this.version++;
    }
    if (player.reloadTime > this.previousReload + 0.0001) {
      this.reload = 0;
      this.shot = this.draw = Infinity;
    } else if (player.reloadTime === 0 && this.previousReload > dt * 2) this.reload = Infinity;
    this.previousReload = player.reloadTime;
  }
  fired() {
    this.version++;
    this.shot = 0;
    this.draw = this.reload = Infinity;
  }
  clock(out: PlayerAnimation = { phase: 0, air: 0, shot: null, draw: null, reload: null }) {
    const actions = weaponClips[this.previousWeapon] ?? {};
    const age = (name: "shoot" | "draw" | "reload", value: number) => {
      const duration = Math.max(
        actions[name]?.duration ?? 0,
        actions[name + "_crouch"]?.duration ?? 0,
      );
      return value < duration ? value : null;
    };
    out.phase = this.phase;
    out.air = this.air;
    out.shot = age("shoot", this.shot);
    out.draw = age("draw", this.draw);
    out.reload = age("reload", this.reload);
    return out;
  }
  private select(weapon: number) {
    if (weapon === this.weapon) return;
    for (const [name, action] of this.actions)
      if (name.startsWith("grip_") || name.startsWith("action_")) {
        action.stop();
        this.active.delete(action);
        this.mixer.uncacheAction(action.getClip());
        this.actions.delete(name);
      }
    const family = isKnife(weapon) ? "knife" : weaponSlot(weapon) === 2 ? "pistol" : "rifle";
    for (const stance of ["stand", "crouch"] as const) {
      const pose = grips[weapon]?.[stance];
      if (!pose) continue;
      const data = new T.AnimationClip(
        "grip_" + stance,
        1,
        Object.entries(pose.bones).flatMap(([bone, p]) => [
          new T.VectorKeyframeTrack(bone + ".position", [0], p.p),
          new T.QuaternionKeyframeTrack(bone + ".quaternion", [0], p.q),
        ]),
      );
      const reference = this.actions
        .get(`idle_${stance === "crouch" ? "crouch_" : ""}${family}`)!
        .getClip();
      T.AnimationUtils.makeClipAdditive(data, 0, reference);
      this.actions.set("grip_" + stance, this.mixer.clipAction(data));
    }
    for (const [name, raw] of Object.entries(weaponClips[weapon] ?? {})) {
      const data = raw.clone(),
        pose = grips[weapon]?.[name.includes("crouch") ? "crouch" : "stand"];
      const reference = pose
        ? new T.AnimationClip(
            "reference",
            1,
            Object.entries(pose.bones).flatMap(([bone, p]) => [
              new T.VectorKeyframeTrack(bone + ".position", [0], p.p),
              new T.QuaternionKeyframeTrack(bone + ".quaternion", [0], p.q),
            ]),
          )
        : this.actions.get("idle_" + family)!.getClip();
      T.AnimationUtils.makeClipAdditive(data, 0, reference);
      const action = this.mixer.clipAction(data);
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
      this.actions.set("action_" + name, action);
    }
    this.weapon = weapon;
  }
  private evaluate(player: HitboxPlayer, plant: number) {
    this.select(player.weapon);
    const yaw = player.yaw + Math.PI,
      c = T.MathUtils.clamp(
        (movement.standingEye - player.eye) / (movement.standingEye - movement.duckEye),
        0,
        1,
      );
    const speed = Math.hypot(player.vx, player.vz);
    const x = player.vx * Math.cos(yaw) - player.vz * Math.sin(yaw),
      z = player.vx * Math.sin(yaw) + player.vz * Math.cos(yaw);
    const family = isKnife(player.weapon)
      ? "knife"
      : weaponSlot(player.weapon) === 2
        ? "pistol"
        : "rifle";
    for (const a of this.active) a.setEffectiveWeight(0);
    const pose = (name: string, weight: number, progress?: number) => {
      const action = this.actions.get(name);
      if (!(weight > 0) || !action) return false;
      action.play().setEffectiveWeight(weight);
      action.time =
        progress === undefined
          ? this.time % action.getClip().duration
          : T.MathUtils.clamp(progress, 0, 1) * action.getClip().duration;
      this.active.add(action);
      return true;
    };
    if (plant > 0) pose("planting", 1, plant);
    else if (!player.grounded && player.ladder?.id == null) {
      const jumping = player.vertical > 0,
        name = `${jumping ? "jump_n" : "inair_stand"}_${family}`;
      const duration = this.actions.get(name)!.getClip().duration;
      pose(name, 1, jumping ? Math.min(1, this.air / duration) : (this.air % duration) / duration);
    } else
      for (const sample of characterLocomotion(speed, x, z, c))
        pose(`${sample.name}_${family}`, sample.weight, this.phase);
    if (!plant) {
      pose("grip_stand", 1 - c, 0);
      pose("grip_crouch", c, 0);
      for (const [name, elapsed] of [
        ["shoot", this.shot],
        ["reload", this.reload],
        ["draw", this.draw],
      ] as const) {
        const key = "action_" + name,
          action = this.actions.get(c > 0.5 ? key + "_crouch" : key) ?? this.actions.get(key);
        if (action && elapsed < action.getClip().duration) {
          pose(
            [...this.actions].find(([, a]) => a === action)![0],
            1,
            elapsed / action.getClip().duration,
          );
          break;
        }
      }
    }
    for (const a of this.active)
      if (a.getEffectiveWeight() <= 0) {
        a.stop();
        this.active.delete(a);
      }
    orderCharacterLayers(this.mixer, this.active);
    this.mixer.update(0);
    this.root.position.set(player.x, player.y, player.z);
    this.root.rotation.y = yaw;
    this.root.updateMatrixWorld(true);
  }
  capsules(player: HitboxPlayer, plant = 0, clock?: PlayerAnimation) {
    const override = clock
      ? `${clock.phase}/${clock.air}/${clock.shot}/${clock.draw}/${clock.reload}`
      : "current";
    const key = `${this.version}/${player.x}/${player.y}/${player.z}/${player.yaw}/${player.eye}/${player.weapon}/${player.vx}/${player.vz}/${player.grounded}/${plant}/${override}`;
    if (key !== this.evaluated) {
      const previous = [this.phase, this.air, this.shot, this.draw, this.reload];
      if (clock) {
        this.phase = clock.phase;
        this.air = clock.air;
        this.shot = clock.shot ?? Infinity;
        this.draw = clock.draw ?? Infinity;
        this.reload = clock.reload ?? Infinity;
      }
      this.evaluate(player, plant);
      [this.phase, this.air, this.shot, this.draw, this.reload] = previous;
      shapes.forEach((shape, i) => {
        const capsule = this.bound[i],
          matrix = this.bones[capsule.bone].matrixWorld;
        capsule.start.copy(shape.start).applyMatrix4(matrix);
        capsule.end.copy(shape.end).applyMatrix4(matrix);
        capsule.radius = shape.radius * matrix.getMaxScaleOnAxis();
      });
      this.evaluated = key;
    }
    return this.bound;
  }
  hit(player: HitboxPlayer, ray: T.Ray, maxDistance = Infinity, plant = 0) {
    const center = new T.Vector3(player.x, player.y + 0.9, player.z);
    if (ray.distanceSqToPoint(center) > 2.25 || center.distanceTo(ray.origin) > maxDistance + 1.5)
      return null;
    return tracePlayerCapsules(this.capsules(player, plant), ray, maxDistance);
  }
}
