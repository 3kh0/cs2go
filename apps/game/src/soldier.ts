import { registerActorLighting, disposeActorLighting } from "./actor-lighting";
import { loadWorldGrips, worldGrip, worldGripClips } from "./world-grips";
import { peekSelectedAgent } from "./agent-roster";
import { weaponSlot } from "./physics";
import * as T from "three";
import { Ragdoll } from "./ragdoll";
import type { RagdollWorld } from "./ragdoll";
import { fetchGzipped, loadModel } from "./gltf";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { createWeaponInstance, type WeaponInstance } from "./weapon-instance";
import { disposeWorldGun, createWorldGun, shareSkeletons } from "./weapons";

export type AgentTeam = "t" | "ct";
type Template = { scene: T.Group; animations: T.AnimationClip[] };
const templates = new Map<AgentTeam, Template>();
let bombTemplate: T.Group;
export async function loadSoldierModels() {
  const gripLoad = loadWorldGrips();
  await Promise.all([
    loadModel("/models/c4.glb").then((model) => {
      bombTemplate = model.scene;
    }),
    ...(["t", "ct"] as const).map(async (team) => {
      const [model, data] = await Promise.all([
        loadModel(`/models/agents/${team === "t" ? "ground-rebel-native" : "idf"}.glb`),
        fetchGzipped(`/models/animations/agents/${team}.json.gz`),
      ]);
      const clips = JSON.parse(new TextDecoder().decode(data)) as ReturnType<
        typeof T.AnimationClip.toJSON
      >[];
      const animations = clips.map((clip) => T.AnimationClip.parse(clip));
      await gripLoad;
      const gripClips = worldGripClips(team);
      const actionWeapon: Record<string, number> = { ak: 0, m4a1s: 1, usp: 2, awp: 3 };
      for (const motion of animations) {
        if (!/^(shoot_|draw_)/.test(motion.name)) continue;
        motion.tracks = motion.tracks.filter((track) =>
          /^(spine_|clavicle_|arm_|hand_|finger_|ValveBipedBip01_(?:Spine|[LR]_(?:Clavicle|UpperArm|Forearm|Hand|Finger)))/.test(
            track.name,
          ),
        );
        T.AnimationUtils.makeClipAdditive(
          motion,
          0,
          gripClips.find(
            (clip) =>
              clip.name === `grip_stand_${actionWeapon[motion.name.split("_")[1].split(".")[0]]}`,
          ) ?? animations.find((clip) => clip.name === "idle_rifle")!,
        );
      }
      for (const clip of gripClips) {
        const index = Number(clip.name.split("_")[2]);
        const stance = clip.name.includes("_crouch_") ? "idle_crouch_" : "idle_";
        T.AnimationUtils.makeClipAdditive(
          clip,
          0,
          animations.find(
            (base) => base.name === stance + (weaponSlot(index) === 2 ? "pistol" : "rifle"),
          )!,
        );
      }
      animations.push(...gripClips);
      templates.set(team, {
        scene: model.scene,
        animations,
      });
    }),
  ]);
}
export type Soldier = {
  group: T.Group;
  model: T.Group;
  mixer: T.AnimationMixer;
  actions: Record<string, T.AnimationAction>;
  head: T.Object3D;
  spine: T.Object3D;
  hips: T.Object3D[];
  team: AgentTeam;
  animationTeam: AgentTeam;
  releaseAppearance?: () => void;
  recoil: number;
  stride: number;
  moveX: number;
  moveZ: number;
  time: number;
  dying: boolean;
  ragdoll?: Ragdoll;
  ragdollBones: T.Object3D[];
  phase: number;
  weapon: T.Group;
  weaponIndex: number;
  weaponInstance: WeaponInstance;
  weaponCreator: string;
  suppressed: boolean;
  rightHand: T.Object3D;
  leftHand: T.Object3D;
  weaponGripInverse?: T.Matrix4;
  grip: T.Vector3;
  support: T.Vector3;
  crouch: number;
  airborne: boolean;
  jumping: boolean;
  plant: number;
  shotTime: number;
  drawTime: number;
  activeActions: Set<T.AnimationAction>;
  carriedBomb: T.Group;
  airTime: number;
};
export function disposeSoldier(soldier: Soldier) {
  disposeWorldGun(soldier.weapon);
  disposeActorLighting(soldier.group);
  soldier.mixer.stopAllAction();
  soldier.mixer.uncacheRoot(soldier.model);
  const skeletons = new Set<T.Skeleton>();
  soldier.model.traverse((object) => {
    if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton);
  });
  skeletons.forEach((skeleton) => skeleton.dispose());
  soldier.releaseAppearance?.();
}
export function createSoldier(
  index: number,
  team: AgentTeam = "t",
  appearance?: { scene: T.Group; animationTeam: AgentTeam; release?: () => void },
): Soldier {
  appearance ??= peekSelectedAgent(team);
  const animationTeam = appearance?.animationTeam ?? team;
  const template = templates.get(animationTeam)!;
  const group = new T.Group();
  group.name = team === "t" ? "Ground Rebel | Elite Crew" : "IDF";
  const model = clone(appearance?.scene ?? template.scene) as T.Group;
  group.add(model);
  const bone = (t: string, ct: string) => model.getObjectByName(t) ?? model.getObjectByName(ct)!;
  const head = bone("head_0", "ValveBipedBip01_Head1");
  const spine = bone("spine_3", "ValveBipedBip01_Spine4");
  const hips = [
    bone("leg_upper_L", "ValveBipedBip01_L_Thigh"),
    bone("leg_upper_R", "ValveBipedBip01_R_Thigh"),
  ];
  shareSkeletons(model);
  model.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = o.receiveShadow = true;
      o.userData.bot = index;
    }
  });
  const mixer = new T.AnimationMixer(model);
  const actions: Record<string, T.AnimationAction> = {};
  for (const clip of template.animations) {
    const action = mixer.clipAction(clip);
    action.setEffectiveWeight(0);
    actions[clip.name] = action;
  }
  actions.idle_rifle.play().setEffectiveWeight(1);
  mixer.update(0);
  // Size and ground the sampled rifle stance, rather than its taller bind pose.
  model.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(model, true);
  const scale = 1.8 / (bounds.max.y - bounds.min.y);
  model.scale.setScalar(scale);
  model.position.y = -bounds.min.y * scale;
  // Animated bounds differ from the bind pose, particularly while falling. A
  // fixed agent-sized sphere keeps culling and ray rejection valid in any pose.
  group.updateMatrixWorld(true);
  model.traverse((o) => {
    if (o instanceof T.SkinnedMesh)
      o.boundingSphere = agentBounds.clone().applyMatrix4(o.matrixWorld.clone().invert());
  });

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
  const carriedBomb = bombTemplate.clone(true);
  carriedBomb.visible = false;
  carriedBomb.traverse((object) => {
    if (object instanceof T.Mesh) object.raycast = () => {};
  });
  group.add(carriedBomb);
  group.visible = false;
  registerActorLighting(group, true);
  const soldier = {
    group,
    model,
    mixer,
    actions,
    head,
    spine,
    hips,
    team,
    animationTeam,
    releaseAppearance: appearance?.release,
    recoil: 0,
    stride: 0,
    moveX: 0,
    moveZ: 0,
    time: index,
    dying: false,
    ragdollBones: [
      bone("pelvis", "ValveBipedBip01_Pelvis"),
      spine,
      head,
      bone("arm_upper_L", "ValveBipedBip01_L_UpperArm"),
      bone("arm_lower_L", "ValveBipedBip01_L_Forearm"),
      leftHand,
      bone("arm_upper_R", "ValveBipedBip01_R_UpperArm"),
      bone("arm_lower_R", "ValveBipedBip01_R_Forearm"),
      rightHand,
      hips[0],
      bone("leg_lower_L", "ValveBipedBip01_L_Calf"),
      bone("ankle_L", "ValveBipedBip01_L_Foot"),
      hips[1],
      bone("leg_lower_R", "ValveBipedBip01_R_Calf"),
      bone("ankle_R", "ValveBipedBip01_R_Foot"),
    ],
    phase: index * 0.19,
    weapon,
    weaponIndex: 2,
    weaponInstance: createWeaponInstance(2, `bot:${index}`),
    weaponCreator: `bot:${index}`,
    suppressed: true,
    crouch: 0,
    airborne: false,
    jumping: false,
    plant: 0,
    shotTime: 0,
    drawTime: 0,
    activeActions: new Set([actions.idle_rifle]),
    carriedBomb,
    airTime: 0,
    rightHand,
    leftHand,
    weaponGripInverse: weapon.userData.buyGrip
      ? new T.Matrix4().fromArray(weapon.userData.buyGrip).invert()
      : undefined,
    grip: new T.Vector3(),
    support: new T.Vector3(),
  };
  poseWeapon(soldier);
  return soldier;
}
export const agentBounds = new T.Sphere(new T.Vector3(0, 0.9, 0), 1.5);
const weaponMatrix = new T.Matrix4();
const up = new T.Vector3(0, 1, 0);
const pistolGripOffset = new T.Vector3(0.018, -0.065, 0.085);
const gripOffset = new T.Vector3(0.01, -0.05, -0.1);
const supportOffset = new T.Vector3(-0.02, 0.02, -0.5);
const weaponGripRotation = new T.Quaternion()
  .setFromRotationMatrix(new T.Matrix4().lookAt(gripOffset, supportOffset, up))
  .invert();
const gripAttachment = new T.Matrix4();
const gripPosition = new T.Vector3(),
  gripRotation = new T.Quaternion(),
  gripScale = new T.Vector3();
const movementClips = [
  ["n", 0, 1],
  ["s", 0, -1],
  ["e", 1, 0],
  ["w", -1, 0],
] as const;
// getWorldPosition refreshes only each hand's ancestor chain, not the whole rig.
function poseWeapon(soldier: Soldier) {
  soldier.group.worldToLocal(soldier.rightHand.getWorldPosition(soldier.grip));
  soldier.group.worldToLocal(soldier.leftHand.getWorldPosition(soldier.support));
  const native = worldGrip(soldier.animationTeam, soldier.weaponIndex);
  if (native && soldier.weaponGripInverse) {
    const stand = native.stand.attachmentPose!,
      crouched = native.crouch.attachmentPose!;
    const crouch = T.MathUtils.clamp(soldier.crouch, 0, 1);
    gripPosition.copy(stand.position).lerp(crouched.position, crouch);
    gripRotation.copy(stand.rotation).slerp(crouched.rotation, crouch);
    gripScale.copy(stand.scale).lerp(crouched.scale, crouch);
    gripAttachment.compose(gripPosition, gripRotation, gripScale);
    soldier.rightHand.updateWorldMatrix(true, false);
    weaponMatrix
      .copy(soldier.group.matrixWorld)
      .invert()
      .multiply(soldier.rightHand.matrixWorld)
      .multiply(gripAttachment)
      .multiply(soldier.weaponGripInverse);
    weaponMatrix.decompose(
      soldier.weapon.position,
      soldier.weapon.quaternion,
      soldier.weapon.scale,
    );
  } else {
    weaponMatrix.lookAt(soldier.grip, soldier.support, up);
    soldier.weapon.quaternion.setFromRotationMatrix(weaponMatrix).multiply(weaponGripRotation);
    if (weaponSlot(soldier.weaponIndex) === 2)
      soldier.weapon.quaternion.setFromAxisAngle(up, Math.PI);
    soldier.weapon.position
      .copy(weaponSlot(soldier.weaponIndex) === 2 ? pistolGripOffset : gripOffset)
      .applyQuaternion(soldier.weapon.quaternion)
      .negate()
      .add(soldier.grip);
  }
  soldier.weapon.visible = soldier.plant === 0;
  soldier.carriedBomb.visible = soldier.plant > 0;
  if (soldier.carriedBomb.visible) {
    soldier.carriedBomb.position.copy(soldier.grip).lerp(soldier.support, 0.5);
    soldier.carriedBomb.position.y -= 0.025;
  }
}
export function setSoldierWeapon(
  soldier: Soldier,
  index: number,
  suppressed = true,
  instance?: WeaponInstance,
) {
  const identity =
    instance ??
    (soldier.weaponIndex === index
      ? soldier.weaponInstance
      : createWeaponInstance(index, soldier.weaponCreator));
  if (
    soldier.weaponIndex === index &&
    soldier.suppressed === suppressed &&
    soldier.weaponInstance === identity
  )
    return;
  soldier.suppressed = suppressed;
  let castShadow = false;
  soldier.weapon.traverse((o) => {
    if (o instanceof T.Mesh && o.castShadow) castShadow = true;
  });
  disposeWorldGun(soldier.weapon);
  soldier.weapon = createWorldGun(index, suppressed, identity);
  soldier.weaponInstance = identity;
  soldier.weaponIndex = index;
  soldier.weaponGripInverse = soldier.weapon.userData.buyGrip
    ? new T.Matrix4().fromArray(soldier.weapon.userData.buyGrip).invert()
    : undefined;
  soldier.drawTime = 0.55;
  soldier.weapon.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = castShadow;
      o.raycast = () => {};
    }
  });
  soldier.group.add(soldier.weapon);
  registerActorLighting(soldier.group, true);
  poseWeapon(soldier);
}
export function resetSoldier(soldier: Soldier) {
  soldier.dying = false;
  soldier.ragdoll?.reset();
  soldier.ragdoll = undefined;
  soldier.stride = soldier.recoil = soldier.moveX = soldier.moveZ = 0;
  soldier.group.rotation.x = soldier.group.rotation.z = 0;
  soldier.group.userData.groundY = soldier.group.position.y;
  Object.values(soldier.actions).forEach((a) => a.stop().setEffectiveWeight(0));
  soldier.actions.idle_rifle.reset().play().setEffectiveWeight(1);
  soldier.activeActions.clear();
  soldier.activeActions.add(soldier.actions.idle_rifle);
  soldier.crouch = soldier.plant = soldier.shotTime = soldier.drawTime = 0;
  soldier.airborne = soldier.jumping = false;
  soldier.airTime = 0;
  soldier.mixer.update(0);
  poseWeapon(soldier);
}
// Synchronous ray queries reuse scratch positions; shotgun pellets must not
// allocate several vectors for every decorative-mesh intersection.
const hitAnchorA = new T.Vector3(),
  hitAnchorB = new T.Vector3();
export function soldierHeadHit(soldier: Soldier, point: T.Vector3) {
  soldier.head.getWorldPosition(hitAnchorA);
  return point.distanceToSquared(hitAnchorA) <= 0.18 * 0.18;
}
/** Map skinned contact heights through animated pelvis/spine anchors. The trace still
 * hits the actual deformed mesh; region thresholds now follow crouch/lean poses. */
export function soldierHitHeight(soldier: Soldier, point: T.Vector3) {
  soldier.hips[0].getWorldPosition(hitAnchorA);
  soldier.hips[1].getWorldPosition(hitAnchorB);
  hitAnchorA.add(hitAnchorB).multiplyScalar(0.5);
  soldier.spine.getWorldPosition(hitAnchorB);
  const x = hitAnchorB.x - hitAnchorA.x;
  const y = hitAnchorB.y - hitAnchorA.y;
  const z = hitAnchorB.z - hitAnchorA.z;
  const projection =
    ((point.x - hitAnchorA.x) * x + (point.y - hitAnchorA.y) * y + (point.z - hitAnchorA.z) * z) /
    Math.max(0.0001, x * x + y * y + z * z);
  return projection < -0.1 ? 0.7 : projection < 0.45 ? 1 : 1.2;
}
export function animateSoldier(soldier: Soldier, speed: number, dt: number, alive: boolean) {
  soldier.time += dt;
  if (!alive) {
    soldier.plant = 0;
    if (soldier.ragdoll) {
      soldier.group.position.copy(soldier.ragdoll.points[0].position);
      soldier.group.position.y -= 0.9;
      soldier.ragdoll.apply();
    }
    poseWeapon(soldier);
    return;
  }
  soldier.stride = T.MathUtils.damp(soldier.stride, Math.min(speed / 2.1, 1), 12, dt);
  const magnitude = Math.hypot(soldier.moveX, soldier.moveZ);
  const x = magnitude > 0.01 ? soldier.moveX / magnitude : 0;
  const z = magnitude > 0.01 ? soldier.moveZ / magnitude : 1;
  const sum = Math.abs(x) + Math.abs(z);
  for (const action of soldier.activeActions) action.setEffectiveWeight(0);
  const pose = (name: string, weight: number, progress?: number) => {
    if (weight <= 0) return;
    const action = soldier.actions[name];
    if (!action) return;
    action.play().setEffectiveWeight(weight);
    action.time =
      progress === undefined
        ? action.getClip().duration > 0
          ? soldier.time % action.getClip().duration
          : 0
        : T.MathUtils.clamp(progress, 0, 1) * action.getClip().duration;
    soldier.activeActions.add(action);
  };
  const family = weaponSlot(soldier.weaponIndex) === 2 ? "pistol" : "rifle";
  const running = T.MathUtils.smoothstep(speed, 2.1, 3.5);
  const crouch = T.MathUtils.clamp(soldier.crouch, 0, 1);
  soldier.airTime = soldier.airborne ? soldier.airTime + dt : 0;
  soldier.phase += (dt * speed) / T.MathUtils.lerp(1.12, 2.35, running);
  if (soldier.plant > 0) pose("planting", 1, soldier.plant);
  else if (soldier.airborne) {
    pose(
      `${soldier.jumping ? "jump_n" : "inair_stand"}_${family}`,
      1,
      soldier.jumping ? Math.min(1, soldier.airTime / 0.4) : (soldier.airTime % 0.3) / 0.3,
    );
  } else {
    pose(`idle_${family}`, (1 - soldier.stride) * (1 - crouch));
    pose(`idle_crouch_${family}`, (1 - soldier.stride) * crouch);
    for (const [direction, dx, dz] of movementClips) {
      const weight = (Math.max(0, x * dx + z * dz) / sum) * soldier.stride;
      pose(`walk_${direction}_${family}`, weight * (1 - running) * (1 - crouch), soldier.phase % 1);
      pose(`run_${direction}_${family}`, weight * running * (1 - crouch), soldier.phase % 1);
      pose(`crouch_${direction}_${family}`, weight * crouch, soldier.phase % 1);
    }
  }
  if (soldier.plant === 0 && worldGrip(soldier.animationTeam, soldier.weaponIndex)) {
    pose(`grip_stand_${soldier.weaponIndex}`, 1 - crouch, 0);
    pose(`grip_crouch_${soldier.weaponIndex}`, crouch, 0);
  }
  const weapon = ["ak", "m4a1s", "usp", "awp"][soldier.weaponIndex];
  if (soldier.plant === 0 && soldier.shotTime > 0) {
    pose(`shoot_${weapon}.vnmclip+non_additive`, 1, 1 - soldier.shotTime / 0.25);
  } else if (soldier.plant === 0 && soldier.drawTime > 0) {
    pose(`draw_${weapon}`, 1, 1 - soldier.drawTime / 0.55);
  }
  soldier.shotTime = Math.max(0, soldier.shotTime - dt);
  soldier.drawTime = Math.max(0, soldier.drawTime - dt);
  for (const action of soldier.activeActions) {
    if (action.getEffectiveWeight() > 0) continue;
    action.stop();
    soldier.activeActions.delete(action);
  }
  soldier.mixer.update(0);
  soldier.recoil = Math.max(0, soldier.recoil - dt * 7);
  soldier.spine.rotateZ(-soldier.recoil * 0.045 + Math.sin(soldier.time * 1.8) * 0.002);
  poseWeapon(soldier);
}
// Called by the same fixed 128 Hz simulation as living bot movement.
export function stepSoldierRagdoll(
  soldier: Soldier,
  vertical: number,
  dt: number,
  world: RagdollWorld,
) {
  if (!soldier.ragdoll) {
    soldier.dying = true;
    soldier.plant = 0;
    const yaw = soldier.group.rotation.y;
    const motion = new T.Vector3(
      soldier.moveX * Math.cos(yaw) + soldier.moveZ * Math.sin(yaw),
      vertical,
      -soldier.moveX * Math.sin(yaw) + soldier.moveZ * Math.cos(yaw),
    );
    soldier.ragdoll = new Ragdoll(soldier.ragdollBones, motion, yaw);
  }
  soldier.ragdoll.step(dt, world);
}
