import { expect, test } from "vitest";
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
