import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { createWorldGun } from "./weapons";

export type AgentTeam = "t" | "ct";
type Template = { scene: T.Group; animations: T.AnimationClip[] };
const templates = new Map<AgentTeam, Template>();
export async function loadSoldierModels() {
  const loader = new GLTFLoader();
  await Promise.all(
    (["t", "ct"] as const).map(async (team) => {
      const model = await loader.loadAsync(
        `/models/agents/${team === "t" ? "ground-rebel" : "idf"}.glb`,
      );
      templates.set(team, model);
    }),
  );
}
type LooseJoint = {
  bone: T.Object3D;
  rest: T.Quaternion;
  base: T.Quaternion;
  angle: T.Vector3;
  velocity: T.Vector3;
  target: T.Vector3;
};
export type Soldier = {
  group: T.Group;
  model: T.Group;
  mixer: T.AnimationMixer;
  actions: Record<string, T.AnimationAction>;
  head: T.Object3D;
  spine: T.Object3D;
  hips: T.Object3D[];
  team: AgentTeam;
  recoil: number;
  stride: number;
  moveX: number;
  moveZ: number;
  time: number;
  dying: boolean;
  fallTime: number;
  fallVelocity: number;
  fallRoll: number;
  joints: LooseJoint[];
  contacts: T.Object3D[];
  phase: number;
  weapon: T.Group;
  weaponIndex: number;
  rightHand: T.Object3D;
  leftHand: T.Object3D;
  grip: T.Vector3;
  support: T.Vector3;
};
export function disposeSoldier(soldier: Soldier) {
  soldier.mixer.stopAllAction();
  soldier.mixer.uncacheRoot(soldier.model);
  const skeletons = new Set<T.Skeleton>();
  soldier.model.traverse((object) => {
    if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton);
  });
  skeletons.forEach((skeleton) => skeleton.dispose());
}
export function createSoldier(index: number, team: AgentTeam = "t"): Soldier {
  const template = templates.get(team)!;
  const group = new T.Group();
  group.name = team === "t" ? "Ground Rebel | Elite Crew" : "IDF";
  const model = clone(template.scene) as T.Group;
  group.add(model);
  const bone = (t: string, ct: string) => model.getObjectByName(team === "t" ? t : ct)!;
  const head = bone("head_0", "ValveBipedBip01_Head1");
  const spine = bone("spine_3", "ValveBipedBip01_Spine4");
  const hips = [
    bone("leg_upper_L", "ValveBipedBip01_L_Thigh"),
    bone("leg_upper_R", "ValveBipedBip01_R_Thigh"),
  ];
  model.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = o.receiveShadow = true;
      o.userData.bot = index;
      // Animated bounds differ from the bind pose, particularly while falling.
      o.frustumCulled = false;
    }
  });
  const mixer = new T.AnimationMixer(model);
  const actions: Record<string, T.AnimationAction> = {};
  for (const clip of template.animations) {
    const action = mixer.clipAction(clip);
    action.play().setEffectiveWeight(0);
    actions[clip.name] = action;
  }
  actions.idle_rifle.setEffectiveWeight(1);
  mixer.update(0);
  // Size and ground the sampled rifle stance, rather than its taller bind pose.
  model.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(model, true);
  const scale = 1.8 / (bounds.max.y - bounds.min.y);
  model.scale.setScalar(scale);
  model.position.y = -bounds.min.y * scale;

  const weapon = createWorldGun(2);
  const rightHand = bone("hand_R", "ValveBipedBip01_R_Hand");
  const leftHand = bone("hand_L", "ValveBipedBip01_L_Hand");
  weapon.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = true;
      o.raycast = () => {}; // Carried equipment is excluded from flesh/cover hits.
    }
  });
  group.add(weapon);
  group.visible = false;
  const soldier = {
    group,
    model,
    mixer,
    actions,
    head,
    spine,
    hips,
    team,
    recoil: 0,
    stride: 0,
    moveX: 0,
    moveZ: 0,
    time: index,
    dying: false,
    fallTime: 0,
    fallVelocity: 0,
    fallRoll: Math.sin(index * 2.4 + 1) * 0.22,
    joints: [
      [spine, 0.12, 0, 0.12],
      [head, -0.12, 0.1, 0.08],
      [hips[0], 0.12, 0.1, 0.18],
      [hips[1], -0.1, -0.1, -0.18],
      [bone("arm_upper_L", "ValveBipedBip01_L_UpperArm"), 0.25, 0.1, 0.45],
      [bone("arm_upper_R", "ValveBipedBip01_R_UpperArm"), -0.2, -0.1, -0.35],
      [bone("arm_lower_L", "ValveBipedBip01_L_Forearm"), 0, 0.1, 0.3],
      [bone("arm_lower_R", "ValveBipedBip01_R_Forearm"), 0, -0.1, -0.25],
      [bone("leg_lower_L", "ValveBipedBip01_L_Calf"), 0, 0, 0.25],
      [bone("leg_lower_R", "ValveBipedBip01_R_Calf"), 0, 0, -0.2],
    ]
      .filter(([object]) => object instanceof T.Object3D)
      .map(([object, x, y, z]) => {
        const joint = object as T.Object3D;
        return {
          bone: joint,
          rest: joint.quaternion.clone(),
          base: joint.quaternion.clone(),
          angle: new T.Vector3(),
          velocity: new T.Vector3(),
          target: new T.Vector3(x as number, y as number, z as number),
        };
      }),
    contacts: [
      head,
      rightHand,
      leftHand,
      ...hips,
      bone("ankle_L", "ValveBipedBip01_L_Foot"),
      bone("ankle_R", "ValveBipedBip01_R_Foot"),
    ].filter(Boolean),
    phase: index * 0.19,
    weapon,
    weaponIndex: 2,
    rightHand,
    leftHand,
    grip: new T.Vector3(),
    support: new T.Vector3(),
  };
  poseWeapon(soldier);
  return soldier;
}
const looseRotation = new T.Euler();
const looseQuaternion = new T.Quaternion();
const contactPosition = new T.Vector3();
const weaponMatrix = new T.Matrix4();
const up = new T.Vector3(0, 1, 0);
const pistolGripOffset = new T.Vector3(0.018, -0.065, 0.085);
const gripOffset = new T.Vector3(0.01, -0.05, -0.1);
const supportOffset = new T.Vector3(-0.02, 0.02, -0.5);
const weaponGripRotation = new T.Quaternion()
  .setFromRotationMatrix(new T.Matrix4().lookAt(gripOffset, supportOffset, up))
  .invert();
const movementClips = [
  ["walk_n_rifle", 0, 1],
  ["walk_s_rifle", 0, -1],
  ["walk_e_rifle", 1, 0],
  ["walk_w_rifle", -1, 0],
] as const;
function poseWeapon(soldier: Soldier) {
  soldier.group.updateMatrixWorld(true);
  soldier.group.worldToLocal(soldier.rightHand.getWorldPosition(soldier.grip));
  soldier.group.worldToLocal(soldier.leftHand.getWorldPosition(soldier.support));
  weaponMatrix.lookAt(soldier.grip, soldier.support, up);
  soldier.weapon.quaternion.setFromRotationMatrix(weaponMatrix).multiply(weaponGripRotation);
  soldier.weapon.position
    .copy(soldier.weaponIndex === 2 ? pistolGripOffset : gripOffset)
    .applyQuaternion(soldier.weapon.quaternion)
    .negate()
    .add(soldier.grip);
}
export function setSoldierWeapon(soldier: Soldier, index: number) {
  if (soldier.weaponIndex === index) return;
  let castShadow = false;
  soldier.weapon.traverse((o) => {
    if (o instanceof T.Mesh && o.castShadow) castShadow = true;
  });
  soldier.group.remove(soldier.weapon);
  soldier.weapon = createWorldGun(index);
  soldier.weaponIndex = index;
  soldier.weapon.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = castShadow;
      o.raycast = () => {};
    }
  });
  soldier.group.add(soldier.weapon);
  poseWeapon(soldier);
}
export function resetSoldier(soldier: Soldier) {
  soldier.dying = false;
  soldier.fallTime = soldier.fallVelocity = 0;
  for (const joint of soldier.joints) {
    joint.bone.quaternion.copy(joint.rest);
    joint.angle.set(0, 0, 0);
    joint.velocity.set(0, 0, 0);
  }
  soldier.stride = soldier.recoil = soldier.moveX = soldier.moveZ = 0;
  soldier.group.rotation.x = soldier.group.rotation.z = 0;
  soldier.group.userData.groundY = soldier.group.position.y;
  Object.values(soldier.actions).forEach((a) => a.reset().play().setEffectiveWeight(0));
  soldier.actions.idle_rifle.setEffectiveWeight(1);
  soldier.mixer.update(0);
  poseWeapon(soldier);
}
export function soldierHeadHit(soldier: Soldier, point: T.Vector3) {
  const head = soldier.head.getWorldPosition(new T.Vector3());
  return point.y >= head.y - 0.09 && Math.hypot(point.x - head.x, point.z - head.z) < 0.18;
}
export function animateSoldier(soldier: Soldier, speed: number, dt: number, alive: boolean) {
  soldier.time += dt;
  if (!alive) {
    if (!soldier.dying) {
      soldier.dying = true;
      soldier.fallVelocity = 1.4 + Math.hypot(soldier.moveX, soldier.moveZ) * 0.25;
      for (const joint of soldier.joints) {
        joint.base.copy(joint.bone.quaternion);
        joint.velocity.copy(joint.target).multiplyScalar(2);
      }
    }
    // Bounded spring motion gives the frozen gait inertia, loose limbs and a
    // small landing rebound. Sleeping corpses incur no skeletal updates.
    if (soldier.fallTime >= 2.5) return;
    soldier.fallTime += dt;
    soldier.stride = 0;
    const group = soldier.group;
    soldier.fallVelocity += ((1.48 - group.rotation.x) * 45 - soldier.fallVelocity * 7) * dt;
    group.rotation.x += soldier.fallVelocity * dt;
    if (group.rotation.x > 1.56) {
      group.rotation.x = 1.56;
      soldier.fallVelocity = -Math.abs(soldier.fallVelocity) * 0.22;
    }
    group.rotation.z = T.MathUtils.damp(group.rotation.z, soldier.fallRoll, 5, dt);
    for (const joint of soldier.joints) {
      joint.velocity
        .addScaledVector(joint.target, 32 * dt)
        .addScaledVector(joint.angle, -32 * dt)
        .multiplyScalar(Math.exp(-5 * dt));
      joint.angle.addScaledVector(joint.velocity, dt);
      looseRotation.set(joint.angle.x, joint.angle.y, joint.angle.z);
      joint.bone.quaternion.copy(joint.base).multiply(looseQuaternion.setFromEuler(looseRotation));
    }
    const ground = group.userData.groundY ?? group.position.y;
    group.position.y = T.MathUtils.damp(group.position.y, ground + 0.08, 10, dt);
    group.updateMatrixWorld(true);
    let penetration = 0;
    for (const contact of soldier.contacts) {
      contact.getWorldPosition(contactPosition);
      penetration = Math.max(penetration, ground + 0.07 - contactPosition.y);
    }
    group.position.y += penetration;
    poseWeapon(soldier);
    return;
  }
  soldier.stride = T.MathUtils.damp(soldier.stride, Math.min(speed / 2.1, 1), 12, dt);
  const magnitude = Math.hypot(soldier.moveX, soldier.moveZ);
  const x = magnitude > 0.01 ? soldier.moveX / magnitude : 0;
  const z = magnitude > 0.01 ? soldier.moveZ / magnitude : 1;
  const sum = Math.abs(x) + Math.abs(z);
  soldier.actions.idle_rifle.setEffectiveWeight(1 - soldier.stride);
  soldier.phase += (dt * speed) / 1.12;
  for (const [name, dx, dz] of movementClips) {
    const action = soldier.actions[name];
    action.setEffectiveWeight((Math.max(0, x * dx + z * dz) / sum) * soldier.stride);
    action.time = (soldier.phase % 1) * action.getClip().duration;
  }
  soldier.mixer.update(0);
  soldier.recoil = Math.max(0, soldier.recoil - dt * 7);
  soldier.spine.rotateZ(-soldier.recoil * 0.045 + Math.sin(soldier.time * 1.8) * 0.002);
  poseWeapon(soldier);
}
