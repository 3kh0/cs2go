import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { viewHandsTemplate } from "./knife-motion";
import { createGrenadeModel, createGrenadeMotion } from "./grenade-models";
import type { GrenadeKind } from "./utility";
import type { GrenadeHandling } from "./grenade-handling";
import { forearmTwists, updateForearmTwists } from "./forearm-twist";
import { updateGloveModel } from "./gloves";
import type { Team } from "@cs2go/protocol";

type Rig = {
  group: T.Group;
  source: T.Group;
  arms: T.Group;
  model: T.Object3D;
  mixer: T.AnimationMixer;
  actions: Map<string, T.AnimationAction>;
  hands: { target: T.Bone; source: T.Object3D }[];
  twists: ReturnType<typeof forearmTwists>;
  weapon: { target: T.Bone; source: T.Object3D }[];
  attachment: T.Object3D;
  modelBasis: T.Matrix4;
};
/** Native pinned clips sampled on the same fixed clock as the grenade lifecycle. */
export class GrenadeView {
  group = new T.Group();
  rigs = new Map<GrenadeKind, Rig>();
  selected: GrenadeKind | null = null;
  selectedAt = 0;
  scratch = new T.Matrix4();
  basis = new T.Matrix4().makeRotationY(Math.PI);
  inches = new T.Matrix4().makeScale(0.0254, 0.0254, 0.0254);
  create(kind: GrenadeKind) {
    const motion = createGrenadeMotion(kind),
      model = createGrenadeModel(kind);
    if (!motion || !model) return null;
    const source = motion.source,
      arms = clone(viewHandsTemplate()) as T.Group;
    const group = new T.Group();
    group.add(arms, model);
    this.group.add(group);
    const mixer = new T.AnimationMixer(source);
    const actions = new Map(
      motion.clips.map(([name, clip]) => {
        const action = mixer.clipAction(clip).setLoop(T.LoopOnce, 1);
        action.clampWhenFinished = true;
        return [name, action] as const;
      }),
    );
    const hands: Rig["hands"] = [],
      weapon: Rig["weapon"] = [];
    arms.traverse((target) => {
      if (target instanceof T.Mesh) target.frustumCulled = false;
      if (
        !(target instanceof T.Bone) ||
        !/^(arm_upper_|arm_lower_|hand_|finger_)/.test(target.name)
      )
        return;
      const from = source.getObjectByName(target.name);
      if (from) hands.push({ target, source: from });
    });
    model.updateMatrixWorld(true);
    const modelBasis = new T.Matrix4().copy(model.getObjectByName("weapon")!.matrixWorld).invert();
    model.traverse((target) => {
      if (!(target instanceof T.Bone)) return;
      const from = source.getObjectByName(target.name);
      if (from) weapon.push({ target, source: from });
    });
    const rig = {
      group,
      source,
      arms,
      model,
      mixer,
      actions,
      hands,
      twists: forearmTwists(arms),
      weapon,
      attachment: source.getObjectByName("wpn")!,
      modelBasis,
    };
    this.rigs.set(kind, rig);
    return rig;
  }
  update(kind: GrenadeKind, handling: GrenadeHandling, clock = 0, team: Team = "ct") {
    if (this.selected !== kind) {
      this.selected = kind;
      this.selectedAt = clock;
    }
    const rig = this.rigs.get(kind) ?? this.create(kind);
    if (!rig) return;
    for (const [id, other] of this.rigs) other.group.visible = id === kind;
    let name = "idle",
      time = clock - this.selectedAt;
    if (handling.phase === "pin") {
      name = "pullpin";
      time = handling.elapsed;
    } else if (handling.phase === "held") {
      name =
        handling.strength > 0.75
          ? "throwcharge_high"
          : handling.strength < 0.25
            ? "throwcharge_low"
            : "throwcharge_mid";
      time = handling.elapsed;
    } else if (handling.phase === "release") {
      name = handling.strength < 0.25 ? "throw_underhand" : "throw_overhand";
      time = handling.elapsed;
    } else if (time < rig.actions.get("draw")!.getClip().duration) name = "draw";
    rig.mixer.stopAllAction();
    const action = rig.actions.get(name)!;
    action.reset().play();
    action.paused = true;
    action.time = Math.min(time, action.getClip().duration);
    rig.mixer.update(0);
    rig.source.updateMatrixWorld(true);
    this.group.updateWorldMatrix(true, true);
    for (const { target, source } of rig.hands) {
      this.scratch
        .copy(target.parent!.matrixWorld)
        .invert()
        .multiply(rig.group.matrixWorld)
        .multiply(this.basis)
        .multiply(source.matrixWorld)
        .multiply(this.inches);
      this.scratch.decompose(target.position, target.quaternion, target.scale);
      target.updateWorldMatrix(false, false);
    }
    updateForearmTwists(rig.twists);
    for (const { target, source } of rig.weapon) {
      target.position.copy(source.position);
      target.quaternion.copy(source.quaternion);
      target.scale.copy(source.scale);
    }
    this.scratch.copy(this.basis).multiply(rig.attachment.matrixWorld).multiply(rig.modelBasis);
    this.scratch.decompose(rig.model.position, rig.model.quaternion, rig.model.scale);
    rig.model.visible = !handling.released;
    rig.group.updateMatrixWorld(true);
    updateGloveModel(rig.arms, team);
  }
}
