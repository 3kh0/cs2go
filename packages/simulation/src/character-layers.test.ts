import { expect, test, vi } from "vitest";
import * as T from "three";
import { invalidateCharacterLayers, orderCharacterLayers } from "./character-layers";

function rig() {
  const bone = new T.Bone();
  bone.name = "hand";
  const mixer = new T.AnimationMixer(bone);
  const make = (name: string, axis: T.Vector3, angle: number, additive = false) => {
    const q = new T.Quaternion().setFromAxisAngle(axis, angle);
    const clip = new T.AnimationClip(
      name,
      1,
      [new T.QuaternionKeyframeTrack("hand.quaternion", [0, 1], [...q.toArray(), ...q.toArray()])],
      additive ? T.AdditiveAnimationBlendMode : T.NormalAnimationBlendMode,
    );
    return mixer.clipAction(clip);
  };
  return {
    bone,
    mixer,
    idle: make("idle", new T.Vector3(0, 0, 1), 0.2),
    walk: make("walk", new T.Vector3(0, 0, 1), 0.4),
    grip: make("grip_stand_7", new T.Vector3(1, 0, 0), 0.8, true),
    draw: make("agent_7_draw", new T.Vector3(0, 1, 0), -0.7, true),
  };
}

test("weapon and locomotion activation histories cannot reorder additive hand rotations", () => {
  const a = rig(),
    b = rig();
  a.idle.play();
  a.grip.play();
  a.draw.play();
  // Stopping the old normal action swaps Three's last active action into its
  // slot. This is the real weapon-transition path that reversed grip/draw.
  a.walk.play();
  a.idle.stop();
  b.walk.play();
  b.draw.play();
  b.grip.play();
  for (const r of [a, b]) {
    r.draw.time = 0.7673859;
    orderCharacterLayers(r.mixer, [r.walk, r.grip, r.draw]);
    expect(r.draw.time).toBe(0.7673859);
    r.mixer.update(0);
  }
  const expected = new T.Quaternion()
    .setFromAxisAngle(new T.Vector3(0, 0, 1), 0.4)
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), 0.8))
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -0.7));
  expect(a.bone.quaternion.angleTo(expected)).toBeLessThan(0.001);
  expect(a.bone.quaternion.angleTo(b.bone.quaternion)).toBeLessThan(0.001);
  const stop = a.mixer.stopAllAction.bind(a.mixer);
  let stops = 0;
  a.mixer.stopAllAction = () => {
    stops++;
    return stop();
  };
  orderCharacterLayers(a.mixer, [a.draw, a.walk, a.grip]);
  expect(stops).toBe(0);
  invalidateCharacterLayers(a.mixer);
  orderCharacterLayers(a.mixer, [a.draw, a.walk, a.grip]);
  expect(stops).toBe(1);
});

test("Set layer membership ignores insertion order and inactive extras without disturbing playback", () => {
  const r = rig();
  for (const action of [r.draw, r.walk, r.grip]) action.play();
  orderCharacterLayers(r.mixer, new Set([r.draw, r.walk, r.grip]));
  r.draw.time = 0.63;
  r.draw.paused = true;
  r.draw.setEffectiveWeight(0.4);
  r.idle.setEffectiveWeight(0);
  const stop = vi.spyOn(r.mixer, "stopAllAction");
  orderCharacterLayers(r.mixer, new Set([r.grip, r.idle, r.walk, r.draw]));
  expect(stop).not.toHaveBeenCalled();
  expect(r.draw.time).toBe(0.63);
  expect(r.draw.paused).toBe(true);
  expect(r.draw.getEffectiveWeight()).toBe(0.4);

  // Replacing a normal layer keeps the count, but requires canonical activation.
  r.walk.stop();
  r.idle.play().setEffectiveWeight(1);
  orderCharacterLayers(r.mixer, new Set([r.draw, r.idle, r.grip]));
  expect(stop).toHaveBeenCalledTimes(1);
  expect(r.draw.time).toBe(0.63);
  expect(r.draw.paused).toBe(true);
  expect(r.draw.getEffectiveWeight()).toBe(0.4);
  r.mixer.update(0);
  const expected = new T.Quaternion()
    .setFromAxisAngle(new T.Vector3(0, 0, 1), 0.2)
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), 0.8))
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -0.7 * 0.4));
  expect(r.bone.quaternion.angleTo(expected)).toBeLessThan(0.001);
});

test("Set layer caching respects edited clip ordering keys and invalidation", () => {
  const r = rig();
  const active = new Set([r.walk.play(), r.draw.play(), r.grip.play()]);
  orderCharacterLayers(r.mixer, active);
  const stop = vi.spyOn(r.mixer, "stopAllAction");
  r.grip.getClip().name = "zz_after_draw";
  orderCharacterLayers(r.mixer, active);
  expect(stop).toHaveBeenCalledTimes(1);
  r.mixer.update(0);
  const expected = new T.Quaternion()
    .setFromAxisAngle(new T.Vector3(0, 0, 1), 0.4)
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -0.7))
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), 0.8));
  expect(r.bone.quaternion.angleTo(expected)).toBeLessThan(0.001);
  invalidateCharacterLayers(r.mixer);
  orderCharacterLayers(r.mixer, active);
  expect(stop).toHaveBeenCalledTimes(2);
});

test("generic iterable duplicate layers retain the original activation behavior", () => {
  const r = rig();
  for (const action of [r.walk, r.grip, r.draw]) action.play();
  orderCharacterLayers(r.mixer, new Set([r.walk, r.grip, r.draw]));
  const play = vi.spyOn(r.grip, "play");
  orderCharacterLayers(r.mixer, [r.walk, r.grip, r.grip, r.draw]);
  expect(play).toHaveBeenCalledTimes(2);
  // A duplicated generic cache cannot satisfy a later unique Set membership.
  orderCharacterLayers(r.mixer, new Set([r.idle.play(), r.walk, r.grip, r.draw]));
  expect(play).toHaveBeenCalledTimes(3);
});
