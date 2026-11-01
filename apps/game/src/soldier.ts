import { registerActorLighting, disposeActorLighting } from "./actor-lighting";
import { loadWorldGrips, worldGrip, worldGripClips } from "./world-grips";
import { peekSelectedAgent, defaultAgent, acquireAgentAppearance } from "./agent-roster";
import {
  loadAgentGameplayClips,
  acquireAgentAnimationPack,
  ensureAgentAnimationBones,
  loadAgentWeaponActions,
  agentClipForModel,
  completeAgentClip,
} from "./agent-animations";
import { updateGloveModel, unregisterGloveModel, type GloveChoice } from "./gloves";
import { weaponSlot } from "./physics";
import * as T from "three";
import { Ragdoll } from "./ragdoll";
import type { RagdollWorld } from "./ragdoll";
import { loadModel } from "./gltf";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { createWeaponInstance, type WeaponInstance } from "./weapon-instance";
import { disposeWorldGun, createWorldGun, shareSkeletons } from "./weapons";

export type AgentTeam = "t" | "ct";
type Template = { scene: T.Group; animations: T.AnimationClip[] };
const templates = new Map<AgentTeam, Template>();
const actionReferences = new Map<AgentTeam, T.AnimationClip[]>();
const nativeWeaponActions = new Map<number, Promise<Record<string, T.AnimationClip>>>();
let bombTemplate: T.Group;
export async function loadSoldierModels() {
  const gripLoad = loadWorldGrips();
  const nativeLoad = loadAgentGameplayClips();
  await Promise.all([
    loadModel("/models/c4.glb").then((model) => {
      bombTemplate = model.scene;
    }),
    ...(["t", "ct"] as const).map(async (team) => {
      const [model, sourceAnimations] = await Promise.all([
        team === "ct"
          ? // Startup owns this lease for the lifetime of its shared body template.
            acquireAgentAppearance("default-ct").then((appearance) => ({
              scene: appearance!.scene,
            }))
          : loadModel("/models/agents/ground-rebel-native.glb"),
        nativeLoad,
      ]);
      const binding = await acquireAgentAnimationPack("world/rifle/_default_rifle");
      ensureAgentAnimationBones(model.scene, binding.scene);
      binding.release();
      const animations = sourceAnimations.map((clip) =>
        completeAgentClip(agentClipForModel(clip, model.scene), model.scene),
      );
      await gripLoad;
      const gripClips = worldGripClips();
      actionReferences.set(
        "t",
        gripClips.map((clip) => clip.clone()),
      );
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
  animationTeam: "t";
  releaseAppearance?: () => void;
  recoil: number;
  proceduralSpineBase?: T.Quaternion;
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
  reloadTime: number;
  gloveChoice?: GloveChoice;
  agentId?: string;
  nativeActions?: Record<string, T.AnimationAction>;
  nativeGeneration: number;
  disposed: boolean;
  nativeShotElapsed: number;
  nativeDrawElapsed: number;
  nativeReloadElapsed: number;
  previousShotTime: number;
  previousDrawTime: number;
  previousReloadTime: number;
  activeActions: Set<T.AnimationAction>;
  carriedBomb: T.Group;
  airTime: number;
};
export function disposeSoldier(soldier: Soldier) {
  soldier.disposed = true;
  soldier.nativeGeneration++;
  unregisterGloveModel(soldier.group);
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
  appearance?: { scene: T.Group; animationTeam: "t"; release?: () => void; agentId?: string },
  useSelection = true,
): Soldier {
  if (useSelection) appearance ??= peekSelectedAgent(team);
  const animationTeam = "t";
  const template = templates.get(team)!;
  const group = new T.Group();
  group.name = defaultAgent(team).name;
  const model = clone(appearance?.scene ?? template.scene) as T.Group;
  group.add(model);
  const bone = (name: string) => model.getObjectByName(name)!;
  const head = bone("head_0");
  const spine = bone("spine_3");
  const hips = [bone("leg_upper_L"), bone("leg_upper_R")];
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
    const action = mixer.clipAction(agentClipForModel(clip, model));
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
  const rightHand = bone("hand_R");
  const leftHand = bone("hand_L");
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
  const soldier: Soldier = {
    group,
    model,
    mixer,
    actions,
    head,
    spine,
    hips,
    team,
    animationTeam,
    agentId: appearance?.agentId ?? defaultAgent(team).id,
    releaseAppearance: appearance?.release,
    recoil: 0,
    stride: 0,
    moveX: 0,
    moveZ: 0,
    time: index,
    dying: false,
    ragdollBones: [
      bone("pelvis"),
      spine,
      head,
      bone("arm_upper_L"),
      bone("arm_lower_L"),
      leftHand,
      bone("arm_upper_R"),
      bone("arm_lower_R"),
      rightHand,
      hips[0],
      bone("leg_lower_L"),
      bone("ankle_L"),
      hips[1],
      bone("leg_lower_R"),
      bone("ankle_R"),
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
    reloadTime: 0,
    nativeGeneration: 0,
    disposed: false,
    nativeShotElapsed: Infinity,
    nativeDrawElapsed: Infinity,
    nativeReloadElapsed: Infinity,
    previousShotTime: 0,
    previousDrawTime: 0,
    previousReloadTime: 0,
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
  prepareNativeActions(soldier);
  updateGloveModel(soldier.group, team, soldier.gloveChoice, true, soldier.agentId);
  return soldier;
}
function prepareNativeActions(soldier: Soldier) {
  const generation = ++soldier.nativeGeneration;
  for (const action of Object.values(soldier.nativeActions ?? {})) {
    action.stop();
    soldier.activeActions.delete(action);
    soldier.mixer.uncacheAction(action.getClip());
    soldier.mixer.uncacheClip(action.getClip());
  }
  soldier.nativeActions = undefined;
  const index = soldier.weaponIndex;
  let pending = nativeWeaponActions.get(index);
  if (!pending) {
    pending = loadAgentWeaponActions(index).catch((error) => {
      nativeWeaponActions.delete(index);
      throw error;
    });
    nativeWeaponActions.set(index, pending);
  }
  void pending
    .then((clips) => {
      if (soldier.disposed || generation !== soldier.nativeGeneration) return;
      const actions: Record<string, T.AnimationAction> = {};
      for (const [name, source] of Object.entries(clips)) {
        const clip = source.clone();
        clip.tracks = clip.tracks.filter((track) =>
          /^(spine_|clavicle_|arm_|hand_|finger_)/.test(track.name),
        );
        if (!clip.tracks.length) continue;
        const reference =
          actionReferences
            .get("t")!
            .find(
              (clip) =>
                clip.name === `grip_${name.includes("crouch") ? "crouch" : "stand"}_${index}`,
            ) ?? templates.get("t")!.animations.find((clip) => clip.name === "idle_rifle")!;
        T.AnimationUtils.makeClipAdditive(clip, 0, reference);
        const action = soldier.mixer.clipAction(clip);
        action.setLoop(T.LoopOnce, 1);
        action.clampWhenFinished = true;
        actions[name] = action;
      }
      soldier.nativeActions = actions;
    })
    .catch(() => {
      /* Existing locomotion remains responsive; a later switch retries. */
    });
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
  const native = worldGrip(soldier.weaponIndex);
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
  soldier.weapon.visible = soldier.plant === 0 && !soldier.dying;
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
  soldier.nativeShotElapsed = soldier.nativeReloadElapsed = Infinity;
  soldier.nativeDrawElapsed = 0;
  soldier.previousDrawTime = 0;
  prepareNativeActions(soldier);
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
  if (soldier.proceduralSpineBase) {
    soldier.spine.quaternion.copy(soldier.proceduralSpineBase);
    soldier.proceduralSpineBase = undefined;
  }
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
  soldier.reloadTime = 0;
  soldier.nativeShotElapsed = soldier.nativeDrawElapsed = soldier.nativeReloadElapsed = Infinity;
  soldier.previousShotTime = soldier.previousDrawTime = soldier.previousReloadTime = 0;
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
  updateGloveModel(soldier.group, soldier.team, soldier.gloveChoice, true, soldier.agentId);
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
  if (soldier.proceduralSpineBase) soldier.spine.quaternion.copy(soldier.proceduralSpineBase);
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
  if (soldier.plant === 0 && worldGrip(soldier.weaponIndex)) {
    pose(`grip_stand_${soldier.weaponIndex}`, 1 - crouch, 0);
    pose(`grip_crouch_${soldier.weaponIndex}`, crouch, 0);
  }
  if (soldier.shotTime > soldier.previousShotTime + 0.0001) {
    soldier.nativeShotElapsed = 0;
    soldier.nativeDrawElapsed = soldier.nativeReloadElapsed = Infinity;
  }
  if (soldier.drawTime > soldier.previousDrawTime + 0.0001) {
    soldier.nativeDrawElapsed = 0;
    soldier.nativeShotElapsed = soldier.nativeReloadElapsed = Infinity;
  }
  if (soldier.reloadTime > soldier.previousReloadTime + 0.0001) {
    soldier.nativeReloadElapsed = 0;
    soldier.nativeShotElapsed = soldier.nativeDrawElapsed = Infinity;
  } else if (soldier.reloadTime === 0 && soldier.previousReloadTime > dt * 2) {
    soldier.nativeReloadElapsed = Infinity;
  }
  const native = soldier.nativeActions;
  const nativePose = (name: string, elapsed: number) => {
    const action = native?.[crouch > 0.5 ? `${name}_crouch` : name] ?? native?.[name];
    if (!action || elapsed >= action.getClip().duration) return false;
    action.play().setEffectiveWeight(1);
    action.time = elapsed;
    soldier.activeActions.add(action);
    return true;
  };
  if (soldier.plant === 0) {
    if (
      !nativePose("shoot", soldier.nativeShotElapsed) &&
      !nativePose("reload", soldier.nativeReloadElapsed)
    )
      nativePose("draw", soldier.nativeDrawElapsed);
  }
  soldier.nativeShotElapsed += dt;
  soldier.nativeDrawElapsed += dt;
  soldier.nativeReloadElapsed += dt;
  soldier.shotTime = Math.max(0, soldier.shotTime - dt);
  soldier.drawTime = Math.max(0, soldier.drawTime - dt);
  soldier.previousShotTime = soldier.shotTime;
  soldier.previousDrawTime = soldier.drawTime;
  soldier.previousReloadTime = soldier.reloadTime;
  for (const action of soldier.activeActions) {
    if (action.getEffectiveWeight() > 0) continue;
    action.stop();
    soldier.activeActions.delete(action);
  }
  soldier.mixer.update(0);
  soldier.recoil = Math.max(0, soldier.recoil - dt * 7);
  (soldier.proceduralSpineBase ??= new T.Quaternion()).copy(soldier.spine.quaternion);
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
