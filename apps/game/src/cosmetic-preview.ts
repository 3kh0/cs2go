import * as T from "three";
import { acquireAgentAppearance, defaultAgent, type AgentDefinition } from "./agent-roster";
import {
  acquireAgentAnimation,
  agentAnimationWeaponIndex,
  agentClipForModel,
  completeAgentClip,
  ensureAgentAnimationBones,
} from "./agent-animations";
import { acquireGloveInspection, defaultGloveChoice, type GloveChoice } from "./gloves";
import { createSoldier, disposeSoldier, type Soldier, type AgentTeam } from "./soldier";
import { applyBuyPose, buyPoseToken } from "./buy-poses";
import { createWorldGun, disposeWorldGun, loadWeaponModels } from "./weapons";
import { createNativeWorldGun } from "./weapon-motion";
import { isKnife } from "./physics";
import { InspectionLighting, prepareInspectionLighting } from "./inspection-lighting";
import { MenuBackdrop, inspectionBackdropOptions } from "./menu-backdrop";
import { previewBounds, framePreview } from "./preview-framing";

/** Draft-owned cosmetics use the existing renderer/clock and never write equipment. */
export class CosmeticPreview {
  private scene = new T.Scene();
  private pivot = new T.Group();
  private camera = new T.PerspectiveCamera(30, 1, 0.01, 30);
  private backgroundCamera = new T.PerspectiveCamera();
  private lighting = new InspectionLighting(this.scene, "agent");
  private backdrop = new MenuBackdrop(inspectionBackdropOptions(this.lighting.postProcessing));
  private model?: T.Object3D;
  private soldier?: Soldier;
  private mixer?: T.AnimationMixer;
  private release?: () => void;
  private releaseClip?: () => void;
  private action?: T.AnimationAction;
  private hands: {
    target: T.Bone;
    source: T.Object3D;
    world: T.Matrix4;
    position: T.Vector3;
    quaternion: T.Quaternion;
    scale: T.Vector3;
  }[] = [];
  private attachment?: { hand: T.Object3D; matrix: T.Matrix4; inverse: T.Matrix4 };
  private version = 0;
  private open = false;
  private bounds = new T.Box3();
  private fittedAspect = 0;
  private team: AgentTeam = "ct";
  private category: "agents" | "gloves" = "agents";
  private view = new T.Vector4();
  private scissor = new T.Vector4();
  private size = new T.Vector2();
  private matrix = new T.Matrix4();
  private parent = new T.Matrix4();
  private position = new T.Vector3();
  private rotation = new T.Quaternion();
  private scale = new T.Vector3();
  private reduced = matchMedia("(prefers-reduced-motion: reduce)");
  private stage: HTMLElement;
  constructor(stage: HTMLElement) {
    this.stage = stage;
    this.scene.add(this.pivot);
  }
  get inspectionCamera() {
    return this.backgroundCamera;
  }
  private clear() {
    this.releaseClip?.();
    this.releaseClip = undefined;
    this.action = undefined;
    this.hands = [];
    this.mixer?.stopAllAction();
    this.mixer = undefined;
    this.release?.();
    this.release = undefined;
    this.model = undefined;
    this.soldier = undefined;
    this.attachment = undefined;
    this.pivot.clear();
  }
  hide() {
    this.version++;
    this.open = false;
    this.clear();
    this.backdrop.invalidate();
    delete this.stage.dataset.ready;
    delete this.stage.dataset.item;
    delete this.stage.dataset.animation;
  }
  async show(
    renderer: T.WebGLRenderer,
    team: AgentTeam,
    agent: AgentDefinition,
    gloves?: GloveChoice,
  ) {
    const version = ++this.version;
    this.open = true;
    this.clear();
    this.team = team;
    this.category = gloves ? "gloves" : "agents";
    this.stage.dataset.ready = "false";
    this.stage.dataset.category = this.category;
    this.lighting.setProfile(gloves ? "gloves" : "agent");
    await Promise.all([this.lighting.load(), prepareInspectionLighting(renderer)]);
    if (version !== this.version) return;
    if (gloves) {
      const lease = await acquireGloveInspection(gloves, team);
      if (version !== this.version) return lease.release();
      this.model = lease.model;
      this.release = () => lease.release();
      this.mixer = new T.AnimationMixer(lease.model);
      const clip = (name: string) => lease.animations.find((c) => c.name.endsWith(name));
      const loop = clip("pedestal_gloves_loop");
      const deploy = clip("pedestal_gloves_deploy");
      lease.model.traverse((target) => {
        if (
          !(target instanceof T.Bone) ||
          !/^(arm_upper_|arm_lower_|hand_|finger_)/.test(target.name)
        )
          return;
        const source = lease.model.getObjectByName(`vmrig_${target.name}`);
        if (source)
          this.hands.push({
            target,
            source,
            world: new T.Matrix4(),
            position: target.position.clone(),
            quaternion: target.quaternion.clone(),
            scale: target.scale.clone(),
          });
      });
      if (loop) this.action = this.mixer.clipAction(loop).play();
      this.mixer.update(0);
      this.pivot.add(lease.model);
      this.updateHands();
      this.frame();
      if (loop && deploy && !this.reduced.matches) {
        this.action?.stop();
        const intro = this.mixer.clipAction(deploy).setLoop(T.LoopOnce, 1).play();
        intro.clampWhenFinished = true;
        this.mixer.addEventListener("finished", () => {
          intro.stop();
          this.action?.reset().play();
        });
      }
      this.stage.dataset.item = gloves.id || `default-${team}`;
      this.stage.dataset.wear = String(gloves.wear);
      this.stage.dataset.seed = String(gloves.seed);
      this.stage.dataset.animation = loop?.name ?? "bind";
    } else {
      const appearance = await acquireAgentAppearance(agent.id);
      if (version !== this.version) return appearance?.release();
      const soldier = createSoldier(-1, team, appearance, false, defaultGloveChoice());
      soldier.group.visible = true;
      soldier.weapon.visible = false;
      this.model = soldier.group;
      this.soldier = soldier;
      this.mixer = soldier.mixer;
      this.release = () => disposeSoldier(soldier);
      this.pivot.add(this.model);
      await this.playAnimation(
        renderer,
        `base::${agent.sourcePose ?? (team === "ct" ? "cu_ct_pose01" : "cu_t_pose01")}`,
      );
      if (version !== this.version) return;
      this.stage.dataset.item = agent.id || defaultAgent(team).id;
      this.frame();
    }
    if (version !== this.version || !this.model) return;
    this.lighting.configureBackgroundCamera(this.backgroundCamera);
    this.camera.fov = this.backgroundCamera.fov;
    this.lighting.update(this.model, undefined, renderer);
    this.backdrop.invalidate();
    this.stage.dataset.ready = "true";
  }
  private frame() {
    if (!this.model) return;
    if (this.category === "gloves") {
      // The exported viewmodel faces +Z. Inspect from the player's side,
      // eight Source units behind its origin, rather than fitting an object
      // camera in front of the hands. Forearms naturally leave the bottom.
      this.camera.position.set(0, 0, -8 * 0.0254);
      this.camera.lookAt(0, 0, 1);
      this.fittedAspect = 0;
      return;
    }
    this.model.updateMatrixWorld(true);
    this.bounds.copy(previewBounds([this.model]));
    this.fittedAspect = 0;
    this.camera.position.set(0, 0, 3);
    this.camera.lookAt(0, 0, 0);
  }
  private updateHands() {
    if (!this.hands.length || !this.model) return;
    this.model.updateMatrixWorld(true);
    for (const hand of this.hands) hand.world.copy(hand.source.matrixWorld);
    // Merge the separately animated helper rig in world space. Its reverse-chain
    // hierarchy differs from the weighted skin, so local-track renaming is invalid.
    for (const { target, world } of this.hands) {
      this.matrix.copy(target.parent!.matrixWorld).invert().multiply(world);
      this.matrix.decompose(target.position, target.quaternion, target.scale);
      target.updateWorldMatrix(false, false);
    }
    this.model.updateMatrixWorld(true);
  }
  async playAnimation(renderer: T.WebGLRenderer, id: string) {
    const version = this.version;
    const soldier = this.soldier;
    if (!soldier) return;
    const clip = await acquireAgentAnimation(id);
    let index = 0;
    try {
      if (clip.definition.equipped !== "none") {
        index = await agentAnimationWeaponIndex(id, this.team === "ct" ? 9 : 0);
        await loadWeaponModels(renderer, [index]);
      }
      if (version !== this.version || soldier !== this.soldier) return;
      this.releaseClip?.();
      this.mixer!.stopAllAction();
      this.attachment = undefined;
      if (clip.definition.equipped !== "none") {
        const buy = applyBuyPose(soldier, buyPoseToken(index));
        disposeWorldGun(soldier.weapon);
        soldier.weapon = isKnife(index)
          ? createWorldGun(index)
          : createNativeWorldGun(index, true, buy.weaponBones, true);
        soldier.group.add(soldier.weapon);
        this.attachment = {
          hand: buy.hand,
          matrix: buy.matrix,
          inverse: new T.Matrix4().fromArray(soldier.weapon.userData.buyGrip).invert(),
        };
      }
      soldier.weapon.visible = clip.definition.equipped !== "none";
      ensureAgentAnimationBones(soldier.model, clip.pack.scene);
      this.action = this.mixer!.clipAction(
        completeAgentClip(agentClipForModel(clip.clip, soldier.model), soldier.model),
      ).reset();
      this.action.setLoop(
        clip.definition.loop ? T.LoopRepeat : T.LoopOnce,
        clip.definition.loop ? Infinity : 1,
      );
      this.action.clampWhenFinished = true;
      this.action.play();
      this.mixer!.update(0);
      this.releaseClip = clip.release;
      this.stage.dataset.animation = id;
    } finally {
      if (this.releaseClip !== clip.release) clip.release();
    }
  }
  render(renderer: T.WebGLRenderer, capture: () => void, environment?: T.Texture | null, dt = 0) {
    if (!this.open || !this.stage.checkVisibility()) return false;
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    // Helpers descend from weighted bones: restore the original skin pose before
    // sampling their transforms, then snapshot every helper before retargeting.
    for (const hand of this.hands) {
      hand.target.position.copy(hand.position);
      hand.target.quaternion.copy(hand.quaternion);
      hand.target.scale.copy(hand.scale);
    }
    if (!this.reduced.matches) this.mixer?.update(Math.min(dt, 0.1));
    this.updateHands();
    if (this.attachment && this.soldier) {
      const { hand, matrix, inverse } = this.attachment;
      this.soldier.group.updateMatrixWorld(true);
      this.matrix
        .copy(hand.matrixWorld)
        .multiply(matrix)
        .decompose(this.position, this.rotation, this.scale);
      this.matrix.compose(this.position, this.rotation, this.scale.set(1, 1, 1));
      this.matrix
        .premultiply(this.parent.copy(this.soldier.group.matrixWorld).invert())
        .multiply(inverse)
        .decompose(
          this.soldier.weapon.position,
          this.soldier.weapon.quaternion,
          this.soldier.weapon.scale,
        );
    }
    renderer.getSize(this.size);
    renderer.getViewport(this.view);
    renderer.getScissor(this.scissor);
    const auto = renderer.autoClear,
      tone = renderer.toneMapping,
      test = renderer.getScissorTest();
    try {
      renderer.setScissorTest(false);
      const aspect = this.size.x / this.size.y;
      if (this.backgroundCamera.aspect !== aspect) {
        this.backgroundCamera.aspect = aspect;
        this.backgroundCamera.updateProjectionMatrix();
        this.backdrop.invalidate();
      }
      this.backdrop.render(renderer, capture, this.team);
      if (this.model) {
        const canvas = renderer.domElement.getBoundingClientRect();
        const x = ((rect.left - canvas.left) * this.size.x) / canvas.width;
        const y = ((canvas.bottom - rect.bottom) * this.size.y) / canvas.height;
        const width = (rect.width * this.size.x) / canvas.width;
        const height = (rect.height * this.size.y) / canvas.height;
        if (this.fittedAspect !== width / height) {
          if (this.category === "gloves") {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.camera.updateMatrixWorld(true);
          } else framePreview(this.camera, this.bounds, width / height);
          this.fittedAspect = width / height;
        }
        this.lighting.update(this.model, environment, renderer);
        renderer.autoClear = false;
        renderer.toneMapping = T.CustomToneMapping;
        renderer.setViewport(x, y, width, height);
        renderer.setScissor(x, y, width, height);
        renderer.setScissorTest(true);
        renderer.clearDepth();
        renderer.render(this.scene, this.camera);
      }
    } finally {
      renderer.autoClear = auto;
      renderer.toneMapping = tone;
      renderer.setViewport(this.view);
      renderer.setScissor(this.scissor);
      renderer.setScissorTest(test);
    }
    return true;
  }
}
