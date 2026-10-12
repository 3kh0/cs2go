import { WEAPON_ANIMATION_RATE } from "./physics";
import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { gltf } from "./gltf";
import { viewHandsTemplate } from "./knife-motion";
import type { WeaponSound } from "./audio";

const weapons = ["ak-47", "m4a1_s", "usp-s", "awp"];
const motions = ["idle", "draw", "reload", "shoot1", "lookat01"] as const;
type Motion = (typeof motions)[number];
type SoundCue = { time: number; kind: WeaponSound };
type ClipEvent = { m_flStartTime: { m_flValue: number }; m_name?: string };
type Template = {
  model: T.Group;
  source: T.Group;
  clips: Map<Motion, T.AnimationClip>;
  sounds: Map<Motion, SoundCue[]>;
};
const templates: Template[] = [];
export async function loadNativeWeapons() {
  await Promise.all(
    weapons.map(async (name, index) => {
      const [model, ...animations] = await Promise.all([
        gltf.loadAsync(`/models/viewmodels/${name}.glb`),
        ...motions.map((m) => gltf.loadAsync(`/models/viewmodels/${name}/${m}.glb`)),
      ]);
      templates[index] = {
        model: model.scene,
        source: animations[0].scene,
        sounds: new Map(
          animations.map((a, i) => {
            const data = a.parser.json as { animations: { extras?: { events?: ClipEvent[] } }[] };
            const cues: SoundCue[] = [];
            for (const event of data.animations[0].extras?.events ?? []) {
              const sound = event.m_name?.split(".").at(-1);
              const kind: WeaponSound | undefined =
                sound === "clipout"
                  ? "reload"
                  : sound === "clipin"
                    ? "reloadIn"
                    : sound === "boltpull" || sound === "boltback" || sound === "slideback"
                      ? "bolt"
                      : sound === "boltforward" || sound === "sliderelease"
                        ? "boltForward"
                        : sound === "draw" && index < 2
                          ? "draw"
                          : undefined;
              if (kind) cues.push({ time: event.m_flStartTime.m_flValue, kind });
            }
            return [motions[i], cues];
          }),
        ),
        clips: new Map(
          animations.map((a, i) => [
            motions[i],
            new T.AnimationClip(
              motions[i],
              a.animations[0].duration,
              a.animations.flatMap((c) => c.tracks),
            ).optimize(),
          ]),
        ),
      };
    }),
  );
}
export function nativeShotDuration(index: number) {
  return (templates[index]?.clips.get("shoot1")?.duration ?? 0) / WEAPON_ANIMATION_RATE;
}
export function nativeInspectDuration(index: number) {
  return (templates[index]?.clips.get("lookat01")?.duration ?? 0) / WEAPON_ANIMATION_RATE;
}
export function nativeSoundCues(index: number, motion: Motion) {
  return templates[index]?.sounds.get(motion) ?? [];
}
export function setNativeReflections(texture: T.Texture) {
  for (const template of templates)
    template.model.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof T.MeshStandardMaterial) {
          material.envMap = texture;
          material.envMapIntensity = 0.8;
        }
      }
    });
}
type Binding = { target: T.Object3D; source: T.Object3D };
type Rig = {
  index: number;
  arms: T.Group;
  model: T.Group;
  source: T.Group;
  mixer: T.AnimationMixer;
  actions: Map<Motion, T.AnimationAction>;
  current?: Motion;
  armsBindings: Binding[];
  weaponBindings: Binding[];
  attachment: T.Object3D;
  markers: { target: T.Object3D; source: T.Object3D }[];
  muzzle: T.Object3D;
  transitionStart: number;
  blend: {
    bone: T.Object3D;
    position: T.Vector3;
    quaternion: T.Quaternion;
    scale: T.Vector3;
    rawPosition: T.Vector3;
    rawQuaternion: T.Quaternion;
    rawScale: T.Vector3;
  }[];
};
const rigs = new WeakMap<T.Group, Rig>();
function prepare(template: T.Group) {
  const root = clone(template) as T.Group;
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.frustumCulled = false;
      o.geometry = o.geometry.clone();
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
    }
  });
  return root;
}
export function createNativeWeapon(group: T.Group, index: number) {
  const template = templates[index];
  if (!template) return false;
  const arms = prepare(viewHandsTemplate()),
    model = prepare(template.model),
    source = template.source.clone(true);
  arms.name = "agent-view-arms";
  model.name = "weapon-model";
  group.add(arms, model);
  const mixer = new T.AnimationMixer(source),
    actions = new Map<Motion, T.AnimationAction>();
  for (const [name, clip] of template.clips) {
    const action = mixer.clipAction(clip);
    action.setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    actions.set(name, action);
  }
  function bind(root: T.Group, filter: (name: string) => boolean) {
    const bindings: Binding[] = [];
    root.traverse((target) => {
      const bone = source.getObjectByName(target.name);
      if (target instanceof T.Bone && bone && filter(target.name))
        bindings.push({ target, source: bone });
    });
    return bindings;
  }
  const markers = ["L", "R"].map((side) => {
    const target = new T.Object3D();
    target.name = side === "L" ? "left-hand" : "right-hand";
    group.add(target);
    return { target, source: source.getObjectByName(`hand_${side}`)! };
  });
  const blend: Rig["blend"] = [];
  source.traverse((bone) =>
    blend.push({
      bone,
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone(),
      rawPosition: bone.position.clone(),
      rawQuaternion: bone.quaternion.clone(),
      rawScale: bone.scale.clone(),
    }),
  );
  rigs.set(group, {
    index,
    arms,
    model,
    source,
    mixer,
    actions,
    armsBindings: bind(arms, (n) => /^(arm_upper_|arm_lower_|hand_|finger_)/.test(n)),
    weaponBindings: bind(model, () => true),
    attachment: source.getObjectByName("wpn")!,
    markers,
    muzzle: source.getObjectByName("muzzle")!,
    transitionStart: -Infinity,
    blend,
  });
  return true;
}
const basis = new T.Matrix4().set(0, -0.0254, 0, 0, 0, 0, 0.0254, 0, -0.0254, 0, 0, 0, 0, 0, 0, 1);
const world = new T.Matrix4(),
  attachment = new T.Matrix4(),
  matrix = new T.Matrix4();
const markerScale = new T.Vector3();
export type NativePose = {
  clock?: number;
  inspect?: number;
  inspectActive?: boolean;
  draw: number;
  reload: number;
  reloadActive?: boolean;
  bolt: number;
  boltActive?: boolean;
  shot?: number;
  shotActive?: boolean;
  bob: number;
  sway: number;
};
export function animateNativeWeapon(group: T.Group, pose: NativePose) {
  const rig = rigs.get(group);
  if (!rig) return false;
  let name: Motion = "idle",
    progress = 0;
  if (pose.reloadActive || pose.reload > 0) {
    name = "reload";
    progress = pose.reload;
  } else if (pose.draw > 0) {
    name = "draw";
    progress = 1 - pose.draw;
  } else if (rig.index === 3 && (pose.boltActive || pose.bolt > 0)) {
    name = "shoot1";
    progress = pose.bolt;
  } else if (pose.shotActive) {
    name = "shoot1";
    progress = pose.shot ?? 0;
  } else if (pose.inspectActive) {
    name = "lookat01";
    progress = pose.inspect ?? 0;
  }
  const action = rig.actions.get(name)!;
  if (rig.current !== name) {
    // Blend interrupted actions in Source space so weapon attachments and hands
    // share the same transition. The fixed simulation clock freezes on pause.
    rig.transitionStart =
      rig.current &&
      name !== "draw" &&
      (name !== "shoot1" || rig.current === "lookat01") &&
      pose.clock !== undefined
        ? pose.clock
        : -Infinity;
    for (const state of rig.blend) {
      state.position.copy(state.bone.position);
      state.quaternion.copy(state.bone.quaternion);
      state.scale.copy(state.bone.scale);
    }
    rig.mixer.stopAllAction();
    action.reset().play();
    rig.current = name;
  }
  action.paused = true;
  action.time = T.MathUtils.clamp(progress, 0, 1) * action.getClip().duration;
  // PropertyMixer skips unchanged values; restore its last unblended output
  // before sampling, otherwise repeated paused frames would accumulate blending.
  for (const state of rig.blend) {
    state.bone.position.copy(state.rawPosition);
    state.bone.quaternion.copy(state.rawQuaternion);
    state.bone.scale.copy(state.rawScale);
  }
  rig.mixer.update(0);
  for (const state of rig.blend) {
    state.rawPosition.copy(state.bone.position);
    state.rawQuaternion.copy(state.bone.quaternion);
    state.rawScale.copy(state.bone.scale);
  }
  const blend = T.MathUtils.clamp(((pose.clock ?? 0) - rig.transitionStart) / 0.08, 0, 1);
  if (blend < 1)
    for (const state of rig.blend) {
      state.bone.position.lerp(state.position, 1 - blend);
      state.bone.quaternion.slerp(state.quaternion, 1 - blend);
      state.bone.scale.lerp(state.scale, 1 - blend);
    }
  rig.source.updateMatrixWorld(true);
  group.position.set(0.05 + pose.sway, -0.025 + pose.bob, -0.025);
  group.rotation.set(0, 0, 0);
  group.updateWorldMatrix(true, true);
  world.multiplyMatrices(group.matrixWorld, basis);
  attachment.copy(world).multiply(rig.attachment.matrixWorld);
  function apply(bindings: Binding[], root: T.Matrix4) {
    for (const { target, source } of bindings) {
      matrix.copy(target.parent!.matrixWorld).invert().multiply(root).multiply(source.matrixWorld);
      matrix.decompose(target.position, target.quaternion, target.scale);
      target.updateWorldMatrix(false, false);
    }
  }
  apply(rig.armsBindings, world);
  rig.arms.updateMatrixWorld(true);
  apply(rig.weaponBindings, attachment);
  rig.model.updateMatrixWorld(true);
  for (const { target, source } of rig.markers) {
    matrix.copy(basis).multiply(source.matrixWorld);
    matrix.decompose(target.position, target.quaternion, markerScale);
  }
  matrix.copy(basis).multiply(rig.attachment.matrixWorld).multiply(rig.muzzle.matrixWorld);
  group.userData.muzzle.setFromMatrixPosition(matrix);
  return true;
}
