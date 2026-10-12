import * as T from "three";
import { gltf } from "./gltf";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export const DRAW_DURATION = 0.55;
export const VIEWMODEL_FOV = 60;
export const DRAW_ACTION_START = 0.18;
export const DRAW_ACTION_LENGTH = 0.68;
export const DRAW_PULL_CUE = DRAW_ACTION_START + DRAW_ACTION_LENGTH * 0.3;
export const DRAW_RELEASE_CUE = DRAW_ACTION_START + DRAW_ACTION_LENGTH * 0.65;
const templates: T.Group[] = [];
const armTemplates = new Map<string, { scene: T.Group; clip: T.AnimationClip }>();
export async function loadWeaponModels() {
  const models = await Promise.all(
    ["ak-47", "m4a1_s", "usp-s", "awp", "m9-bayonet"].map((name) =>
      gltf.loadAsync(`/models/${name}.glb`),
    ),
  );
  await Promise.all(
    ["ground-rebel", "idf"].map(async (name) => {
      const asset = await gltf.loadAsync(`/models/agents/${name}-arms.glb`);
      armTemplates.set(name, {
        scene: asset.scene,
        clip: asset.animations.find((a) => a.name.endsWith("idle_rifle")) || asset.animations[0],
      });
    }),
  );
  models.forEach((model, index) => {
    templates[index] = model.scene;
  });
}
// SkeletonUtils gives every skinned part its own skeleton copy. Parts bound to
// identical bones share one, so each rig uploads a single bone texture per frame.
export function shareSkeletons(root: T.Object3D) {
  const skeletons: T.Skeleton[] = [];
  root.traverse((object) => {
    if (!(object instanceof T.SkinnedMesh)) return;
    const own = object.skeleton;
    const match = skeletons.find(
      (s) =>
        s.bones.length === own.bones.length &&
        s.bones.every(
          (bone, i) => bone === own.bones[i] && s.boneInverses[i].equals(own.boneInverses[i]),
        ),
    );
    if (!match) skeletons.push(own);
    else {
      own.dispose();
      object.bind(match, object.bindMatrix);
    }
  });
}
// Carried guns are rigid, so their parts are merged into one draw per material.
const worldGuns: T.Group[] = [];
const relative = new T.Matrix4();
function mergeWorldGun(source: T.Group) {
  source.updateMatrixWorld(true);
  const inverse = source.matrixWorld.clone().invert();
  const parts = new Map<T.Material, T.BufferGeometry[]>();
  let plain = true;
  source.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const position = object.geometry.getAttribute("position");
    if (
      Array.isArray(object.material) ||
      !(position instanceof T.BufferAttribute) ||
      position.normalized
    )
      plain = false;
    else {
      relative.multiplyMatrices(inverse, object.matrixWorld);
      const list = parts.get(object.material) ?? [];
      list.push(object.geometry.clone().applyMatrix4(relative));
      parts.set(object.material, list);
    }
  });
  const meshes = [...parts].map(([material, list]) => {
    const geometry = list.length > 1 ? mergeGeometries(list) : list[0];
    return geometry && new T.Mesh(geometry, material);
  });
  if (!plain || meshes.some((mesh) => !mesh)) return source;
  const group = new T.Group();
  source.matrix.decompose(group.position, group.quaternion, group.scale);
  group.add(...(meshes as T.Mesh[]));
  return group;
}
export function createWorldGun(index: number) {
  worldGuns[index] ??= mergeWorldGun(templates[index]);
  return worldGuns[index].clone(true);
}
export function createGun(index: number, team: "t" | "ct" = "ct") {
  const group = new T.Group();
  group.userData.muzzle = new T.Vector3(0, 0.015, -0.9);
  if (templates[index]) {
    const model = templates[index].clone(true);
    model.traverse((child) => {
      if (child instanceof T.Mesh) {
        child.geometry = child.geometry.clone();
        child.material = Array.isArray(child.material)
          ? child.material.map((m) => m.clone())
          : child.material.clone();
      }
    });
    model.name = "weapon-model";
    group.add(model);
  }
  const template = armTemplates.get(team === "t" ? "ground-rebel" : "idf");
  // The initial constructor runs before assets finish loading.
  if (!template) return group;
  const arms = cloneSkeleton(template.scene) as T.Group;
  arms.name = "agent-view-arms";
  arms.rotation.y = Math.PI;
  // Normalize the two source rigs to the same palm size, not their different
  // world-model export scales. Oversized palms could never fit these grips.
  arms.scale.multiplyScalar(team === "t" ? 0.72 : 0.94);
  shareSkeletons(arms);
  arms.traverse((object) => {
    if (object instanceof T.Mesh) {
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material)
        ? object.material.map((m) => m.clone())
        : object.material.clone();
      object.frustumCulled = false;
    }
  });
  group.add(arms);
  const mixer = new T.AnimationMixer(arms);
  mixer.clipAction(template.clip).play();
  mixer.update(0);
  if (index === 4) {
    for (let joint = 0; joint < 3; joint++) {
      const indexBone = arms.getObjectByName(
        team === "t" ? `finger_index_${joint}_R` : `ValveBipedBip01_R_Finger1${joint || ""}`,
      );
      const middleBone = arms.getObjectByName(
        team === "t" ? `finger_middle_${joint}_R` : `ValveBipedBip01_R_Finger2${joint || ""}`,
      );
      if (indexBone && middleBone) indexBone.quaternion.copy(middleBone.quaternion);
    }
    arms.traverse((bone) => {
      if (
        bone instanceof T.Bone &&
        (team === "t"
          ? /finger_(index|middle|ring|pinky)_[012]_L/.test(bone.name)
          : /_L_Finger[12]/.test(bone.name))
      )
        bone.quaternion.slerp(new T.Quaternion(), 0.3);
    });
  }
  arms.updateMatrixWorld(true);
  const rightRest = new T.Vector3(
    0.032,
    [-0.025, -0.055, -0.035, -0.075, 0.035][index],
    [-0.06, -0.065, 0.17, -0.07, -0.035][index],
  );
  const leftRest = new T.Vector3(
    index === 2 ? -0.035 : -0.07,
    [0.05, 0.015, -0.055, -0.05, -0.04][index],
    [-0.46, -0.43, 0.17, -0.46, -0.07][index],
  );
  function arm(side: number, rest: T.Vector3): Arm {
    const hand = new T.Group();
    hand.name = side < 0 ? "left-hand" : "right-hand";
    group.add(hand);
    const suffix = side < 0 ? "L" : "R";
    const upper = arms.getObjectByName(
      team === "t" ? `arm_upper_${suffix}` : `ValveBipedBip01_${suffix}_UpperArm`,
    )! as T.Bone;
    const fore = arms.getObjectByName(
      team === "t" ? `arm_lower_${suffix}` : `ValveBipedBip01_${suffix}_Forearm`,
    )! as T.Bone;
    const wrist = arms.getObjectByName(
      team === "t" ? `hand_${suffix}` : `ValveBipedBip01_${suffix}_Hand`,
    )! as T.Bone;
    // First-person forearms need reach without enlarging the palms. Extending
    // the hidden upper arm keeps the source mesh's cut sleeve below the frame.
    fore.position.multiplyScalar(1.45);
    wrist.position.multiplyScalar(1.25);
    arms.updateMatrixWorld(true);
    // Source 1 and Source 2 hands use different mirrored bone axes.
    // Build a palm frame explicitly: knuckles forward, palm toward the grip.
    const forward = new T.Vector3(side < 0 ? 1 : 0, 0, side < 0 ? 0 : -1);
    const normal = new T.Vector3(side < 0 ? 0 : -1, side < 0 ? 1 : 0, 0);
    const x = forward.multiplyScalar(team === "t" && side > 0 ? -1 : 1);
    const y = normal.multiplyScalar(team === "t" && side < 0 ? 1 : -1);
    const gripRotation = new T.Quaternion().setFromRotationMatrix(
      new T.Matrix4().makeBasis(x, y, new T.Vector3().crossVectors(x, y)),
    );
    const upperLength = upper
      .getWorldPosition(new T.Vector3())
      .distanceTo(fore.getWorldPosition(new T.Vector3()));
    const foreLength = fore
      .getWorldPosition(new T.Vector3())
      .distanceTo(wrist.getWorldPosition(new T.Vector3()));
    return {
      hand,
      shoulder: new T.Vector3(side < 0 ? -0.42 : 0.24, -0.45, 0.1),
      upper,
      fore,
      wrist,
      rest,
      upperAxis: fore.position.clone().normalize(),
      foreAxis: wrist.position.clone().normalize(),
      gripRotation,
      upperRest: upper.quaternion.clone(),
      foreRest: fore.quaternion.clone(),
      wristRest: wrist.quaternion.clone(),
      upperLength,
      foreLength,
    };
  }
  const left = arm(-1, leftRest),
    right = arm(1, rightRest);
  const source = templates[index]?.children[0];
  group.userData.muzzle = new T.Vector3().fromArray(source?.userData.muzzle || [0, 0.015, -0.9]);
  const bolt = group.getObjectByName("bolt"),
    magazine = group.getObjectByName("magazine");
  if (bolt) {
    bolt.userData.restPosition = bolt.position.clone();
    // The static OBJ only exposes the external action. A coaxial shaft keeps
    // the withdrawing AWP bolt physically inside the receiver throughout travel.
    if (index === 3) {
      const shaft = new T.Mesh(
        new T.CylinderGeometry(0.009, 0.009, 0.15, 12),
        new T.MeshStandardMaterial({ color: 0x454a4b, metalness: 0.8, roughness: 0.3 }),
      );
      shaft.name = "bolt-shaft";
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = -0.06;
      bolt.add(shaft);
    }
  }
  if (magazine) magazine.userData.restPosition = magazine.position.clone();
  rigs.set(group, {
    index,
    left,
    right,
    bolt,
    magazine,
    model: group.getObjectByName("weapon-model")!,
  });
  animateGun(group, { reload: 0, draw: 0, bolt: 0, recoil: 0, bob: 0, sway: 0 });
  return group;
}

type Arm = {
  hand: T.Group;
  shoulder: T.Vector3;
  rest: T.Vector3;
  upper: T.Bone;
  fore: T.Bone;
  wrist: T.Bone;
  upperAxis: T.Vector3;
  foreAxis: T.Vector3;
  gripRotation: T.Quaternion;
  upperRest: T.Quaternion;
  foreRest: T.Quaternion;
  wristRest: T.Quaternion;
  upperLength: number;
  foreLength: number;
};
type Rig = {
  index: number;
  left: Arm;
  right: Arm;
  bolt?: T.Object3D;
  magazine?: T.Object3D;
  model: T.Object3D;
};
const rigs = new WeakMap<T.Group, Rig>();
const elbow = new T.Vector3(),
  delta = new T.Vector3();
const targetLeft = new T.Vector3(),
  targetRight = new T.Vector3(),
  contact = new T.Vector3();
// Piecewise cubic easing gives deliberate contact holds and quick mechanical
// strokes. Sampling absolute simulation progress makes pause/cancel deterministic.
function track(p: number, keys: number[][]) {
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i][0]) {
      const a = keys[i - 1],
        b = keys[i];
      const t = T.MathUtils.clamp((p - a[0]) / (b[0] - a[0]), 0, 1);
      return T.MathUtils.lerp(a[1], b[1], t * t * (3 - 2 * t));
    }
  }
  return keys[keys.length - 1][1];
}
const parentInverse = new T.Matrix4(),
  rotation = new T.Quaternion(),
  wristRotation = new T.Quaternion(),
  boneAxis = new T.Vector3(),
  shoulder = new T.Vector3(),
  twist = new T.Quaternion();
function poseArm(arm: Arm, target: T.Vector3, side: number) {
  arm.hand.position.copy(target);
  // Analytic two-bone IK keeps the original weighted mesh and bone lengths.
  // Solve in weapon space so simulation tracks retain magazine/bolt contacts.
  shoulder.copy(arm.shoulder);
  const distance = shoulder.distanceTo(target);
  const reach = Math.min(distance, arm.upperLength + arm.foreLength - 0.001);
  // Permit the hidden shoulder to follow extreme reaches. Clamping only the
  // elbow left the actual skinned wrist short of its magazine/knife target.
  if (distance > reach) shoulder.lerp(target, (distance - reach) / distance);
  const along = (arm.upperLength ** 2 - arm.foreLength ** 2 + reach ** 2) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, arm.upperLength ** 2 - along ** 2));
  delta.copy(target).sub(shoulder).normalize();
  elbow
    .set(side * 0.65, -1, 0)
    .addScaledVector(delta, -delta.dot(elbow))
    .normalize()
    .multiplyScalar(bend)
    .addScaledVector(delta, along)
    .add(shoulder);
  const group = arm.hand.parent!;
  group.updateWorldMatrix(true, true);
  parentInverse.copy(arm.upper.parent!.matrixWorld).invert();
  arm.upper.position.copy(shoulder).applyMatrix4(group.matrixWorld).applyMatrix4(parentInverse);
  delta
    .copy(elbow)
    .applyMatrix4(group.matrixWorld)
    .applyMatrix4(parentInverse)
    .sub(arm.upper.position)
    .normalize();
  arm.upper.quaternion
    .setFromUnitVectors(boneAxis.copy(arm.upperAxis).applyQuaternion(arm.upperRest), delta)
    .multiply(arm.upperRest);
  arm.upper.updateWorldMatrix(false, true);
  parentInverse.copy(arm.fore.parent!.matrixWorld).invert();
  delta
    .copy(target)
    .applyMatrix4(group.matrixWorld)
    .applyMatrix4(parentInverse)
    .sub(arm.fore.position)
    .normalize();
  arm.fore.quaternion
    .setFromUnitVectors(boneAxis.copy(arm.foreAxis).applyQuaternion(arm.foreRest), delta)
    .multiply(arm.foreRest);
  arm.fore.updateWorldMatrix(false, true);
  group.getWorldQuaternion(wristRotation).multiply(arm.hand.quaternion).multiply(arm.gripRotation);
  arm.fore.getWorldQuaternion(rotation).invert();
  twist.copy(arm.wristRest).invert();
  rotation.multiply(wristRotation).multiply(twist);
  const roll =
    rotation.x * arm.foreAxis.x + rotation.y * arm.foreAxis.y + rotation.z * arm.foreAxis.z;
  twist
    .set(arm.foreAxis.x * roll, arm.foreAxis.y * roll, arm.foreAxis.z * roll, rotation.w)
    .normalize();
  arm.fore.quaternion.multiply(twist);
  arm.fore.updateWorldMatrix(false, true);
  arm.wrist.parent!.getWorldQuaternion(rotation).invert();
  arm.wrist.quaternion.copy(rotation).multiply(wristRotation);
  arm.wrist.updateWorldMatrix(false, true);
}
// Offsets from each weapon's ready pose: time, translation, pitch/yaw/roll.
// The rifle rolls expose the action to the support hand; the pistol leads with
// its muzzle; the heavy AWP seats without unnecessarily cycling the bolt.
const drawTracks = [
  [
    [0, 0.08, -0.42, 0.16, 0.55, -0.22, 0.8],
    [0.24, -0.035, -0.04, 0.02, 0.28, -0.1, 0.65],
    [0.57, -0.045, 0.015, 0, 0.19, -0.08, 0.58],
    [0.86, 0.004, -0.005, 0, -0.015, 0.006, -0.025],
    [1, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0.06, -0.42, 0.14, 0.7, 0.08, -0.24],
    [0.26, -0.025, -0.015, 0.015, 0.34, 0.04, -0.14],
    [0.57, -0.03, 0.015, 0, 0.22, 0.02, -0.1],
    [0.88, 0.002, -0.006, 0, -0.015, 0, 0.012],
    [1, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0.03, -0.4, 0.06, 0.8, -0.22, 0.24],
    [0.28, -0.025, 0.025, -0.025, 0.48, -0.16, 0.15],
    [0.58, -0.015, 0.01, -0.02, 0.28, -0.1, 0.08],
    [0.87, 0.003, -0.004, 0, -0.02, 0, -0.014],
    [1, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0.12, -0.43, 0.15, 0.18, 0.2, -0.38],
    [0.35, 0.015, -0.035, 0.015, 0.06, 0.07, -0.14],
    [0.68, -0.005, 0.012, -0.008, 0.012, -0.012, 0.025],
    [1, 0, 0, 0, 0, 0, 0],
  ],
];
function drawComponent(index: number, t: number, component: number) {
  const keys = drawTracks[index];
  for (let i = 1; i < keys.length; i++) {
    if (t > keys[i][0]) continue;
    const a = keys[i - 1],
      b = keys[i];
    const u = T.MathUtils.clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
    return T.MathUtils.lerp(a[component], b[component], u * u * (3 - 2 * u));
  }
  return 0;
}
function palmRotation(forward: T.Vector3, normal: T.Vector3) {
  forward.normalize();
  normal.addScaledVector(forward, -normal.dot(forward)).normalize();
  return new T.Quaternion().setFromRotationMatrix(
    new T.Matrix4().makeBasis(forward, normal, new T.Vector3().crossVectors(forward, normal)),
  );
}
const slashTrack = [
  [0, 0],
  [0.07, -0.06],
  [0.2, 1],
  [0.36, 0.92],
  [0.74, 0.12],
  [1, 0],
];
const stabTrack = [
  [0, 0],
  [0.09, -0.1],
  [0.18 / 0.85, 1],
  [0.31, 1],
  [0.75, 0.12],
  [1, 0],
];
const stabRotation = new T.Quaternion().setFromEuler(new T.Euler(-1.45, 0.12, 0.12));
const guardRotation = palmRotation(new T.Vector3(0.8, 0.15, -0.58), new T.Vector3(0, -0.6, -0.8));
const pistolSupport = palmRotation(new T.Vector3(0, 0, -1), new T.Vector3(1, 0, 0));
const reloadGrip = palmRotation(new T.Vector3(0.8, 0.55, 0), new T.Vector3(0, 0, -1));
const actionGrip = palmRotation(new T.Vector3(0.3, 0, -1), new T.Vector3(0, -1, 0));
const knifeBasis = new T.Quaternion()
  .setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2)
  .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2));
export type GunPose = {
  reload: number;
  draw: number;
  bolt: number;
  recoil: number;
  bob: number;
  sway: number;
  knife?: number;
  stab?: boolean;
};
export function animateGun(group: T.Group, pose: GunPose) {
  const rig = rigs.get(group);
  if (!rig) return;
  const { index, left, right, bolt, magazine, model } = rig;
  const p = pose.reload,
    drawing = T.MathUtils.clamp(pose.draw, 0, 1);
  const tilt =
    p > 0
      ? track(p, [
          [0, 0],
          [0.1, 1],
          [0.68, 1],
          [0.84, 0.7],
          [1, 0],
        ])
      : 0;
  group.position.set(
    (index === 2 ? 0.19 : 0.24) + pose.sway - tilt * 0.075,
    (index === 2 ? -0.18 : -0.215) + pose.bob - pose.recoil * 0.3,
    (index === 2 ? -0.53 : index === 4 ? -0.5 : -0.42) + pose.recoil,
  );
  group.rotation.set(
    pose.recoil * 0.6 + tilt * 0.12,
    (index === 2 ? -0.045 : 0.1) + tilt * (index === 2 ? 0.25 : 0.12),
    tilt * -0.32,
  );
  if (drawing > 0 && index < 4) {
    const t = 1 - drawing;
    group.position.x += drawComponent(index, t, 1);
    group.position.y += drawComponent(index, t, 2);
    group.position.z += drawComponent(index, t, 3);
    group.rotation.x += drawComponent(index, t, 4);
    group.rotation.y += drawComponent(index, t, 5);
    group.rotation.z += drawComponent(index, t, 6);
  }
  targetLeft.copy(left.rest);
  targetRight.copy(right.rest);
  left.hand.rotation.set(0, 0, 0);
  right.hand.rotation.set(0, 0, 0);
  if (index === 2) left.hand.quaternion.copy(pistolSupport);
  if (magazine) {
    magazine.position.copy(magazine.userData.restPosition);
    magazine.rotation.set(0, 0, 0);
    magazine.visible = true;
    if (p > 0) {
      const drop = track(p, [
        [0, 0],
        [0.13, 0],
        [0.28, 1],
        [0.4, 1],
        [0.5, 0],
        [1, 0],
      ]);
      magazine.position.y -= drop * (index === 2 ? 0.23 : 0.28);
      magazine.position.x -= drop * 0.035;
      magazine.position.z += drop * 0.035;
      if (index === 0) magazine.rotation.x = drop * -0.28; // Rock AK magazine out/in.
      magazine.visible = !(p > 0.3 && p < 0.39);
      const hold = track(p, [
        [0, 0],
        [0.1, 1],
        [0.52, 1],
        [0.66, 0],
        [1, 0],
      ]);
      contact.copy(magazine.position);
      contact.x -= 0.055;
      contact.y -= 0.015;
      contact.z += 0.015;
      targetLeft.lerp(contact, hold);
      left.hand.quaternion.slerp(reloadGrip, hold);
    }
  }
  if (bolt) {
    bolt.position.copy(bolt.userData.restPosition);
    bolt.rotation.set(0, 0, 0);
    let action = pose.bolt;
    if (p > 0) action = T.MathUtils.clamp((p - 0.68) / 0.29, 0, 1);
    else if (drawing > 0 && index !== 3)
      action = T.MathUtils.clamp((1 - drawing - DRAW_ACTION_START) / DRAW_ACTION_LENGTH, 0, 1);
    const pull =
      action > 0
        ? track(action, [
            [0, 0],
            [0.3, 0],
            [0.47, 1],
            [0.65, 1],
            [0.83, 0],
            [1, 0],
          ])
        : 0;
    const unlock =
      action > 0
        ? track(action, [
            [0, 0],
            [0.18, 0],
            [0.3, 1],
            [0.83, 1],
            [0.95, 0],
            [1, 0],
          ])
        : 0;
    bolt.position.z += pull * (index === 3 ? 0.07 : index === 2 ? 0.035 : 0.045);
    if (index === 3) bolt.rotation.z = unlock * 1.08;
    if (index === 2 && !p && !drawing)
      bolt.position.z += T.MathUtils.clamp(pose.recoil / 0.07, 0, 1) * 0.035;
    const reach =
      action > 0
        ? track(action, [
            [0, 0],
            [0.16, 1],
            [0.93, 1],
            [1, 0],
          ])
        : 0;
    if (index === 3) {
      contact.set(0.056, -0.021, 0.065).applyEuler(bolt.rotation).add(bolt.position);
      targetRight.lerp(contact, reach);
      right.hand.rotation.z = unlock * 0.7;
      group.rotation.z -= reach * 0.05;
    } else {
      contact
        .set(
          index === 0 ? 0.008 : -0.035,
          index === 0 ? 0.11 : index === 1 ? 0.09 : 0.11,
          index === 0 ? -0.285 : index === 1 ? -0.08 : 0.16,
        )
        .add(bolt.position);
      targetLeft.lerp(contact, reach);
      // Lift over the receiver instead of interpolating straight through it.
      targetLeft.y += Math.sin(reach * Math.PI) * 0.055;
      left.hand.quaternion.slerp(actionGrip, reach);
    }
  }
  if (index === 4) {
    const t = 1 - pose.draw;
    // M9: lift the blade upright, turn the wrist, then settle in forward grip.
    const lift =
      pose.draw > 0
        ? track(t, [
            [0, -0.42],
            [0.2, -0.3],
            [0.48, 0.065],
            [0.72, 0.015],
            [1, 0],
          ])
        : 0;
    const roll =
      pose.draw > 0
        ? track(t, [
            [0, -0.35],
            [0.25, -0.15],
            [0.48, 0.05],
            [0.8, 1.18],
            [1, 1.12],
          ])
        : 1.12;
    // Impact poses coincide with the simulation's 100 ms slash / 180 ms stab.
    const strike = track(pose.knife ?? 0, pose.stab ? stabTrack : slashTrack);
    group.position.set(0.24 + pose.sway, -0.24 + pose.bob, -0.5);
    group.rotation.set(0, -0.045, 0);
    targetRight.set(
      0.025 - strike * (pose.stab ? 0.2 : 0.26),
      0.035 + lift,
      -0.035 - strike * (pose.stab ? 0.32 : 0.12),
    );
    right.hand.rotation.set(0.2 + strike * 0.35, 0.35, roll - strike * 0.9);
    if (pose.stab) right.hand.quaternion.slerp(stabRotation, Math.max(0, strike));
    model.position.set(-0.018, 0, -0.055).applyQuaternion(right.hand.quaternion).add(targetRight);
    model.quaternion.copy(right.hand.quaternion).multiply(knifeBasis);
    // Relaxed guard hand returns a little behind the dominant wrist.
    const guard =
      pose.draw > 0
        ? track(t, [
            [0, 0.3],
            [0.4, 0.3],
            [0.8, -0.012],
            [1, 0],
          ])
        : 0;
    targetLeft.set(-0.42, -0.04 - guard, -0.07);
    left.hand.quaternion.copy(guardRotation);
    targetLeft.y -= Math.max(0, strike) * 0.035;
  }
  poseArm(left, targetLeft, -1);
  poseArm(right, targetRight, 1);
}
