import { WEAPON_ANIMATION_RATE } from "./physics";
import * as T from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { gltf } from "./gltf";

const names = [
  "idle1",
  "idle2",
  "draw",
  "light_miss1",
  "light_miss2",
  "heavy_miss1",
  "lookat01",
  "lookat01_draw",
] as const;
type MotionName = (typeof names)[number];
let hands: T.Group;
let skeleton: T.Group;
const clips = new Map<MotionName, T.AnimationClip>();
export async function loadKnifeMotion() {
  const [arms, ...motions] = await Promise.all([
    gltf.loadAsync("/models/agents/view-hands.glb"),
    ...names.map((name) => gltf.loadAsync(`/models/animations/bayonet/${name}.glb`)),
  ]);
  hands = arms.scene;
  skeleton = motions[0].scene;
  motions.forEach((motion, i) => {
    // The secondary skeleton contains the knife's independent finger roll.
    clips.set(
      names[i],
      new T.AnimationClip(
        names[i],
        motion.animations[0].duration,
        motion.animations.flatMap((clip) => clip.tracks),
      ).optimize(),
    );
  });
}

export function knifeInspectDuration(draw = false) {
  return clips.get(draw ? "lookat01_draw" : "lookat01")!.duration / WEAPON_ANIMATION_RATE;
}

export function viewHandsTemplate() {
  return hands;
}

type Binding = { target: T.Object3D; source: T.Object3D };
type MotionRig = {
  arms: T.Group;
  source: T.Group;
  mixer: T.AnimationMixer;
  actions: Map<MotionName, T.AnimationAction>;
  current?: MotionName;
  bindings: Binding[];
  model: T.Object3D;
  weapon: T.Object3D;
  secondary: T.Object3D;
  meshToSource: T.Matrix4;
  left: T.Object3D;
  right: T.Object3D;
};
const rigs = new WeakMap<T.Group, MotionRig>();
export function createKnifeMotion(group: T.Group) {
  if (!hands) return false;
  const arms = cloneSkeleton(hands) as T.Group;
  arms.name = "agent-view-arms";
  arms.traverse((object) => {
    if (object instanceof T.Mesh) {
      object.frustumCulled = false;
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material)
        ? object.material.map((m) => m.clone())
        : object.material.clone();
    }
  });
  group.add(arms);
  const source = skeleton.clone(true);
  const mixer = new T.AnimationMixer(source);
  const actions = new Map<MotionName, T.AnimationAction>();
  for (const [name, clip] of clips) {
    const action = mixer.clipAction(clip);
    action.setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    actions.set(name, action);
  }
  const bindings: Binding[] = [];
  arms.traverse((target) => {
    if (!(target instanceof T.Bone)) return;
    const bone = source.getObjectByName(target.name);
    if (bone && /^(arm_upper_|arm_lower_|hand_|finger_)/.test(target.name))
      bindings.push({ target, source: bone });
  });
  const left = new T.Object3D(),
    right = new T.Object3D();
  left.name = "left-hand";
  right.name = "right-hand";
  group.add(left, right);
  rigs.set(group, {
    arms,
    source,
    mixer,
    actions,
    bindings,
    model: group.getObjectByName("weapon-model")!,
    weapon: source.getObjectByName("wpn")!,
    secondary: source.getObjectByName("weapon_offset")!,
    meshToSource: new T.Matrix4().fromArray(
      group.getObjectByName("m9-bayonet")!.userData.meshToSource,
    ),
    left,
    right,
  });
  return true;
}
// Source viewmodel coordinates: X forward, Y left, Z up; Source units are inches.
const cameraBasis = new T.Matrix4().set(
  0,
  -0.0254,
  0,
  0,
  0,
  0,
  0.0254,
  0,
  -0.0254,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
);
const matrix = new T.Matrix4(),
  parentInverse = new T.Matrix4(),
  world = new T.Matrix4();
const position = new T.Vector3(),
  quaternion = new T.Quaternion(),
  scale = new T.Vector3();
export type KnifePose = {
  draw: number;
  knife?: number;
  stab?: boolean;
  knifeActive?: boolean;
  alternate?: boolean;
  time?: number;
  inspect?: number;
  inspectActive?: boolean;
  inspectDraw?: boolean;
  bob: number;
  sway: number;
};
export function animateKnifeMotion(group: T.Group, pose: KnifePose) {
  const rig = rigs.get(group);
  if (!rig) return false;
  let name: MotionName = "idle1",
    progress = 0;
  if (pose.draw > 0) {
    name = "draw";
    progress = 1 - pose.draw;
  } else if (pose.knifeActive || (pose.knife && pose.knife > 0)) {
    name = pose.stab ? "heavy_miss1" : pose.alternate ? "light_miss2" : "light_miss1";
    progress = pose.knife ?? 0;
  } else if (pose.inspectActive) {
    name = pose.inspectDraw ? "lookat01_draw" : "lookat01";
    progress = pose.inspect ?? 0;
  } else {
    const idle1 = clips.get("idle1")!.duration,
      idle2 = clips.get("idle2")!.duration;
    const t = ((pose.time ?? 0) * WEAPON_ANIMATION_RATE) % (idle1 + idle2);
    name = t < idle1 ? "idle1" : "idle2";
    progress = t < idle1 ? t / idle1 : (t - idle1) / idle2;
  }
  const action = rig.actions.get(name)!;
  if (rig.current !== name) {
    rig.mixer.stopAllAction();
    action.reset().play();
    rig.current = name;
  }
  action.paused = true;
  action.time = T.MathUtils.clamp(progress, 0, 1) * action.getClip().duration;
  rig.mixer.update(0);
  rig.source.updateMatrixWorld(true);
  group.position.set(0.05 + pose.sway, -0.025 + pose.bob, -0.025);
  group.rotation.set(0, 0, 0);
  group.updateWorldMatrix(true, true);
  world.multiplyMatrices(group.matrixWorld, cameraBasis);
  for (const { target, source } of rig.bindings) {
    parentInverse.copy(target.parent!.matrixWorld).invert();
    matrix.copy(parentInverse).multiply(world).multiply(source.matrixWorld);
    matrix.decompose(target.position, target.quaternion, target.scale);
    target.updateWorldMatrix(false, false);
  }
  rig.arms.updateMatrixWorld(true);
  matrix
    .copy(cameraBasis)
    .multiply(rig.weapon.matrixWorld)
    .multiply(rig.secondary.matrixWorld)
    .multiply(rig.meshToSource);
  matrix.decompose(rig.model.position, rig.model.quaternion, rig.model.scale);
  for (const [marker, side] of [
    [rig.left, "L"],
    [rig.right, "R"],
  ] as const) {
    matrix.copy(cameraBasis).multiply(rig.source.getObjectByName(`hand_${side}`)!.matrixWorld);
    matrix.decompose(position, quaternion, scale);
    marker.position.copy(position);
    marker.quaternion.copy(quaternion);
  }
  return true;
}
