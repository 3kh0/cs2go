import { forearmTwists, updateForearmTwists } from "./forearm-twist";
import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { loadModel } from "./gltf";
import { viewHandsTemplate, type KnifePose } from "./knife-motion";
import { knifeDefinitions } from "./physics";
import { KNIFE_ANIMATION_RATE, knifeTiming, restoreKnifeTiming } from "./knife-timing";
import { registerSkinModel } from "./skins";

type Template = { scene: T.Group; clips: Map<string, T.AnimationClip> };
const templates = new Map<number, Template>();
function motionName(name: string) {
  // Defaults call their first idle "idle", while other knives call it "idle1".
  const short = name.split("/").at(-1)!;
  const motion =
    /^(idle\d*|draw\d*|lookat\d+(?:_draw)?|(?:light|heavy)_(?:hit|miss)\d+)(?:_|$)/.exec(
      short,
    )?.[1];
  return motion === "idle" ? "idle1" : motion;
}
export async function loadInspectsKnives(reflections: T.Texture) {
  await Promise.all(
    knifeDefinitions
      .filter(({ id }) => id !== 4)
      .map(async ({ icon, id }) => {
        const asset = await loadModel(`/models/animations/knives/${icon}.glb`);
        asset.scene.traverse((o) => {
          if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial) {
            o.material.envMap = reflections;
            o.material.envMapIntensity = 1.2;
          }
        });
        const clips = new Map<string, T.AnimationClip>();
        for (const clip of asset.animations) {
          const name = clip.name.includes("/") && motionName(clip.name);
          if (name) clips.set(name, restoreKnifeTiming(clip, knifeTiming(id, name)));
        }
        for (const name of ["idle1", "draw", "light_miss1", "heavy_miss1"])
          if (!clips.has(name)) throw new Error(`Missing ${icon} knife motion: ${name}`);
        if (![...clips.keys()].some((name) => name.startsWith("lookat")))
          throw new Error(`Missing ${icon} knife inspection`);
        templates.set(id, { scene: asset.scene, clips });
      }),
  );
}
export function sourceKnifeDrawDuration(index: number) {
  return (templates.get(index)?.clips.get("draw")?.duration ?? 1) / KNIFE_ANIMATION_RATE;
}
export function sourceKnifeInspectDuration(index: number, variant: number) {
  const clips = [...templates.get(index)!.clips]
    .filter(([name]) => name.startsWith("lookat"))
    .map(([, clip]) => clip);
  return clips[variant % clips.length].duration / KNIFE_ANIMATION_RATE;
}
export function sourceKnifeAttackDuration(index: number, stab: boolean, alternate: boolean) {
  const clips = templates.get(index)!.clips;
  const prefix = stab ? "heavy" : "light";
  const variant = stab ? 1 : alternate ? 2 : 1;
  return (
    Math.max(
      clips.get(`${prefix}_miss${variant}`)!.duration,
      clips.get(`${prefix}_hit${variant}`)?.duration ?? 0,
    ) / KNIFE_ANIMATION_RATE
  );
}
const rigs = new WeakMap<T.Group, ReturnType<typeof makeRig>>();
function makeRig(index: number, group: T.Group) {
  const template = templates.get(index)!;
  const source = clone(template.scene) as T.Group;
  const model = clone(template.scene) as T.Group;
  model.name = "weapon-model";
  const arms = clone(viewHandsTemplate()) as T.Group;
  arms.name = "agent-view-arms";
  group.add(model, arms);
  const bindings: { target: T.Object3D; source: T.Object3D }[] = [];
  arms.traverse((target) => {
    const bone = source.getObjectByName(`vmrig_${target.name}`);
    if (
      target instanceof T.Bone &&
      bone &&
      /^(arm_upper_|arm_lower_|hand_|finger_)/.test(target.name)
    )
      bindings.push({ target, source: bone });
  });
  const weaponBindings: { target: T.Object3D; source: T.Object3D }[] = [];
  model.traverse((target) => {
    if (target instanceof T.Mesh) {
      target.frustumCulled = false;
      // Each viewmodel owns its materials; painting must not mutate templates.
      const copy = (material: T.Material) => {
        const own = material.clone();
        if (index === 5 || index === 6)
          own.name = index === 5 ? "weapon_knife_butterfly" : "weapon_knife_karambit";
        return own;
      };
      target.material = Array.isArray(target.material)
        ? target.material.map(copy)
        : copy(target.material);
    }
    if (target instanceof T.Bone && !target.name.startsWith("vmrig_"))
      weaponBindings.push({ target, source: source.getObjectByName(target.name)! });
  });
  registerSkinModel(model, index);
  arms.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.frustumCulled = false;
      // Per-view probe uniforms must never modify the shared hand template.
      o.material = Array.isArray(o.material)
        ? o.material.map((material) => material.clone())
        : o.material.clone();
    }
  });
  source.updateMatrixWorld(true);
  const modelBasis = source.getObjectByName("weapon")!.matrixWorld.clone().invert();
  const mixer = new T.AnimationMixer(source);
  const actions = new Map(
    [...template.clips].map(([name, c]) => {
      const action = mixer.clipAction(c);
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
      return [name, action] as const;
    }),
  );
  return {
    source,
    model,
    arms,
    bindings,
    twists: forearmTwists(arms),
    weaponBindings,
    modelBasis,
    mixer,
    actions,
    current: "",
    attachment: source.getObjectByName("vmrig_wpn")!,
  };
}
export function createInspectsKnife(group: T.Group, index: number) {
  rigs.set(group, makeRig(index, group));
}
const basis = new T.Matrix4().makeRotationY(Math.PI),
  inches = new T.Matrix4().makeScale(0.0254, 0.0254, 0.0254),
  matrix = new T.Matrix4();
export function animateInspectsKnife(
  group: T.Group,
  pose: KnifePose & { inspectVariant?: number },
) {
  const rig = rigs.get(group);
  if (!rig) return false;
  let name = "idle1",
    progress = 0;
  if (pose.draw > 0) {
    name = "draw";
    progress = 1 - pose.draw;
  } else if (pose.knifeActive) {
    const attack = pose.stab ? "heavy" : "light";
    const variant = pose.stab ? 1 : pose.alternate ? 2 : 1;
    const contact = `${attack}_${pose.knifeContact ? "hit" : "miss"}${variant}`;
    name = rig.actions.has(contact) ? contact : `${attack}_miss${variant}`;
    progress = pose.knife ?? 0;
  } else if (pose.inspectActive) {
    const choices = [...rig.actions.keys()].filter((n) => n.startsWith("lookat"));
    name = choices[(pose.inspectVariant ?? 0) % choices.length];
    progress = pose.inspect ?? 0;
  } else {
    const a = rig.actions.get("idle1")!.getClip().duration,
      b = rig.actions.get("idle2")?.getClip().duration ?? 0,
      t = ((pose.time ?? 0) * KNIFE_ANIMATION_RATE) % (a + b);
    name = t < a ? "idle1" : "idle2";
    progress = t < a ? t / a : (t - a) / b;
  }
  const action = rig.actions.get(name)!;
  if (pose.knifeActive && pose.knifeElapsed !== undefined)
    progress = (pose.knifeElapsed * KNIFE_ANIMATION_RATE) / action.getClip().duration;
  if (rig.current !== name) {
    rig.mixer.stopAllAction();
    action.reset().play();
    rig.current = name;
  }
  action.paused = true;
  action.time = T.MathUtils.clamp(progress, 0, 1) * action.getClip().duration;
  rig.mixer.update(0);
  rig.source.updateMatrixWorld(true);
  group.position.set(pose.sway, pose.bob, 0);
  group.updateWorldMatrix(true, true);
  for (const { target, source } of rig.bindings) {
    matrix
      .copy(target.parent!.matrixWorld)
      .invert()
      .multiply(group.matrixWorld)
      .multiply(basis)
      .multiply(source.matrixWorld)
      .multiply(inches);
    matrix.decompose(target.position, target.quaternion, target.scale);
    target.updateWorldMatrix(false, false);
  }
  updateForearmTwists(rig.twists);
  for (const { target, source } of rig.weaponBindings) {
    target.position.copy(source.position);
    target.quaternion.copy(source.quaternion);
    target.scale.copy(source.scale);
  }
  matrix.copy(basis).multiply(rig.attachment.matrixWorld).multiply(rig.modelBasis);
  matrix.decompose(rig.model.position, rig.model.quaternion, rig.model.scale);
  rig.model.updateMatrixWorld(true);
  rig.arms.updateMatrixWorld(true);
  return true;
}

/** A frozen native knife model for the menu; it never includes the view arms. */
export function createInspectsWorldKnife(index: number) {
  const template = templates.get(index)!;
  const model = clone(template.scene) as T.Group;
  model.traverse((object) => {
    if (object instanceof T.Mesh) {
      object.frustumCulled = false;
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material)
        ? object.material.map((m) => m.clone())
        : object.material.clone();
    }
  });
  const idle = template.clips.get("idle1")!;
  new T.AnimationMixer(model).clipAction(idle).play().getMixer().update(0);
  model.updateMatrixWorld(true);
  const position = new T.Vector3(),
    rotation = new T.Quaternion(),
    scale = new T.Vector3();
  model.getObjectByName("weapon")!.matrixWorld.decompose(position, rotation, scale);
  const group = new T.Group();
  group.add(model);
  group.userData.ownedWorldGun = true;
  group.userData.buyGrip = new T.Matrix4()
    .compose(position, rotation, new T.Vector3(1, 1, 1))
    .toArray();
  return group;
}
