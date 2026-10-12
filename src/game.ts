import { nativeShotDuration, nativeInspectDuration, nativeSoundCues } from "./weapon-motion";
import { knifeInspectDuration } from "./knife-motion";
import { dustRadarProjection, loadCalloutRadar, radarCrop } from "./radar";
import * as T from "three";
import { ballistics, rangeDamage, penetrate, SOURCE_UNITS_PER_METER } from "./ballistics";
import type { BulletMaterial } from "./ballistics";
import { Soundscape } from "./soundscape";
import { WeaponAudio } from "./audio";
import type { WeaponSound } from "./audio";
import {
  accelerate,
  blocked,
  fallStep,
  limitJumpSpeed,
  movement,
  weapons,
  WEAPON_ANIMATION_RATE,
} from "./physics";
import { loadDust2 } from "./dust2";
import { enableTextureTranscoding } from "./gltf";
import { detour } from "./local-navigation";
import { createWorld } from "./world";
import {
  createGun,
  createWorldGun,
  loadWeaponModels,
  animateGun,
  DRAW_DURATION,
  VIEWMODEL_FOV,
} from "./weapons";
import {
  createSoldier,
  animateSoldier,
  loadSoldierModels,
  resetSoldier,
  setSoldierWeapon,
  disposeSoldier,
  soldierHeadHit,
  agentBounds,
} from "./soldier";
import type { AgentTeam, Soldier } from "./soldier";
type Mode = "casual" | "deathmatch" | "practice";
type Bot = {
  name: string;
  team: AgentTeam;
  target: number | "player" | null;
  memory: T.Vector3;
  alert: number;
  stuck: number;
  vertical: number;
  blockedAreas: Set<number>;
  navArea: number;
  group: T.Group;
  rig: Soldier;
  speed: number;
  moving: boolean;
  tracking: boolean;
  health: number;
  kills: number;
  deaths: number;
  respawn: number;
  shot: number;
  buyTime: number;
  reaction: number;
  path: (T.Vector2 | T.Vector3)[];
  nav: number;
  facing: number;
  velocity: T.Vector2;
  anim: number;
};
const nodes = new Map<string, HTMLElement>();
const el = (id: string) => {
  let node = nodes.get(id);
  if (!node?.isConnected) nodes.set(id, (node = document.getElementById(id)!));
  return node;
};
// HUD values are refreshed every frame or step; skip DOM writes that change nothing.
const setText = (id: string, text: string) => {
  const node = el(id);
  if (node.textContent !== text) node.textContent = text;
};
const styles = new Map<string, string>();
const setStyle = (id: string, property: string, value: string) => {
  if (styles.get(id + property) === value) return;
  styles.set(id + property, value);
  el(id).style.setProperty(property, value);
};
const toggle = (id: string, show: boolean) => el(id).classList.toggle("hidden", !show);
const clamp = T.MathUtils.clamp;
const names = [
  "Atlas",
  "Kestrel",
  "Rook",
  "Wolf",
  "Echo",
  "Falcon",
  "Viper",
  "Sierra",
  "Ghost",
  "Nova",
  "Mako",
  "Delta",
  "Hawk",
  "Onyx",
  "Jade",
  "Flint",
  "Lynx",
  "Raven",
  "Ace",
].map((name) => `BOT ${name}`);
const spawns = [
  [-17, 17],
  [17, -17],
  [-17, -17],
  [17, 17],
  [0, -17],
  [0, 17],
  [-17, 0],
  [17, 5],
];
const step = 1 / 128;
const botDesired = new T.Vector2();
const botAway = new T.Vector2();
const botAhead = new T.Vector2();
const up = new T.Vector3(0, 1, 0);
const scratch = new T.Vector3();
const botSphere = new T.Sphere();
const frustum = new T.Frustum();
const projection = new T.Matrix4();
// Shared effect resources: tracers scale a unit cylinder, and impact decals
// occupy a bounded instanced ring buffer. Neither is disposed per effect.
const tracerGeometry = new T.CylinderGeometry(0.009, 0.009, 1, 3);
const tracerMaterials = new Map<number, T.MeshBasicMaterial>();
const tracerMaterial = (color: number) => {
  let material = tracerMaterials.get(color);
  if (!material)
    tracerMaterials.set(
      color,
      (material = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })),
    );
  return material;
};
const decalLimit = 96;
const hiddenDecal = new T.Matrix4().makeScale(0, 0, 0);
const decalMatrix = new T.Matrix4();
const decalRotation = new T.Quaternion();
const forward = new T.Vector3(0, 0, 1);
const unit = new T.Vector3(1, 1, 1);
const decalPoint = new T.Vector3();
export class Game {
  spectated: Bot | undefined;
  spectatorFocus = new T.Vector3();
  spectatorOffset = new T.Vector3();
  spectatorRay = new T.Ray();
  canvas = el("game") as HTMLCanvasElement;
  renderer!: T.WebGLRenderer;
  scene = new T.Scene();
  view = new T.Scene();
  camera = new T.PerspectiveCamera(90, innerWidth / innerHeight, 0.05, 110);
  viewCamera = new T.PerspectiveCamera(VIEWMODEL_FOV, innerWidth / innerHeight, 0.01, 10);
  world!: ReturnType<typeof createWorld>;
  range!: ReturnType<typeof createWorld>;
  dust?: Awaited<ReturnType<typeof loadDust2>>;
  round = 1;
  teamScores = { t: 0, ct: 0 };
  roundHistory: { winner: AgentTeam; reason: string }[] = [];
  scoreboardSignature = "";
  roundPause = 0;
  bomb: {
    position: T.Vector3;
    planted: boolean;
    timer: number;
    progress: number;
    defuser: number | "player" | null;
    carrier: number | "player";
    plantProgress: number;
  } | null = null;
  bombMesh = new T.Mesh(
    new T.BoxGeometry(0.22, 0.09, 0.3),
    new T.MeshStandardMaterial({ color: 0x303b2a, roughness: 0.8 }),
  );
  gun = createGun(0);
  flash!: T.Mesh;
  ray = new T.Raycaster();
  bots: Bot[] = [];
  keys = new Set<string>();
  jumpQueued = false;
  position = new T.Vector3(-17, 0, 17);
  velocity = { x: 0, z: 0 };
  vertical = 0;
  grounded = true;
  yaw = -0.12;
  pitch = 0;
  eye = 1.65;
  active = false;
  locked = false;
  mode: Mode = "deathmatch";
  team: AgentTeam = "ct";
  dead = 0;
  time = 300;
  kills = 0;
  deaths = 0;
  health = 100;
  armor = 100;
  assetsReady = false;
  wheelTime = 0;
  scopeLevel = 0;
  scopeSettle = 0;
  boltTime = 0;
  rescope = 0;
  weaponCooldowns = weapons.map(() => 0);
  selected = 2;
  primary: number | null = null;
  knifeTime = 0;
  knifeDuration = 0.5;
  knifeStab = false;
  knifePending = false;
  knifeAlternate = true;
  inspectTime = 0;
  inspectDraw = false;
  weaponTime = 0;
  shotTime = 0;
  animationTime = 0;
  inventorySignature = "";
  ammo = 12;
  reserve = 48;
  magazines = weapons.map((w) => ({ ammo: w.mag, reserve: w.reserve }));
  cooldown = 0;
  reload = 0;
  drawTime = 0;
  shots = 0;
  recovery = 0;
  firing = false;
  kick = 0;
  hit = 0;
  damage = 0;
  invulnerable = 0;
  settings = {
    sensitivity: 1,
    fov: 90,
    volume: 60,
    musicVolume: 25,
    effectsVolume: 100,
    quality: "high",
    autoBunnyhop: false,
  };
  audio: AudioContext | null = null;
  noise: AudioBuffer | null = null;
  weaponAudio = new WeaponAudio();
  soundscape = new Soundscape();
  tracers: { mesh: T.Mesh; life: number }[] = [];
  decals = new T.InstancedMesh(
    new T.CircleGeometry(0.045, 6),
    new T.MeshBasicMaterial({ color: 0x3a3026, side: T.DoubleSide }),
    decalLimit,
  );
  decalLife = new Float32Array(decalLimit);
  decalNext = 0;
  guns = new Map<string, T.Group>();
  targets: T.Object3D[] = [];
  radarImage?: HTMLImageElement;
  radarLayers = new Map<string, HTMLCanvasElement>();
  detours = 0;
  accumulator = 0;
  last = 0;
  uiTime = 0;
  frames = 0;
  fps = 0;
  fpsTime = 0;
  tick = 0;
  toastTime = 0;
  sway = 0;
  footsteps = 0;
  supported = true;
  navGrid: boolean[] = [];
  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem("cs2go-settings") || "{}");
      for (const k of ["sensitivity", "fov", "volume", "musicVolume", "effectsVolume"] as const)
        if (Number.isFinite(saved[k]))
          this.settings[k] = clamp(
            saved[k],
            k === "fov" ? 75 : k === "sensitivity" ? 0.2 : 0,
            k === "fov" ? 110 : k === "sensitivity" ? 3 : 100,
          );
      if (["high", "low"].includes(saved.quality)) this.settings.quality = saved.quality;
      if (typeof saved.autoBunnyhop === "boolean") this.settings.autoBunnyhop = saved.autoBunnyhop;
    } catch {
      /* Optional browser storage. */
    }
    try {
      this.renderer = new T.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      toggle("unsupported", true);
      this.supported = false;
      return;
    }
    enableTextureTranscoding(this.renderer);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.autoClear = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.range = this.world = createWorld(this.scene);
    this.bombMesh.visible = false;
    this.scene.add(this.bombMesh);
    this.decals.count = 0;
    this.decals.visible = this.decals.frustumCulled = false;
    this.scene.add(this.decals);
    this.camera.rotation.order = "YXZ";
    this.view.add(this.gun, new T.HemisphereLight(0xffffff, 0x554938, 2.5));
    const light = new T.DirectionalLight(0xffefd5, 3);
    light.position.set(-1, 3, 2);
    this.view.add(light);
    this.flash = new T.Mesh(
      new T.ConeGeometry(0.06, 0.18, 5),
      new T.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 }),
    );
    this.flash.rotation.x = Math.PI / 2;
    this.flash.position.set(0, 0.045, -1.1);
    this.gun.add(this.flash);
    this.flash.visible = false;

    for (let z = 0; z < 22; z++)
      for (let x = 0; x < 22; x++)
        this.navGrid.push(!blocked(x * 2 - 21, z * 2 - 21, 0, this.world.walls, 0.55));
    this.drawMap(el("map-preview") as HTMLCanvasElement, false);
    this.saveSettings();
    this.events();
    const play = el("play") as HTMLButtonElement;
    play.disabled = true;
    play.querySelector("span")!.textContent = "LOADING ARMORY…";
    void Promise.all([
      loadCalloutRadar().then((image) => {
        this.radarImage = image;
      }),
      loadWeaponModels(this.renderer),
      this.weaponAudio.load(),
      this.soundscape.load(),
      loadSoldierModels(),
      loadDust2(this.scene).then((world) => {
        this.dust = world;
      }),
    ])
      .then(() => {
        for (let i = 0; i < 5; i++) this.bots.push(this.makeBot(i));
        this.assetsReady = true;
        this.useWorld(true);
        this.equip(this.selected);
        return this.warmUp();
      })
      .then(() => {
        play.disabled = false;
        play.querySelector("span")!.textContent = "LET’S PLAY";
      })
      .catch(() => {
        play.querySelector("span")!.textContent = "ARMORY UNAVAILABLE";
        el("mode-description").textContent =
          "Weapon models or audio could not load. Refresh the page to retry.";
      });
    requestAnimationFrame((t) => this.frame(t));
  }
  saveSettings() {
    this.soundscape.setVolume(
      this.settings.volume,
      this.settings.musicVolume,
      this.settings.effectsVolume,
    );
    try {
      localStorage.setItem("cs2go-settings", JSON.stringify(this.settings));
    } catch {
      /* Optional persistence. */
    }
    if (!this.supported || !this.renderer) return;
    this.camera.fov = this.scopeLevel === 2 ? 10 : this.scopeLevel === 1 ? 40 : this.settings.fov;
    this.camera.updateProjectionMatrix();
    // Viewmodel lens is independent of world FOV, as in Source.
    this.viewCamera.fov = VIEWMODEL_FOV;
    this.viewCamera.updateProjectionMatrix();
    this.scene.traverse((object) => {
      if (object instanceof T.DirectionalLight && object.castShadow)
        object.shadow.needsUpdate = true;
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.settings.quality === "high" ? 1.5 : 1),
    );
    this.renderer.shadowMap.enabled = this.settings.quality === "high";
    this.renderer.shadowMap.type = T.PCFShadowMap;
  }
  ensureAudio() {
    if (!this.audio) {
      this.audio = new AudioContext();
      this.noise = this.audio.createBuffer(1, this.audio.sampleRate * 0.25, this.audio.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.soundscape.attach(this.audio);
      this.weaponAudio.output = this.soundscape.effects;
      this.soundscape.setVolume(
        this.settings.volume,
        this.settings.musicVolume,
        this.settings.effectsVolume,
      );
    }
    void this.audio.resume();
  }
  events() {
    document.addEventListener("pointerdown", () => {
      this.ensureAudio();
      if (!this.active && !el("menu").classList.contains("hidden"))
        this.soundscape.playMusic("menu");
    });
    document.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button"))
        this.soundscape.play(
          (event.target as HTMLElement).closest("[data-weapon]") ? "buy" : "click",
        );
    });
    document.addEventListener("pointerover", (event) => {
      if ((event.target as HTMLElement).matches("button")) this.soundscape.play("hover");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.soundscape.music.pause();
      else if (!this.active && !el("menu").classList.contains("hidden"))
        this.soundscape.playMusic("menu");
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.keys.clear();
      document.querySelector(".radar-wrap")!.classList.remove("expanded");
      this.jumpQueued = false;
      this.firing = false;
      if (!this.locked) {
        this.rescope = 0;
        this.setScope(0);
      }
      if (this.active) toggle("pause", !this.locked && el("loadout").classList.contains("hidden"));
    });
    document.addEventListener("pointerlockerror", () => {
      if (this.active) {
        toggle("pause", true);
        this.toast("Click BACK TO THE GAME to capture your mouse.");
      }
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked || this.dead) return;
      const zoomRatio =
        Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)) /
        Math.tan(T.MathUtils.degToRad(this.settings.fov / 2));
      this.yaw -= e.movementX * 0.002 * this.settings.sensitivity * zoomRatio;
      this.pitch = clamp(
        this.pitch - e.movementY * 0.002 * this.settings.sensitivity * zoomRatio,
        -1.45,
        1.45,
      );
    });
    document.addEventListener("keydown", (e) => {
      if (this.locked && ["Space", "Tab", "ArrowUp", "ArrowDown"].includes(e.code))
        e.preventDefault();
      if (e.code === "Tab" && this.active) {
        toggle("scoreboard", true);
        this.scoreboard();
      }
      if (e.code === "KeyM" && this.active && this.locked && this.world.navigation)
        document.querySelector(".radar-wrap")!.classList.add("expanded");
      if (!this.locked || this.dead) return;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === "Space") this.jumpQueued = true;
      if (e.code === "KeyR") this.beginReload();
      if (
        e.code === "KeyF" &&
        !this.reload &&
        !this.boltTime &&
        !this.shotTime &&
        !this.knifeTime &&
        !this.inspectTime &&
        (!this.drawTime || (this.selected === 4 && this.drawTime > DRAW_DURATION * 0.85))
      ) {
        this.inspectDraw = this.drawTime > 0;
        this.inspectTime = this.inspectDuration();
        this.setScope(0);
        this.drawTime = this.weaponTime = 0;
      }
      if (e.code === "Digit1") {
        if (this.primary !== null) this.equip(this.primary);
        else this.toast("Press B to buy a primary weapon", 1.5);
      }
      if (e.code === "Digit2") this.equip(2);
      if (e.code === "Digit3") this.equip(4);
      if (e.code === "KeyB") {
        toggle("loadout", true);
        document.exitPointerLock();
        toggle("pause", false);
      }
    });
    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "KeyM") document.querySelector(".radar-wrap")!.classList.remove("expanded");
      if (e.code === "Tab") toggle("scoreboard", false);
    });
    document.addEventListener(
      "wheel",
      (e) => {
        if (!this.active || !this.locked || this.dead || !e.deltaY) return;
        e.preventDefault();
        const now = performance.now();
        if (now - this.wheelTime < 100) return;
        this.wheelTime = now;
        const inventory = this.inventory();
        const current = inventory.indexOf(this.selected);
        this.equip(
          inventory[(current + (e.deltaY > 0 ? 1 : -1) + inventory.length) % inventory.length],
        );
      },
      { passive: false },
    );
    document.addEventListener("mousedown", (e) => {
      if (e.button === 2 && this.locked && !this.dead) {
        if (this.selected === 3) this.cycleScope();
        else if (this.selected === 4) this.fireKnife(true);
      }
      if (e.button === 0 && this.locked && !this.dead) {
        this.firing = true;
        this.fire();
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.firing = false;
    });
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.firing = false;
      if (this.locked) document.exitPointerLock();
    });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("resize", () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = this.viewCamera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.viewCamera.updateProjectionMatrix();
    });
  }
  async lock() {
    if (!this.active) return;
    try {
      await this.canvas.requestPointerLock();
    } catch {
      toggle("pause", true);
    }
    if (this.audio?.state === "suspended") void this.audio.resume();
  }
  setTeam(team: AgentTeam) {
    if (this.active || team === this.team) return;
    this.team = team;
    this.bots.forEach((b) => {
      disposeSoldier(b.rig);
      this.scene.remove(b.group);
    });
    if (this.assetsReady) this.bots = names.slice(0, 5).map((_, i) => this.makeBot(i));
    this.bots.forEach((b) => {
      b.group.visible = false;
    });
    if (this.assetsReady) {
      this.equip(this.selected);
      void this.warmUp();
    }
  }
  viewGun(index: number) {
    const key = `${this.team}:${index}`;
    let gun = this.guns.get(key);
    if (!gun) this.guns.set(key, (gun = createGun(index, this.team)));
    return gun;
  }
  // Compile every program and upload every texture that play can reveal (both
  // worlds' lighting, hidden agents, all weapons, effects) before the match.
  warmUp() {
    if (!this.dust) return;
    const extras = new T.Group(),
      viewExtras = new T.Group();
    extras.add(
      createWorldGun(0),
      createWorldGun(1),
      ...[0xffdda0, 0xffc881].map((color) => new T.Mesh(tracerGeometry, tracerMaterial(color))),
    );
    for (let index = 0; index < weapons.length; index++)
      if (this.viewGun(index) !== this.gun) viewExtras.add(this.viewGun(index));
    this.scene.add(extras);
    this.view.add(viewExtras);
    const range = this.range.root.visible,
      dust = this.dust.root.visible;
    for (const casual of [false, true]) {
      this.range.root.visible = !casual;
      this.dust.root.visible = casual;
      this.renderer.compile(this.scene, this.camera);
    }
    this.range.root.visible = range;
    this.dust.root.visible = dust;
    this.renderer.compile(this.view, this.viewCamera);
    const textures = new Set<T.Texture>();
    for (const root of [this.scene, this.view])
      root.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          for (const value of Object.values(material))
            if (value instanceof T.Texture) textures.add(value);
      });
    textures.forEach((texture) => this.renderer.initTexture(texture));
    this.scene.remove(extras);
    viewExtras.clear();
    this.view.remove(viewExtras);
    return this.finishPrograms();
  }
  // Let drivers link in parallel, then take each program's first use (uniform
  // lookup) now rather than when an agent or weapon first comes into view.
  async finishPrograms() {
    const parallel = this.renderer.extensions.has("KHR_parallel_shader_compile"),
      pending = new Set(this.renderer.info.programs ?? []),
      deadline = performance.now() + 5000;
    while (pending.size) {
      for (const program of pending)
        if (
          !parallel ||
          performance.now() > deadline ||
          (program as T.WebGLProgram & { isReady(): boolean }).isReady()
        ) {
          program.getUniforms();
          pending.delete(program);
        }
      if (pending.size) await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  start(mode: Mode) {
    if (!this.supported || matchMedia("(pointer: coarse)").matches) {
      toggle("unsupported", true);
      return;
    }
    if (!this.assetsReady) return;
    this.active = true;
    this.mode = mode;
    this.useWorld(mode === "casual");
    this.configureBots(mode === "casual");
    this.round = 1;
    this.teamScores = { t: 0, ct: 0 };
    this.roundHistory = [];
    this.scoreboardSignature = "";
    this.roundPause = 0;
    this.bomb = null;
    this.bombMesh.visible = false;
    this.time = 300;
    this.kills = this.deaths = 0;
    this.dead = 0;
    for (const id of ["menu", "pause", "result", "loadout", "settings"]) toggle(id, false);
    toggle("hud", true);
    el("killfeed").replaceChildren();
    el("match-mode").textContent =
      mode === "practice" ? "PRACTICE" : mode === "casual" ? "CASUAL · 10V10" : "DEATHMATCH";
    el("match-goal").textContent =
      mode === "practice"
        ? "AIM · RESET · REPEAT"
        : mode === "casual"
          ? "DUST II · FIRST TO 8 ROUNDS"
          : "FIRST TO 20";
    el("radar-caption").textContent =
      mode === "practice"
        ? "TARGET RANGE"
        : mode === "casual"
          ? "DUST II · TEAM RADAR · HOLD M"
          : "YOU VS BOTS";
    this.magazines = weapons.map((w) => ({ ammo: w.mag, reserve: w.reserve }));
    this.spawnPlayer();
    this.bots.forEach((b, i) => {
      b.kills = b.deaths = 0;
      this.spawnBot(b, i);
    });
    if (mode === "casual") this.startRound();
    this.ensureAudio();
    this.soundscape.playMusic("start");
    this.soundscape.play("ready");
    void this.lock();
    this.toast(
      mode === "practice"
        ? "PRACTICE · Aim at the stationary bots"
        : mode === "casual"
          ? "CASUAL · 10V10 · Plant / defuse with E · First to 8 rounds"
          : "GET READY · First to 20 kills",
    );
    this.updateUI();
  }
  menu() {
    this.active = false;
    this.setScope(0);
    this.rescope = 0;
    if (this.locked) document.exitPointerLock();
    for (const id of ["hud", "pause", "result", "settings", "loadout"]) toggle(id, false);
    toggle("menu", true);
    this.soundscape.playMusic("menu");
    this.bots.forEach((b) => (b.group.visible = false));
    this.bombMesh.visible = false;
    this.useWorld(true);
  }
  inspectDuration() {
    return this.selected === 4
      ? knifeInspectDuration(this.inspectDraw)
      : nativeInspectDuration(this.selected);
  }
  animationSounds(motion: "draw" | "reload" | "shoot1", before: number, after: number) {
    if (this.dead) return;
    for (const cue of nativeSoundCues(this.selected, motion)) {
      if (before < cue.time && after >= cue.time) this.sound(cue.kind);
    }
  }
  setScope(level: number) {
    if (level) this.inspectTime = 0;
    this.scopeLevel = level;
    this.scopeSettle = level ? 0.18 : 0;
    this.camera.fov = level === 2 ? 10 : level === 1 ? 40 : this.settings.fov;
    this.camera.updateProjectionMatrix();
    toggle("scope", level > 0);
    el("scope-zoom").textContent = level === 2 ? "ZOOM II" : "ZOOM I";
    toggle("crosshair", this.selected !== 3);
  }
  cycleScope() {
    if (this.reload) return;
    if (this.boltTime > 0) {
      this.rescope = 0;
      return;
    }
    this.rescope = 0;
    this.setScope((this.scopeLevel + 1) % 3);
    this.sound("scope");
  }
  spawnPlayer() {
    this.setScope(0);
    this.rescope = this.boltTime = 0;
    this.weaponCooldowns = weapons.map(() => 0);
    this.position.set(-17, 0, 17);
    if (this.mode === "casual" && this.dust) {
      this.position.fromArray(this.dust.navigation.data.spawns[this.team][0]);
      this.position.y = this.dust.collision.floor(
        this.position.x,
        this.position.z,
        this.position.y + 0.5,
      );
    }
    this.velocity = { x: 0, z: 0 };
    this.vertical = 0;
    this.grounded = true;
    this.jumpQueued = false;
    this.health = this.armor = 100;
    this.yaw =
      this.mode === "casual"
        ? (this.dust?.navigation.data.spawnAngles?.[this.team][0] ?? 0)
        : -0.12;
    this.pitch = 0;
    this.eye = 1.65;
    this.dead = 0;
    this.reload = this.shots = this.cooldown = this.drawTime = 0;
    this.invulnerable = 2;
    if (this.soundscape.currentMusic === "deathcam") this.soundscape.playMusic(null);
    this.magazines = weapons.map((w) => ({ ammo: w.mag, reserve: w.reserve }));
    this.primary = null;
    this.ammo = weapons[this.selected].mag;
    this.reserve = weapons[this.selected].reserve;
    this.equip(2);
    this.firing = false;
    this.camera.position.copy(this.position);
    this.camera.position.y += this.eye;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
  inventory() {
    return this.primary === null ? [2, 4] : [this.primary, 2, 4];
  }
  buy(index: number) {
    if (!this.active || this.dead || ![0, 1, 2, 3].includes(index)) return false;
    if (index !== 2 && this.primary !== index) {
      this.primary = index;
      this.magazines[index] = { ammo: weapons[index].mag, reserve: weapons[index].reserve };
    }
    this.equip(index);
    return true;
  }
  equip(index: number) {
    if (!this.inventory().includes(index)) return;
    this.knifeTime = this.inspectTime = this.weaponTime = 0;
    this.knifeAlternate = true;
    this.shotTime = 0;
    this.knifePending = false;
    this.setScope(0);
    this.rescope = this.boltTime = 0;
    this.magazines[this.selected] = { ammo: this.ammo, reserve: this.reserve };
    this.selected = index;
    this.ammo = this.magazines[index].ammo;
    this.reserve = this.magazines[index].reserve;
    this.reload = 0;
    this.shots = 0;
    this.drawTime = DRAW_DURATION;
    this.cooldown = Math.max(DRAW_DURATION, this.weaponCooldowns[index]);
    if (index === 3 && this.weaponCooldowns[index] > 0) this.boltTime = this.weaponCooldowns[index];
    // View models are cached per team and weapon; animateGun fully re-poses them.
    this.view.remove(this.gun);
    this.gun = this.viewGun(index);
    this.flash.position.copy(this.gun.userData.muzzle);
    this.gun.add(this.flash);
    this.view.add(this.gun);
    this.setScope(0);
    if (this.active) {
      this.animationSounds("draw", -1, 0);
      this.soundscape.play("gear");
    }
    this.updateUI();
  }
  updateInventory() {
    const indices = this.inventory();
    const signature = `${indices.join(",")}:${this.selected}`;
    if (signature === this.inventorySignature) return;
    this.inventorySignature = signature;
    const fragment = document.createDocumentFragment();
    for (const index of indices) {
      const slot = index === 2 ? 2 : index === 4 ? 3 : 1;
      const row = document.createElement("div");
      row.className = `inventory-weapon ${index === this.selected ? "active" : ""}`;
      row.dataset.weaponIndex = String(index);
      row.setAttribute("role", "listitem");
      row.setAttribute(
        "aria-label",
        `${weapons[index].name}${index === this.selected ? ", equipped" : ""}`,
      );
      if (index === this.selected) row.setAttribute("aria-current", "true");
      const image = document.createElement("img");
      image.src = `/icons/${["ak-47", "m4a1-s", "usp-s", "awp", "m9-bayonet"][index]}.png`;
      image.alt = "";
      const key = document.createElement("span");
      key.className = "inventory-key";
      key.textContent = String(slot);
      const name = document.createElement("span");
      name.className = "inventory-name";
      name.textContent = weapons[index].name;
      row.append(image, key, name);
      fragment.append(row);
    }
    el("inventory").replaceChildren(fragment);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-weapon]")) {
      const index = Number(button.dataset.weapon);
      button.classList.toggle("owned", indices.includes(index));
      button.querySelector(".buy-state")!.textContent =
        index === 2 ? "OWNED · EQUIP" : index === this.primary ? "OWNED · EQUIP" : "FREE · BUY";
    }
  }
  fireKnife(stab = false) {
    if (
      !this.active ||
      !this.locked ||
      this.dead ||
      this.selected !== 4 ||
      this.cooldown > 0 ||
      this.roundPause > 0
    )
      return;
    if (
      this.bomb?.defuser === "player" ||
      (this.bomb?.carrier === "player" && this.bomb.plantProgress > 0)
    )
      return;
    this.inspectTime = this.weaponTime = 0;
    if (!stab) this.knifeAlternate = !this.knifeAlternate;
    this.knifeStab = stab;
    this.knifeDuration = (stab ? 0.85 : 0.5) / WEAPON_ANIMATION_RATE;
    this.knifeTime = this.knifeDuration;
    this.knifePending = true;
    this.cooldown = this.weaponCooldowns[4] = this.knifeDuration;
    this.soundscape.play(this.knifeAlternate ? "knife-swing1" : "knife-swing2");
  }
  meleeHit(stab: boolean) {
    this.camera.position.copy(this.position);
    this.camera.position.y += this.eye;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.updateMatrixWorld(true);
    this.ray.set(
      this.camera.position,
      new T.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion),
    );
    this.ray.far = stab ? 1.7 : 1.9;
    const impact = this.ray.intersectObjects(this.shotTargets(), true)[0];
    if (!impact) return;
    const index = impact.object.userData.bot;
    if (typeof index !== "number") {
      this.soundscape.play("knife-wall");
      return;
    }
    const b = this.bots[index];
    // A narrow, non-penetrating melee trace: solid cover always blocks it.
    b.health -= stab ? 65 : 35;
    this.hit = 0.13;
    this.soundscape.play("knife-hit");
    el("hitmarker").style.color = "#fff";
    if (b.health <= 0) {
      this.kills++;
      b.deaths++;
      b.speed = 0;
      b.respawn = this.mode === "casual" ? Infinity : this.mode === "practice" ? 1.8 : 3;
      if (this.mode === "casual") this.dropBomb(index);
      this.feed("YOU", b.name, false, 4);
      this.toast("KNIFE ELIMINATION +1", 1);
      if (this.mode === "deathmatch" && this.kills >= 20) this.finish();
    }
    this.updateUI();
  }
  beginReload() {
    if (this.selected === 4) return;
    const w = weapons[this.selected];
    if (!this.reserve && this.mode === "practice") this.reserve = w.reserve;
    if (this.reload || this.ammo === w.mag || !this.reserve) return;
    this.drawTime = this.inspectTime = this.shotTime = 0;
    this.setScope(0);
    this.rescope = 0;
    this.reload = w.reload;
    this.boltTime = 0;
    this.animationSounds("reload", -1, 0);
    this.updateUI();
  }
  sound(
    kind: WeaponSound | "hit" | "head" | "step",
    pan = 0,
    distance = 0,
    weapon = this.selected,
  ) {
    if (!this.audio || !this.noise || !this.settings.volume || !this.settings.effectsVolume) return;
    if (kind === "step") {
      this.soundscape.play("step", false, this.position.y > 0.1 ? "concrete" : "sand");
      return;
    }
    if (weapon === 4 && kind !== "hit" && kind !== "head" && kind !== "bot") return;
    if (kind !== "hit" && kind !== "head") {
      this.weaponAudio.play(this.audio, kind, weapon, 100, pan, distance);
      return;
    }
    this.soundscape.play(kind);
  }
  makeBot(index: number): Bot {
    const team =
      this.mode === "casual" && index >= 10 ? this.team : this.team === "ct" ? "t" : "ct";
    const rig = createSoldier(index, team);
    // Dust II caches static sun shadows; moving agents must not become frozen
    // silhouettes when graphics settings rebuild that cache mid-round.
    if (this.mode === "casual")
      rig.group.traverse((object) => {
        if (object instanceof T.Mesh) object.castShadow = false;
      });
    this.scene.add(rig.group);
    return {
      name: names[index],
      team,
      target: null,
      memory: new T.Vector3(),
      alert: 0,
      stuck: 0,
      vertical: 0,
      blockedAreas: new Set(),
      navArea: 0,
      group: rig.group,
      rig,
      speed: 0,
      moving: false,
      tracking: false,
      health: 100,
      kills: 0,
      deaths: 0,
      respawn: 0,
      shot: 1,
      buyTime: 0,
      reaction: 0.8,
      path: [],
      nav: 0,
      facing: 0,
      velocity: new T.Vector2(),
      anim: 0,
    };
  }
  spawnBot(b: Bot, index: number) {
    const practice = [
        [-17, 4],
        [-1, 16],
        [13, 17],
        [17, 5],
        [0, -17],
      ],
      safe = spawns.filter((s) => Math.hypot(s[0] - this.position.x, s[1] - this.position.z) > 12);
    const p =
      this.mode === "practice"
        ? practice[index % 5]
        : safe[Math.floor(Math.random() * safe.length)] || spawns[(index + 1) % spawns.length];
    b.group.position.set(p[0], 0, p[1]);
    if (this.mode === "casual" && this.dust) {
      const points = this.dust.navigation.data.spawns[b.team];
      const slot = b.team === this.team ? index - 9 : index;
      b.group.position.fromArray(points[slot % points.length]);
      b.group.position.y = this.dust.collision.floor(
        b.group.position.x,
        b.group.position.z,
        b.group.position.y + 0.5,
      );
      b.navArea = this.dust.navigation.nearest(b.group.position);
    }
    b.target = null;
    b.alert = b.stuck = 0;
    b.vertical = 0;
    b.blockedAreas.clear();
    b.health = 100;
    b.speed = 0;
    b.moving = b.tracking = false;
    resetSoldier(b.rig);
    b.anim = 0;
    b.velocity.set(0, 0);
    b.facing = b.group.rotation.y;
    b.respawn = 0;
    b.group.visible = true;
    setSoldierWeapon(b.rig, 2);
    b.buyTime = this.mode === "practice" ? Infinity : 2 + (index % 7) * 0.3;
    b.shot = 0.8 + Math.random();
    b.reaction = 0.7;
    b.path = [];
    b.nav = 0;
  }
  findPath(from: T.Vector3, to: T.Vector3) {
    const cell = (x: number, z: number) =>
        clamp(Math.floor((z + 22) / 2), 0, 21) * 22 + clamp(Math.floor((x + 22) / 2), 0, 21),
      start = cell(from.x, from.z),
      end = cell(to.x, to.z),
      queue = [start],
      previous = new Int16Array(484).fill(-1);
    previous[start] = start;
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i];
      if (n === end) break;
      for (const v of [n - 22, n + 22, n % 22 > 0 ? n - 1 : -1, n % 22 < 21 ? n + 1 : -1]) {
        if (v < 0 || v >= 484 || !this.navGrid[v] || previous[v] !== -1) continue;
        previous[v] = n;
        queue.push(v);
      }
    }
    if (previous[end] === -1) return [];
    const path: T.Vector2[] = [];
    let n = end;
    while (n !== start) {
      path.unshift(new T.Vector2((n % 22) * 2 - 21, Math.floor(n / 22) * 2 - 21));
      n = previous[n];
    }
    return path;
  }
  visible(from: T.Vector3, to: T.Vector3) {
    if (this.world.collision) return this.world.collision.visible(from, to);
    const direction = to.clone().sub(from);
    this.ray.set(from, direction.clone().normalize());
    this.ray.far = direction.length();
    const result = this.ray.intersectObjects(this.world.solids, false).length === 0;
    this.ray.far = Infinity;
    return result;
  }
  trace(from: T.Vector3, to: T.Vector3, color: number) {
    const distance = from.distanceTo(to);
    if (distance < 0.01) return;
    let tracer = this.tracers.find((t) => t.life <= 0);
    if (!tracer && this.tracers.length >= 32)
      tracer = this.tracers.reduce((a, b) => (b.life < a.life ? b : a));
    if (!tracer) {
      tracer = { mesh: new T.Mesh(tracerGeometry), life: 0 };
      this.tracers.push(tracer);
      this.scene.add(tracer.mesh);
    }
    const mesh = tracer.mesh;
    mesh.material = tracerMaterial(color);
    mesh.position.copy(from).lerp(to, 0.5);
    mesh.quaternion.setFromUnitVectors(up, scratch.copy(to).sub(from).normalize());
    mesh.scale.set(1, distance, 1);
    mesh.visible = true;
    tracer.life = 0.055;
  }
  decal(point: T.Vector3, normal: T.Vector3) {
    const slot = this.decalNext;
    this.decalNext = (slot + 1) % decalLimit;
    decalRotation.setFromUnitVectors(forward, normal);
    this.decals.setMatrixAt(slot, decalMatrix.compose(point, decalRotation, unit));
    this.decals.instanceMatrix.needsUpdate = true;
    this.decalLife[slot] = 8;
    this.decals.count = Math.max(this.decals.count, slot + 1);
    this.decals.visible = true;
  }
  // Rays test the world plus living enemies whose agent sphere the ray reaches;
  // only those rigs need fresh world matrices for skinned picking.
  shotTargets() {
    const targets = this.targets,
      ray = this.ray.ray;
    targets.length = 0;
    for (const solid of this.world.solids) {
      solid.updateWorldMatrix(true, false);
      targets.push(solid);
    }
    for (const b of this.bots) {
      if (b.health <= 0 || (this.mode === "casual" && b.team === this.team)) continue;
      botSphere.copy(agentBounds).center.add(b.group.position);
      if (
        !ray.intersectsSphere(botSphere) ||
        ray.origin.distanceTo(botSphere.center) > this.ray.far + botSphere.radius
      )
        continue;
      b.group.updateMatrixWorld(true);
      targets.push(...b.group.children);
    }
    return targets;
  }
  fire() {
    if (this.dead || !this.active || this.reload || this.cooldown > 0 || !this.locked) return;
    if (
      this.mode === "casual" &&
      (this.roundPause > 0 ||
        this.bomb?.defuser === "player" ||
        (this.bomb?.carrier === "player" && this.bomb.plantProgress > 0))
    )
      return;
    if (this.selected === 4) {
      this.fireKnife();
      return;
    }
    if (!this.ammo) {
      this.beginReload();
      return;
    }
    this.camera.position.copy(this.position);
    this.camera.position.y += this.eye;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.updateMatrixWorld(true);
    const w = weapons[this.selected];
    this.ammo--;
    this.cooldown = w.delay;
    this.weaponCooldowns[this.selected] = w.delay;
    this.recovery = 0.25;
    this.shots++;
    this.kick = 0.07;
    this.inspectTime = 0;
    this.shotTime = this.selected === 3 ? 0 : nativeShotDuration(this.selected);
    const moving = Math.hypot(this.velocity.x, this.velocity.z) / w.speed,
      spread =
        this.selected === 3
          ? (this.scopeLevel ? 0.0005 + this.scopeSettle * 0.035 : 0.095) +
            moving * 0.045 +
            (this.grounded ? 0 : 0.1)
          : 0.0015 +
            moving * 0.033 +
            (this.grounded ? 0 : 0.065) +
            Math.min(this.shots, 20) * 0.0007,
      crouch = this.keys.has("ControlLeft") || this.keys.has("KeyC");
    const direction = new T.Vector3(
      (Math.random() - 0.5) * spread * (crouch ? 0.55 : 1),
      (Math.random() - 0.5) * spread * (crouch ? 0.55 : 1),
      -1,
    )
      .normalize()
      .applyQuaternion(this.camera.quaternion);
    this.ray.set(this.camera.position, direction);
    const stats = ballistics[this.selected];
    this.ray.far = stats.range / SOURCE_UNITS_PER_METER;
    const impacts = this.ray.intersectObjects(this.shotTargets(), true);
    const seenBots = new Set<number>(),
      seenSolids = new Set<T.Object3D>();
    let damage = stats.damage as number,
      previousDistance = 0,
      remaining = 4,
      passed = false;
    let end = this.camera.position.clone().addScaledVector(direction, Math.min(90, this.ray.far));
    for (const impact of impacts) {
      if (impact.distance < previousDistance - 0.001) continue;
      const index = impact.object.userData.bot;
      if (
        typeof index === "number"
          ? seenBots.has(index)
          : !this.world.collision && seenSolids.has(impact.object)
      )
        continue;
      damage = rangeDamage(damage, impact.distance - previousDistance, stats.modifier);
      if (damage < 1) break;
      end.copy(impact.point);
      let thickness: number, material: BulletMaterial;
      if (typeof index === "number") {
        seenBots.add(index);
        const b = this.bots[index],
          head = soldierHeadHit(b.rig, impact.point);
        const height = impact.point.y - b.group.position.y;
        const multiplier = head ? w.head : height < 0.85 ? 0.75 : height < 1.08 ? 1.25 : 1;
        b.health -= Math.floor(damage * multiplier);
        this.hit = 0.13;
        this.sound(head ? "head" : "hit");
        el("hitmarker").style.color = head ? "#efac51" : "#fff";
        if (b.health <= 0) {
          this.kills++;
          b.deaths++;
          b.speed = 0;
          b.respawn = this.mode === "casual" ? Infinity : this.mode === "practice" ? 1.8 : 3;
          if (this.mode === "casual") this.dropBomb(index);
          this.feed(
            "YOU",
            b.name,
            head,
            this.selected,
            this.selected === 3 && !this.scopeLevel,
            passed,
          );
          this.toast(head ? "HEADSHOT +1" : "ELIMINATION +1", 1);
          if (this.mode === "deathmatch" && this.kills >= 20) this.finish();
        }
        // Flesh thickness follows the struck region and ray direction, excluding
        // armor pouches, the carried rifle, and overlapping decorative meshes.
        const local = direction.clone().applyAxisAngle(new T.Vector3(0, 1, 0), -b.group.rotation.y);
        thickness = Math.min(head ? 0.23 : 0.28 / Math.max(0.2, Math.abs(local.z)), 0.44);
        material = "flesh";
      } else {
        seenSolids.add(impact.object);
        material = impact.object.userData.bulletMaterial || "concrete";
        if (this.world.collision) thickness = this.world.collision.thickness(impact, direction);
        else {
          const mesh = impact.object as T.Mesh;
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          const bounds = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
          const origin = this.ray.ray.origin;
          let exit = Infinity;
          for (const axis of ["x", "y", "z"] as const) {
            if (Math.abs(direction[axis]) > 1e-8)
              exit = Math.min(
                exit,
                ((direction[axis] > 0 ? bounds.max[axis] : bounds.min[axis]) - origin[axis]) /
                  direction[axis],
              );
          }
          thickness = Math.max(0, exit - impact.distance);
        }
        this.decal(
          decalPoint.copy(impact.point).addScaledVector(direction, -0.015),
          scratch.copy(impact.face!.normal).transformDirection(impact.object.matrixWorld),
        );
      }
      if (!remaining || impact.distance * SOURCE_UNITS_PER_METER > 3000) break;
      damage = penetrate(damage, stats.power, thickness, material);
      if (damage < 1) break;
      remaining--;
      passed = true;
      previousDistance = impact.distance + thickness;
      end.copy(this.camera.position).addScaledVector(direction, previousDistance);
    }
    this.trace(
      this.camera.position
        .clone()
        .add(new T.Vector3(0.15, -0.13, 0).applyQuaternion(this.camera.quaternion)),
      end,
      0xffdda0,
    );
    this.pitch = clamp(this.pitch + w.recoil * (this.shots < 5 ? 0.75 : 1.25), -1.45, 1.45);
    this.yaw += Math.sin(this.shots * 0.68) * w.recoil * (this.shots > 6 ? 0.7 : 0.12);
    this.sound("shot");
    if (this.selected === 3) {
      this.rescope = this.scopeLevel;
      this.boltTime = w.delay;
      this.setScope(0);
    }
    this.updateUI();
  }
  feed(
    killer: string,
    victim: string,
    head = false,
    weapon = this.selected,
    noScope = false,
    wallbang = false,
  ) {
    const container = el("killfeed");
    // Rows only shift when the oldest is trimmed; measure layout just then.
    const before =
      container.children.length >= 6
        ? new Map(
            [...container.children].map((child) => [child, child.getBoundingClientRect().top]),
          )
        : undefined;
    const row = document.createElement("div");
    row.className = "feed" + (killer === "YOU" || victim === "YOU" ? " feed-local" : "");
    row.setAttribute("role", "listitem");
    const name = (text: string) => {
      const node = document.createElement("span");
      node.className =
        (text === "YOU"
          ? this.team
          : (this.bots.find((b) => b.name === text)?.team ?? (this.team === "ct" ? "t" : "ct"))) ===
        "ct"
          ? "feed-ct"
          : "feed-t";
      node.textContent = text;
      return node;
    };
    const icon = (file: string, label: string, className: string) => {
      const img = document.createElement("img");
      img.src = `/icons/${file}.png`;
      img.alt = label;
      img.className = className;
      return img;
    };
    if (noScope) row.append(icon("noscope", "NO SCOPE", "feed-modifier"));
    row.append(
      name(killer),
      icon(
        ["ak-47", "m4a1-s", "usp-s", "awp", "m9-bayonet"][weapon],
        weapons[weapon].name,
        "feed-weapon",
      ),
    );
    if (wallbang) row.append(icon("wallbang", "PENETRATION", "feed-modifier"));
    if (head) row.append(icon("headshot", "HEADSHOT", "feed-modifier"));
    row.append(name(victim));
    row.setAttribute(
      "aria-label",
      `${killer} eliminated ${victim} with ${weapons[weapon].name}${head ? ", HEADSHOT" : ""}${noScope ? ", NO SCOPE" : ""}`,
    );
    container.append(row);
    while (container.children.length > 6) container.firstElementChild?.remove();
    if (before)
      for (const child of container.children) {
        const old = before.get(child);
        if (old !== undefined) {
          const offset = old - child.getBoundingClientRect().top;
          if (offset)
            child.animate(
              [{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }],
              { duration: 160, easing: "ease-out" },
            );
        }
      }
    setTimeout(() => {
      if (!row.isConnected) return;
      row.classList.add("feed-exit");
      setTimeout(() => row.remove(), 240);
    }, 6500);
  }
  toast(text: string, time = 3) {
    setText("toast", text);
    this.toastTime = time;
  }
  finish() {
    this.setScope(0);
    this.rescope = 0;
    this.active = false;
    this.firing = false;
    if (this.locked) document.exitPointerLock();
    toggle("pause", false);
    toggle("result", true);
    el("result-title").textContent = (
      this.mode === "casual" ? this.teamScores[this.team] >= 8 : this.kills >= 20
    )
      ? "VICTORY."
      : this.mode === "casual" || this.bots.some((b) => b.kills >= 20)
        ? "DEFEAT."
        : "TIME’S UP.";
    this.soundscape.playMusic(
      (this.mode === "casual" ? this.teamScores[this.team] >= 8 : this.kills >= 20)
        ? "win"
        : "lose",
    );
    el("result-stats").textContent =
      `${this.kills} eliminations · ${this.deaths} deaths · ${this.deaths ? (this.kills / this.deaths).toFixed(2) : this.kills.toFixed(2)} K/D`;
  }
  simulate(dt: number) {
    this.animationTime += dt;
    if (!this.drawTime && !this.knifeTime && !this.inspectTime) this.weaponTime += dt;
    this.shotTime = Math.max(0, this.shotTime - dt);
    this.inspectTime = Math.max(0, this.inspectTime - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.knifeTime = Math.max(0, this.knifeTime - dt);
    if (
      this.knifePending &&
      this.knifeDuration - this.knifeTime >= (this.knifeStab ? 0.18 : 0.1) / WEAPON_ANIMATION_RATE
    ) {
      this.knifePending = false;
      if (!this.dead && this.active && this.locked && this.roundPause === 0 && this.selected === 4)
        this.meleeHit(this.knifeStab);
    }
    if (this.drawTime > 0) {
      const before = 1 - this.drawTime / DRAW_DURATION;
      this.drawTime = Math.max(0, this.drawTime - dt);
      const after = 1 - this.drawTime / DRAW_DURATION;
      if (!this.reload) this.animationSounds("draw", before, after);
    }
    for (let i = 0; i < this.weaponCooldowns.length; i++)
      this.weaponCooldowns[i] = Math.max(0, this.weaponCooldowns[i] - dt);
    this.scopeSettle = Math.max(0, this.scopeSettle - dt);
    if (this.boltTime > 0) {
      const previous = this.boltTime;
      this.boltTime = Math.max(0, this.boltTime - dt);
      if (!this.reload && !this.dead) {
        if (!this.drawTime)
          this.animationSounds(
            "shoot1",
            1 - previous / weapons[3].delay,
            1 - this.boltTime / weapons[3].delay,
          );
      }
      if (!this.boltTime && this.rescope && !this.dead && !this.reload && this.selected === 3) {
        this.setScope(this.rescope);
        this.rescope = 0;
      }
    }
    this.kick = Math.max(0, this.kick - dt * 0.65);
    this.hit = Math.max(0, this.hit - dt);
    this.damage = Math.max(0, this.damage - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.recovery -= dt;
    if (this.recovery <= 0) this.shots = Math.max(0, this.shots - dt * 25);
    this.toastTime -= dt;
    if (this.toastTime <= 0) setText("toast", "");
    if (this.mode === "deathmatch") {
      const previousTime = this.time;
      this.time -= dt;
      if (previousTime > 10 && this.time <= 10) this.soundscape.playMusic("countdown");
      if (this.time <= 0) {
        this.finish();
        return;
      }
    }
    if (this.mode === "casual") {
      this.updateRound(dt);
      if (!this.active || this.roundPause > 0) return;
      if (this.dead) {
        this.tick++;
        this.updateBots(dt * 8, this.tick % 8);
        this.moveBots(dt);
        return;
      }
    }
    if (this.dead) {
      this.dead -= dt;
      this.toast(`ELIMINATED · Respawning in ${Math.ceil(this.dead)}`, dt * 2);
      if (this.dead <= 0) {
        this.spawnPlayer();
        this.toast("BACK IN · 2 seconds of spawn protection", 2);
      }
      return;
    }
    if (this.reload) {
      const previous = this.reload;
      this.reload = Math.max(0, this.reload - dt);
      const duration = weapons[this.selected].reload;
      this.animationSounds("reload", 1 - previous / duration, 1 - this.reload / duration);
      if (!this.reload) {
        const amount = Math.min(weapons[this.selected].mag - this.ammo, this.reserve);
        this.ammo += amount;
        this.reserve -= amount;
        this.updateUI();
      }
    }
    const crouch =
        this.keys.has("ControlLeft") ||
        this.keys.has("ControlRight") ||
        this.keys.has("KeyC") ||
        (this.eye < 1.6 &&
          this.isBlocked(this.position.x, this.position.z, this.position.y, 0.3, 1.65)),
      walk = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      maxSpeed =
        (this.scopeLevel && weapons[this.selected].scopedSpeed) || weapons[this.selected].speed,
      speed = maxSpeed * (crouch ? movement.crouchModifier : walk ? movement.walkModifier : 1),
      right = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0),
      forward = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0),
      dx = right * Math.cos(this.yaw) - forward * Math.sin(this.yaw),
      dz = -right * Math.sin(this.yaw) - forward * Math.cos(this.yaw);
    // Source checks jump before ground friction. A jump on the landing tick
    // therefore carries momentum instead of losing a tick of ground speed.
    if (
      (this.jumpQueued || (this.settings.autoBunnyhop && this.keys.has("Space"))) &&
      this.grounded
    ) {
      limitJumpSpeed(this.velocity, maxSpeed);
      this.vertical = movement.jumpImpulse;
      this.grounded = false;
      this.soundscape.play("jump");
    }
    this.jumpQueued = false;
    // Walking/ducking limit the target speed, while ground acceleration keeps
    // weapon-speed strength against stopspeed friction (especially in a crouch).
    accelerate(this.velocity, dx, dz, speed, dt, this.grounded, this.grounded ? maxSpeed : speed);
    const previousY = this.position.y;
    const wasFalling = this.vertical < -2;
    const falling = fallStep(this.vertical, dt);
    this.position.y += falling.distance;
    this.vertical = falling.vertical;
    if (this.world.collision && this.vertical > 0) {
      const ceiling = this.world.collision.ceiling(
        this.position.x,
        this.position.z,
        previousY + this.eye,
        this.position.y + this.eye,
      );
      if (Number.isFinite(ceiling)) {
        this.position.y = ceiling - this.eye;
        this.vertical = 0;
      }
    }
    this.grounded = false;
    let ground = this.world.collision
      ? this.world.collision.floor(
          this.position.x,
          this.position.z,
          previousY + 0.46,
          this.position.y - 0.2,
        )
      : 0;
    for (const b of this.world.walls) {
      const inside =
        this.position.x > b.x - b.w / 2 - 0.2 &&
        this.position.x < b.x + b.w / 2 + 0.2 &&
        this.position.z > b.z - b.d / 2 - 0.2 &&
        this.position.z < b.z + b.d / 2 + 0.2;
      if (!inside) continue;
      if (previousY >= b.h - 0.05) ground = Math.max(ground, b.h);
      if (
        b.y &&
        this.vertical > 0 &&
        previousY + this.eye <= b.y &&
        this.position.y + this.eye > b.y
      ) {
        this.position.y = b.y - this.eye;
        this.vertical = 0;
      }
    }
    if (this.position.y <= ground) {
      this.position.y = ground;
      this.vertical = 0;
      this.grounded = true;
    }
    if (
      this.world.collision &&
      !this.world.collision.resolveHorizontal(this.position, 0.3, this.eye)
    ) {
      // A tight corner may have no horizontal escape. Keep the last clear
      // height so input can still move away instead of embedding the player.
      this.position.y = previousY;
      this.grounded = this.vertical <= 0;
      this.vertical = 0;
    }
    const nextX = this.position.x + this.velocity.x * dt;
    if (!this.isBlocked(nextX, this.position.z, this.position.y, 0.3, this.eye))
      this.position.x = nextX;
    else this.velocity.x = 0;
    const nextZ = this.position.z + this.velocity.z * dt;
    if (!this.isBlocked(this.position.x, nextZ, this.position.y, 0.3, this.eye))
      this.position.z = nextZ;
    else this.velocity.z = 0;
    const nextEye = T.MathUtils.damp(this.eye, crouch ? 1.1 : 1.65, 15, dt);
    if (
      nextEye <= this.eye ||
      !this.isBlocked(this.position.x, this.position.z, this.position.y, 0.3, nextEye)
    )
      this.eye = nextEye;
    this.camera.position.copy(this.position);
    this.camera.position.y += this.eye;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.updateMatrixWorld(true);
    if (this.firing && weapons[this.selected].auto) this.fire();
    const magnitude = Math.hypot(this.velocity.x, this.velocity.z);
    this.sway += magnitude * dt * 1.8;
    this.footsteps += magnitude * dt;
    if (this.footsteps > 2.1 && this.grounded && !walk && !crouch) {
      this.footsteps = 0;
      this.sound("step");
    }
    if (this.grounded && wasFalling) this.soundscape.play("land");
    this.tick++;
    this.updateBots(dt * 8, this.tick % 8);
    this.moveBots(dt);
  }
  useWorld(dust: boolean) {
    this.range.root.visible = !dust || !this.dust;
    if (this.dust) this.dust.root.visible = dust;
    this.world = dust && this.dust ? this.dust : this.range;
    const radar = el("radar") as HTMLCanvasElement;
    radar.width = this.world.navigation ? 900 : 180;
    radar.height = this.world.navigation ? 948 : 180;
    document.querySelector(".radar-wrap")!.classList.toggle("callouts", !!this.world.navigation);
    el("location").textContent = this.world.collision ? "DUST II" : "DUST YARD · RANGE";
    this.scene.background = new T.Color("#c7d6df");
    this.scene.fog = new T.Fog(
      "#c7d6df",
      this.world.collision ? 100 : 30,
      this.world.collision ? 240 : 90,
    );
    this.camera.far = this.world.collision ? 250 : 110;
    this.camera.updateProjectionMatrix();
    this.drawMap(el("map-preview") as HTMLCanvasElement, false);
  }
  configureBots(casual: boolean) {
    for (const bot of this.bots) {
      this.scene.remove(bot.group);
      disposeSoldier(bot.rig);
    }
    this.bots = Array.from({ length: casual ? 19 : 5 }, (_, i) => this.makeBot(i));
  }
  isBlocked(x: number, z: number, y: number, radius = 0.3, height = 1.65) {
    return this.world.collision
      ? this.world.collision.blocked(x, z, y, radius, height)
      : blocked(x, z, y, this.world.walls, radius, height);
  }
  startRound() {
    this.time = 120;
    this.dead = 0;
    this.roundPause = 0;
    this.spawnPlayer();
    this.bots.forEach((b, i) => this.spawnBot(b, i));
    const carrier = this.team === "t" ? "player" : this.bots.findIndex((b) => b.team === "t");
    this.bomb = {
      position: new T.Vector3(),
      planted: false,
      timer: 40,
      progress: 0,
      defuser: null,
      carrier,
      plantProgress: 0,
    };
    this.bombMesh.visible = false;
    this.soundscape.playMusic("start");
    this.toast(
      `ROUND ${this.round} · ${this.team.toUpperCase()} · ${this.team === "t" ? "You carry the bomb · Hold E at A or B" : "Defend A and B · Hold E to defuse"}`,
      4,
    );
    this.updateUI();
  }
  endRound(winner: AgentTeam, reason: string) {
    if (this.roundPause) return;
    this.teamScores[winner]++;
    this.roundHistory.push({ winner, reason });
    this.roundPause = 5;
    this.firing = false;
    this.setScope(0);
    this.rescope = this.boltTime = 0;
    this.soundscape.playMusic(winner === this.team ? "win" : "lose");
    this.toast(`${winner.toUpperCase()} WINS · ${reason}`, 5);
    this.updateUI();
    if (this.teamScores[winner] >= 8) this.finish();
  }
  dropBomb(carrier: number | "player") {
    if (!this.bomb || this.bomb.planted || this.bomb.carrier !== carrier) return;
    const position = carrier === "player" ? this.position : this.bots[carrier].group.position;
    this.bomb.position.copy(position);
    this.bomb.carrier = -1;
    this.bomb.plantProgress = 0;
    this.bombMesh.position.copy(position).y += 0.08;
    this.bombMesh.visible = true;
  }
  updateRound(dt: number) {
    if (!this.bomb) return;
    if (this.roundPause > 0) {
      this.roundPause -= dt;
      if (this.roundPause <= 0) {
        this.round++;
        this.startRound();
      }
      return;
    }
    this.time = Math.max(0, this.time - dt);
    const bomb = this.bomb!;
    const stationary = !["KeyW", "KeyA", "KeyS", "KeyD", "Space"].some((key) => this.keys.has(key));
    const alive = (team: AgentTeam) => {
      let count = this.team === team && !this.dead ? 1 : 0;
      for (const b of this.bots) if (b.team === team && b.health > 0) count++;
      return count;
    };
    if (!alive("ct")) {
      this.endRound("t", "Counter-Terrorists eliminated");
      return;
    }
    if (!alive("t") && !bomb.planted) {
      this.endRound("ct", "Terrorists eliminated");
      return;
    }
    if (!bomb.planted && this.time <= 0) {
      this.endRound("ct", "Time expired");
      return;
    }
    if (bomb.carrier === -1 && !bomb.planted) {
      if (this.team === "t" && !this.dead && this.position.distanceTo(bomb.position) < 1.5)
        bomb.carrier = "player";
      else {
        const index = this.bots.findIndex(
          (b) => b.team === "t" && b.health > 0 && b.group.position.distanceTo(bomb.position) < 1.5,
        );
        if (index >= 0) bomb.carrier = index;
      }
      if (bomb.carrier !== -1) this.bombMesh.visible = false;
    }
    if (!bomb.planted && bomb.carrier !== -1) {
      const position =
        bomb.carrier === "player" ? this.position : this.bots[bomb.carrier].group.position;
      bomb.position.copy(position);
      const atSite = this.dust!.navigation.data.sites.some(
        (s) =>
          Math.hypot(position.x - s[0], position.z - s[2]) < 3.6 && Math.abs(position.y - s[1]) < 3,
      );
      const planting =
        atSite &&
        (bomb.carrier !== "player" ||
          (!this.dead && this.grounded && stationary && this.keys.has("KeyE")));
      bomb.plantProgress = planting ? bomb.plantProgress + dt : 0;
      if (planting) {
        if (bomb.carrier === "player") {
          this.firing = false;
          this.velocity.x = this.velocity.z = 0;
          this.toast(`PLANTING · ${Math.ceil(Math.max(0, 3.2 - bomb.plantProgress))}s`, dt * 2);
        } else this.bots[bomb.carrier].moving = false;
      }
      if (bomb.plantProgress >= 3.2) {
        bomb.planted = true;
        bomb.timer = 40;
        this.bombMesh.position.copy(position).y += 0.08;
        this.bombMesh.visible = true;
        this.toast("BOMB PLANTED · 40 seconds · Hold E nearby to defuse", 4);
        this.soundscape.play("bomb-plant");
        this.bots.forEach((b) => {
          b.nav = 0;
        });
      }
      return;
    }
    if (!bomb.planted) return;
    const previousBombSecond = Math.ceil(bomb.timer);
    bomb.timer -= dt;
    if (Math.ceil(bomb.timer) < previousBombSecond && bomb.timer > 0)
      this.soundscape.play("bomb-beep", this.position.distanceTo(bomb.position) > 20);
    if (bomb.timer <= 0) {
      this.soundscape.play("bomb-explode");
      this.endRound("t", "Bomb detonated");
      return;
    }
    let defuser: number | "player" | null = null;
    if (
      this.team === "ct" &&
      !this.dead &&
      this.keys.has("KeyE") &&
      stationary &&
      this.position.distanceTo(bomb.position) < 2
    )
      defuser = "player";
    else {
      const index = this.bots.findIndex(
        (b) =>
          b.team === "ct" &&
          b.health > 0 &&
          !b.tracking &&
          b.group.position.distanceTo(bomb.position) < 1.6,
      );
      if (index >= 0) defuser = index;
    }
    if (bomb.defuser !== defuser) bomb.progress = 0;
    bomb.defuser = defuser;
    if (defuser !== null) {
      bomb.progress += dt;
      if (defuser === "player") {
        this.firing = false;
        this.velocity.x = this.velocity.z = 0;
        this.toast(`DEFUSING · ${Math.ceil(Math.max(0, 10 - bomb.progress))}s`, dt * 2);
      } else this.bots[defuser].moving = false;
      if (bomb.progress >= 10) {
        this.soundscape.play("bomb-defuse");
        this.endRound("ct", "Bomb defused");
      }
    } else bomb.progress = 0;
  }
  spectate() {
    const teammate = this.bots.find((b) => b.team === this.team && b.health > 0);
    this.spectated = teammate;
    if (!teammate) return;
    const p = teammate.group.position,
      yaw = teammate.group.rotation.y;
    this.spectatorFocus.copy(p).y += 1.4;
    this.spectatorOffset.set(-Math.sin(yaw) * 3, 0.65, -Math.cos(yaw) * 3);
    const distance = this.spectatorOffset.length();
    this.spectatorRay.set(this.spectatorFocus, this.spectatorOffset.normalize());
    const obstruction = this.world.collision?.intersections(this.spectatorRay, distance)[0];
    this.camera.position
      .copy(this.spectatorFocus)
      .addScaledVector(
        this.spectatorOffset,
        obstruction ? Math.max(0, obstruction.distance - 0.25) : distance,
      );
    this.camera.lookAt(this.spectatorFocus);
    this.toast(`SPECTATING ${teammate.name} · Next round in play`, 0.2);
  }
  updateCasualBots(dt: number, phase: number) {
    const nav = this.dust!.navigation,
      bomb = this.bomb!;
    for (let i = phase; i < this.bots.length; i += 8) {
      const b = this.bots[i];
      if (b.health <= 0) continue;
      const pos = b.group.position,
        from = pos.clone().add(new T.Vector3(0, 1.4, 0));
      const candidates: { id: number | "player"; position: T.Vector3; distance: number }[] = [];
      if (b.team !== this.team && !this.dead)
        candidates.push({
          id: "player",
          position: this.position,
          distance: pos.distanceTo(this.position),
        });
      this.bots.forEach((other, index) => {
        if (other.team !== b.team && other.health > 0)
          candidates.push({
            id: index,
            position: other.group.position,
            distance: pos.distanceTo(other.group.position),
          });
      });
      candidates.sort((a, c) => a.distance - c.distance);
      const target = candidates.find((candidate) => {
        if (candidate.distance > 38) return false;
        const facing = Math.atan2(candidate.position.x - pos.x, candidate.position.z - pos.z);
        if (b.alert <= 0 && Math.cos(facing - b.facing) < -0.35 && candidate.distance > 5)
          return false;
        return this.visible(from, candidate.position.clone().add(new T.Vector3(0, 1.3, 0)));
      });
      b.target = target?.id ?? null;
      b.tracking = !!target;
      b.shot -= dt;
      b.alert = Math.max(0, b.alert - dt);
      if (target) {
        b.memory.copy(target.position);
        b.alert = 5;
        b.facing = Math.atan2(target.position.x - pos.x, target.position.z - pos.z);
      } else b.reaction = 0.5;
      if (target && (b.reaction -= dt) <= 0 && b.shot <= 0) {
        const aim = target.position.clone().add(new T.Vector3(0, 1.3, 0));
        const direction = aim.clone().sub(from).normalize();
        const buddyInLine = this.bots.some((other) => {
          if (other === b || other.team !== b.team || other.health <= 0) return false;
          const offset = other.group.position
            .clone()
            .add(new T.Vector3(0, 1.3, 0))
            .sub(from);
          const along = offset.dot(direction);
          return (
            along > 0 &&
            along < target.distance &&
            offset.addScaledVector(direction, -along).length() < 0.45
          );
        });
        if (!buddyInLine) {
          b.rig.recoil = 1;
          b.shot = weapons[b.rig.weaponIndex].delay + 0.12 + Math.random() * 0.15;
          this.trace(from, aim, 0xffc881);
          const playerDistance = pos.distanceTo(this.position);
          if (playerDistance < 45)
            this.sound(
              "bot",
              Math.sin(Math.atan2(pos.x - this.position.x, pos.z - this.position.z) + this.yaw),
              playerDistance,
              b.rig.weaponIndex,
            );
          const chance = clamp(0.8 - target.distance * 0.013 - b.speed * 0.025, 0.18, 0.7);
          if (Math.random() < chance) {
            const damage = 18 + Math.floor(Math.random() * 12);
            if (target.id === "player") {
              if (this.invulnerable <= 0) {
                const absorbed = Math.min(this.armor, Math.round(damage * 0.45));
                this.armor -= absorbed;
                this.health -= damage - absorbed;
                this.damage = 0.25;
                this.soundscape.play("damage");
                if (this.health <= 0) {
                  this.health = 0;
                  this.deaths++;
                  b.kills++;
                  this.dead = Infinity;
                  this.knifeTime = this.inspectTime = 0;
                  this.knifePending = false;
                  this.setScope(0);
                  this.firing = false;
                  this.rescope = this.boltTime = this.reload = 0;
                  this.dropBomb("player");
                  this.soundscape.play("death");
                  this.feed(b.name, "YOU", false, b.rig.weaponIndex);
                }
                this.updateUI();
              }
            } else {
              const victim = this.bots[target.id];
              victim.health -= damage;
              victim.memory.copy(pos);
              victim.alert = 5;
              if (victim.health <= 0) {
                victim.deaths++;
                b.kills++;
                victim.respawn = Infinity;
                victim.moving = false;
                this.dropBomb(target.id);
                this.feed(b.name, victim.name, false, b.rig.weaponIndex);
              }
            }
          }
        }
      }
      b.moving = !target || target.distance > 10;
      let goal: T.Vector3;
      if (b.alert > 0) goal = b.memory;
      else if (bomb.planted || (bomb.carrier === -1 && b.team === "t")) goal = bomb.position;
      else {
        const sites = nav.data.sites;
        const site = (i + this.round) % sites.length;
        goal = nav.site(
          site,
          b.team === "ct" ? ((i % 3) - 1) * 3 : 0,
          b.team === "ct" ? (i % 2 ? 3 : -3) : 0,
        );
        // Spread defenders over both sites; attackers use different staging
        // lanes before converging, avoiding a single train chasing the player.
        if (b.team === "t" && bomb.carrier !== i && this.time > 102)
          goal.set(i % 3 === 0 ? -39 : i % 3 === 1 ? -10 : 25, 0, i % 3 === 0 ? -24 : -15);
        if (bomb.carrier === i) goal = nav.site(this.round % sites.length);
      }
      const interacting = bomb.planted || (bomb.carrier === -1 && b.team === "t");
      if (!target && pos.distanceTo(goal) < (interacting ? 0.65 : 2)) b.moving = false;
      if ((bomb.plantProgress > 0 && bomb.carrier === i) || bomb.defuser === i) b.moving = false;
      b.nav -= dt;
      if (b.nav <= 0 && b.moving) {
        b.nav = 0.65 + (i % 5) * 0.09;
        b.path = nav.path(
          pos,
          goal,
          this.bots
            .filter((other) => other !== b && other.team === b.team && other.health > 0)
            .map((other) => other.group.position),
          b.blockedAreas,
        );
        if (!b.path.length) b.blockedAreas.clear();
      }
    }
  }
  // Each bot thinks at 16 Hz on its own phase of the 128 Hz step, spreading
  // visibility rays and path searches (including mass re-paths) over 8 steps.
  updateBots(dt: number, phase: number) {
    for (let i = phase; i < this.bots.length; i += 8) {
      const b = this.bots[i];
      if (b.health <= 0 || b.buyTime <= 0) continue;
      b.buyTime -= dt;
      if (b.buyTime <= 0) setSoldierWeapon(b.rig, b.team === "t" ? 0 : 1);
    }
    if (this.mode === "casual") {
      this.updateCasualBots(dt, phase);
      return;
    }
    const player = this.position.clone();
    player.y += 1.3;
    for (let i = phase; i < this.bots.length; i += 8) {
      const b = this.bots[i];
      if (b.health <= 0) {
        b.respawn -= dt;
        if (b.respawn <= 0) this.spawnBot(b, i);
        continue;
      }
      const pos = b.group.position,
        from = pos.clone();
      from.y = 1.4;
      const dist = pos.distanceTo(this.position),
        canSee = dist < 32 && this.visible(from, player);
      b.tracking = canSee;
      b.moving = this.mode !== "practice" && (dist > 7 || !canSee);
      if (canSee) b.facing = Math.atan2(this.position.x - pos.x, this.position.z - pos.z);
      b.shot -= dt;
      if (canSee && this.mode === "deathmatch") {
        b.reaction -= dt;
        if (b.shot <= 0 && b.reaction <= 0) {
          b.rig.recoil = 1;
          b.shot = 0.45 + Math.random() * 0.45;
          this.trace(from, player, 0xffc881);
          this.sound(
            "bot",
            Math.sin(Math.atan2(pos.x - this.position.x, pos.z - this.position.z) + this.yaw),
            dist,
            b.rig.weaponIndex,
          );
          const chance = clamp(
            0.72 - dist * 0.014 - Math.hypot(this.velocity.x, this.velocity.z) * 0.025,
            0.15,
            0.65,
          );
          if (Math.random() < chance && this.invulnerable <= 0) {
            const raw = 12 + Math.floor(Math.random() * 8),
              absorbed = Math.min(this.armor, Math.round(raw * 0.45));
            this.armor -= absorbed;
            this.health -= raw - absorbed;
            this.soundscape.play("damage");
            this.damage = 0.25;
            this.updateUI();
            if (this.health <= 0) {
              this.health = 0;
              this.deaths++;
              b.kills++;
              this.dead = 2.5;
              this.knifeTime = this.inspectTime = 0;
              this.knifePending = false;
              this.soundscape.play("death");
              this.soundscape.playMusic("deathcam");
              this.setScope(0);
              this.rescope = this.boltTime = 0;
              this.firing = false;
              this.feed(b.name, "YOU", false, b.rig.weaponIndex);
              this.updateUI();
              if (b.kills >= 20) this.finish();
              break;
            }
          }
        }
      } else b.reaction = 0.6;
      if (this.mode === "practice") continue;
      b.nav -= dt;
      if (b.nav <= 0) {
        b.nav = 0.9 + Math.random() * 0.4;
        b.path = this.findPath(pos, this.position);
      }
    }
  }
  botSupport(b: Bot, x: number, z: number, ceiling: number, bottom: number) {
    const nav = this.mode === "casual" ? this.dust!.navigation : undefined;
    return nav?.support(x, z, ceiling, bottom, nav.areas[b.navArea]);
  }
  stepBot(b: Bot, x: number, z: number) {
    const nav = this.mode === "casual" ? this.dust!.navigation : undefined,
      pos = b.group.position;
    const ground = this.botSupport(b, x, z, pos.y + 0.46, pos.y - 8);
    // The original NAV regions already include Source's player hull and
    // smooth clip ramps. Only cross a region's authored outgoing links.
    if (ground) {
      pos.x = x;
      pos.z = z;
      b.navArea = nav!.index.get(ground.area.id)!;
      return;
    }
    if (!this.isBlocked(x, z, pos.y, 0.35)) {
      pos.x = x;
      pos.z = z;
      if (nav) b.navArea = nav.nearest(pos);
    }
  }
  moveBots(dt: number) {
    this.detours = 0;
    for (const b of this.bots) {
      // Visual animation accumulates simulated time and is applied per rendered frame.
      if (b.health <= 0) {
        if (b.group.visible) b.anim += dt;
        continue;
      }
      const desired = botDesired.set(0, 0);
      const pos = b.group.position,
        previousX = pos.x,
        previousY = pos.y,
        previousZ = pos.z;
      if (b.moving) {
        let target = b.path[0];
        while (
          target &&
          Math.hypot(
            target.x - pos.x,
            (target instanceof T.Vector3 ? target.z : target.y) - pos.z,
          ) < 0.35
        ) {
          b.path.shift();
          target = b.path[0];
        }
        if (target) {
          const direction = desired.copy(target);
          direction.x -= pos.x;
          direction.y = (target instanceof T.Vector3 ? target.z : target.y) - pos.z;
          direction.normalize().multiplyScalar(this.mode === "casual" ? 3.6 : 2.1);
          if (!b.tracking) b.facing = Math.atan2(direction.x, direction.y);
        }
      }
      if (this.mode === "casual" && b.moving) {
        for (const other of this.bots) {
          if (other === b || other.health <= 0 || Math.abs(other.group.position.y - pos.y) > 1.2)
            continue;
          const sx = pos.x - other.group.position.x,
            sz = pos.z - other.group.position.z,
            distance = Math.hypot(sx, sz);
          if (distance > 0.01 && distance < 0.85) {
            const push = ((0.85 - distance) * 4) / distance;
            desired.x += sx * push;
            desired.y += sz * push;
          }
        }
        if (!this.dead && Math.abs(pos.y - this.position.y) < 1.2) {
          const sx = pos.x - this.position.x,
            sz = pos.z - this.position.z,
            distance = Math.hypot(sx, sz);
          if (distance > 0.01 && distance < 1.5) {
            const away = botAway.set(sx / distance, sz / distance),
              inward = desired.dot(away);
            if (inward < 0) {
              const side = b.group.id % 2 ? 3.6 : -3.6;
              desired.addScaledVector(away, -inward);
              desired.x -= away.y * side;
              desired.y += away.x * side;
            }
            desired.addScaledVector(away, Math.max(0, 1.1 - distance) * 6).clampLength(0, 3.6);
          }
        }
      }
      b.velocity.x = T.MathUtils.damp(b.velocity.x, desired.x, 12, dt);
      b.velocity.y = T.MathUtils.damp(b.velocity.y, desired.y, 12, dt);
      if (this.world.collision && b.moving && b.vertical === 0 && desired.lengthSq() > 0) {
        const ahead = botAhead.copy(desired).normalize().multiplyScalar(0.7);
        const raised =
          this.botSupport(b, pos.x + ahead.x, pos.z + ahead.y, pos.y + 1.05, pos.y - 0.1)?.height ??
          this.world.collision.floor(pos.x + ahead.x, pos.z + ahead.y, pos.y + 1.05, pos.y - 0.1);
        const target = b.path[0];
        if (
          (raised > pos.y + 0.4 && raised < pos.y + 1.05) ||
          (target instanceof T.Vector3 &&
            target.y > pos.y + 0.45 &&
            target.y < pos.y + 1.5 &&
            Math.hypot(target.x - pos.x, target.z - pos.z) < 2)
        )
          b.vertical = 7.5;
      }
      if (this.world.collision && b.vertical !== 0) {
        b.vertical -= 20 * dt;
        pos.y += b.vertical * dt;
        if (b.vertical > 0) {
          const ceiling = this.world.collision.ceiling(
            pos.x,
            pos.z,
            previousY + 1.65,
            pos.y + 1.65,
          );
          if (Number.isFinite(ceiling)) {
            pos.y = ceiling - 1.65;
            b.vertical = -0.01;
          }
        }
      }
      const dx = b.velocity.x * dt,
        dz = b.velocity.y * dt;
      if (dx) this.stepBot(b, pos.x + dx, pos.z);
      if (dz) this.stepBot(b, pos.x, pos.z + dz);

      if (this.world.collision) {
        const floor =
          this.botSupport(b, pos.x, pos.z, pos.y + (b.vertical > 0 ? 0 : 0.46), pos.y - 8)
            ?.height ??
          this.world.collision.floor(pos.x, pos.z, pos.y + (b.vertical > 0 ? 0 : 0.45), pos.y - 8);
        if (Number.isFinite(floor)) {
          if (b.vertical <= 0 && pos.y <= floor + 0.45) {
            pos.y = floor;
            b.vertical = 0;
            b.group.userData.groundY = floor;
          } else if (b.vertical === 0) b.vertical = -0.01;
        } else {
          pos.x = previousX;
          pos.z = previousZ;
          b.nav = 0;
        }
        b.stuck =
          b.moving && Math.hypot(pos.x - previousX, pos.z - previousZ) < dt * 0.25
            ? b.stuck + dt
            : 0;
        // Local detours are synchronous searches; allow one per simulation step.
        if (b.stuck > 0.8 && !this.detours) {
          this.detours++;
          const route = b.path.filter((p): p is T.Vector3 => p instanceof T.Vector3);
          const goalIndex = route.findIndex((p) => Math.hypot(p.x - pos.x, p.z - pos.z) > 4);
          const index = goalIndex >= 0 ? goalIndex : route.length - 1;
          const local = index >= 0 ? detour(this.world.collision, pos, route[index]) : [];
          if (local.length) {
            b.path = [...local, ...route.slice(index + 1)];
            b.nav = 3;
          } else {
            const nav = this.dust!.navigation;
            const area = nav.areas[nav.nearest(pos)];
            const next = route
              .map((point) => nav.areas[nav.nearest(point)].id)
              .find((id) => id !== area.id && area.links.includes(id));
            if (next !== undefined) b.blockedAreas.add(next);
            if (b.blockedAreas.size > 8) b.blockedAreas.clear();
            b.path = [];
            b.nav = 0;
          }
          b.stuck = 0;
        }
      }
      const turn = Math.atan2(
        Math.sin(b.facing - b.group.rotation.y),
        Math.cos(b.facing - b.group.rotation.y),
      );
      b.group.rotation.y += turn * (1 - Math.exp(-12 * dt));
      b.speed = Math.hypot(pos.x - previousX, pos.z - previousZ) / dt;
      const vx = (pos.x - previousX) / dt,
        vz = (pos.z - previousZ) / dt;
      b.rig.moveX = vx * Math.cos(b.group.rotation.y) - vz * Math.sin(b.group.rotation.y);
      b.rig.moveZ = vx * Math.sin(b.group.rotation.y) + vz * Math.cos(b.group.rotation.y);
      b.anim += dt;
    }
  }
  // Apply simulated time to agent rigs once per rendered frame. On-screen
  // agents animate every frame; distant ones at 30 Hz and off-screen ones at
  // 10 Hz, which keeps any visible shadows moving. Without bot shadows (casual),
  // off-screen bodies also skip render-list traversal of their skeletons.
  animateBots() {
    this.camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(
      projection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
    );
    const shadows = this.mode !== "casual" && this.renderer.shadowMap.enabled;
    for (const b of this.bots) {
      if (!b.group.visible) continue;
      botSphere.copy(agentBounds).center.add(b.group.position);
      const onScreen = frustum.intersectsSphere(botSphere);
      b.rig.model.visible = onScreen || shadows;
      if (b.anim <= 0) continue;
      const interval = !onScreen
        ? 0.1
        : botSphere.center.distanceToSquared(this.camera.position) > 40 * 40
          ? 1 / 30
          : 0;
      if (b.anim < interval) continue;
      animateSoldier(b.rig, b.speed, b.anim, b.health > 0);
      b.anim = 0;
    }
  }
  // The static radar layer (nav areas or range walls) is drawn once per world,
  // canvas size and style, then composited under the live markers.
  drawMap(canvas: HTMLCanvasElement, live: boolean) {
    const ctx = canvas.getContext("2d")!,
      w = canvas.width,
      h = canvas.height,
      key = `${this.world === this.range ? "range" : "dust"}:${live}:${w}x${h}`;
    let layer = this.radarLayers.get(key);
    if (!layer) {
      layer = document.createElement("canvas");
      layer.width = w;
      layer.height = h;
      this.drawMapLayer(layer.getContext("2d")!, w, h, live);
      this.radarLayers.set(key, layer);
    }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(layer, 0, 0);
    if (!live) return;
    if (this.world.navigation) {
      const { px, pz } = this.mapProjection(w, h);
      const marker = Math.min(w, h) / 300;
      const spotted = new Set<number | "player" | null>();
      for (const ally of this.bots) if (ally.team === this.team) spotted.add(ally.target);
      this.bots.forEach((b, i) => {
        if (b.health <= 0) return;
        if (b.team !== this.team && !spotted.has(i)) return;
        ctx.beginPath();
        ctx.arc(px(b.group.position.x), pz(b.group.position.z), 2.4 * marker, 0, Math.PI * 2);
        ctx.fillStyle = b.team === this.team ? "#8fc9ed" : "#eca755";
        ctx.fill();
      });
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(px(this.position.x), pz(this.position.z), 3 * marker, 0, Math.PI * 2);
      ctx.fill();
      if (this.bomb && (this.bomb.planted || this.bomb.carrier === -1)) {
        ctx.fillStyle = "#ff5c4e";
        ctx.fillRect(
          px(this.bomb.position.x) - 3 * marker,
          pz(this.bomb.position.z) - 3 * marker,
          6 * marker,
          6 * marker,
        );
      }
      return;
    }
    const s = Math.min(w, h) / 50;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    for (const b of this.bots) {
      if (b.health <= 0) continue;
      ctx.beginPath();
      ctx.arc(b.group.position.x * s, b.group.position.z * s, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = "#eca755";
      ctx.fill();
    }
    ctx.translate(this.position.x * s, this.position.z * s);
    ctx.rotate(-this.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fillStyle = "#b7e9fc";
    ctx.fill();
    ctx.restore();
  }
  mapProjection(w: number, h: number) {
    return dustRadarProjection(w, h);
  }

  drawMapLayer(ctx: CanvasRenderingContext2D, w: number, h: number, live: boolean) {
    if (this.world.navigation) {
      if (this.radarImage) {
        const { scale, left, top } = dustRadarProjection(w, h);
        const { x, y, width, height, referenceSize } = radarCrop;
        const sourceScale = this.radarImage.naturalWidth / referenceSize;
        ctx.drawImage(
          this.radarImage,
          x * sourceScale,
          y * sourceScale,
          width * sourceScale,
          height * sourceScale,
          left,
          top,
          width * scale,
          height * scale,
        );
      }
      return;
    }
    const s = Math.min(w, h) / 50;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.fillStyle = live ? "#5c6b6970" : "#8c9e8a13";
    ctx.fillRect(-22 * s, -22 * s, 44 * s, 44 * s);
    for (const b of this.world.walls) {
      ctx.fillStyle = b.h > 4 ? (live ? "#a8b3a6" : "#b5c5b450") : "#dfbe8640";
      ctx.fillRect((b.x - b.w / 2) * s, (b.z - b.d / 2) * s, b.w * s, b.d * s);
      ctx.strokeStyle = "#dbe5ca30";
      ctx.lineWidth = 0.5;
      ctx.strokeRect((b.x - b.w / 2) * s, (b.z - b.d / 2) * s, b.w * s, b.d * s);
    }
    ctx.font = `bold ${live ? 12 : 15}px Arial`;
    ctx.fillStyle = "#efac51";
    ctx.fillText("A", 13 * s, 17 * s);
    ctx.fillStyle = "#a3c1cf";
    ctx.fillText("B", -10 * s, 18 * s);
    if (!live) {
      ctx.strokeStyle = "#efac5180";
      ctx.setLineDash([3, 4]);
      ctx.strokeRect(-24 * s, -24 * s, 48 * s, 48 * s);
    }
    ctx.restore();
  }
  scoreboard() {
    const rows = [
      {
        id: "player" as number | "player",
        name: "YOU",
        kills: this.kills,
        deaths: this.deaths,
        team: this.team,
        alive: !this.dead,
      },
      ...this.bots.map((b, id) => ({
        id,
        name: b.name,
        kills: b.kills,
        deaths: b.deaths,
        team: b.team,
        alive: b.health > 0,
      })),
    ].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const seconds = Math.max(
      0,
      Math.ceil(this.mode === "casual" && this.bomb?.planted ? this.bomb.timer : this.time),
    );
    const signature = JSON.stringify([
      rows,
      seconds,
      this.mode,
      this.round,
      this.roundHistory,
      this.teamScores,
      this.bomb?.carrier,
      this.bomb?.planted,
      this.roundPause > 0,
    ]);
    if (signature === this.scoreboardSignature) return;
    this.scoreboardSignature = signature;
    const make = (tag: string, className: string, text = "") => {
      const node = document.createElement(tag);
      node.className = className;
      node.textContent = text;
      return node;
    };
    el("scoreboard").querySelector("h2")!.textContent =
      `${this.mode.toUpperCase()} | ${this.mode === "casual" ? "Dust II" : "Dust Yard"}`;
    el("scoreboard-clock").textContent =
      this.mode === "practice"
        ? "∞"
        : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    el("scoreboard-summary").textContent =
      this.mode === "casual"
        ? `10 VS 10 · FIRST TO 8 · ${this.roundPause ? "ROUND COMPLETE" : `ROUND ${this.round}`}${this.bomb?.planted ? " · BOMB PLANTED" : ""}`
        : this.mode === "deathmatch"
          ? "FIRST TO 20 KILLS · RESPAWNS ENABLED"
          : "TARGET PRACTICE · UNLIMITED TIME";
    const board = document.createDocumentFragment();
    for (const team of ["ct", "t"] as const) {
      if (team === "t") {
        const progress = make("div", "score-progress");
        if (this.mode === "casual") {
          progress.setAttribute("aria-label", "Round history");
          progress.append(make("span", "progress-label", "MATCH PROGRESS"));
          const rounds = make("div", "round-slots");
          for (let i = 0; i < 15; i++) {
            const outcome = this.roundHistory[i];
            const slot = make(
              "span",
              `round-slot ${outcome?.winner ?? ""} ${!outcome && i === this.round - 1 ? "current" : ""}`,
              outcome ? outcome.winner.toUpperCase() : String(i + 1),
            );
            slot.title = `Round ${i + 1}: ${outcome ? `${outcome.winner.toUpperCase()} won · ${outcome.reason}` : i === this.round - 1 ? "In progress" : "Unplayed"}`;
            slot.setAttribute("aria-label", slot.title);
            rounds.append(slot);
          }
          progress.append(rounds);
        } else {
          progress.append(
            make(
              "span",
              "progress-label",
              this.mode === "deathmatch" ? "YOUR KILL PROGRESS" : "TARGETS ELIMINATED",
            ),
          );
          const meter = document.createElement("progress");
          meter.max = this.mode === "deathmatch" ? 20 : Math.max(20, this.kills);
          meter.value = this.kills;
          meter.setAttribute("aria-label", "Your kills");
          progress.append(
            meter,
            make(
              "span",
              "progress-count",
              `${this.kills}${this.mode === "deathmatch" ? " / 20" : ""}`,
            ),
          );
        }
        board.append(progress);
      }
      const players = rows.filter((r) => r.team === team);
      const section = make("section", `score-team ${team}`);
      section.setAttribute("aria-label", team === "ct" ? "Counter-Terrorists" : "Terrorists");
      const aside = make("div", "score-team-summary");
      aside.append(
        make(
          "strong",
          "team-score",
          String(
            this.mode === "casual"
              ? this.teamScores[team]
              : players.reduce((sum, r) => sum + r.kills, 0),
          ),
        ),
        make("h3", "team-name", team === "ct" ? "COUNTER-TERRORISTS" : "TERRORISTS"),
        make(
          "span",
          "team-alive",
          `Alive: ${players.filter((r) => r.alive).length}/${players.length}`,
        ),
        make("span", "team-score-label", this.mode === "casual" ? "ROUNDS WON" : "TOTAL KILLS"),
      );
      const table = make("div", "score-team-table");
      const heading = make("div", "scoreboard-head");
      heading.append(
        make("span", "", ""),
        make("span", "", "PLAYER"),
        make("span", "", "STATUS"),
        make("span", "", "KILLS"),
        make("span", "", "DEATHS"),
      );
      table.append(heading);
      for (const r of players) {
        const row = make(
          "div",
          `score-row ${r.name === "YOU" ? "you" : ""} ${r.alive ? "alive" : "dead"}`,
        );
        row.setAttribute(
          "aria-label",
          `${r.name}, ${r.alive ? "alive" : "dead"}, ${r.kills} kills, ${r.deaths} deaths`,
        );
        const name = make("span", "score-player", r.name);
        const avatar = make(
          "span",
          "score-avatar",
          r.name === "YOU" ? "Y" : r.name.replace("BOT ", "").slice(0, 1),
        );
        name.prepend(avatar);
        if (
          this.mode === "casual" &&
          !this.bomb?.planted &&
          this.bomb?.carrier === r.id &&
          r.alive
        ) {
          const bomb = make("span", "score-bomb", "C4");
          bomb.title = "Bomb carrier";
          name.append(bomb);
        }
        row.append(
          make("span", "score-life", r.alive ? "●" : "×"),
          name,
          make("span", "score-state", r.alive ? "ALIVE" : "DEAD"),
          make("span", "score-number", String(r.kills)),
          make("span", "score-number", String(r.deaths)),
        );
        table.append(row);
      }
      section.append(aside, table);
      board.append(section);
    }
    el("scoreboard-rows").replaceChildren(board);
  }

  updateUI() {
    setText("health", String(Math.max(0, this.health)));
    setText("armor", String(this.armor));
    setText("ammo", this.selected === 4 ? "" : String(this.ammo));
    el("ammo").parentElement!.classList.toggle("knife-equipped", this.selected === 4);
    this.updateInventory();
    setText("reserve", String(this.reserve));
    setText("gun-name", weapons[this.selected].name);
    setText(
      "reload-label",
      this.reload
        ? "RELOADING…"
        : this.boltTime > 0
          ? "CYCLING BOLT…"
          : this.ammo === 0 && this.selected !== 4
            ? "R · RELOAD"
            : "",
    );
    setText("score", String(this.mode === "casual" ? this.teamScores[this.team] : this.kills));
    setText(
      "enemy-score",
      String(
        this.mode === "casual"
          ? this.teamScores[this.team === "t" ? "ct" : "t"]
          : Math.max(...this.bots.map((b) => b.kills), 0),
      ),
    );
    if (this.mode === "casual") {
      const friendCount =
        this.bots.filter((b) => b.team === this.team && b.health > 0).length + (this.dead ? 0 : 1);
      const enemyCount = this.bots.filter((b) => b.team !== this.team && b.health > 0).length;
      setText("match-goal", `ROUND ${this.round} · ${friendCount} VS ${enemyCount} ALIVE`);
    }
    const sec = Math.max(
      0,
      Math.ceil(this.mode === "casual" && this.bomb?.planted ? this.bomb.timer : this.time),
    );
    setText(
      "clock",
      this.mode === "practice"
        ? "∞"
        : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`,
    );
    if (!el("scoreboard").classList.contains("hidden")) this.scoreboard();
  }
  animateWeapon(bob = 0, sway = 0) {
    animateGun(this.gun, {
      clock: this.animationTime,
      reload: this.reload ? 1 - this.reload / weapons[this.selected].reload : 0,
      draw: this.drawTime / DRAW_DURATION,
      bolt: this.boltTime ? 1 - this.boltTime / weapons[3].delay : 0,
      recoil: this.kick,
      reloadActive: this.reload > 0,
      boltActive: this.boltTime > 0,
      shot: this.shotTime ? 1 - this.shotTime / nativeShotDuration(this.selected) : 0,
      shotActive: this.shotTime > 0,
      bob,
      sway,
      knife: this.knifeTime > 0 ? 1 - this.knifeTime / this.knifeDuration : 0,
      stab: this.knifeStab,
      knifeActive: this.knifeTime > 0,
      alternate: this.knifeAlternate,
      time: this.weaponTime,
      inspect: this.inspectTime ? 1 - this.inspectTime / this.inspectDuration() : 0,
      inspectActive: this.inspectTime > 0,
      inspectDraw: this.inspectDraw,
    });
    this.flash.position.copy(this.gun.userData.muzzle);
  }
  frame(now: number) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime > 1) {
      this.fps = Math.round(this.frames / this.fpsTime);
      this.frames = 0;
      this.fpsTime = 0;
      setText("telemetry", `${this.fps} FPS · 128 TICK · LOCAL`);
    }
    if (this.active && this.locked) {
      this.accumulator += dt;
      while (this.accumulator >= step && this.active && this.locked) {
        this.simulate(step);
        this.accumulator -= step;
      }
      this.uiTime += dt;
      if (this.uiTime > 0.1) {
        this.updateUI();
        this.drawMap(el("radar") as HTMLCanvasElement, true);
        this.uiTime = 0;
      }
    } else {
      this.accumulator = 0;
      if (!this.active && el("result").classList.contains("hidden")) {
        const angle = now * 0.000025;
        if (this.world.collision) {
          this.camera.position.set(36 + Math.sin(angle) * 2, 12, -45);
          this.camera.lookAt(25, 2, -63);
        } else {
          this.camera.position.set(17 + Math.sin(angle) * 2, 8.5, 20);
          this.camera.lookAt(-3, 1, -3);
        }
      }
    }
    for (const tracer of this.tracers) {
      if (tracer.life <= 0) continue;
      tracer.life -= dt;
      if (tracer.life <= 0) tracer.mesh.visible = false;
    }
    if (this.decals.visible) {
      let live = 0;
      for (let i = 0; i < this.decals.count; i++) {
        if (this.decalLife[i] <= 0) continue;
        this.decalLife[i] -= dt;
        if (this.decalLife[i] > 0) live++;
        else {
          this.decals.setMatrixAt(i, hiddenDecal);
          this.decals.instanceMatrix.needsUpdate = true;
        }
      }
      if (!live) {
        this.decals.visible = false;
        this.decals.count = this.decalNext = 0;
      }
    }
    const speed = Math.hypot(this.velocity.x, this.velocity.z),
      bob = this.active && this.locked && this.grounded ? Math.sin(this.sway) * speed * 0.0017 : 0;
    this.animateWeapon(bob, Math.cos(this.sway * 0.5) * speed * 0.001);

    this.flash.visible = this.kick > 0.048;
    this.flash.rotation.z = Math.random() * 6;
    setStyle(
      "crosshair",
      "--gap",
      `${4 + speed * 2 + Math.min(this.shots, 20) * 0.5 + (this.grounded ? 0 : 14)}px`,
    );
    setStyle("hitmarker", "opacity", this.hit > 0 ? "1" : "0");
    setStyle("damage", "opacity", String(this.damage * 3));
    if (this.active && this.locked && this.dead && this.mode === "casual") this.spectate();
    if (!this.dead || !this.active) this.spectated = undefined;
    this.animateBots();
    // A close wall can compress the chase camera into the followed body. Hide
    // that body only for this render, retaining visibility for game state.
    const followed = this.spectated?.group;
    const hideFollowed =
      followed && this.camera.position.distanceToSquared(this.spectatorFocus) < 0.81;
    const wasVisible = followed?.visible;
    if (hideFollowed) followed.visible = false;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (followed && hideFollowed) followed.visible = wasVisible!;
    if (this.active && !this.dead && !this.scopeLevel) {
      this.renderer.clearDepth();
      this.renderer.render(this.view, this.viewCamera);
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}
