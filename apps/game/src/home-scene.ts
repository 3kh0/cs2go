import { assetUrl } from "./asset-url";
import {
  acquireAgentAppearance,
  defaultAgent,
  peekSelectedAgent,
  selectedAgent,
  selectedAgentId,
  type AgentAppearance,
} from "./agent-roster";
import * as T from "three";
import { fetchGzipped } from "./gltf";
import { createSoldier, disposeSoldier, type Soldier, type AgentTeam } from "./soldier";
import { applyBuyPose, buyPoseToken, poseBuyProp } from "./buy-poses";
import { unregisterSkinModel } from "./skins";
import { createNativeWorldGun } from "./weapon-motion";
import { bayonetWorldGrip } from "./knife-motion";
import { registerActorLighting, updateActorLighting, setActorReflection } from "./actor-lighting";
import {
  sampleSourceProbe,
  sampleSourceProbeSun,
  sampleSourceProbeLocalShadows,
  nearestSourceProbe,
  loadSourceReflection,
} from "./source-lighting";
import { movePreviewHands } from "./preview-arm";
import {
  acquireAgentAnimation,
  loadAgentAnimations,
  agentWeaponAnimationPacks,
  agentAnimationWeaponIndex,
  ensureAgentAnimationBones,
  agentClipForModel,
  completeAgentClip,
  agentAnimationEquipment,
} from "./agent-animations";
import { createWorldGun, disposeWorldGun, loadWeaponModels, weaponModelReady } from "./weapons";
import { readHomeWeapons } from "./home-weapons";
import { createWeaponInstance } from "./weapon-instance";
import { isKnife, weaponSlot } from "./physics";
import { createGrenadeModel } from "./grenade-models";
import { HomeAtmosphere } from "./home-atmosphere";
import { withoutSourceColorCorrection } from "./map-color";

// uimodel_walkup.vnmgraph: linear, completion-driven transitions.
const homeBlendSeconds = 0.2;

type Pose = {
  clip: string;
  hand: string;
  weaponBones: Record<string, { p: number[]; q: number[]; s: number }>;
  frames: {
    time: number;
    bones: Record<string, { p: number[]; q: number[] }>;
    attachment: number[];
  }[];
};
type Preview = {
  soldier: Soldier;
  mixer: T.AnimationMixer;
  action: T.AnimationAction;
  weapon: T.Group;
  index: number;
  agentId: string;
  agentName: string;
  idleVariationLoad?: Promise<void>;
  idleVariation?: {
    actions: T.AnimationAction[];
    releases: (() => void)[];
    wait: number;
    current?: T.AnimationAction;
    entrance?: T.AnimationAction;
    idle?: T.AnimationAction;
    ready?: boolean;
    initialized?: boolean;
    anchor?: T.Object3D;
    returning: boolean;
    last: number;
    seed: number;
  };
  pairedGrips?: { hand: T.Object3D; bone: T.Object3D; offset: T.Matrix4 }[];
  animation?: {
    id: string;
    release: () => void;
    equipped: string;
    gripInverse: T.Matrix4;
    hand: T.Object3D;
    attachment: T.Matrix4;
    equipment?: string;
  };
};

/** The home scene shares the game's renderer and configurable menu clock. */
export class HomeScene {
  private scene = new T.Scene();
  private reflection?: T.WebGLRenderTarget;
  /** Shared native stage probe; inspectors borrow it without owning/disposal. */
  get inspectionEnvironment() {
    return this.reflection?.texture;
  }
  private reflectionLoad?: Promise<void>;
  private atmosphere?: HomeAtmosphere;
  private lightPosition = new T.Vector3();
  get backgroundCamera() {
    return this.camera;
  }
  get graphicsRoot() {
    return this.scene;
  }
  get previewRoots() {
    return Array.from(this.previews.values()).flatMap((preview) => [
      preview.soldier.model,
      preview.weapon,
    ]);
  }
  private framing = new WeakMap<Preview, T.Box3>();
  private framingPoint = new T.Vector3();
  private camera = new T.PerspectiveCamera(30, 1, 0.1016, 254);
  private poses!: Record<"t", { rifle: Pose }>;
  private previews = new Map<AgentTeam, Preview>();
  private namePosition = new T.Vector3();
  private reduced = matchMedia("(prefers-reduced-motion: reduce)");
  private current?: AgentTeam;
  private cameraPosition = new T.Vector3();
  private cameraDirection = new T.Vector3();
  private cameraRotation = new T.Quaternion();
  private pointer = new T.Vector2();
  private parallax = new T.Vector2();
  private floor = -9.674049 * 0.0254;
  private weapons = readHomeWeapons();
  get startupWeapons() {
    return [...new Set([0, 2, 9, this.weapons.ct, this.weapons.t])];
  }
  private renderer!: T.WebGLRenderer;
  private pendingWeapons = new Set<number>();
  private failedWeapons = new Set<number>();
  private pendingAgents = new Map<AgentTeam, string>();
  private failedAgents = new Set<string>();
  private agentPlayLock = false;
  private animationRequests = new Map<AgentTeam, number>();
  private animationFrame = new T.Matrix4();
  private animationParentInverse = new T.Matrix4();
  private animationPosition = new T.Vector3();
  private animationRotation = new T.Quaternion();
  private animationScale = new T.Vector3();
  private arrivedAgents = new Set<string>();
  private createWeapon(index: number, bones: Pose["weaponBones"]) {
    if (!isKnife(index)) return createNativeWorldGun(index, true, bones, true);
    const model = createWorldGun(index, true, createWeaponInstance(index, "player", true));
    if (index === 4) model.userData.buyGrip = bayonetWorldGrip(model).toArray();
    else if (buyPoseToken(index) === "push")
      model.userData.buyGrip = poseBuyProp(model, bones).toArray();
    return model;
  }
  private prepareIdleVariations(preview: Preview, team: AgentTeam) {
    return (preview.idleVariationLoad ??= this.loadIdleVariations(preview, team));
  }
  private async loadIdleVariations(preview: Preview, team: AgentTeam) {
    const state: NonNullable<Preview["idleVariation"]> = (preview.idleVariation = {
      actions: [] as T.AnimationAction[],
      releases: [] as (() => void)[],
      wait: 0,
      returning: false,
      last: -1,
      seed: (Math.random() * 0x7fffffff) | 1,
    });
    try {
      const catalog = await loadAgentAnimations();
      const weaponPacks = new Set(await agentWeaponAnimationPacks(preview.index));
      const candidates = catalog.filter(
        (clip) =>
          weaponPacks.has(clip.pack) &&
          clip.equipped === (isKnife(preview.index) ? "knife" : "weapon") &&
          (!isKnife(preview.index) ||
            clip.token === (buyPoseToken(preview.index) === "push" ? "pushknife" : "knife")) &&
          clip.team === team &&
          clip.source === "main_menu" &&
          !clip.additive,
      );
      const compatible = (
        await Promise.all(
          candidates.map(async (clip) =>
            // The shared knife UI graph supplies the human/anchor motion for
            // each knife model. Its default-knife secondary skeleton is not
            // the equipped cosmetic's item ID; push knives have their own token.
            isKnife(preview.index) ||
            (await agentAnimationWeaponIndex(clip.id, preview.index)) === preview.index
              ? clip
              : undefined,
          ),
        )
      ).filter((clip) => clip !== undefined);
      // Retain the weapon's full gesture set, including T lookback/lookaround
      // variants. Each native clip completes before selecting another state.
      const chosen = [...new Map(compatible.map((clip) => [clip.name, clip])).values()];
      for (const definition of chosen) {
        const loaded = await acquireAgentAnimation(definition.id);
        if (this.previews.get(team) !== preview || preview.animation) {
          loaded.release();
          return;
        }
        // Carried knife bones share secondary track names but use metre locals.
        // Exclude them from the Source-inch body mixer and its constant channels.
        const parent = preview.weapon.parent;
        preview.weapon.removeFromParent();
        let clip: T.AnimationClip;
        try {
          ensureAgentAnimationBones(preview.soldier.model, loaded.pack.scene);
          // Legacy meshes bake the Source basis into the model node.
          const pelvis = preview.soldier.model.getObjectByName("pelvis")!;
          const root = preview.soldier.model.getObjectByName("root_motion");
          if (root && pelvis.parent !== root)
            while (root.children.length) pelvis.parent!.add(root.children[0]);
          clip = completeAgentClip(
            agentClipForModel(loaded.clip, preview.soldier.model),
            preview.soldier.model,
          );
        } finally {
          parent?.add(preview.weapon);
        }
        const action = preview.mixer.clipAction(clip);
        const idle = definition.name.includes("_idle");
        action.setLoop(T.LoopOnce, 1);
        action.clampWhenFinished = true;
        if (idle) state.idle ??= action;
        else if (definition.name.includes("walkup")) state.entrance ??= action;
        else state.actions.push(action);
        state.anchor = preview.soldier.model.getObjectByName("wpn");
        state.releases.push(loaded.release);
      }
      state.ready = true;
    } catch {
      preview.mixer.update(0);
      // Keep the existing idle when an optional animation pack is unavailable.
    }
  }
  private updateIdleVariation(preview: Preview, team: AgentTeam, dt: number) {
    if (preview.animation) return;
    if (!preview.idleVariation) {
      void this.prepareIdleVariations(preview, team);
      return;
    }
    const state = preview.idleVariation;
    if (!state.ready || !state.idle || !state.anchor) return;
    if (!state.initialized) {
      preview.mixer.stopAllAction();
      preview.action = state.idle.reset().play();
      preview.mixer.update(0);
      preview.soldier.group.updateMatrixWorld(true);
      preview.soldier.group.position.y +=
        this.floor - new T.Box3().setFromObject(preview.soldier.model, true).min.y;
      // Native wpn carries the source attachment animation, including its
      // rotation. Keep the gun outside the bone hierarchy in metre units.
      preview.soldier.group.add(preview.weapon);
      registerActorLighting(preview.soldier.group);
      state.initialized = true;
      this.current = undefined;
    }
    const splash = document.getElementById("startup");
    if (splash && !splash.classList.contains("startup-walk-in")) return;
    if (!state.current && state.entrance && !this.arrivedAgents.has(preview.agentId)) {
      this.arrivedAgents.add(preview.agentId);
      state.current = state.entrance;
      // The native clip already walks the pelvis into place. Crossfading from
      // the standing pose pulls it backward before that forward motion begins.
      // Start the complete entrance pose while the splash is still opaque.
      preview.action.stop();
      state.current.reset().setEffectiveWeight(1).play();
    }
    if (state.current) {
      if (
        !state.returning &&
        state.current.time >= state.current.getClip().duration - homeBlendSeconds
      ) {
        preview.action.reset().setEffectiveWeight(1).fadeIn(homeBlendSeconds).play();
        state.current.fadeOut(homeBlendSeconds);
        state.returning = true;
        state.wait = homeBlendSeconds;
      }
      if (state.returning && (state.wait -= dt) <= 0) {
        state.current.stop();
        state.current = undefined;
        state.returning = false;
      }
    } else if (
      state.actions.length &&
      preview.action.time >= preview.action.getClip().duration - homeBlendSeconds
    ) {
      const choices = state.actions.map((_, i) => i).filter((i) => i !== state.last);
      // A stable per-preview seed avoids frame-rate dependent timer selection.
      // The engine's seed update policy is not exported; this is our scheduler.
      state.seed ^= state.seed << 13;
      state.seed ^= state.seed >>> 17;
      state.seed ^= state.seed << 5;
      const index = choices.length ? choices[(state.seed >>> 0) % choices.length] : 0;
      state.last = index;
      state.current = state.actions[index];
      preview.action.fadeOut(homeBlendSeconds);
      state.current.reset().setEffectiveWeight(1).fadeIn(homeBlendSeconds).play();
    }
  }
  selectedAnimation(team: AgentTeam) {
    return this.previews.get(team)?.animation?.id;
  }
  async playAnimation(team: AgentTeam, id: string) {
    const generation = (this.animationRequests.get(team) ?? 0) + 1;
    this.animationRequests.set(team, generation);
    const wanted = selectedAgentId(team);
    const results = await Promise.allSettled([
      acquireAgentAnimation(id),
      acquireAgentAppearance(wanted),
      agentAnimationWeaponIndex(id, this.weapons[team]).then(async (index) => {
        await loadWeaponModels(this.renderer, [index]);
        return index;
      }),
    ]);
    if (results.some((result) => result.status === "rejected")) {
      if (results[0].status === "fulfilled") results[0].value.release();
      if (results[1].status === "fulfilled") results[1].value?.release();
      throw (results.find((result) => result.status === "rejected") as PromiseRejectedResult)
        .reason;
    }
    const animation = (
      results[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof acquireAgentAnimation>>>
    ).value;
    const appearance = (
      results[1] as PromiseFulfilledResult<Awaited<ReturnType<typeof acquireAgentAppearance>>>
    ).value;
    const index = (results[2] as PromiseFulfilledResult<number>).value;
    const equipment = await agentAnimationEquipment(id);
    if (this.animationRequests.get(team) !== generation || selectedAgentId(team) !== wanted) {
      animation.release();
      appearance?.release();
      return;
    }
    this.clearPreview(team);
    const preview = this.create(team, appearance, wanted);
    const buy = applyBuyPose(
      preview.soldier,
      equipment === "he" ? "hegrenade" : (equipment ?? buyPoseToken(index)),
    );
    this.disposeWeapon(preview.weapon);
    if (equipment) {
      const model =
        equipment === "c4"
          ? preview.soldier.carriedBomb.clone(true)
          : createGrenadeModel(equipment)!;
      model.traverse((object) => {
        if (object instanceof T.Mesh) {
          object.geometry = object.geometry.clone();
          object.material = Array.isArray(object.material)
            ? object.material.map((material) => material.clone())
            : object.material.clone();
        }
      });
      preview.weapon = new T.Group();
      preview.weapon.add(model);
      preview.weapon.userData.buyGrip = (
        equipment === "c4" ? new T.Matrix4() : poseBuyProp(model, buy.weaponBones)
      ).toArray();
    } else preview.weapon = this.createWeapon(index, buy.weaponBones);
    preview.soldier.group.add(preview.weapon);
    registerActorLighting(preview.soldier.group);
    preview.mixer.stopAllAction();
    ensureAgentAnimationBones(preview.soldier.model, animation.pack.scene);
    preview.action = preview.mixer
      .clipAction(agentClipForModel(animation.clip, preview.soldier.model))
      .reset();
    preview.action.setLoop(
      animation.definition.loop ? T.LoopRepeat : T.LoopOnce,
      animation.definition.loop ? Infinity : 1,
    );
    preview.action.clampWhenFinished = true;
    preview.action.play();
    preview.mixer.update(0);
    preview.animation = {
      id,
      release: animation.release,
      equipped: animation.definition.equipped,
      gripInverse: new T.Matrix4().fromArray(preview.weapon.userData.buyGrip).invert(),
      hand: buy.hand,
      attachment: buy.matrix,
      equipment,
    };
    preview.soldier.group.updateMatrixWorld(true);
    preview.soldier.group.position.y +=
      this.floor - new T.Box3().setFromObject(preview.soldier.model, true).min.y;
    this.framing.set(preview, new T.Box3().setFromObject(preview.soldier.model, true));
    this.current = undefined;
  }
  stopAnimation(team: AgentTeam) {
    this.animationRequests.set(team, (this.animationRequests.get(team) ?? 0) + 1);
    if (!this.previews.get(team)?.animation) return;
    const ready = peekSelectedAgent(team);
    this.clearPreview(team);
    this.create(team, ready, selectedAgentId(team));
  }
  setWeapon(team: AgentTeam, index: number) {
    if (this.weapons[team] !== index) this.failedWeapons.delete(index);
    this.weapons[team] = index;
  }
  constructor() {
    window.addEventListener("cs2go-agent-selection", () => this.failedAgents.clear());
    document.getElementById("menu")!.addEventListener("pointermove", (event) => {
      this.pointer.set(event.clientX / innerWidth - 0.5, event.clientY / innerHeight - 0.5);
    });
  }
  async load(renderer: T.WebGLRenderer, scenery: Promise<T.Group>) {
    this.renderer = renderer;
    const [data, world] = await Promise.all([
      fetchGzipped("/models/animations/home/poses.json.gz"),
      scenery,
      document.fonts.load('700 16px "Stratum2 Monodigit"'),
      document.fonts.load('700 16px "Stratum2 Mono"'),
    ]);
    this.poses = JSON.parse(new TextDecoder().decode(data));
    // Separate scene graph, shared immutable geometry/materials and native map lighting.
    // Avoid downloading/uploading a second Dust II just for the panorama.
    const background = world.clone(true);
    // Native atlases already contain environment shadows. The showcase light
    // should add only the agent's shadow, rather than projecting nearby map
    // props onto the street a second time from a different sun direction.
    background.traverse((object) => {
      if (object instanceof T.Mesh || object instanceof T.Light) object.castShadow = false;
    });
    this.scene.add(background);
    background.updateMatrixWorld(true);
    const ground = new T.Raycaster(
      new T.Vector3(1355.757812 * 0.0254, 2, -925.05896 * 0.0254),
      new T.Vector3(0, -1, 0),
      0,
      5,
    ).intersectObject(background, true)[0];
    if (ground) this.floor = ground.point.y;
    // The stage stays at one location. Resolve its native reflection before
    // compileAsync: swapping env-map defines during parallel shader warm-up
    // can leave it waiting on a program that has already been released.
    const probe = nearestSourceProbe(
      this.lightPosition.set(1355.757812 * 0.0254, this.floor + 1, -925.05896 * 0.0254),
    );
    if (probe !== null)
      this.reflectionLoad = loadSourceReflection(probe)
        .then((texture) => {
          const generator = new T.PMREMGenerator(renderer);
          try {
            this.reflection = generator.fromEquirectangular(texture);
          } finally {
            texture.dispose();
            generator.dispose();
          }
        })
        .catch(() => {
          // Native diffuse probes remain available if an optional reflection fails.
        });

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 32);
    gradient.addColorStop(0, "#0007");
    gradient.addColorStop(1, "#0000");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const shadow = new T.Mesh(
      new T.PlaneGeometry(1.1, 0.7),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(1355.757812 * 0.0254, this.floor + 0.005, -925.05896 * 0.0254);
    this.scene.add(shadow);

    this.scene.background = new T.Color("#cbd2d1");
    // Retain the chosen distance haze for our gameplay-map backdrop. Native
    // vanity meshes add the local moving veils and ground-hugging dust.
    this.scene.fog = new T.FogExp2(new T.Color("#d8c9b2"), 0.011);
    const atmosphere = new HomeAtmosphere();
    await atmosphere.load(background, this.floor);
    this.atmosphere = atmosphere;
    this.scene.add(atmosphere.root);
    registerActorLighting(atmosphere.paper);
    // Use Dust II's native sun and probe irradiance instead of studio fill.
    // Three's Lambertian BRDF includes 1/pi; the Source intensity does not.
    const sun = new T.DirectionalLight(0xffdebd, 2.5 * Math.PI);
    sun.target.position.set(34.435, 0.65, -23.497);
    const sunPitch = T.MathUtils.degToRad(50),
      sunYaw = T.MathUtils.degToRad(43);
    sun.position
      .copy(sun.target.position)
      .add(
        new T.Vector3(
          -Math.cos(sunPitch) * Math.cos(sunYaw),
          Math.sin(sunPitch),
          Math.cos(sunPitch) * Math.sin(sunYaw),
        ).multiplyScalar(10),
      );
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -4,
      right: 4,
      top: 4,
      bottom: -4,
      near: 0.1,
      far: 20,
    });
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun, sun.target);
    // Native Source coordinates (X forward, Y left, Z up), inches -> metres.
    this.camera.position.set(1305.921753 * 0.0254, 28.755077 * 0.0254, -725.599976 * 0.0254);
    const yaw = T.MathUtils.degToRad(75.346497),
      pitch = T.MathUtils.degToRad(-1);
    this.cameraPosition.copy(this.camera.position);
    this.camera.lookAt(
      this.camera.position
        .clone()
        .add(
          new T.Vector3(
            Math.cos(pitch) * Math.cos(yaw),
            -Math.sin(pitch),
            -Math.cos(pitch) * Math.sin(yaw),
          ),
        ),
    );
    this.camera.getWorldDirection(this.cameraDirection);
    this.cameraRotation.copy(this.camera.quaternion);
  }
  private create(
    team: AgentTeam,
    appearance?: AgentAppearance,
    agentId = defaultAgent(team).id,
  ): Preview {
    const desired = this.weapons[team];
    const index = weaponModelReady(desired) ? desired : team === "ct" ? 9 : 0;
    const soldier = createSoldier(-1, team, appearance);
    const poseTeam = soldier.animationTeam;
    const idle = this.poses[poseTeam].rifle;
    let pose = appearance ? structuredClone(idle) : idle;
    soldier.mixer.stopAllAction();
    soldier.weapon.visible = false;
    if (index !== (poseTeam === "t" ? 0 : 9)) {
      const buy = applyBuyPose(soldier, buyPoseToken(index));
      const bones: Pose["frames"][number]["bones"] = {};
      soldier.model.traverse((object) => {
        if (object instanceof T.Bone)
          bones[object.name] = { p: object.position.toArray(), q: object.quaternion.toArray() };
      });
      pose = {
        clip: buy.clip,
        hand: buy.hand.name,
        weaponBones: buy.weaponBones,
        frames: idle.frames.map((frame) => ({
          time: frame.time,
          bones: Object.fromEntries(
            Object.entries(bones).map(([name, base]) => {
              const reference = idle.frames[0].bones[name],
                sample = frame.bones[name];
              if (!/spine|neck|head/i.test(name) || !reference || !sample) return [name, base];
              const delta = new T.Quaternion()
                .fromArray(reference.q)
                .invert()
                .multiply(new T.Quaternion().fromArray(sample.q));
              return [
                name,
                { p: base.p, q: new T.Quaternion().fromArray(base.q).multiply(delta).toArray() },
              ];
            }),
          ),
          attachment: buy.matrix.toArray(),
        })),
      };
    }
    if (appearance) {
      // Imported vests/plate carriers extend beyond the reference agent's
      // chest. Retarget both arm contacts together, rather than moving the gun
      // away from the sampled fingers or scaling the weapon down.
      for (const frame of pose.frames) {
        for (const [name, transform] of Object.entries(frame.bones)) {
          const bone = soldier.model.getObjectByName(name);
          if (!bone) continue;
          bone.position.fromArray(transform.p);
          bone.quaternion.fromArray(transform.q);
        }
        soldier.group.updateMatrixWorld(true);
        movePreviewHands(
          soldier.group,
          weaponSlot(index) === 1 || buyPoseToken(index) === "elite"
            ? [soldier.rightHand, soldier.leftHand]
            : [soldier.rightHand],
          0.14,
        );
        for (const hand of [soldier.rightHand, soldier.leftHand]) {
          for (const bone of [hand, hand.parent!, hand.parent!.parent!]) {
            frame.bones[bone.name] = { p: bone.position.toArray(), q: bone.quaternion.toArray() };
          }
        }
      }
    }
    soldier.group.visible = true;
    soldier.group.position.set(1355.757812 * 0.0254, -9.674049 * 0.0254, -925.05896 * 0.0254);
    // The agent's local +Z faces forward; native Source yaw 248.18 faces the camera.
    soldier.group.rotation.y = T.MathUtils.degToRad(90 + 248.180099);
    const weapon = this.createWeapon(index, pose.weaponBones);
    weapon.name = "home-showcase-weapon";
    const grip = new T.Group();
    grip.name = "home_weapon_attachment";
    soldier.model.getObjectByName(pose.hand)!.add(grip);
    const inverse = new T.Matrix4().fromArray(weapon.userData.buyGrip).invert();
    inverse.decompose(weapon.position, weapon.quaternion, weapon.scale);
    grip.add(weapon);
    // World guns already own cloned materials. Preserve their identity: the
    // skin registry updates those exact materials when changing/resetting paint.
    registerActorLighting(soldier.group);
    const times = pose.frames.map((frame) => frame.time);
    const tracks: T.KeyframeTrack[] = [];
    for (const name of Object.keys(pose.frames[0].bones)) {
      tracks.push(
        new T.VectorKeyframeTrack(
          `${name}.position`,
          times,
          pose.frames.flatMap((f) => f.bones[name].p),
        ),
      );
      tracks.push(
        new T.QuaternionKeyframeTrack(
          `${name}.quaternion`,
          times,
          pose.frames.flatMap((f) => f.bones[name].q),
        ),
      );
    }
    const position = new T.Vector3(),
      rotation = new T.Quaternion(),
      scale = new T.Vector3();
    const positions: number[] = [],
      rotations: number[] = [],
      scales: number[] = [];
    const handScale = soldier.model.getObjectByName(pose.hand)!.getWorldScale(new T.Vector3());
    for (const frame of pose.frames) {
      new T.Matrix4().fromArray(frame.attachment).decompose(position, rotation, scale);
      positions.push(...position);
      rotations.push(...rotation);
      scales.push(1 / handScale.x, 1 / handScale.y, 1 / handScale.z);
    }
    tracks.push(new T.VectorKeyframeTrack(`${grip.name}.position`, times, positions));
    tracks.push(new T.QuaternionKeyframeTrack(`${grip.name}.quaternion`, times, rotations));
    tracks.push(new T.VectorKeyframeTrack(`${grip.name}.scale`, times, scales));
    const mixer = new T.AnimationMixer(soldier.model);
    // Attachment scale compensates for Source inches. Keep it fully weighted
    // while body actions crossfade so the weapon never shrinks out of the hand.
    const duration = Math.max(1, times.at(-1)!);
    mixer
      .clipAction(
        new T.AnimationClip(
          "home-grip",
          duration,
          tracks.filter((track) => track.name.startsWith(grip.name + ".")),
        ),
      )
      .play();
    const action = mixer
      .clipAction(
        new T.AnimationClip(
          pose.clip,
          duration,
          tracks.filter((track) => !track.name.startsWith(grip.name + ".")),
        ),
      )
      .play();
    mixer.update(0);
    // Retargeted meshes have different sole heights; seat the first pose on the
    // native street while retaining the clip's subsequent body/foot motion.
    soldier.group.updateMatrixWorld(true);
    soldier.group.position.y += this.floor - new T.Box3().setFromObject(soldier.model, true).min.y;
    this.scene.add(soldier.group);
    const agentName =
      agentId === defaultAgent(team).id ? defaultAgent(team).name : selectedAgent(team).name;
    const preview: Preview = { soldier, mixer, action, weapon, index, agentId, agentName };
    if (buyPoseToken(index) === "push") {
      // Calibrate each rigid knife against its authored buy-pose hand contact.
      // The body clips use Source inches; carried knife bones use metres.
      preview.pairedGrips = ["L", "R"].map((side) => {
        const hand = soldier.model.getObjectByName(`hand_${side}`)!;
        const bone = weapon.getObjectByName(`weapon_hand_${side.toLowerCase()}`)!;
        hand.matrixWorld.decompose(position, rotation, scale);
        const handFrame = new T.Matrix4().compose(position, rotation, scale.set(1, 1, 1));
        const offset = handFrame.invert().multiply(bone.matrixWorld);
        // The exported weapon-hand pivot is the grip, not the old buy
        // attachment origin (whose reconstructed arm reach differs by agent).
        offset.setPosition(0, 0, 0);
        return { hand, bone, offset };
      });
    }
    this.framing.set(preview, new T.Box3().setFromObject(soldier.model, true));
    this.previews.set(team, preview);
    return preview;
  }
  private clearPreview(team: AgentTeam) {
    const previous = this.previews.get(team);
    if (!previous) return;
    this.scene.remove(previous.soldier.group);
    previous.animation?.release();
    previous.idleVariation?.releases.forEach((release) => release());
    this.disposeWeapon(previous.weapon);
    previous.mixer.stopAllAction();
    previous.mixer.uncacheRoot(previous.soldier.model);
    disposeSoldier(previous.soldier);
    this.previews.delete(team);
    this.current = undefined;
  }
  private disposeWeapon(weapon: T.Group) {
    if (weapon.userData.ownedWorldGun) {
      disposeWorldGun(weapon);
      return;
    }
    unregisterSkinModel(weapon);
    weapon.removeFromParent();
    weapon.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.dispose();
    });
  }
  private preview(team: AgentTeam) {
    const wanted = selectedAgentId(team);
    let previous = this.previews.get(team);
    const index = this.weapons[team];
    if (!weaponModelReady(index)) {
      if (!this.pendingWeapons.has(index) && !this.failedWeapons.has(index)) {
        this.pendingWeapons.add(index);
        void loadWeaponModels(this.renderer, [index])
          .catch((error: unknown) => {
            console.error("Showcase weapon failed to load", error);
            this.failedWeapons.add(index);
          })
          .finally(() => this.pendingWeapons.delete(index));
      }
      return previous ?? this.create(team);
    }
    if (previous?.index !== this.weapons[team] || previous.agentId !== wanted) {
      const ready = peekSelectedAgent(team);
      if (ready || wanted === defaultAgent(team).id) {
        this.clearPreview(team);
        return this.create(team, ready, wanted);
      }
      if (!this.failedAgents.has(wanted) && this.pendingAgents.get(team) !== wanted) {
        this.pendingAgents.set(team, wanted);
        void acquireAgentAppearance(wanted)
          .then((appearance) => {
            if (selectedAgentId(team) !== wanted) {
              appearance?.release();
              return;
            }
            if (this.previews.get(team)?.animation && this.previews.get(team)?.agentId === wanted) {
              appearance?.release();
              return;
            }
            this.clearPreview(team);
            this.create(team, appearance, wanted);
          })
          .catch((error: unknown) => {
            console.error("Agent appearance failed to load", error);
            this.failedAgents.add(wanted);
          })
          .finally(() => {
            if (this.pendingAgents.get(team) === wanted) this.pendingAgents.delete(team);
          });
      }
      previous ??= this.create(team);
    }
    return previous;
  }
  async prepare(renderer: T.WebGLRenderer) {
    await this.reflectionLoad;
    if (!this.reduced.matches) {
      const teams = ["ct", "t"] as const;
      const appearances = await Promise.all(
        teams.map((team) => acquireAgentAppearance(selectedAgentId(team)).catch(() => undefined)),
      );
      try {
        await Promise.all(
          teams.map((team) => this.prepareIdleVariations(this.preview(team), team)),
        );
      } finally {
        appearances.forEach((appearance) => appearance?.release());
      }
    }
    for (const team of ["ct", "t"] as const)
      setActorReflection(this.preview(team).soldier.group, this.reflection?.texture);
    const previousToneMapping = renderer.toneMapping;
    let programs: Promise<unknown>;
    try {
      renderer.toneMapping = T.CustomToneMapping;
      programs = renderer.compileAsync(this.scene, this.camera);
    } finally {
      renderer.toneMapping = previousToneMapping;
    }
    await programs;
  }
  /** Capture the shared world from an authored inspection camera, without refitting it. */
  renderInspectionBackdrop(renderer: T.WebGLRenderer, camera: T.PerspectiveCamera) {
    const visible = Array.from(this.previews.values(), (preview) => ({
      group: preview.soldier.group,
      visible: preview.soldier.group.visible,
    }));
    const toneMapping = renderer.toneMapping;
    for (const preview of visible) preview.group.visible = false;
    this.atmosphere?.invalidateDepth();
    try {
      // Ordinary offscreen targets intentionally skip Three's tone mapping.
      // Keep linear HDR here; the inspector applies its own native VPOST/LUT.
      withoutSourceColorCorrection(() => {
        this.atmosphere?.captureDepth(renderer, this.scene, camera, this.reduced.matches);
        renderer.clear();
        renderer.render(this.scene, camera);
      });
    } finally {
      for (const preview of visible) preview.group.visible = preview.visible;
      renderer.toneMapping = toneMapping;
      this.atmosphere?.invalidateDepth();
    }
  }

  render(renderer: T.WebGLRenderer, team: AgentTeam, dt: number, showAgent = true) {
    const preview = this.preview(team);
    const loading = this.pendingAgents.has(team);
    const weaponLoading = this.pendingWeapons.has(this.weapons[team]);
    const weaponFailed = this.failedWeapons.has(this.weapons[team]);
    const status = document.getElementById("home-agent-status");
    if (
      status &&
      (loading || this.failedAgents.has(selectedAgentId(team)) || weaponLoading || weaponFailed)
    ) {
      status.dataset.owner = "appearance";
      status.textContent = weaponLoading
        ? "Loading weapon..."
        : weaponFailed
          ? "Weapon unavailable. Select another weapon to retry."
          : loading
            ? "Loading agent..."
            : "Agent unavailable. Select another agent to retry.";
    } else if (status?.dataset.owner === "appearance") status.textContent = "";
    const play = document.getElementById("play") as HTMLButtonElement;
    if (loading && !play.disabled) {
      this.agentPlayLock = true;
      play.disabled = true;
    } else if (!loading && this.agentPlayLock) {
      this.agentPlayLock = false;
      play.disabled = false;
    }
    if (this.current !== team) {
      this.atmosphere?.invalidateDepth();
      for (const [key, value] of this.previews) value.soldier.group.visible = key === team;
      this.current = team;
      (document.getElementById("home-profile-icon") as HTMLImageElement).src = assetUrl(
        `/icons/team-${team}.png`,
      );
      const stage = document.getElementById("home-agent-stage")!;
      stage.dataset.clip = preview.action.getClip().name;
      stage.dataset.showcaseWeapon = String(preview.index);
      stage.dataset.agent = preview.agentId;
    }
    if (preview.soldier.group.visible !== showAgent) this.atmosphere?.invalidateDepth();
    preview.soldier.group.visible = showAgent;
    if (!this.reduced.matches && showAgent) {
      this.updateIdleVariation(preview, team, dt);
      preview.mixer.update(dt);
    }
    const nativeAnchor = preview.idleVariation?.initialized
      ? preview.idleVariation.anchor
      : undefined;
    if (!preview.animation && nativeAnchor) {
      preview.soldier.group.updateMatrixWorld(true);
      this.animationFrame
        .copy(nativeAnchor.matrixWorld)
        .decompose(this.animationPosition, this.animationRotation, this.animationScale);
      this.animationFrame.compose(
        this.animationPosition,
        this.animationRotation,
        this.animationScale.set(1, 1, 1),
      );
      this.animationFrame
        .multiply(this.animationParentInverse.fromArray(preview.weapon.userData.buyGrip).invert())
        .premultiply(this.animationParentInverse.copy(preview.soldier.group.matrixWorld).invert())
        .decompose(preview.weapon.position, preview.weapon.quaternion, preview.weapon.scale);
    }
    if (preview.pairedGrips && nativeAnchor && !preview.animation) {
      preview.soldier.group.updateMatrixWorld(true);
      for (const { hand, bone, offset } of preview.pairedGrips) {
        hand.matrixWorld.decompose(
          this.animationPosition,
          this.animationRotation,
          this.animationScale,
        );
        this.animationFrame
          .compose(this.animationPosition, this.animationRotation, this.animationScale.set(1, 1, 1))
          .multiply(offset)
          .premultiply(this.animationParentInverse.copy(bone.parent!.matrixWorld).invert())
          .decompose(bone.position, bone.quaternion, bone.scale);
      }
    }
    if (preview.animation) {
      preview.weapon.visible = preview.animation.equipped !== "none";
      const anchor = preview.animation.hand;
      preview.soldier.group.updateMatrixWorld(true);
      const p = this.animationPosition,
        q = this.animationRotation,
        s = this.animationScale;
      const frame = this.animationFrame
        .copy(anchor.matrixWorld)
        .multiply(preview.animation.attachment);
      frame.decompose(p, q, s);
      frame.compose(p, q, s.set(1, 1, 1));
      frame
        .premultiply(this.animationParentInverse.copy(preview.soldier.group.matrixWorld).invert())
        .multiply(preview.animation.gripInverse);
      frame.decompose(preview.weapon.position, preview.weapon.quaternion, preview.weapon.scale);
      if (preview.animation.equipment === "c4") {
        preview.soldier.rightHand.getWorldPosition(p);
        preview.soldier.leftHand.getWorldPosition(s);
        p.lerp(s, 0.5);
        preview.soldier.group.worldToLocal(p);
        preview.weapon.position.copy(p);
        preview.weapon.position.y -= 0.025;
      }
    }
    this.camera.position.copy(this.cameraPosition);
    this.camera.quaternion.copy(this.cameraRotation);
    if (!this.reduced.matches) {
      this.parallax.lerp(this.pointer, Math.min(1, dt * 5));
    }
    if ((document.getElementById("home-background") as HTMLSelectElement).value === "close")
      this.camera.position.addScaledVector(this.cameraDirection, 1.2);
    this.camera.aspect = renderer.domElement.width / renderer.domElement.height;
    // Bounds are sampled only when the appearance/pose changes. Fit their eight
    // corners cheaply so close backgrounds and tall agents retain headroom.
    const bounds = this.framing.get(preview);
    this.camera.updateMatrixWorld(true);
    let tangent = Math.tan(T.MathUtils.degToRad(15));
    if (bounds)
      for (let corner = 0; corner < 8; corner++) {
        const point = this.framingPoint
          .set(
            corner & 1 ? bounds.max.x : bounds.min.x,
            corner & 2 ? bounds.max.y : bounds.min.y,
            corner & 4 ? bounds.max.z : bounds.min.z,
          )
          .applyMatrix4(this.camera.matrixWorldInverse);
        if (point.z < 0)
          tangent = Math.max(
            tangent,
            Math.abs(point.y) / (-point.z * 0.72),
            Math.abs(point.x) / (-point.z * this.camera.aspect * 0.8),
          );
      }
    this.camera.fov = T.MathUtils.radToDeg(2 * Math.atan(tangent / 1.1));
    this.camera.updateProjectionMatrix();
    // Fit at the neutral angle so pointer movement never changes zoom or pitch.
    if (!this.reduced.matches)
      this.camera.rotateOnWorldAxis(
        T.Object3D.DEFAULT_UP,
        -this.parallax.x * T.MathUtils.degToRad(0.5),
      );
    this.lightPosition.copy(preview.soldier.group.position);
    this.lightPosition.y += 1;
    updateActorLighting(
      preview.soldier.group,
      this.lightPosition,
      sampleSourceProbe,
      dt,
      undefined,
      sampleSourceProbeSun,
      sampleSourceProbeLocalShadows,
    );
    setActorReflection(preview.soldier.group, this.reflection?.texture);
    this.atmosphere?.update(dt, this.reduced.matches);
    if (this.atmosphere)
      updateActorLighting(
        this.atmosphere.paper,
        this.lightPosition,
        sampleSourceProbe,
        dt,
        undefined,
        sampleSourceProbeSun,
        sampleSourceProbeLocalShadows,
      );
    renderer.toneMapping = T.CustomToneMapping;
    this.atmosphere?.captureDepth(renderer, this.scene, this.camera, this.reduced.matches);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    preview.soldier.model.getObjectByName("pelvis")!.getWorldPosition(this.namePosition);
    this.framingPoint.copy(this.namePosition);
    this.framingPoint.y = this.floor;
    this.namePosition.lerp(this.framingPoint, 0.75);
    this.namePosition.project(this.camera);
    const profile = document.querySelector<HTMLElement>(".home-profile")!;
    profile.style.visibility = showAgent ? "" : "hidden";
    profile.style.left = `${(this.namePosition.x + 1) * 50}%`;
    profile.style.top = `${((1 - this.namePosition.y) * innerHeight) / 2 - document.querySelector(".home-header")!.clientHeight}px`;
    profile.style.bottom = "auto";
  }
}
