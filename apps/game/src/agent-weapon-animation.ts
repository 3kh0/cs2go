import * as T from "three";
import { nativeWorldRig } from "./weapon-motion";

type Binding = { target: T.Bone; source: T.Object3D; scale: T.Vector3; sourceScale: T.Vector3 };
const position = new T.Vector3(),
  rotation = new T.Quaternion(),
  scale = new T.Vector3();
const matrix = new T.Matrix4(),
  world = new T.Matrix4(),
  parentInverse = new T.Matrix4();
const metric = (frame: T.Matrix4) => {
  frame.decompose(position, rotation, scale);
  return new T.Matrix4().compose(position, rotation, new T.Vector3(1, 1, 1));
};

/** The authored @weapon skeleton runs beside the body, on the same clock and
 * blend weights. Its locals are metres; the weapon mesh's skin stays in its
 * original Source basis, so convert world frames while retaining bind scale. */
export class AgentWeaponAnimation {
  private source: T.Object3D;
  private mixer: T.AnimationMixer;
  private actions = new Map<T.AnimationAction, T.AnimationAction>();
  private active = new Set<T.AnimationAction>();
  private variants = new Map<T.Object3D, { frame: T.Matrix4; bindings: Binding[] }>();
  private inverse: T.Matrix4;
  private children = -1;
  private restScales = new Map<string, T.Vector3>();
  private weapon: T.Group;
  constructor(weapon: T.Group, source: T.Group) {
    this.weapon = weapon;
    this.source = source.getObjectByName("weapon")!.clone(true);
    this.source.updateMatrixWorld(true);
    this.source.traverse((node) =>
      this.restScales.set(node.name, node.getWorldScale(new T.Vector3())),
    );
    this.inverse = metric(
      (this.source.getObjectByName("weapon_offset") ?? this.source).matrixWorld,
    ).invert();
    this.mixer = new T.AnimationMixer(this.source);
  }
  bind(body: T.AnimationAction, clip?: T.AnimationClip) {
    if (!clip || this.actions.has(body)) return;
    const action = this.mixer.clipAction(clip.clone());
    action.setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    this.actions.set(body, action);
  }
  update() {
    for (const action of this.active) action.setEffectiveWeight(0);
    for (const [body, action] of this.actions) {
      const weight = body.getEffectiveWeight();
      if (weight <= 0 || !body.isScheduled()) continue;
      action.play().setEffectiveWeight(weight);
      action.time = body.time;
      this.active.add(action);
    }
    for (const action of this.active)
      if (action.getEffectiveWeight() === 0) {
        action.stop();
        this.active.delete(action);
      }
    this.mixer.update(0);
    this.source.updateMatrixWorld(true);
    this.weapon.updateWorldMatrix(true, true);
    if (this.children !== this.weapon.children.length)
      this.weapon.traverse((group) => {
        const rig = nativeWorldRig(group);
        if (!rig || this.variants.has(group)) return;
        const bindings: Binding[] = [];
        rig.model.traverse((target) => {
          const source = this.source.getObjectByName(target.name);
          if (target instanceof T.Bone && source)
            bindings.push({
              target,
              source,
              scale: target.getWorldScale(new T.Vector3()),
              sourceScale: this.restScales.get(source.name)!,
            });
        });
        this.variants.set(group, { frame: metric(rig.frame).multiply(this.inverse), bindings });
      });
    this.children = this.weapon.children.length;
    for (const [group, variant] of this.variants) {
      world.multiplyMatrices(group.matrixWorld, variant.frame);
      for (const binding of variant.bindings) {
        matrix.multiplyMatrices(world, binding.source.matrixWorld);
        matrix.decompose(position, rotation, scale);
        scale.divide(binding.sourceScale).multiply(binding.scale);
        matrix.compose(position, rotation, scale);
        matrix.premultiply(parentInverse.copy(binding.target.parent!.matrixWorld).invert());
        matrix.decompose(binding.target.position, binding.target.quaternion, binding.target.scale);
        binding.target.updateWorldMatrix(false, false);
      }
    }
  }
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.source);
    this.actions.clear();
    this.active.clear();
    this.variants.clear();
  }
}
