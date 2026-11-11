import { expect, it, vi } from "vitest";
import * as T from "three";
import { animateSoldier, resetSoldier, type Soldier } from "./soldier";
import { Ragdoll } from "./ragdoll";
import native from "./data/native-ragdoll.json";
import { updateGloveModel } from "./gloves";
import { createWeaponInstance } from "./weapon-instance";

vi.mock("./gloves", () => ({ updateGloveModel: vi.fn() }));

function actor(): Soldier {
  const group = new T.Group();
  const model = new T.Group();
  group.add(model);
  const bones = native.profiles.ct.bodies.map((body) => {
    const bone = new T.Bone();
    bone.name = body.bone;
    bone.position.set(0, 1, 0);
    model.add(bone);
    return bone;
  });
  const rightHand = model.getObjectByName("hand_r")!;
  const leftHand = model.getObjectByName("hand_l")!;
  rightHand.position.x = 0.2;
  leftHand.position.set(-0.2, 1, -0.5);
  const weapon = new T.Group(),
    carriedBomb = new T.Group();
  group.add(weapon, carriedBomb);
  const mixer = new T.AnimationMixer(model);
  const idle = mixer.clipAction(new T.AnimationClip("idle_rifle", 1, [])).play();
  return {
    group,
    model,
    mixer,
    actions: { idle_rifle: idle },
    activeActions: new Set([idle]),
    head: model.getObjectByName("head_0")!,
    spine: model.getObjectByName("spine_2")!,
    hips: [model.getObjectByName("leg_upper_l")!, model.getObjectByName("leg_upper_r")!],
    team: "ct",
    animationTeam: "t",
    rightHand,
    leftHand,
    weapon,
    carriedBomb,
    weaponIndex: 2,
    weaponInstance: createWeaponInstance(2, "pose-test"),
    weaponCreator: "pose-test",
    suppressed: true,
    nativeGeneration: 0,
    disposed: false,
    grip: new T.Vector3(),
    support: new T.Vector3(),
    time: 0,
    dying: true,
    plant: 0,
    crouch: 0,
    recoil: 0,
    stride: 0,
    moveX: 0,
    moveZ: 0,
    phase: 0,
    airTime: 0,
    airborne: false,
    jumping: false,
    shotTime: 0,
    drawTime: 0,
    reloadTime: 0,
    nativeShotElapsed: Infinity,
    nativeDrawElapsed: Infinity,
    nativeReloadElapsed: Infinity,
    previousShotTime: 0,
    previousDrawTime: 0,
    previousReloadTime: 0,
    ragdollBones: bones,
  };
}

it.each([false, true])(
  "keeps corpse pose and glove refresh with sleeping=%s without posing hidden attachments",
  (sleeping) => {
    const soldier = actor();
    soldier.ragdoll = new Ragdoll(soldier.ragdollBones, new T.Vector3(), 0);
    soldier.ragdoll.points[0].position.set(2, 0.4, 3);
    soldier.ragdoll.sleeping = sleeping;
    const right = vi.spyOn(soldier.rightHand, "updateWorldMatrix");
    const left = vi.spyOn(soldier.leftHand, "updateWorldMatrix");
    const glovesBefore = vi.mocked(updateGloveModel).mock.calls.length;
    animateSoldier(soldier, 0, 1 / 60, false);
    expect(soldier.ragdoll.dirty).toBe(false);
    expect(soldier.group.position.toArray()).toEqual([2, -0.5, 3]);
    const point = soldier.ragdoll.points[0];
    const center = point.bone.localToWorld(point.center.clone());
    expect(center.distanceTo(point.position)).toBeLessThan(1e-10);
    const finalPose = soldier.ragdollBones.map((bone) => bone.matrixWorld.clone());
    animateSoldier(soldier, 0, 1 / 60, false);
    expect(soldier.ragdollBones.map((bone) => bone.matrixWorld)).toEqual(finalPose);
    expect(vi.mocked(updateGloveModel).mock.calls.length).toBe(glovesBefore + 2);
    expect(right).not.toHaveBeenCalled();
    expect(left).not.toHaveBeenCalled();
    expect(soldier.weapon.visible).toBe(false);
    expect(soldier.carriedBomb.visible).toBe(false);
  },
);

it("repositions and reveals the carried weapon when a corpse resets", () => {
  const soldier = actor();
  animateSoldier(soldier, 0, 1 / 60, false);
  soldier.weapon.position.set(99, 99, 99);
  resetSoldier(soldier);
  expect(soldier.dying).toBe(false);
  expect(soldier.weapon.visible).toBe(true);
  expect(soldier.carriedBomb.visible).toBe(false);
  expect(soldier.weapon.position.length()).toBeLessThan(3);
});

it("still attaches a visible planted bomb while the carried weapon is hidden", () => {
  const soldier = actor();
  soldier.plant = 0.5;
  animateSoldier(soldier, 0, 1 / 60, true);
  expect(soldier.weapon.visible).toBe(false);
  expect(soldier.carriedBomb.visible).toBe(true);
  const expected = soldier.grip.clone().lerp(soldier.support, 0.5);
  expected.y -= 0.025;
  expect(soldier.carriedBomb.position.distanceTo(expected)).toBeLessThan(1e-10);
  expect(soldier.carriedBomb.position.y).toBeCloseTo(0.975);
});
