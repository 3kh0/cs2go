import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { loadModel } from "./gltf";
import { assetFetch } from "./asset-url";
import { loadViewHands, viewHandsTemplate } from "./knife-motion";
import { registerActorLighting, disposeActorLighting } from "./actor-lighting";
import { updateGloveModel, unregisterGloveModel, type GloveChoice } from "./gloves";
import { forearmTwists, updateForearmTwists } from "./forearm-twist";
import type { Team } from "@cs2go/protocol";

export type HealthshotViewPhase = "draw" | "idle" | "use";
export type HealthshotSoundCue = { kind: "prepare" | "thud"; time: number };
export type HealthshotViewTiming = {
  draw: number;
  use: number;
  commit: number;
  sounds: readonly HealthshotSoundCue[];
};
type NativeHealthshotTiming = Omit<HealthshotViewTiming, "sounds"> & {
  events: HealthshotSoundCue[];
  sourceEvent: { id: string; frame: number; frameRate: number };
};

/** Shipped healthshot clips sampled in seconds on the fixed simulation clock.
 * This class presents the action; it never awards healing or consumes an item. */
export class HealthshotView extends T.Group {
  private loading?: Promise<HealthshotViewTiming>;
  private source?: T.Group;
  private arms?: T.Group;
  private model?: T.Group;
  private attachment?: T.Object3D;
  private mixer?: T.AnimationMixer;
  private actions = new Map<HealthshotViewPhase, T.AnimationAction>();
  private bindings: { target: T.Bone; source: T.Object3D }[] = [];
  private twists: ReturnType<typeof forearmTwists> = [];
  private weaponBindings: { target: T.Bone; source: T.Object3D }[] = [];
  private scratch = new T.Matrix4();
  private basis = new T.Matrix4().makeRotationY(Math.PI);
  private inches = new T.Matrix4().makeScale(0.0254, 0.0254, 0.0254);
  private modelBasis = new T.Matrix4();
  private timing?: HealthshotViewTiming;

  constructor() {
    super();
    this.name = "native-healthshot-view";
    this.visible = false;
  }
  get ready() {
    return !!this.timing;
  }
  prepare(): Promise<HealthshotViewTiming> {
    return (this.loading ??= this.load().catch((error: unknown) => {
      this.loading = undefined;
      throw error;
    }));
  }
  private async load(): Promise<HealthshotViewTiming> {
    const [body, draw, idle, inject, timing] = await Promise.all([
      loadModel("/models/viewmodels/healthshot/model.glb"),
      loadModel("/models/viewmodels/healthshot/draw.glb"),
      loadModel("/models/viewmodels/healthshot/idle.glb"),
      loadModel("/models/viewmodels/healthshot/inject.glb"),
      assetFetch("/models/viewmodels/healthshot/timing.json").then(async (response) => {
        if (!response.ok) throw new Error("Native healthshot timing metadata could not load");
        return (await response.json()) as NativeHealthshotTiming;
      }),
      loadViewHands(),
    ]);
    // Keep the body model separate from its two motion skeletons. Three's
    // name-based tracks must not bind the duplicate "weapon" bone in the mesh.
    const source = idle.scene;
    const clips = { draw: draw.animations[0], idle: idle.animations[0], use: inject.animations[0] };
    if (Object.values(clips).some((clip) => !clip))
      throw new Error("Native healthshot animation clip is missing");
    // VRF's direct animation GLBs omit CNmIDEvent metadata. The companion
    // record retains the compiled clip's verified frame 20 injection event.
    const commit = timing.commit;
    const event = timing.sourceEvent;
    if (
      !Number.isFinite(commit) ||
      commit < 0 ||
      commit > clips.use.duration ||
      event?.id !== "WPN_HEALTHSHOT_INJECT" ||
      !(event.frameRate > 0) ||
      Math.abs(commit - event.frame / event.frameRate) > 0.00001 ||
      Math.abs(timing.draw - clips.draw.duration) > 0.0001 ||
      Math.abs(timing.use - clips.use.duration) > 0.0001
    )
      throw new Error("Native healthshot injection timing does not match its clips");
    const attachment = source.getObjectByName("wpn");
    const weapon = body.scene.getObjectByName("weapon");
    if (!attachment || !weapon) throw new Error("Native healthshot attachment skeleton is missing");
    const arms = clone(viewHandsTemplate()) as T.Group;
    arms.name = "healthshot-view-arms";
    const bindings: HealthshotView["bindings"] = [];
    arms.traverse((target) => {
      if (target instanceof T.Mesh) {
        target.frustumCulled = false;
        target.material = Array.isArray(target.material)
          ? target.material.map((material) => material.clone())
          : target.material.clone();
      }
      if (
        !(target instanceof T.Bone) ||
        !/^(arm_upper_|arm_lower_|hand_|finger_)/.test(target.name)
      )
        return;
      const from =
        source.getObjectByName(`vmrig_${target.name}`) ?? source.getObjectByName(target.name);
      if (from) bindings.push({ target, source: from });
    });
    if (
      !bindings.some((binding) => binding.target.name === "hand_R") ||
      !bindings.some((binding) => binding.target.name === "hand_L")
    )
      throw new Error("Native healthshot hand tracks are missing");
    const weaponBindings: HealthshotView["weaponBindings"] = [];
    body.scene.traverse((object) => {
      if (object instanceof T.Mesh) object.frustumCulled = false;
      if (object instanceof T.Bone) {
        const from = source.getObjectByName(object.name);
        if (from) weaponBindings.push({ target: object, source: from });
      }
    });
    body.scene.updateMatrixWorld(true);
    this.modelBasis.copy(weapon.matrixWorld).invert();
    this.source = source;
    this.arms = arms;
    this.model = body.scene;
    this.weaponBindings = weaponBindings;
    this.attachment = attachment;
    this.bindings = bindings;
    this.twists = forearmTwists(arms);
    this.mixer = new T.AnimationMixer(source);
    for (const phase of Object.keys(clips) as HealthshotViewPhase[]) {
      const action = this.mixer.clipAction(clips[phase]).setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
      this.actions.set(phase, action);
    }
    this.add(arms, this.model);
    registerActorLighting(this);
    this.timing = {
      draw: clips.draw.duration,
      use: clips.use.duration,
      commit,
      sounds: timing.events,
    };
    this.sample("idle", 0);
    return this.timing;
  }

  sample(
    phase: HealthshotViewPhase,
    elapsed: number,
    team: Team = "ct",
    glove?: GloveChoice,
    agentId?: string,
  ) {
    if (!this.timing || !this.source || !this.arms || !this.model || !this.attachment) return false;
    const action = this.actions.get(phase)!;
    const duration = action.getClip().duration;
    this.mixer!.stopAllAction();
    action.reset().play();
    action.paused = true;
    action.time =
      phase === "idle" ? Math.max(0, elapsed) % duration : T.MathUtils.clamp(elapsed, 0, duration);
    this.mixer!.update(0);
    this.source.updateMatrixWorld(true);
    this.updateMatrixWorld(true);
    for (const { target, source } of this.bindings) {
      this.scratch
        .copy(target.parent!.matrixWorld)
        .invert()
        .multiply(this.matrixWorld)
        .multiply(this.basis)
        .multiply(source.matrixWorld)
        .multiply(this.inches);
      this.scratch.decompose(target.position, target.quaternion, target.scale);
      target.updateWorldMatrix(false, false);
    }
    updateForearmTwists(this.twists);
    this.arms.updateMatrixWorld(true);
    for (const { target, source } of this.weaponBindings) {
      target.position.copy(source.position);
      target.quaternion.copy(source.quaternion);
      target.scale.copy(source.scale);
    }
    this.scratch.copy(this.basis).multiply(this.attachment.matrixWorld).multiply(this.modelBasis);
    this.scratch.decompose(this.model.position, this.model.quaternion, this.model.scale);
    this.model.updateMatrixWorld(true);
    updateGloveModel(this.arms, team, glove, false, agentId);
    this.userData.phase = phase;
    this.userData.clip = action.getClip().name;
    this.userData.time = action.time;
    return true;
  }

  dispose() {
    if (this.arms) unregisterGloveModel(this.arms);
    disposeActorLighting(this);
    this.mixer?.stopAllAction();
    const materials = new Set<T.Material>();
    const geometries = new Set<T.BufferGeometry>();
    const textures = new Set<T.Texture>();
    this.model?.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof T.Texture) textures.add(value);
      }
      if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
    });
    this.arms?.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
      if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
    });
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
    this.clear();
    this.visible = false;
    this.timing = undefined;
  }
}
