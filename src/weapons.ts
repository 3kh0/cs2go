import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
const templates: T.Group[] = [];
const armTemplates = new Map<string, { scene: T.Group; clip: T.AnimationClip }>();
export async function loadWeaponModels() {
  const loader = new GLTFLoader();
  const models = await Promise.all(
    ["ak-47", "m4a1_s", "usp-s", "awp", "m9-bayonet"].map((name) =>
      loader.loadAsync(`/models/${name}.glb`),
    ),
  );
  await Promise.all(
    ["ground-rebel", "idf"].map(async (name) => {
      const asset = await loader.loadAsync(`/models/agents/${name}-arms.glb`);
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
export function createWorldGun(index: number) {
  return templates[index].clone(true);
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
    if (index === 4) {
      model.position.set(0.018, -0.04, 0.02);
      model.quaternion.setFromUnitVectors(
        new T.Vector3(0, 0, -1),
        new T.Vector3(-0.8, 0.4, -0.45).normalize(),
      );
    }
    group.add(model);
  }
  const template = armTemplates.get(team === "t" ? "ground-rebel" : "idf");
  // The initial constructor runs before assets finish loading.
  if (!template) return group;
  const arms = cloneSkeleton(template.scene) as T.Group;
  arms.name = "agent-view-arms";
  arms.rotation.y = Math.PI;
  arms.scale.multiplyScalar(1.35);
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
    // Close the trigger finger around the bayonet grip on the cloned rig.
    for (const name of team === "t"
      ? ["finger_index_0_R", "finger_index_1_R", "finger_index_2_R"]
      : ["ValveBipedBip01_R_Finger1", "ValveBipedBip01_R_Finger11", "ValveBipedBip01_R_Finger12"]) {
      arms.getObjectByName(name)?.rotateZ(team === "t" ? 0.9 : -0.9);
    }
  }
  arms.updateMatrixWorld(true);
  const rightRest = new T.Vector3(
    0.018,
    index === 2 || index === 4 ? -0.065 : -0.12,
    [-0.14, -0.14, 0.085, -0.14, 0.02][index],
  );
  const leftRest = new T.Vector3(
    index === 4 ? -0.34 : -0.024,
    -0.075,
    [-0.51, -0.43, 0.04, -0.48, -0.02][index],
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
    const gripRotation = wrist.getWorldQuaternion(new T.Quaternion());
    const upperLength = upper
      .getWorldPosition(new T.Vector3())
      .distanceTo(fore.getWorldPosition(new T.Vector3()));
    const foreLength = fore
      .getWorldPosition(new T.Vector3())
      .distanceTo(wrist.getWorldPosition(new T.Vector3()));
    return {
      hand,
      shoulder: new T.Vector3(side < 0 ? -0.42 : 0.13, -0.32, side < 0 ? 0.04 : 0.24),
      upper,
      fore,
      wrist,
      rest,
      upperAxis: fore.position.clone().normalize(),
      foreAxis: wrist.position.clone().normalize(),
      gripRotation,
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
  rigs.set(group, { index, left, right, bolt, magazine });
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
  upperLength: number;
  foreLength: number;
};
type Rig = { index: number; left: Arm; right: Arm; bolt?: T.Object3D; magazine?: T.Object3D };
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
  wristRotation = new T.Quaternion();
function poseArm(arm: Arm, target: T.Vector3, side: number) {
  arm.hand.position.copy(target);
  // Analytic two-bone IK keeps the original weighted mesh and bone lengths.
  // Solve in weapon space so simulation tracks retain magazine/bolt contacts.
  const distance = arm.shoulder.distanceTo(target);
  const reach = Math.min(distance, arm.upperLength + arm.foreLength - 0.001);
  const along = (arm.upperLength ** 2 - arm.foreLength ** 2 + reach ** 2) / (2 * reach);
  const bend = Math.sqrt(Math.max(0, arm.upperLength ** 2 - along ** 2));
  delta.copy(target).sub(arm.shoulder).normalize();
  elbow
    .set(side * 0.65, -1, 0)
    .addScaledVector(delta, -delta.dot(elbow))
    .normalize()
    .multiplyScalar(bend)
    .addScaledVector(delta, along)
    .add(arm.shoulder);
  const group = arm.hand.parent!;
  group.updateWorldMatrix(true, true);
  parentInverse.copy(arm.upper.parent!.matrixWorld).invert();
  arm.upper.position.copy(arm.shoulder).applyMatrix4(group.matrixWorld).applyMatrix4(parentInverse);
  delta
    .copy(elbow)
    .applyMatrix4(group.matrixWorld)
    .applyMatrix4(parentInverse)
    .sub(arm.upper.position)
    .normalize();
  arm.upper.quaternion.setFromUnitVectors(arm.upperAxis, delta);
  arm.upper.updateWorldMatrix(false, true);
  parentInverse.copy(arm.fore.parent!.matrixWorld).invert();
  delta
    .copy(target)
    .applyMatrix4(group.matrixWorld)
    .applyMatrix4(parentInverse)
    .sub(arm.fore.position)
    .normalize();
  arm.fore.quaternion.setFromUnitVectors(arm.foreAxis, delta);
  arm.fore.updateWorldMatrix(false, true);
  arm.wrist.parent!.getWorldQuaternion(rotation).invert();
  group.getWorldQuaternion(wristRotation).multiply(arm.gripRotation).multiply(arm.hand.quaternion);
  arm.wrist.quaternion.copy(rotation).multiply(wristRotation);
  arm.wrist.updateWorldMatrix(false, true);
}
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
  const { index, left, right, bolt, magazine } = rig;
  const p = pose.reload,
    drawing = pose.draw * pose.draw * (3 - 2 * pose.draw);
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
    0.26 + pose.sway - tilt * 0.075,
    -0.25 + pose.bob - pose.recoil * 0.3 - drawing * 0.34,
    -0.48 + pose.recoil + drawing * 0.18,
  );
  group.rotation.set(
    pose.recoil * 0.6 + drawing * -0.65 + tilt * 0.12,
    -0.045 + tilt * (index === 2 ? 0.25 : 0.12),
    tilt * -0.32 + drawing * -0.45,
  );
  targetLeft.copy(left.rest);
  targetRight.copy(right.rest);
  left.hand.rotation.set(0, 0, 0);
  right.hand.rotation.set(0, 0, 0);
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
      contact.copy(magazine.position).add(new T.Vector3(-0.035, -0.01, 0.015));
      targetLeft.lerp(contact, hold);
      left.hand.rotation.z = hold * -0.35;
    }
  }
  if (bolt) {
    bolt.position.copy(bolt.userData.restPosition);
    bolt.rotation.set(0, 0, 0);
    let action = pose.bolt;
    if (p > 0) action = T.MathUtils.clamp((p - 0.68) / 0.29, 0, 1);
    else if (drawing > 0 && index !== 3)
      action = T.MathUtils.clamp((1 - drawing - 0.18) / 0.68, 0, 1);
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
      contact.set(0.056, -0.021, 0.0).applyEuler(bolt.rotation).add(bolt.position);
      targetRight.lerp(contact, reach);
      right.hand.rotation.z = unlock * 0.7;
      group.rotation.z -= reach * 0.05;
    } else {
      contact
        .copy(bolt.position)
        .add(new T.Vector3(index === 0 ? 0.05 : -0.04, 0.035, index === 2 ? 0.065 : -0.25));
      targetLeft.lerp(contact, reach);
      left.hand.rotation.z -= reach * 0.6;
    }
  }
  if (index === 4) {
    const strike = Math.sin(Math.PI * T.MathUtils.clamp((pose.knife ?? 0) / 0.65, 0, 1));
    group.position.x += pose.stab ? -strike * 0.09 : -strike * 0.25;
    group.position.z -= strike * (pose.stab ? 0.3 : 0.1);
    group.rotation.z += 0.22 - strike * (pose.stab ? 0.15 : 0.65);
    group.rotation.x += -0.35 + strike * 0.2;
    // The off hand stays open beside the blade, rather than gripping its edge.
    targetLeft.set(-0.32, -0.07, -0.01);
    right.hand.rotation.set(0, 0.85, 0.2);
  }
  poseArm(left, targetLeft, -1);
  poseArm(right, targetRight, 1);
}
