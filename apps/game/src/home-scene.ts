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
import { fetchGzipped, loadModel } from "./gltf";
import { createSoldier, disposeSoldier, type Soldier, type AgentTeam } from "./soldier";
import { applyBuyPose, buyPoseToken } from "./buy-poses";
import { unregisterSkinModel } from "./skins";
import { createNativeWorldGun } from "./weapon-motion";
import { gradeMapColors } from "./map-color";
import { armoryReflections } from "./reflections";
import { reachPreviewHand } from "./preview-arm";

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
};

/** The home scene shares the game's renderer and 30 Hz menu clock. */
export class HomeScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(30, 1, 0.1016, 254);
  private poses!: Record<AgentTeam, { rifle: Pose }>;
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
  private weapons = { ct: 9, t: 0 };
  private pendingAgents = new Map<AgentTeam, string>();
  private failedAgents = new Set<string>();
  private agentPlayLock = false;
  setWeapon(team: AgentTeam, index: number) {
    this.weapons[team] = index;
  }
  constructor() {
    window.addEventListener("cs2go-agent-selection", () => this.failedAgents.clear());
    document.getElementById("menu")!.addEventListener("pointermove", (event) => {
      this.pointer.set(event.clientX / innerWidth - 0.5, event.clientY / innerHeight - 0.5);
    });
  }
  async load(renderer: T.WebGLRenderer) {
    const [data, world] = await Promise.all([
      fetchGzipped("/models/animations/home/poses.json.gz"),
      loadModel("/models/home/dust2.glb"),
      document.fonts.load('700 16px "Stratum2 Monodigit"'),
      document.fonts.load('700 16px "Stratum2 Mono"'),
    ]);
    this.poses = JSON.parse(new TextDecoder().decode(data));
    // VRF exports (Source y,z,x); agents/camera use (Source x,z,-y).
    world.scene.rotation.y = Math.PI / 2;
    world.scene.traverse((object) => {
      if (object instanceof T.Mesh) object.receiveShadow = true;
    });
    gradeMapColors(world.scene);
    this.scene.add(world.scene);
    world.scene.updateMatrixWorld(true);
    const ground = new T.Raycaster(
      new T.Vector3(1355.757812 * 0.0254, 2, -925.05896 * 0.0254),
      new T.Vector3(0, -1, 0),
      0,
      5,
    ).intersectObject(world.scene, true)[0];
    if (ground) this.floor = ground.point.y;
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
    this.scene.environment = armoryReflections(renderer);
    this.scene.environmentIntensity = 0.38;
    this.scene.background = new T.Color("#c4d4de");
    this.scene.add(new T.HemisphereLight(0xe7f2ff, 0x8f7c60, 1.15));
    const sun = new T.DirectionalLight(0xffe8c7, 2.6);
    sun.target.position.set(34.435, 0.65, -23.497);
    sun.position.copy(sun.target.position).add(new T.Vector3(-3, 8, 5));
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
  private create(team: AgentTeam, appearance?: AgentAppearance, agentId = defaultAgent(team).id) {
    const index = this.weapons[team];
    const soldier = createSoldier(-1, team, appearance);
    const poseTeam = soldier.animationTeam ?? team;
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
      const forward = new T.Vector3(0, 0, 0.12);
      for (const frame of pose.frames) {
        for (const [name, transform] of Object.entries(frame.bones)) {
          const bone = soldier.model.getObjectByName(name);
          if (!bone) continue;
          bone.position.fromArray(transform.p);
          bone.quaternion.fromArray(transform.q);
        }
        soldier.group.updateMatrixWorld(true);
        reachPreviewHand(soldier.rightHand, forward);
        reachPreviewHand(soldier.leftHand, forward);
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
    const weapon = createNativeWorldGun(index, true, pose.weaponBones, true);
    weapon.name = "home-showcase-weapon";
    const grip = new T.Group();
    grip.name = "home_weapon_attachment";
    soldier.model.getObjectByName(pose.hand)!.add(grip);
    const inverse = new T.Matrix4().fromArray(weapon.userData.buyGrip).invert();
    inverse.decompose(weapon.position, weapon.quaternion, weapon.scale);
    grip.add(weapon);
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
    const action = mixer
      .clipAction(new T.AnimationClip(pose.clip, Math.max(1, times.at(-1)!), tracks))
      .play();
    mixer.update(0);
    // Retargeted meshes have different sole heights; seat the first pose on the
    // native street while retaining the clip's subsequent body/foot motion.
    soldier.group.updateMatrixWorld(true);
    soldier.group.position.y += this.floor - new T.Box3().setFromObject(soldier.model, true).min.y;
    this.scene.add(soldier.group);
    const agentName =
      agentId === defaultAgent(team).id ? defaultAgent(team).name : selectedAgent(team).name;
    const preview = { soldier, mixer, action, weapon, index, agentId, agentName };
    this.previews.set(team, preview);
    return preview;
  }
  private clearPreview(team: AgentTeam) {
    const previous = this.previews.get(team);
    if (!previous) return;
    this.scene.remove(previous.soldier.group);
    unregisterSkinModel(previous.weapon);
    previous.weapon.removeFromParent();
    previous.weapon.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.dispose();
    });
    previous.mixer.stopAllAction();
    previous.mixer.uncacheRoot(previous.soldier.model);
    disposeSoldier(previous.soldier);
    this.previews.delete(team);
    this.current = undefined;
  }
  private preview(team: AgentTeam) {
    const wanted = selectedAgentId(team);
    let previous = this.previews.get(team);
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
  render(renderer: T.WebGLRenderer, team: AgentTeam, dt: number, showAgent = true) {
    const preview = this.preview(team);
    const loading = this.pendingAgents.has(team);
    const status = document.getElementById("home-agent-status");
    if (status && (loading || this.failedAgents.has(selectedAgentId(team)))) {
      status.dataset.owner = "appearance";
      status.textContent = loading
        ? "Loading agent…"
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
      for (const [key, value] of this.previews) value.soldier.group.visible = key === team;
      this.current = team;
      document.getElementById("home-agent-name")!.textContent = preview.agentName;
      (document.getElementById("home-profile-icon") as HTMLImageElement).src = assetUrl(
        `/icons/team-${team}.png`,
      );
      document
        .querySelectorAll<HTMLElement>("[data-home-team]")
        .forEach((button) =>
          button.setAttribute("aria-pressed", String(button.dataset.homeTeam === team)),
        );
      const stage = document.getElementById("home-agent-stage")!;
      stage.dataset.clip = preview.action.getClip().name;
      stage.dataset.showcaseWeapon = String(preview.index);
      stage.dataset.agent = preview.agentId;
    }
    preview.soldier.group.visible = showAgent;
    if (!this.reduced.matches) {
      preview.mixer.update(dt);
    }
    this.camera.position.copy(this.cameraPosition);
    this.camera.quaternion.copy(this.cameraRotation);
    if (!this.reduced.matches) {
      this.parallax.lerp(this.pointer, Math.min(1, dt * 5));
      this.camera.rotateY(-this.parallax.x * T.MathUtils.degToRad(0.5));
      this.camera.rotateX(-this.parallax.y * T.MathUtils.degToRad(0.5));
    }
    if ((document.getElementById("home-background") as HTMLSelectElement).value === "close")
      this.camera.position.addScaledVector(this.cameraDirection, 1.2);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    renderer.clear();
    renderer.render(this.scene, this.camera);
    preview.soldier.model
      .getObjectByName(
        preview.soldier.model.getObjectByName("pelvis") ? "pelvis" : "ValveBipedBip01_Pelvis",
      )!
      .getWorldPosition(this.namePosition);
    this.namePosition.project(this.camera);
    const profile = document.querySelector<HTMLElement>(".home-profile")!;
    profile.style.left = `${(this.namePosition.x + 1) * 50}%`;
    profile.style.top = `${((1 - this.namePosition.y) * innerHeight) / 2 - document.querySelector(".home-header")!.clientHeight}px`;
    profile.style.bottom = "auto";
  }
}
