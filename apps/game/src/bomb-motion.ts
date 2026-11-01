import { registerActorLighting } from "./actor-lighting";
import * as T from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { loadModel } from "./gltf";
import { viewHandsTemplate } from "./knife-motion";
import { armoryReflections } from "./reflections";
import { updateGloveModel } from "./gloves";

export const PLANT_DURATION = 3.2;
// The weapon attachment stops changing at frame 89 (30 fps), then holds its
// lowered pose through 3.8667s. Map visible placement onto the 3.2s game action.
export const PLANT_ANIMATION_END = 89 / 30;

/** The supplied meter-scale C4 clip, sampled directly from simulation progress. */
export class BombPlantModel extends T.Group {
  private mixer?: T.AnimationMixer;
  private action?: T.AnimationAction;
  protected source?: T.Group;
  protected arms?: T.Group;
  private attachment?: T.Object3D;
  protected weapon?: T.Object3D;
  private bindings: { target: T.Bone; source: T.Object3D }[] = [];
  private scratch = new T.Matrix4();
  private basis = new T.Matrix4().makeRotationY(Math.PI);
  private inches = new T.Matrix4().makeScale(0.0254, 0.0254, 0.0254);
  private modelBasis = new T.Matrix4();

  async load(renderer: T.WebGLRenderer) {
    const [motion, textured] = await Promise.all([
      loadModel("/models/animations/c4/plant.glb"),
      loadModel("/models/c4.glb"),
    ]);
    const materials = new Map<string, T.Material>();
    textured.scene.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.set(material.name, material);
    });
    this.source = motion.scene;
    this.source.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.frustumCulled = false;
      // The tiny first body primitive is the unsupported Panorama overlay.
      const screen = object.name.includes("c4_screen");
      object.geometry.computeBoundingBox();
      if (!screen && object.geometry.boundingBox!.getSize(new T.Vector3()).y < 0.001) {
        object.visible = false;
        return;
      }
      const material = materials.get(screen ? "weapon_c4_digits" : "weapon_c4")!.clone();
      if (material instanceof T.MeshStandardMaterial) {
        for (const key of [
          "map",
          "normalMap",
          "roughnessMap",
          "metalnessMap",
          "aoMap",
          "emissiveMap",
        ] as const) {
          const texture = material[key];
          if (!texture) continue;
          material[key] = texture.clone();
          material[key]!.offset.set(0, 0);
          material[key]!.repeat.set(1, 1);
        }
        material.envMap = armoryReflections(renderer);
        material.envMapIntensity = 1.6;
        material.aoMapIntensity = 0.65;
      }
      object.material = material;
    });
    this.arms = clone(viewHandsTemplate()) as T.Group;
    this.arms.name = "plant-view-arms";
    // Isolate shared hand materials before attaching per-view lighting uniforms.
    this.arms.traverse((object) => {
      if (object instanceof T.Mesh)
        object.material = Array.isArray(object.material)
          ? object.material.map((material) => material.clone())
          : object.material.clone();
    });
    this.arms.traverse((target) => {
      if (target instanceof T.Mesh) target.frustumCulled = false;
      if (
        !(target instanceof T.Bone) ||
        !/^(arm_upper_|arm_lower_|hand_|finger_)/.test(target.name)
      )
        return;
      const source = this.source!.getObjectByName(`vmrig_${target.name}`);
      if (source) this.bindings.push({ target, source });
    });
    this.attachment = this.source.getObjectByName("vmrig_wpn")!;
    this.source.updateMatrixWorld(true);
    this.modelBasis.copy(this.source.getObjectByName("weapon")!.matrixWorld).invert();
    this.weapon = this.source.children[0];
    this.mixer = new T.AnimationMixer(this.source);
    const clip = motion.animations.find((clip) => clip.name.endsWith("/plant_c4"))!;
    this.action = this.mixer.clipAction(clip);
    this.action.setLoop(T.LoopOnce, 1).play();
    this.action.clampWhenFinished = true;
    this.action.paused = true;
    this.add(this.arms, this.source);
    registerActorLighting(this);
    this.sample(0);
  }

  sample(progress: number) {
    this.sampleTime(T.MathUtils.clamp(progress, 0, 1) * PLANT_ANIMATION_END);
  }

  protected sampleTime(seconds: number) {
    if (!this.action || !this.source || !this.arms) return;
    this.action.time = T.MathUtils.clamp(seconds, 0, this.action.getClip().duration);
    this.mixer!.update(0);
    // Keep the motion skeleton in its original world space while transferring.
    this.source.rotation.y = 0;
    this.weapon!.position.set(0, 0, 0);
    this.weapon!.quaternion.identity();
    this.source.updateMatrixWorld(true);
    this.arms.updateMatrixWorld(true);
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
    this.scratch.copy(this.attachment!.matrixWorld).multiply(this.modelBasis);
    this.scratch.decompose(this.weapon!.position, this.weapon!.quaternion, this.weapon!.scale);
    this.source.rotation.y = Math.PI;
    this.source.updateMatrixWorld(true);
    this.arms.updateMatrixWorld(true);
    updateGloveModel(this.arms, this.userData.gloveTeam ?? "ct");
  }
}
