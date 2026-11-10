import { groundSpawn } from "@cs2go/simulation/spawn-position";
import { sourceVerticalFov, sourceZoomRatio } from "./source-camera";
import { MapHazards, BombReset, supportedBombPosition } from "@cs2go/simulation/map-hazards";
import { DoorAudio } from "./door-audio";
import { NativePropBreakAudio } from "./prop-break-audio";
import propBreakCues from "./data/prop-break-audio.json";
import { NativeMapCache } from "./native-map-cache";
import { updateRadarLocation } from "./radar-location";
import { GameRadar } from "./game-radar";
import { botPortrait } from "./bot-portrait";
import { HealthshotView } from "./healthshot-view";
import { selectedAgentId } from "./agent-roster";
import { HealthshotAction, HealthshotHealing } from "./healthshot-action";
import { deathmatchKillPoints } from "./deathmatch-scoring";
import { DeathmatchState, DeathmatchCombat, deathmatchBonusWeapons } from "./deathmatch-state";
import { DeathDamage, showDeathcam, hideDeathcam, setDeathcamWeaponArtwork } from "./deathcam";
import { updateDeathmatchHud } from "./deathmatch-hud";
import { equippedKnives, equipKnife } from "./equipped-knives";
import { deathmatchSpawnPool, chooseDeathmatchSpawn } from "./deathmatch-spawns";
import type { BreakableDamageKind } from "@cs2go/simulation/breakables";
import { BOMB_DRAW_DURATION } from "./bomb-presentation";
import { prepareMatchMedia } from "./match-media";
import { configureStartupLoading } from "./loading";
import { rendererDiagnostics } from "./renderer-diagnostics";
import { MatchChat } from "./chat";
import { applyShadowDetail, graphicsPixelRatio, graphicsPresets } from "./graphics-settings";
import { applyDisplayViewport, type DisplayAspect } from "./display-settings";
import { applyViewmodelCamera, viewmodelPointToWorld } from "./viewmodel-settings";
import { defaultGloveChoice, unregisterGloveModel, gloveChoices } from "./gloves";
import { bindWeaponInstance } from "./skins";
import { createWeaponInstance, weaponInstanceName } from "./weapon-instance";
import { grenadeData, grenadeIcons, grenadeTypes, type GrenadeKind } from "./utility";
import { setAssetCacheMatchActive } from "./asset-cache";
import { assetUrl } from "./asset-url";
import { weaponBuyIcon } from "./buy-menu";
import { playerName, playerAvatar } from "./player-profile";
import {
  createTracer,
  launchTracer,
  updateTracer,
  loadTracerTextures,
  type Tracer,
} from "./tracers";
import { HomeScene } from "./home-scene";
import { BuyPreview } from "./buy-preview";
import type { MusicKitPreview } from "./music-kit-preview";
import type { WeaponInspectPreview } from "./weapon-inspect-preview";
import type { CosmeticPreview } from "./cosmetic-preview";
import { loadBuyPoses } from "./buy-poses";
import { loadoutCategory } from "./loadouts";
import { soldierHit } from "./soldier-hitboxes";
import {
  actorCarry,
  actorLanding,
  actorSupport,
  slideActors,
  type ActorHull,
} from "./actor-collision";
import { SuppressorState, removableSuppressor } from "./suppressor";
import { advanceRenderClock } from "./render-clock";
import { GameInventory } from "./game-inventory";
import {
  type AccuracyPose,
  advanceWeaponAccuracy,
  applyFiringInaccuracy,
  applyLandingInaccuracy,
  createWeaponAccuracy,
  spreadOffset,
  weaponInaccuracy,
  weaponShotSpread,
} from "./accuracy";
import {
  presentationDefaults,
  readPresentationSettings,
  applyCrosshair,
  applyTextureQuality,
} from "./presentation-settings";
import { knifeBackstab, knifeDamage, knifeRange, REVOLVER_COCK_TIME } from "./melee";
import { GameUtility } from "./game-utility";
import { loadGrenadeModels } from "./grenade-models";
import {
  rulesFor,
  weaponPrice,
  killReward,
  weaponAvailable,
  equipmentPrice,
  roundReward,
  nextLossLevel,
  addMoney,
} from "./economy";
import { applyArmorDamage, friendlyFireScale, hitRegion } from "./damage";
import { mapTriggers } from "./buy-zones";
import { activateNativeMapGrade, showNativeMapGrade } from "./native-map-color";
import { FootstepStride, type FootstepSide } from "@cs2go/simulation/footsteps";
import { createLadderState, stepLadder, type LadderState } from "@cs2go/simulation/ladder";
import { groundCorrectedBombSample } from "./bomb-damage";
import {
  createAimPunch,
  createWeaponRecoil,
  applyWeaponRecoil,
  advanceAimPunch,
  advanceWeaponRecoil,
  RECOIL_VIEW_SCALE,
} from "./recoil";
import { reloadProgress as networkReloadProgress } from "@cs2go/simulation/weapon-actions";
import { ActorReflections } from "./actor-reflections";
import { registerActorLighting, updateActorLighting, setActorReflection } from "./actor-lighting";
import {
  sampleSourceProbe,
  sampleSourceProbeSun,
  sampleSourceProbeLocalShadows,
} from "./source-lighting";
import {
  botAimSpread,
  botBodyHit,
  botRegroupGoal,
  botSearchGoal,
  botShouldMove,
  burstLength,
  inBotView,
  nearestDefuser,
  targetPriority,
} from "./bot-tactics";
import { sourceKnifeInspectDuration } from "./inspects-knife";
import { knifeInspectBlockDuration } from "./knife-timing";
import {
  nativeSuppressor,
  nativeShotDuration,
  nativeInspectDuration,
  nativeSoundCues,
  nativeReloadPhases,
  nativeMagazineInsert,
} from "./weapon-motion";
import { knifeInspectDuration } from "./knife-motion";
import { drawRadar } from "./radar";
import { prepareRadarOverview, radarLayerAt, type PreparedRadarOverview } from "./radar-overview";
import * as T from "three";
import { ballistics, SOURCE_UNITS_PER_METER } from "./ballistics";
import { fleshThickness, hitgroupMultiplier, meshThickness, solveBullet } from "./bullet-solver";
import type { BulletSurface } from "./bullet-solver";
import { Soundscape } from "./soundscape";
import { WeaponAudio, weaponSoundRange } from "./audio";
import type { WeaponSound } from "./audio";
import {
  accelerate,
  blocked,
  fallStep,
  limitJumpSpeed,
  movement,
  weapons,
  reloadMagazine,
  isKnife,
  weaponSlot,
  weaponIcons,
  WEAPON_ANIMATION_RATE,
} from "./physics";
import { loadDust2, loadNativeMap } from "./dust2";
import { MAPS, type MapId, type MatchEvent } from "@cs2go/protocol";
import { warmSourceSky } from "./source-sky";
import { BombModel } from "./bomb";
import { BombPlantModel, PLANT_DURATION } from "./bomb-motion";
import { BombDefuseModel } from "./bomb-defuse";
import { canonicalKey, defaultBindings, readBindings, keyLabel } from "./key-bindings";
import { gradeMapColors } from "./map-color";
import { setupUiAudio } from "./ui-audio";
import { MatchNotices } from "./match-notices";
import { roundMvp } from "./round-mvp";
import { roundFact, type RoundActor } from "./round-facts";
import { renderScoreboard } from "./scoreboard";
import { hideRoundBanner, showRoundBanner } from "./round-banner";
import type { LoadProgress } from "./intro";
import { enableTextureTranscoding } from "./gltf";
import { detour } from "./local-navigation";
import { steerAroundTeammate } from "./bot-avoidance";
import { BotRoundStrategy, type BotStrategyRoutes, type StrategyPoint } from "./bot-strategy";
import { buildBotStrategyRoutes } from "./bot-strategy-routes";
import type { MultiplayerMatch } from "./multiplayer-match";
import {
  createGun,
  createWorldGun,
  loadWeaponModels,
  animateGun,
  weaponDrawDuration,
  weaponKnifeAttackDuration,
  VIEWMODEL_FOV,
} from "./weapons";
import {
  createSoldier,
  animateSoldier,
  stepSoldierRagdoll,
  loadSoldierModels,
  resetSoldier,
  setSoldierWeapon,
  disposeSoldier,
  soldierHitHeight,
  agentBounds,
} from "./soldier";
import type { AgentTeam, Soldier } from "./soldier";
type Mode = "competitive" | "casual" | "deathmatch" | "practice";
const spectatorModes = ["first", "third", "free"] as const;
type SpectatorMode = (typeof spectatorModes)[number];
type Bot = {
  aimPunch: ReturnType<typeof createAimPunch>;
  weaponRecoil: ReturnType<typeof createWeaponRecoil>;
  weaponAccuracy: ReturnType<typeof createWeaponAccuracy>;
  recoilWeapon: number;
  name: string;
  team: AgentTeam;
  target: number | "player" | null;
  memory: T.Vector3;
  lastSight: T.Vector3;
  suppressTime: number;
  suppressShots: number;
  aim: T.Vector3;
  cover: T.Vector3;
  report: number;
  tactic: number;
  reposition: boolean;
  ammo: number;
  reserve: number;
  reloadTime: number;
  burst: number;
  alert: number;
  stuck: number;
  progressTime: number;
  progressPosition: T.Vector3;
  recoveries: number;
  quiet: number;
  regrouping: boolean;
  goal: T.Vector3;
  vertical: number;
  ladderState: LadderState;
  navCrouch: boolean;
  blockedAreas: Set<number>;
  navArea: number;
  group: T.Group;
  rig: Soldier;
  speed: number;
  moving: boolean;
  tracking: boolean;
  health: number;
  armor: number;
  helmet: boolean;
  defuseKit: boolean;
  money: number;
  kills: number;
  deaths: number;
  respawn: number;
  spawnProtection: number;
  deathmatchScore: number;
  shot: number;
  buyTime: number;
  reaction: number;
  path: (T.Vector2 | T.Vector3)[];
  nav: number;
  facing: number;
  velocity: T.Vector2;
  anim: number;
};
type BulletImpactData = {
  point: T.Vector3;
  normal?: T.Vector3;
  actor?: number | "player";
  head?: boolean;
  height?: number;
  crouch?: boolean;
  breakableId?: string;
  doorId?: string;
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
const step = 1 / 128;
const botDesired = new T.Vector2();
const botAway = new T.Vector2();
const botAhead = new T.Vector2();
const botSphere = new T.Sphere();
const frustum = new T.Frustum();
const projection = new T.Matrix4();
// Impact decals occupy a bounded instanced ring buffer.
const decalLimit = 96;
const hiddenDecal = new T.Matrix4().makeScale(0, 0, 0);
const decalMatrix = new T.Matrix4();
const decalRotation = new T.Quaternion();
const forward = new T.Vector3(0, 0, 1);
const unit = new T.Vector3(1, 1, 1);
const decalPoint = new T.Vector3();
export class Game {
  chat = new MatchChat(this);
  utility = new GameUtility(this);
  spectated: Bot | undefined;
  spectatorFocus = new T.Vector3();
  spectatorOffset = new T.Vector3();
  spectatorRay = new T.Ray();
  spectatorMode: SpectatorMode = "first";
  spectatorYaw = 0;
  spectatorPitch = 0.21;
  spectatorShotAt = -Infinity;
  spectatorLastShot = false;
  takeoverUseHeld = false;
  buyPreview = new BuyPreview();
  musicKitPreview?: MusicKitPreview;
  weaponInspectPreview?: WeaponInspectPreview;
  cosmeticPreview?: CosmeticPreview;
  homeScene = new HomeScene();
  canvas = el("game") as HTMLCanvasElement;
  renderer!: T.WebGLRenderer;
  scene = new T.Scene();
  groundInventory = new GameInventory(this);
  view = new T.Scene();
  actorReflections = new ActorReflections();
  viewSun = new T.DirectionalLight(0xffefd5, 3);
  probePosition = new T.Vector3();
  probeRotation = new T.Matrix3();
  probeMatrix = new T.Matrix4();
  probeInverse = new T.Quaternion();
  camera = new T.PerspectiveCamera(sourceVerticalFov(90), innerWidth / innerHeight, 0.05, 110);
  viewCamera = new T.PerspectiveCamera(VIEWMODEL_FOV, innerWidth / innerHeight, 0.01, 10);
  viewmodelPreviewWeapon = 4;
  private lastViewmodelPreview?: T.Group;
  private lastSpectatorViewmodel?: T.Group;
  world!: Awaited<ReturnType<typeof loadDust2>>;
  private nativeWorlds = new NativeMapCache<MapId, Awaited<ReturnType<typeof loadDust2>>>(
    "dust2",
    2,
  );
  private mapHazards = new MapHazards<number | "player">();
  private bombReset = new BombReset();
  get mapId(): MapId {
    return this.dust?.id ?? "dust2";
  }
  network?: MultiplayerMatch;
  dust?: Awaited<ReturnType<typeof loadDust2>>;
  botStrategies: { t: BotRoundStrategy; ct: BotRoundStrategy } | null = null;
  botStrategySeed = Math.floor(Math.random() * 0x100000000);
  private botStrategyRoutes: BotStrategyRoutes | null = null;
  private botStrategyNavigation?: Awaited<ReturnType<typeof loadDust2>>["navigation"];
  private botStrategyRound = -1;
  private botStrategyThink = 0;
  round = 1;
  teamScores = { t: 0, ct: 0 };
  roundHistory: { winner: AgentTeam; reason: string }[] = [];
  scoreboardSignature = "";
  roundStartKills = new Map<number | "player", number>();
  roundElapsed = 0;
  roundHighlights = new Map<RoundActor, { headshots: number; knives: number; grenades: number }>();
  roundFirstKill?: { name: string; seconds: number };
  mvpCounts = new Map<number | "player", number>();
  notices = new MatchNotices();
  roundPause = 0;
  get halftime() {
    return this.teamMode && this.competitive && this.round === 12 && this.roundPause > 0;
  }
  get weaponsFrozen() {
    return this.freezeTime > 0 || this.halftime;
  }
  bomb: {
    position: T.Vector3;
    planted: boolean;
    timer: number;
    progress: number;
    defuser: number | "player" | null;
    carrier: number | "player";
    planter?: number | "player";
    plantProgress: number;
    beepRemaining: number;
    beepPulse: number;
  } | null = null;
  bombSelected = false;
  bombAutoSelected = false;
  bombDrawTime = 0;
  plantLook = 0;
  get viewPitch() {
    return T.MathUtils.lerp(this.pitch, -0.85, this.plantLook);
  }
  get carryingBomb() {
    return (
      this.active &&
      this.teamMode &&
      this.team === "t" &&
      !this.dead &&
      this.bomb?.carrier === "player" &&
      !this.bomb.planted
    );
  }
  equipBomb(automatic = false) {
    if (!this.carryingBomb || this.bombSelected || this.planting) return;
    this.utility.cancelThrow();
    this.utility.selected = null;
    this.suppressors[this.selected].cancel();
    this.bombSelected = true;
    this.bombAutoSelected = automatic;
    this.bombDrawTime = BOMB_DRAW_DURATION;
    this.drawTime = 0;
    this.reload = this.revolverCharge = this.inspectTime = this.knifeTime = this.shotTime = 0;
    this.knifePending = false;
    this.burstRemaining = this.rescope = this.boltTime = 0;
    this.firing = false;
    this.setScope(0);
    this.soundscape.play("bomb-draw");
    this.updateUI();
  }
  private doorUseConsumed = false;
  private readonly doorAudio = new DoorAudio();
  private readonly propBreakAudio = new NativePropBreakAudio(propBreakCues);
  private readonly doorFrom = new T.Vector3();
  private readonly doorDirection = new T.Vector3();
  private readonly doorAim = new T.Euler(0, 0, 0, "YXZ");
  private readonly doorActors: { x: number; y: number; z: number; height: number }[] = [];
  updateBombSelection(dt: number) {
    if (!this.carryingBomb || (this.bombAutoSelected && !this.keys.has("KeyE"))) {
      if (this.bombSelected) {
        this.bombSelected = this.bombAutoSelected = false;
        this.bombDrawTime = 0;
        this.firing = false;
        this.updateUI();
      }
      return;
    }
    if (
      this.keys.has("KeyE") &&
      !this.doorUseConsumed &&
      !this.halftime &&
      mapTriggers(this.dust ?? {}).bombSites.contains(this.position, {
        halfWidth: 0.3,
        height: this.eye,
      })
    )
      this.equipBomb(true);
    this.bombDrawTime = Math.max(0, this.bombDrawTime - dt);
  }
  bombMesh = new BombModel();
  bombView = new BombPlantModel();
  defuseView = new BombDefuseModel();
  gun = createGun(0);
  flash!: T.Mesh;
  ray = new T.Raycaster();
  bots: Bot[] = [];
  keys = new Set<string>();
  jumpQueued = false;
  duckCooldown = 0;
  duckTransitionRate = 15;
  duckHeld = false;
  duckAccepted = false;
  position = new T.Vector3(-17, 0, 17);
  velocity = { x: 0, z: 0 };
  ladderState = createLadderState();
  get ladder() {
    return this.ladderState.id !== null;
  }
  vertical = 0;
  grounded = true;
  yaw = -0.12;
  pitch = 0;
  aimPunch = createAimPunch();
  weaponRecoil = weapons.map(() => createWeaponRecoil());
  weaponAccuracy = weapons.map(() => createWeaponAccuracy());
  eye = movement.standingEye;
  get hullHeight() {
    return this.eye + (movement.standingHeight - movement.standingEye);
  }
  get crouching() {
    return this.eye < 1.4;
  }
  active = false;
  locked = false;
  mode: Mode = "deathmatch";
  team: AgentTeam = "ct";
  get teamMode() {
    return this.mode === "casual" || this.mode === "competitive";
  }
  get rules() {
    return rulesFor(this.competitive ? "competitive" : "casual");
  }
  get competitive() {
    return this.mode === "competitive";
  }
  get teamSize() {
    return this.competitive ? 5 : 10;
  }
  get winTarget() {
    return this.competitive ? 13 : 8;
  }
  helmet = false;
  defuseKit = false;
  money = 0;
  freezeTime = 0;
  buyRemaining = 0;
  lossStreak = { t: 0, ct: 0 };
  dead = 0;
  time = 300;
  kills = 0;
  deaths = 0;
  deathmatchScore = 0;
  deathmatch = new DeathmatchState();
  deathmatchCombat = new DeathmatchCombat(25, 4);
  healthshotAction = new HealthshotAction();
  healthshotHealing = new HealthshotHealing();
  healthshotView = new HealthshotView();
  private healthshotSounds: readonly { kind: "prepare" | "thud"; time: number }[] = [];
  private deathmatchAssisters = new Map<string, string>();
  deathmatchAward = "";
  deathmatchAwardUntil = 0;
  deathmatchBonusAward = 0;
  deathmatchBonusAwardUntil = 0;
  deathmatchRandomBought = false;
  deathmatchRandomWeapons = (() => {
    try {
      return localStorage.getItem("cs2go-dm-random-weapons") !== "false";
    } catch {
      return true;
    }
  })();
  get deathmatchStandings() {
    return [
      {
        id: "player" as const,
        name: playerName(),
        score: this.deathmatchScore,
        kills: this.kills,
        deaths: this.deaths,
        weapon: this.selected,
        team: this.team,
        avatar: playerAvatar(),
        alive: !this.dead && this.health > 0,
      },
      ...this.bots.map((bot, id) => ({
        id,
        name: bot.name,
        score: bot.deathmatchScore,
        kills: bot.kills,
        deaths: bot.deaths,
        weapon: bot.rig.weaponIndex,
        team: bot.team,
        avatar: botPortrait(bot.team, bot.rig.agentId),
        alive: bot.health > 0,
      })),
    ].sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
  }
  health = 100;
  armor = 100;
  assetsReady = false;
  menuReady = false;
  private assetsLoad?: Promise<void>;
  async waitForAssets() {
    await this.assetsLoad;
  }
  wheelTime = 0;
  scopeLevel = 0;
  scopeTransition = 0;
  scopeDuration = 0;
  scopeFrom = sourceVerticalFov(90);
  scopeTarget = sourceVerticalFov(90);
  boltTime = 0;
  rescope = 0;
  weaponCooldowns = weapons.map(() => 0);
  reloadLockouts = weapons.map(() => 0);
  selected = 2;
  primary: number | null = null;
  secondary = 2;
  private actorHulls: ActorHull[] = [];
  private botLadderHulls: ActorHull[] = [];
  private actorStart = new T.Vector3();
  private actorCarrier: number | null = null;
  private actorCarrierTop = 0;
  suppressors = weapons.map(() => new SuppressorState());
  playerAccuracyPose(weapon = this.selected, mode?: 0 | 1): AccuracyPose {
    return {
      mode:
        mode ??
        ((weapon === this.selected && (this.burstMode || this.scopeLevel > 0)) ||
        this.isSuppressed(weapon)
          ? 1
          : 0),
      speed: Math.hypot(this.velocity.x, this.velocity.z),
      crouch: (movement.standingEye - this.eye) / (movement.standingEye - movement.duckEye),
      grounded: this.grounded,
      ladder: this.ladder,
      verticalSpeed: this.vertical,
      walking: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      reloading: weapon === this.selected && this.reload > 0,
    };
  }
  botAccuracyPose(b: Bot): AccuracyPose {
    const weapon = weapons[b.rig.weaponIndex];
    return {
      mode: (weapon.suppressed && b.rig.suppressed) || weapon.zoomLevels > 0 ? 1 : 0,
      speed: b.speed,
      crouch: b.rig.crouch,
      grounded: b.vertical === 0 && b.ladderState.id === null,
      ladder: b.ladderState.id !== null,
      verticalSpeed: b.vertical,
      reloading: b.reloadTime > 0,
    };
  }
  isSuppressed(index: number) {
    return removableSuppressor(index)
      ? this.suppressors[index].attached
      : weapons[index].suppressed;
  }
  toggleSuppressor() {
    if (this.network) {
      this.network.request.toggleSuppressor = true;
      return;
    }
    const state = this.suppressors[this.selected];
    if (
      !removableSuppressor(this.selected) ||
      !this.active ||
      !this.locked ||
      this.dead ||
      this.reload ||
      this.cooldown > 0 ||
      this.planting ||
      this.bomb?.defuser === "player" ||
      this.halftime
    )
      return;
    const native = nativeSuppressor(this.selected, !state.attached);
    state.start(native.duration, native.commit);
    this.inspectTime = this.shotTime = 0;
    this.firing = false;
    this.cooldown = native.duration;
    this.weaponCooldowns[this.selected] = native.duration;
    this.groundInventory.used(this.selected);
  }
  glockBurst = false;
  famasBurst = false;
  revolverCharge = 0;
  knifeFirstSwing = true;
  knifeLastAttack = -Infinity;
  alternateShot = false;
  get burstMode() {
    return this.selected === 7 ? this.glockBurst : this.selected === 19 && this.famasBurst;
  }
  burstRemaining = 0;
  shellPhase: "intro" | "loop" | "outro" = "intro";
  shellInserted = false;
  magazineInserted = false;
  get knife() {
    return equippedKnives[this.team];
  }
  set knife(id: number) {
    if (equippedKnives[this.team] !== id) equipKnife(this.team, id);
  }
  inspectVariant = 2;
  knifeTime = 0;
  knifeDuration = 0.5;
  knifeStab = false;
  knifePending = false;
  knifeContact = false;
  knifeAlternate = true;
  inspectTime = 0;
  inspectRewinding = false;
  inspectDraw = false;
  weaponTime = 0;
  shotTime = 0;
  lastShot = false;
  emptyReload = false;
  private emptyClick?: { weapon: number; remaining: number };
  animationTime = 0;
  inventorySignature = "";
  ammo = 12;
  reserve = 48;
  magazines = weapons.map((w) => ({ ammo: w.mag, reserve: w.reserve }));
  cooldown = 0;
  reload = 0;
  drawTime = 0;
  shots = 0;
  firing = false;
  kick = 0;
  hit = 0;
  damage = 0;
  invulnerable = 0;
  settings = {
    ...presentationDefaults,
    sensitivity: 1,
    hudHue: 110,
    fov: 90,
    volume: 60,
    musicVolume: 25,
    effectsVolume: 100,
    autoBunnyhop: false,
    bindings: defaultBindings(),
  };
  audio: AudioContext | null = null;
  noise: AudioBuffer | null = null;
  weaponAudio = new WeaponAudio();
  soundscape = new Soundscape();
  tracers: Tracer[] = [];
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
  radarOverview?: PreparedRadarOverview;
  radarLayers = new Map<string, HTMLCanvasElement>();
  radarAlternate = false;
  readonly radar = new GameRadar();
  detours = 0;
  accumulator = 0;
  last = 0;
  uiTime = 0;
  frames = 0;
  fps = 0;
  fpsTime = 0;
  tick = 0;
  deathBannerUntil = 0;
  readonly deathDamage = new DeathDamage();
  sway = 0;
  private readonly footstepStride = new FootstepStride();
  supported = true;
  antialiasAtStartup = false;
  aspectAtStartup: DisplayAspect = "native";
  constructor(onLoad: LoadProgress = () => {}) {
    try {
      const saved = JSON.parse(localStorage.getItem("cs2go-settings") || "{}");
      for (const k of [
        "sensitivity",
        "fov",
        "volume",
        "musicVolume",
        "effectsVolume",
        "hudHue",
      ] as const)
        if (Number.isFinite(saved[k]))
          this.settings[k] = clamp(
            saved[k],
            k === "fov" ? 75 : k === "sensitivity" ? 0.2 : 0,
            k === "fov" ? 110 : k === "sensitivity" ? 3 : k === "hudHue" ? 360 : 100,
          );
      if (typeof saved.autoBunnyhop === "boolean") this.settings.autoBunnyhop = saved.autoBunnyhop;
      this.settings.bindings = readBindings(saved.bindings);
      Object.assign(this.settings, readPresentationSettings(saved));
    } catch {
      /* Optional browser storage. */
    }
    try {
      this.aspectAtStartup = this.settings.aspectRatio;
      this.antialiasAtStartup = this.settings.antialias === "msaa";
      this.renderer = new T.WebGLRenderer({
        canvas: this.canvas,
        antialias: this.antialiasAtStartup,
        powerPreference: "high-performance",
      });
    } catch {
      toggle("unsupported", true);
      this.supported = false;
      onLoad(0, 8, true);
      return;
    }
    // Driver log queries can synchronously stall compilation; keep diagnostics in development.
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    const diagnostics = rendererDiagnostics(this.renderer.getContext());
    // A software fallback gets conservative defaults; preserve saved choices.
    if (diagnostics.software) {
      try {
        if (!localStorage.getItem("cs2go-settings"))
          Object.assign(this.settings, graphicsPresets.laptop);
      } catch {
        /* Keep the in-memory defaults when storage is unavailable. */
      }
    }
    configureStartupLoading(this.settings.startupLoad);
    enableTextureTranscoding(this.renderer);
    this.resizeRenderer();
    this.renderer.autoClear = false;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    this.bombMesh.visible = false;
    this.scene.add(this.bombMesh);
    this.decals.count = 0;
    this.decals.visible = this.decals.frustumCulled = false;
    this.scene.add(this.decals);
    this.camera.rotation.order = "YXZ";
    this.view.add(this.healthshotView);
    this.view.add(this.gun, new T.HemisphereLight(0xffffff, 0x554938, 2.5));
    this.viewSun.position.set(-1, 3, 2);
    this.view.add(this.viewSun);
    this.flash = new T.Mesh(
      new T.ConeGeometry(0.06, 0.18, 5),
      new T.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 }),
    );
    this.flash.rotation.x = Math.PI / 2;
    this.flash.position.set(0, 0.045, -1.1);
    this.gun.add(this.flash);
    this.flash.visible = false;

    this.saveSettings();
    this.events();
    const play = el("play") as HTMLButtonElement;
    play.disabled = true;
    play.querySelector("span")!.textContent = "LOADING ARMORY...";
    let loaded = 0;
    const worldReady = loadDust2(this.scene, this.renderer).then((world) => {
      gradeMapColors(world.root);
      this.world = this.dust = world;
      this.nativeWorlds.set("dust2", world);
      return world;
    });
    const assets = [
      prepareMatchMedia(),
      prepareRadarOverview("/models/maps/dust2-radar.png").then((overview) => {
        this.radarOverview = overview;
        this.radarImage = overview.image;
      }),
      loadWeaponModels(this.renderer, this.homeScene.startupWeapons),
      loadGrenadeModels(this.renderer),
      this.weaponAudio.load(),
      this.soundscape.load(),
      loadTracerTextures(),
      Promise.all([
        loadSoldierModels(),
        loadBuyPoses(),
        this.homeScene.load(
          this.renderer,
          worldReady.then((world) => world.scenery),
          worldReady.then((world) => world.collision),
        ),
      ]),
      this.bombMesh.load(this.renderer).then(() => registerActorLighting(this.bombMesh)),
      worldReady,
    ];
    const loadSteps = assets.length + 1; // Compile the homepage before revealing it.
    onLoad(loaded, loadSteps);
    const menuLoad = Promise.all(
      assets.map((asset) =>
        asset.then(() => {
          loaded++;
          onLoad(loaded, loadSteps);
        }),
      ),
    ).then(async () => {
      this.useWorld();
      await this.homeScene.prepare(this.renderer);
      this.menuReady = true;
      this.updateGraphics();
      play.querySelector("span")!.textContent = "PREPARING MATCH...";
      onLoad(loadSteps, loadSteps);
    });
    this.assetsLoad = menuLoad.then(async () => {
      // The homepage no longer waits for unused firearms and knives. Keep
      // Play gated until the background armory and its GPU warm-up finish.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await loadWeaponModels(this.renderer);
      for (let i = 0; i < 5; i++) this.bots.push(this.makeBot(i));
      this.useWorld();
      this.equip(this.selected);
      await this.bombView.load(this.renderer);
      this.view.add(this.bombView);
      await this.defuseView.load(this.renderer);
      this.view.add(this.defuseView);
      this.scene.add(this.defuseView.wires);
      // Submit independent menu and gameplay programs together so drivers can
      // compile both batches in parallel. Play still waits for every program.
      await Promise.all([this.warmUp(), this.groundInventory.preparePreviews(this.renderer)]);
      await this.finishPrograms();
      this.assetsReady = true;
      this.updateGraphics();
      play.disabled = false;
      play.querySelector("span")!.textContent = "GO";
    });
    void this.assetsLoad.catch((error: unknown) => {
      console.error("Game assets failed to load", error);
      play.querySelector("span")!.textContent = "ARMORY UNAVAILABLE";
      el("mode-description").textContent =
        "Weapon models or audio could not load. Refresh the page to retry.";
      if (!this.menuReady) onLoad(loaded, loadSteps, true);
    });
    requestAnimationFrame((t) => this.frame(t));
  }
  textureQualityApplied = "";
  textureViewCheck = -Infinity;
  saveViewmodelSettings() {
    applyViewmodelCamera(this.viewCamera, this.renderSize.x, this.renderSize.y, this.settings);
    try {
      localStorage.setItem("cs2go-settings", JSON.stringify(this.settings));
    } catch {
      /* Session controls still work. */
    }
  }
  saveSettings() {
    applyCrosshair(this.settings);
    document.documentElement.style.setProperty("--hud-hue", String(this.settings.hudHue));
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
    this.scopeTransition = 0;
    this.camera.fov = sourceVerticalFov(
      this.scopeLevel === 2
        ? weapons[this.selected].zoomFov2
        : this.scopeLevel === 1
          ? weapons[this.selected].zoomFov1
          : this.settings.fov,
    );
    this.camera.updateProjectionMatrix();
    // Viewmodel lens is independent of world FOV, as in Source.
    applyViewmodelCamera(this.viewCamera, this.renderSize.x, this.renderSize.y, this.settings);
    this.updateGraphics();
  }
  updateGraphics() {
    const roots = [this.scene, this.homeScene.graphicsRoot];
    applyShadowDetail(roots, this.settings, this.renderer.capabilities.maxTextureSize);
    this.renderer.shadowMap.enabled = this.settings.shadowDetail !== "off";
    this.renderer.shadowMap.type =
      this.settings.shadowFilter === "hard" ? T.BasicShadowMap : T.PCFShadowMap;
    this.resizeRenderer();
    this.updateTextureQuality();
  }
  updateTextureQuality() {
    if (!this.menuReady && !this.assetsReady) return;
    const signature = `${this.settings.textureQuality}:${this.settings.textureFiltering}`;
    const changed = this.textureQualityApplied !== signature;
    const now = performance.now();
    if (!changed && now - this.textureViewCheck < 1000) return;
    // Cached guns are detached from the view scene. Refresh them on a quality
    // change; ordinary checks inspect only the current view and spectator gun.
    const roots: T.Object3D[] = changed
      ? [this.scene, this.homeScene.graphicsRoot, this.view, ...this.guns.values()]
      : [this.view, ...this.homeScene.previewRoots];
    if (
      this.active &&
      this.dead &&
      this.teamMode &&
      this.spectatorMode === "first" &&
      this.spectated
    )
      roots.push(this.viewGun(this.spectated.rig.weaponIndex));
    applyTextureQuality(
      roots,
      this.settings.textureQuality,
      this.renderer.capabilities.getMaxAnisotropy(),
      this.settings.textureFiltering,
    );
    this.textureQualityApplied = signature;
    this.textureViewCheck = now;
  }
  renderSize = new T.Vector2();
  resizeRenderer() {
    const { width, height } = applyDisplayViewport(this.aspectAtStartup, innerWidth, innerHeight);
    const ratio = graphicsPixelRatio(this.settings, width, height, devicePixelRatio);
    if (this.renderer.getPixelRatio() !== ratio) this.renderer.setPixelRatio(ratio);
    this.renderer.getSize(this.renderSize);
    if (this.renderSize.x !== width || this.renderSize.y !== height)
      this.renderer.setSize(width, height);
    this.renderSize.set(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    applyViewmodelCamera(this.viewCamera, width, height, this.settings);
  }

  ensureAudio() {
    if (!this.audio) {
      this.audio = new AudioContext();
      this.noise = this.audio.createBuffer(1, this.audio.sampleRate * 0.25, this.audio.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.soundscape.attach(this.audio);
      this.weaponAudio.output = this.soundscape.effects;
      this.weaponAudio.spatial = this.soundscape.spatial;
      this.soundscape.spatial.obstructed = (from, to) => !this.visible(from, to);
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
    setupUiAudio({
      unlock: () => this.ensureAudio(),
      ready: () => this.audio?.state === "running",
      play: (kind) => this.soundscape.playUi(kind),
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.soundscape.pauseMusic();
      else {
        this.soundscape.resumeMusic();
        if (!this.active && !el("menu").classList.contains("hidden"))
          this.soundscape.playMusic("menu");
      }
    });
    document.addEventListener("pointerlockchange", () => this.syncPointerLock());
    document.addEventListener("pointerlockerror", () => {
      if (this.active) {
        toggle("pause", true);
        toggle("scoreboard", true);
        document.body.classList.add("match-menu-open");
        this.scoreboard();
      }
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked || this.matchLoading || this.chat.open) return;
      if (this.dead) {
        if (this.teamMode && this.competitive && !this.spectated) {
          this.spectatorPitch = clamp(
            this.spectatorPitch - e.movementY * 0.002 * this.settings.sensitivity,
            0.35,
            1.55,
          );
        } else if (this.teamMode && !this.competitive && this.spectatorMode !== "first") {
          this.spectatorYaw -= e.movementX * 0.002 * this.settings.sensitivity;
          this.spectatorPitch = clamp(
            this.spectatorPitch - e.movementY * 0.002 * this.settings.sensitivity,
            -1.45,
            1.45,
          );
        }
        return;
      }
      const zoomRatio = sourceZoomRatio(this.camera.fov, this.settings.fov);
      this.yaw -= e.movementX * 0.002 * this.settings.sensitivity * zoomRatio;
      this.pitch = clamp(
        this.pitch - e.movementY * 0.002 * this.settings.sensitivity * zoomRatio,
        -1.45,
        1.45,
      );
    });
    document.addEventListener("keydown", (e) => {
      if (this.matchLoading || this.chat.open) return;
      if (
        !el("settings").classList.contains("hidden") ||
        document.getElementById("cosmetic-menu")?.classList.contains("hidden") === false ||
        document.getElementById("skin-menu")?.classList.contains("hidden") === false
      )
        return;
      const code = canonicalKey(e.code, this.settings.bindings);
      if (!code) return;
      if (this.locked && ["Space", "Tab", "ArrowUp", "ArrowDown"].includes(code))
        e.preventDefault();
      if (code === "Tab" && this.active) {
        toggle("scoreboard", true);
        this.scoreboard();
      }
      if (code === "KeyM" && this.active && this.locked && this.world.navigation)
        document.querySelector(".radar-wrap")!.classList.add("expanded");
      if (code === "KeyH" && this.active && this.locked && !e.repeat)
        this.radarAlternate = !this.radarAlternate;
      if (!this.locked) return;
      if ((code === "KeyT" || code === "KeyY") && this.active && !e.repeat) {
        e.preventDefault();
        this.chat.show(code === "KeyT" ? "team" : "all");
        return;
      }
      if (code === "KeyE" && this.takeoverUseHeld) {
        if (e.repeat) return;
        this.takeoverUseHeld = false;
      }
      if (code === "F3" && this.mode === "deathmatch" && this.active && !e.repeat) {
        e.preventDefault();
        this.deathmatchRandomWeapons = !this.deathmatchRandomWeapons;
        if (this.deathmatchRandomWeapons) this.applyDeathmatchRandomWeapons();
        try {
          localStorage.setItem("cs2go-dm-random-weapons", String(this.deathmatchRandomWeapons));
        } catch {
          /* Session toggle still works. */
        }
        this.updateUI();
        return;
      }
      if (this.dead) {
        if (code === "KeyE" && !e.repeat) this.takeOverBot();
        if (this.teamMode && this.spectatorMode === "free") this.keys.add(code);
        return;
      }
      this.keys.add(code);
      if (e.repeat) return;
      if (code === "KeyX") this.selectHealthshot();
      if (code === "Space") this.jumpQueued = true;
      if (code === "KeyR" && !this.utility.selected) this.beginReload();
      if (code === "KeyG") {
        if (this.mode === "deathmatch" && this.deathmatch.bonus) {
          this.claimDeathmatchBonus();
          return;
        }
        if (this.healthshotAction.selected) return;
        if (this.bombSelected) {
          if (this.network) this.network.request.dropBomb = true;
          else this.dropBomb("player");
        } else if (this.network) this.network.request.drop = true;
        else this.groundInventory.drop(this.selected, true);
      }
      if (code === "Digit5") this.equipBomb();
      if (code === "Digit4") this.utility.selectNext();
      if (code === "KeyE" && this.network) this.network.request.pickup = true;
      if (code === "KeyE" && !this.network && this.groundInventory.pickup(true))
        this.keys.delete("KeyE");
      if (
        code === "KeyF" &&
        !this.healthshotAction.selected &&
        !this.suppressors[this.selected].action &&
        !this.utility.selected &&
        !this.planting &&
        !this.bombSelected &&
        !this.reload &&
        !this.boltTime &&
        !this.shotTime &&
        (!this.knifeTime ||
          (isKnife(this.selected) &&
            this.cooldown <= 0 &&
            !this.knifePending &&
            this.knifeDuration - this.knifeTime >=
              knifeInspectBlockDuration(
                this.selected,
                this.knifeStab,
                this.knifeAlternate,
                this.knifeContact,
              ))) &&
        (!this.inspectTime || this.inspectRewinding) &&
        (!this.drawTime ||
          (isKnife(this.selected) && this.drawTime > weaponDrawDuration(this.selected) * 0.85))
      ) {
        // During a rewind, F changes direction at the current pose.
        if (!this.inspectTime) {
          this.knifeTime = 0;
          this.inspectVariant = (this.inspectVariant + 1) % 3;
          this.inspectDraw = this.drawTime > 0;
          this.inspectTime = this.inspectDuration();
        }
        this.inspectRewinding = false;
        this.setScope(0);
        this.drawTime = this.weaponTime = 0;
      }
      if (code === "Digit1") {
        if (this.primary !== null) this.equip(this.primary);
      }
      if (code === "Digit2") this.equip(this.secondary);
      if (code === "Digit3") this.equip(this.knife);
      if (code === "KeyB" && this.canBuy()) {
        toggle("loadout", true);
        document.exitPointerLock();
        toggle("pause", false);
      }
    });
    document.addEventListener("keyup", (e) => {
      const code = canonicalKey(e.code, this.settings.bindings);
      this.keys.delete(code);
      if (code === "KeyE") {
        this.takeoverUseHeld = false;
        this.doorUseConsumed = false;
      }
      if (code === "KeyM") document.querySelector(".radar-wrap")!.classList.remove("expanded");
      if (code === "Tab" && el("pause").classList.contains("hidden")) toggle("scoreboard", false);
    });
    document.addEventListener(
      "wheel",
      (e) => {
        if (this.matchLoading || this.chat.open || !this.active || !this.locked || !e.deltaY)
          return;
        e.preventDefault();
        const now = performance.now();
        if (now - this.wheelTime < 100) return;
        this.wheelTime = now;
        if (this.dead) {
          if (this.teamMode) this.cycleSpectatorMode(e.deltaY > 0 ? 1 : -1);
          return;
        }
        this.cycleInventory(e.deltaY > 0 ? 1 : -1);
      },
      { passive: false },
    );
    document.addEventListener("mousedown", (e) => {
      if (this.matchLoading || this.chat.open) return;
      if (
        this.active &&
        this.locked &&
        !this.dead &&
        (this.utility.selected || this.utility.throwingKind) &&
        (e.button === 0 || e.button === 2)
      ) {
        this.utility.pressThrow(e.button);
        return;
      }
      if (this.active && this.locked && this.dead && this.teamMode) {
        if (this.spectatorMode !== "free" && (e.button === 0 || e.button === 2))
          this.spectate(e.button === 0 ? 1 : -1);
        return;
      }
      if (this.bombSelected && e.button === 2) return;
      if (e.button === 2 && this.locked && !this.dead && !this.healthshotAction.selected) {
        if (weapons[this.selected].zoomLevels > 0) this.cycleScope();
        else if (removableSuppressor(this.selected)) this.toggleSuppressor();
        else if (isKnife(this.selected)) this.fireKnife(true);
        else if (this.selected === 17) this.fire(false, true);
        else if (
          (this.selected === 7 || this.selected === 19) &&
          !this.reload &&
          !this.burstRemaining &&
          this.cooldown <= 0
        ) {
          if (this.selected === 7) this.glockBurst = !this.glockBurst;
          else this.famasBurst = !this.famasBurst;
          this.cooldown = 0.3;
          this.weaponCooldowns[this.selected] = this.cooldown;
        }
      }
      if (e.button === 0 && this.locked && !this.dead) {
        this.firing = true;
        this.fire();
      }
    });
    document.addEventListener("mouseup", (e) => {
      this.utility.handling.release(e.button);
      if (e.button === 0) {
        this.firing = false;
        this.revolverCharge = 0;
      }
    });
    window.addEventListener("blur", () => {
      this.utility.cancelThrow();
      this.keys.clear();
      this.firing = false;
      if (this.locked) document.exitPointerLock();
    });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("resize", () => {
      this.resizeRenderer();
    });
  }
  syncPointerLock() {
    // Keep controls disabled while the map and team previews are prepared.
    if (this.matchLoading) {
      this.locked = false;
      this.keys.clear();
      return;
    }
    this.locked = document.pointerLockElement === this.canvas;
    this.keys.clear();
    document.querySelector(".radar-wrap")!.classList.remove("expanded");
    this.jumpQueued = false;
    this.firing = false;
    this.revolverCharge = 0;
    if (!this.locked) {
      this.healthshotAction.cancel();
      this.chat.close();
      this.suppressors[this.selected].cancel();
      this.utility.cancelThrow();
      this.burstRemaining = 0;
      this.weaponAudio.stop();
      this.soundscape.stop();
      this.rescope = 0;
      this.setScope(0);
    }
    if (this.active) {
      const menuOpen = !this.locked && el("loadout").classList.contains("hidden");
      toggle("pause", menuOpen);
      toggle("scoreboard", menuOpen);
      document.body.classList.toggle("match-menu-open", menuOpen);
      if (menuOpen) this.scoreboard();
    }
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
  setTeam(team: AgentTeam, prepare = true) {
    if (this.active || team === this.team) return;
    this.team = team;
    if (!prepare) return;
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
      // Match entry awaits its warm-up with the actual roster and lighting.
    }
  }
  switchTeam(team: AgentTeam) {
    if (!this.active || this.team === team) return;
    if (this.network) {
      if (!this.network.connection.changeTeam(team))
        this.notices.showAlert("Wait for the connection to recover before changing teams.");
      return;
    }
    const previousTeam = this.team;
    const botIndex =
      this.mode === "deathmatch" ? -1 : this.bots.findIndex((bot) => bot.team === team);
    this.dropBomb("player");
    if (this.bomb?.defuser === "player") {
      this.bomb.defuser = null;
      this.bomb.progress = 0;
    }
    this.team = team;
    if (botIndex >= 0) {
      const previous = this.bots[botIndex];
      this.dropBomb(botIndex);
      if (this.bomb?.defuser === botIndex) {
        this.bomb.defuser = null;
        this.bomb.progress = 0;
      }
      this.scene.remove(previous.group);
      disposeSoldier(previous.rig);
      const replacement = this.makeBot(botIndex, previousTeam);
      replacement.kills = previous.kills;
      replacement.deaths = previous.deaths;
      replacement.money = previous.money;
      this.bots[botIndex] = replacement;
      this.spawnBot(replacement, botIndex);
      if (this.teamMode) {
        replacement.health = 0;
        replacement.respawn = Infinity;
        replacement.group.visible = false;
      }
    }
    this.keys.clear();
    this.firing = false;
    this.setScope(0);
    this.reload = this.revolverCharge = this.burstRemaining = 0;
    this.utility.cancelThrow();
    this.groundInventory.roundLoadout = null;
    if (this.teamMode) {
      this.health = 0;
      this.dead = Infinity;
      this.velocity = { x: 0, z: 0 };
      this.spectated = undefined;
      this.spectatorMode = "first";
      this.notices.showAlert("Team changed. You will spawn next round.");
      this.resetBotStrategies();
    } else this.spawnPlayer();
    this.scoreboardSignature = "";
    this.updateUI();
  }
  viewGun(index: number) {
    const key = `${this.team}:${index}`;
    let gun = this.guns.get(key);
    if (!gun) {
      this.guns.set(key, (gun = createGun(index, this.team)));
      registerActorLighting(gun);
    }
    return gun;
  }
  /** Finish map, roster and both factions' equipment before team selection. */
  private pruneNativeWorlds() {
    // The simulation and selected preparation may temporarily reference
    // different maps until useWorld commits. Both must remain alive.
    this.nativeWorlds.prune([this.world, this.dust]);
  }
  async prepareMap(id: MapId, signal: AbortSignal) {
    const release = this.nativeWorlds.retain(id);
    signal.addEventListener("abort", release, { once: true });
    try {
      signal.throwIfAborted();
      const waitFor = async <Value>(pending: Promise<Value>): Promise<Value> => {
        signal.throwIfAborted();
        let abort: () => void = () => {};
        try {
          return await Promise.race([
            pending,
            new Promise<never>((_, reject) => {
              abort = () => reject(signal.reason);
              signal.addEventListener("abort", abort, { once: true });
            }),
          ]);
        } finally {
          signal.removeEventListener("abort", abort);
        }
      };
      let world = this.nativeWorlds.get(id);
      if (!world) {
        world = await waitFor(
          this.nativeWorlds.load(id, async () => {
            // Reserve memory when this queued selection actually starts, after
            // any earlier cancelled world has finished and released its resources.
            this.nativeWorlds.prune([this.world, this.dust], 1);
            const loaded = await loadNativeMap(this.scene, this.renderer, id);
            if (loaded.sourceLighting) gradeMapColors(loaded.root);
            return loaded;
          }),
        );
      }
      signal.throwIfAborted();
      if (this.dust !== world) {
        const radar =
          world.config.radar || id === "dust2"
            ? await waitFor(
                prepareRadarOverview(`/models/maps/${id}-radar.png`, world.config.radar),
              )
            : undefined;
        signal.throwIfAborted();
        // Commit only a complete map/radar pair. Cancelled or failed image
        // preparation must retain the current map and allow a later retry.
        this.dust = world;
        this.radarOverview = radar;
        this.radarImage = radar?.image;
        this.radarLayers.clear();
      }
    } finally {
      signal.removeEventListener("abort", release);
      release();
      this.pruneNativeWorlds();
    }
  }
  async prepareMatch(mode: Mode, bots: boolean, signal: AbortSignal, map: MapId = this.mapId) {
    const team = this.team;
    try {
      this.mode = mode;
      await this.prepareMap(map, signal);
      if (mode === "deathmatch") {
        const timings = await this.healthshotView.prepare();
        signal.throwIfAborted();
        this.healthshotAction.configure({ ...timings, draw: 1 });
        this.healthshotSounds = timings.sounds;
      }
      this.useWorld();
      this.configureBots(this.teamMode, bots ? undefined : 0);
      this.bots.forEach((bot, index) => this.spawnBot(bot, index));
      for (const faction of [team, team === "ct" ? "t" : "ct"] as const) {
        signal.throwIfAborted();
        this.team = faction;
        this.spawnPlayer();
        await this.warmUp(signal);
        this.prepareMatchFrame();
        await this.finishPrograms(signal);
      }
    } finally {
      this.team = team;
      this.bots.forEach((bot) => (bot.group.visible = false));
    }
  }
  // Compile both worlds and weapon programs; upload visible finishes only.
  // Hidden HD skin variants upload on first use instead of occupying GPU memory.
  async warmUp(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!this.dust) return;
    const preparedWorld = this.dust;
    const extras = new T.Group(),
      viewExtras = new T.Group();
    let tracer = this.tracers[0];
    if (!tracer) {
      tracer = createTracer();
      this.tracers.push(tracer);
    }
    const warmTracer = tracer.mesh;
    warmTracer.visible = true;
    extras.add(createWorldGun(0), createWorldGun(1), warmTracer);
    for (let index = 0; index < weapons.length; index++)
      if (this.viewGun(index) !== this.gun) viewExtras.add(this.viewGun(index));
    this.scene.add(extras);
    this.view.add(viewExtras);
    this.updateGraphics();
    applyTextureQuality(
      [this.scene, this.view, this.homeScene.graphicsRoot],
      this.settings.textureQuality,
      this.renderer.capabilities.getMaxAnisotropy(),
      this.settings.textureFiltering,
    );
    const dust = this.dust.root.visible,
      bomb = this.bombView.visible,
      defuse = this.defuseView.visible,
      healthshot = this.healthshotView.visible,
      previousToneMapping = this.renderer.toneMapping;
    const textures = new Set<T.Texture>();
    let foliage: Promise<unknown> | undefined;
    try {
      this.dust.root.visible = true;
      this.renderer.toneMapping = T.CustomToneMapping;
      this.prepareMapFrame(() => this.renderer.compile(this.scene, this.camera));
      this.prepareMapFrame(() => {
        foliage = preparedWorld.nativeCoverage?.prepare(this.camera);
      });
      this.bombView.visible = true;
      this.defuseView.visible = true;
      if (this.mode === "deathmatch" && this.healthshotView.ready) {
        this.healthshotView.visible = true;
        this.healthshotView.sample(
          "idle",
          0,
          this.team,
          gloveChoices[this.team],
          selectedAgentId(this.team),
        );
        this.updateViewLighting(this.healthshotView, 1 / 60);
      }
      this.prepareMapFrame(() => this.renderer.compile(this.view, this.viewCamera));
      for (const uniform of Object.values(warmTracer.material.uniforms))
        if (uniform.value instanceof T.Texture) textures.add(uniform.value);
      for (const root of [this.scene, this.view])
        root.traverseVisible((object) => {
          if (!(object instanceof T.Mesh)) return;
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            for (const value of Object.values(material))
              if (value instanceof T.Texture) textures.add(value);
        });
    } finally {
      this.dust.root.visible = dust;
      this.bombView.visible = bomb;
      this.defuseView.visible = defuse;
      this.healthshotView.visible = healthshot;
      this.renderer.toneMapping = previousToneMapping;
      this.scene.remove(extras);
      viewExtras.clear();
      this.view.remove(viewExtras);
      warmTracer.visible = false;
      this.scene.add(warmTracer);
    }
    // Yield between uploads so input/painting can run during GPU warm-up.
    let uploaded = 0;
    let uploadSlice = performance.now();
    for (const texture of textures) {
      signal?.throwIfAborted();
      this.renderer.initTexture(texture);
      if (++uploaded % 8 === 0 || performance.now() - uploadSlice >= 8) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        uploadSlice = performance.now();
      }
    }
    await foliage;
    if (!this.assetsReady) await this.homeScene.prepare(this.renderer);
    await warmSourceSky(this.dust.skybox, signal);
    let effects: Promise<void> | undefined;
    this.prepareMapFrame(() => {
      effects = preparedWorld.nativeEffects?.prepare(this.camera);
    });
    await effects;
    await this.finishPrograms(signal);
  }
  // Let drivers link in parallel, then take each program's first use (uniform
  // lookup) now rather than when an agent or weapon first comes into view.
  async finishPrograms(signal?: AbortSignal) {
    const parallel = this.renderer.extensions.has("KHR_parallel_shader_compile"),
      pending = new Set(this.renderer.info.programs ?? []);
    while (pending.size) {
      signal?.throwIfAborted();
      if (this.renderer.getContext().isContextLost())
        throw new Error("Graphics context lost during preparation");
      for (const program of pending)
        if (!parallel || (program as T.WebGLProgram & { isReady(): boolean }).isReady()) {
          program.getUniforms();
          const gl = this.renderer.getContext();
          if (!gl.getProgramParameter(program.program as WebGLProgram, gl.LINK_STATUS))
            throw new Error("A graphics shader could not compile during preparation");
          pending.delete(program);
        }
      if (pending.size) await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  prepareMatchFrame() {
    this.updateAimCamera(1);
    this.animateWeapon(0, 0);
    this.animateBots();
    this.updateSceneLighting(0);
    this.renderer.toneMapping = T.CustomToneMapping;
    const effectTime = performance.now() / 1000;
    this.world.nativeEffects?.update(effectTime);
    this.world.nativeEnvironment?.update(effectTime);
    this.world.nativeCoverage?.update(effectTime);
    this.renderMapFrame(() => {
      this.renderer.clear();
      this.utility.renderWorld();
      this.renderer.clearDepth();
      this.renderer.render(this.view, this.viewCamera);
    });
  }
  private cableResolution = new T.Vector2();
  private updateMapCables() {
    const cables = this.world.nativeCables;
    if (!cables) return;
    this.renderer.getDrawingBufferSize(this.cableResolution);
    cables.update(this.camera, this.cableResolution.y);
  }
  renderMapFrame(draw: () => void) {
    this.updateMapCables();
    const composite = this.world.frameComposite;
    const render = () => {
      if (composite) composite.render(this.renderer, draw);
      else draw();
    };
    if (this.world.nativeLocalLights) this.world.nativeLocalLights.render(this.renderer, render);
    else render();
  }
  prepareMapFrame(compile: () => void) {
    this.updateMapCables();
    const composite = this.world.frameComposite;
    if (composite) composite.prepare(this.renderer, compile);
    else compile();
  }
  matchLoading = false;
  start(mode: Mode, options: { bots?: boolean; lock?: boolean } = {}) {
    this.chat.reset();
    hideDeathcam();
    this.deathDamage.reset();
    this.network?.disconnect();
    this.network = undefined;
    this.world?.doors?.release("player");
    hideRoundBanner();
    this.notices.reset();
    if (!this.supported || matchMedia("(pointer: coarse)").matches) {
      toggle("unsupported", true);
      return;
    }
    if (!this.assetsReady) return;
    this.active = true;
    setAssetCacheMatchActive(true);
    this.mode = mode;
    this.groundInventory.roundLoadout = null;
    this.freezeTime = this.buyRemaining = 0;
    this.revolverCharge = 0;
    this.useWorld();
    this.world.breakables.reset();
    this.world.doors?.reset();
    this.doorUseConsumed = false;
    this.syncMapDoors();
    this.syncMapBreakables(false);
    this.configureBots(this.teamMode, options.bots === false ? 0 : undefined);
    this.utility.reset();
    this.utility.botInventories.clear();
    this.round = 1;
    this.botStrategySeed = Math.floor(Math.random() * 0x100000000);
    this.money = this.rules.startMoney;
    this.lossStreak = { t: this.rules.startingLossLevel, ct: this.rules.startingLossLevel };
    this.teamScores = { t: 0, ct: 0 };
    this.roundHistory = [];
    this.mvpCounts.clear();
    this.scoreboardSignature = "";
    this.roundPause = 0;
    this.bomb = null;
    this.bombMesh.visible = false;
    this.time = this.mode === "deathmatch" ? 600 : 300;
    this.kills = this.deaths = this.deathmatchScore = 0;
    this.deathmatch.reset();
    this.deathmatchCombat.reset();
    this.healthshotHealing.clear();
    this.deathmatchAssisters.clear();
    this.healthshotAction.cancel();
    this.deathmatchAward = "";
    this.deathmatchAwardUntil = 0;
    this.primary = null;
    this.dead = 0;
    for (const id of [
      "menu",
      "pause",
      "result",
      "loadout",
      "settings",
      "skin-menu",
      "cosmetic-menu",
    ])
      toggle(id, false);
    toggle("hud", true);
    el("killfeed").replaceChildren();
    this.magazines = weapons.map((w) => ({ ammo: w.mag, reserve: w.reserve }));
    this.bots.forEach((b) => {
      b.kills = b.deaths = b.deathmatchScore = 0;
      b.money = this.rules.startMoney;
    });
    if (this.teamMode) this.startRound();
    else {
      this.spawnPlayer();
      this.bots.forEach((b, i) => this.spawnBot(b, i));
    }
    this.ensureAudio();
    this.soundscape.playMusic(this.teamMode ? "start" : "match");
    this.soundscape.play("ready");
    if (options.lock !== false) void this.lock();
    this.updateUI();
  }
  menu() {
    this.healthshotHealing.clear();
    this.healthshotAction.cancel();
    this.chat.reset();
    hideDeathcam();
    this.deathDamage.reset();
    this.network?.disconnect();
    this.network = undefined;
    this.notices.reset();
    document.body.classList.remove("match-menu-open");
    el("menu").dataset.page = "home";
    document.getElementById("loadout-editor")?.remove();
    this.utility.reset();
    toggle("scoreboard", false);
    this.active = false;
    this.setScope(0);
    this.rescope = 0;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    for (const id of [
      "hud",
      "pause",
      "result",
      "settings",
      "loadout",
      "skin-menu",
      "cosmetic-menu",
    ])
      toggle(id, false);
    toggle("menu", true);
    this.soundscape.playMusic("menu");
    this.bots.forEach((b) => (b.group.visible = false));
    this.bombMesh.visible = false;
    this.useWorld();
    setAssetCacheMatchActive(false);
  }
  inspectDuration() {
    return isKnife(this.selected) && this.selected !== 4
      ? sourceKnifeInspectDuration(this.selected, this.inspectVariant)
      : this.selected === 4
        ? knifeInspectDuration(this.inspectDraw)
        : nativeInspectDuration(this.selected);
  }
  animationSounds(
    motion: "draw" | "reload" | "shoot1" | "shoot2" | "silencer_attach" | "silencer_detach",
    before: number,
    after: number,
  ) {
    if (this.dead) return;
    if (motion === "draw" && isKnife(this.selected) && before < 0 && after >= 0)
      this.soundscape.play(this.selected === 5 ? "butterfly-draw" : "knife-deploy");
    const variant =
      motion === "reload" && this.emptyReload
        ? "reload_empty"
        : motion === "shoot1" && this.lastShot
          ? "shoot_empty"
          : motion;
    for (const cue of nativeSoundCues(this.selected, variant)) {
      if (before < cue.time && after >= cue.time) this.sound(cue.kind);
    }
  }
  setScope(level: number) {
    if (level) this.inspectTime = 0;
    this.scopeLevel = level;
    this.scopeFrom = this.camera.fov;
    const w = weapons[this.selected];
    this.scopeDuration = level === 2 ? w.zoomTime2 : level === 1 ? w.zoomTime1 : w.zoomTime0;
    this.scopeTransition = this.scopeDuration;
    this.scopeTarget = sourceVerticalFov(
      level === 2
        ? weapons[this.selected].zoomFov2
        : level === 1
          ? weapons[this.selected].zoomFov1
          : this.settings.fov,
    );
    if (!this.scopeDuration) this.camera.fov = this.scopeTarget;
    this.camera.updateProjectionMatrix();
    toggle("scope", level > 0 && weapons[this.selected].zoomLevels > 1);
    toggle("crosshair", weapons[this.selected].zoomLevels < 2);
  }
  cycleScope() {
    if (this.bombSelected) return;
    if (this.planting) return;
    if (this.reload) return;
    if (this.boltTime > 0) {
      this.rescope = 0;
      return;
    }
    this.rescope = 0;
    this.setScope((this.scopeLevel + 1) % (weapons[this.selected].zoomLevels + 1));
    this.sound("scope");
  }
  deathmatchSpawn(previous: T.Vector3, bot?: Bot) {
    if (this.mode !== "deathmatch" || !this.world.collision) return undefined;
    const actors = this.bots
      .filter((other) => other !== bot && other.health > 0 && other.group.visible)
      .map((other) => other.group.position);
    if (bot && !this.dead && this.health > 0) actors.push(this.position);
    return chooseDeathmatchSpawn(
      deathmatchSpawnPool(this.world.navigation, this.world.collision),
      actors,
      previous,
      (from, to) => this.visible(from, to),
    );
  }
  spawnPlayer(preserve = false) {
    this.healthshotHealing.clear();
    this.healthshotAction.cancel();
    this.deathmatchRandomBought = false;
    const deathmatchLoadout =
      this.mode === "deathmatch" ? { primary: this.primary, secondary: this.secondary } : null;
    this.dust?.ball.reset();
    if (!preserve) this.suppressors = weapons.map(() => new SuppressorState());
    for (const state of this.suppressors) state.cancel();
    this.utility.spawnPlayer(preserve);
    this.groundInventory.reset(preserve);
    const saved = preserve
      ? {
          primary: this.primary,
          secondary: this.secondary,
          armor: this.armor,
          helmet: this.helmet,
          kit: this.defuseKit,
        }
      : null;
    this.takeoverUseHeld = false;
    this.spectated = undefined;
    this.spectatorMode = "first";
    this.spectatorYaw = 0;
    this.spectatorPitch = 0.21;
    this.spectatorShotAt = -Infinity;
    this.spectatorLastShot = false;
    this.setScope(0);
    this.rescope = this.boltTime = 0;
    this.weaponCooldowns = weapons.map(() => 0);
    this.reloadLockouts.fill(0);
    const deathmatchSpawn = this.deathmatchSpawn(this.position);
    if (deathmatchSpawn) this.position.copy(deathmatchSpawn);
    else if (this.dust) {
      this.position.fromArray(this.dust.navigation.data.spawns[this.team][0]);
      groundSpawn(this.position, this.dust.collision);
    }
    this.velocity = { x: 0, z: 0 };
    this.ladderState = createLadderState();
    this.footstepStride.reset();
    this.vertical = 0;
    this.grounded = true;
    this.jumpQueued = false;
    this.duckCooldown = 0;
    this.duckHeld = this.duckAccepted = false;
    this.plantLook = 0;
    this.health = 100;
    this.deathDamage.reset();
    if (this.mode === "deathmatch") this.deathmatchCombat.spawn("player");
    hideDeathcam();
    this.armor = this.teamMode ? (this.rules.freeArmor ? 100 : 0) : 100;
    this.helmet = this.teamMode ? this.rules.freeArmor : true;
    this.defuseKit = this.teamMode && this.team === "ct" && this.rules.freeKit;
    this.yaw = this.teamMode
      ? (this.dust?.navigation.data.spawnAngles?.[this.team][0] ?? 0)
      : this.mode === "deathmatch"
        ? Math.random() * Math.PI * 2
        : -0.12;
    this.pitch = 0;
    this.aimPunch = createAimPunch();
    this.weaponRecoil = weapons.map(() => createWeaponRecoil());
    this.weaponAccuracy = weapons.map(() => createWeaponAccuracy());
    this.actorCarrier = null;
    this.eye = movement.standingEye;
    this.dead = 0;
    toggle("death-banner", false);
    this.reload = this.shots = this.cooldown = this.drawTime = 0;
    this.invulnerable = this.mode === "deathmatch" ? 10 : this.teamMode ? 0 : 2;
    if (this.soundscape.currentMusic === "deathcam") this.soundscape.playMusic(null);
    this.magazines = weapons.map((w) => ({ ammo: w.mag, reserve: w.reserve }));
    this.primary = null;
    this.ammo = weapons[this.selected].mag;
    this.reserve = weapons[this.selected].reserve;
    this.secondary =
      this.team === "t"
        ? 7
        : (this.groundInventory.loadouts.ct.find((id) => id === 2 || id === 12) ?? 2);
    if (deathmatchLoadout) {
      this.primary = deathmatchLoadout.primary ?? (this.team === "t" ? 0 : 1);
      this.secondary = deathmatchLoadout.secondary;
      if (this.deathmatchRandomWeapons) {
        this.primary = this.randomDeathmatchWeapon(1) ?? this.primary;
        this.secondary = this.randomDeathmatchWeapon(2) ?? this.secondary;
        this.deathmatchRandomBought = true;
      }
    }
    if (saved) {
      this.primary = saved.primary;
      this.secondary = saved.secondary;
      this.armor = this.rules.freeArmor ? 100 : saved.armor;
      this.helmet = this.rules.freeArmor || saved.helmet;
      this.defuseKit = (this.team === "ct" && this.rules.freeKit) || saved.kit;
    }
    this.equip(this.primary ?? this.secondary);
    this.firing = false;
    this.camera.position.copy(this.position);
    this.camera.position.y += this.eye;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
  selectHealthshot() {
    if (
      !this.active ||
      this.dead ||
      this.mode !== "deathmatch" ||
      !this.healthshotAction.ready ||
      this.deathmatchCombat.life("player").healthshots < 1
    )
      return false;
    if (this.healthshotAction.selected) return true;
    this.suppressors[this.selected].cancel();
    this.utility.cancelThrow();
    this.utility.selected = null;
    this.magazines[this.selected] = { ammo: this.ammo, reserve: this.reserve };
    this.reload = this.knifeTime = this.inspectTime = this.shotTime = this.drawTime = 0;
    this.revolverCharge = this.burstRemaining = this.cooldown = 0;
    this.knifePending = this.firing = false;
    this.setScope(0);
    this.rescope = this.boltTime = 0;
    const selected = this.healthshotAction.select();
    this.updateUI();
    return selected;
  }
  useHealthshot() {
    if (!this.locked || this.dead || !this.active || this.mode !== "deathmatch") return false;
    const used = this.healthshotAction.use(
      this.health,
      this.deathmatchCombat.life("player").healthshots,
    );
    if (used) {
      this.firing = false;
      this.invulnerable = 0;
      this.updateUI();
    }
    return used;
  }
  claimDeathmatchBonus() {
    if (
      this.mode !== "deathmatch" ||
      !this.deathmatch.bonus ||
      !this.active ||
      this.dead ||
      this.health <= 0
    )
      return false;
    return this.buy(this.deathmatch.bonus.weapon);
  }
  applyDeathmatchRandomWeapons() {
    if (this.mode !== "deathmatch" || !this.canBuy() || this.deathmatchRandomBought) return false;
    const primary = this.randomDeathmatchWeapon(1);
    const secondary = this.randomDeathmatchWeapon(2);
    if (primary === undefined && secondary === undefined) return false;
    this.deathmatchRandomBought = true;
    if (primary !== undefined) this.primary = primary;
    if (secondary !== undefined) this.secondary = secondary;
    for (const index of [primary, secondary]) {
      if (index === undefined) continue;
      this.magazines[index] = { ammo: weapons[index].mag, reserve: weapons[index].reserve };
      this.groundInventory.newPlayerWeapon(index);
    }
    this.equip(this.primary ?? this.secondary);
    return true;
  }
  randomDeathmatchWeapon(slot: 1 | 2) {
    const choices = this.groundInventory.loadouts[this.team].filter(
      (index) => !isKnife(index) && weaponSlot(index) === slot && weaponAvailable(index, this.team),
    );
    return choices.length ? choices[Math.floor(Math.random() * choices.length)] : undefined;
  }
  inventory() {
    return [
      this.primary,
      this.groundInventory.sidearmDropped ? null : this.secondary,
      this.knife,
    ].filter((id): id is number => id !== null);
  }
  cycleInventory(direction: number) {
    const choices: (number | GrenadeKind | "bomb" | "healthshot")[] = [
      ...this.inventory(),
      ...grenadeTypes.filter((kind) => this.utility.inventory[kind] > 0),
      ...(this.carryingBomb ? ["bomb" as const] : []),
      ...(this.mode === "deathmatch" && this.deathmatchCombat.life("player").healthshots
        ? ["healthshot" as const]
        : []),
    ];
    const current = choices.indexOf(
      this.healthshotAction.selected
        ? "healthshot"
        : this.bombSelected
          ? "bomb"
          : (this.utility.selected ?? this.selected),
    );
    const next = choices[(current + direction + choices.length) % choices.length];
    if (typeof next === "number") this.equip(next);
    else if (next === "healthshot") this.selectHealthshot();
    else if (next === "bomb") this.equipBomb();
    else this.utility.select(next);
  }
  updateAimCamera(scale = RECOIL_VIEW_SCALE) {
    this.camera.position.copy(this.position);
    this.camera.position.y += this.eye;
    this.camera.rotation.set(
      clamp(this.viewPitch + this.aimPunch.pitch * scale, -Math.PI / 2, Math.PI / 2),
      this.yaw + this.aimPunch.yaw * scale,
      0,
    );
    this.camera.updateMatrixWorld(true);
  }
  buy(index: number, drop = false) {
    if (this.network) return this.network.buy(index, drop);
    if (
      !this.active ||
      this.dead ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= weapons.length
    )
      return false;
    if (drop) {
      if (
        isKnife(index) ||
        !this.canBuy() ||
        (this.teamMode &&
          (!weaponAvailable(index, this.team) || !this.groundInventory.allowed(index)))
      )
        return false;
      const price = this.teamMode ? weaponPrice(index) : 0;
      if (this.money < price) return false;
      const dropped = this.groundInventory.spawn(
        index,
        weapons[index].mag,
        weapons[index].reserve,
        this.position,
        this.yaw,
        "player",
        true,
        createWeaponInstance(index, "player", true),
      );
      if (!dropped) return false;
      dropped.buyDrop = true;
      this.money = addMoney(this.money, -price, this.competitive ? "competitive" : "casual");
      this.updateUI();
      return true;
    }
    const owned = this.inventory().includes(index);
    if (!owned && !isKnife(index) && this.teamMode) {
      if (
        !this.canBuy() ||
        !weaponAvailable(index, this.team) ||
        !this.groundInventory.allowed(index) ||
        this.money < weaponPrice(index)
      )
        return false;
      this.money = addMoney(
        this.money,
        -weaponPrice(index),
        this.competitive ? "competitive" : "casual",
      );
    }
    if (isKnife(index)) {
      this.knife = index;
      this.groundInventory.newPlayerWeapon(index);
    }
    const slot = weaponSlot(index);
    if (!owned && !isKnife(index)) {
      const previous =
        slot === 1 ? this.primary : this.groundInventory.sidearmDropped ? null : this.secondary;
      if (previous !== null) this.groundInventory.drop(previous);
      if (slot === 2) this.groundInventory.sidearmDropped = false;
    }
    if (!owned && !isKnife(index)) {
      if (slot === 1) this.primary = index;
      else this.secondary = index;
      this.suppressors[index] = new SuppressorState();
      this.magazines[index] = { ammo: weapons[index].mag, reserve: weapons[index].reserve };
      this.groundInventory.newPlayerWeapon(index);
    }
    this.equip(index);
    if (!owned && !isKnife(index))
      this.groundInventory.purchased(index, this.teamMode ? weaponPrice(index) : 0);
    return true;
  }
  canBuy() {
    if (!this.active || this.dead || this.roundPause > 0) return false;
    if (this.mode === "deathmatch") return this.invulnerable > 0;
    if (!this.teamMode) return true;
    if (this.buyRemaining <= 0 || !this.dust) return false;
    return mapTriggers(this.dust ?? {}).buyZones.contains(this.position, this.team, {
      halfWidth: movement.hullRadius,
      height: this.hullHeight,
    });
  }
  buyEquipment(kind: "kevlar" | "helmet" | "kit") {
    if (this.network) return this.network.equipment(kind);
    if (!this.canBuy() || (kind === "kit" && (this.team !== "ct" || this.defuseKit))) return false;
    if (kind !== "kit" && this.armor >= 100 && (kind === "kevlar" || this.helmet)) return false;
    const price = this.teamMode
      ? equipmentPrice(kind === "kevlar" ? "vest" : kind, this.armor, this.helmet)
      : 0;
    if (this.money < price) return false;
    this.money = addMoney(this.money, -price, this.competitive ? "competitive" : "casual");
    const before = this.groundInventory.equipmentState();
    if (kind === "kit") this.defuseKit = true;
    else {
      this.armor = 100;
      if (kind === "helmet") this.helmet = true;
    }
    this.groundInventory.equipmentPurchased(kind, price, before);
    this.updateUI();
    return true;
  }
  rewardKill(
    attacker: Bot | "player",
    victimTeam: AgentTeam,
    weapon: number,
    victim?: Bot | "player",
  ) {
    const attackerTeam = attacker === "player" ? this.team : attacker.team;
    const friendly = this.teamMode && attackerTeam === victimTeam;
    const delta = friendly ? -1 : 1;
    if (attacker === "player") this.kills += delta;
    else attacker.kills += delta;
    if (this.mode === "deathmatch") {
      const bonusPoints = this.deathmatch.bonusPoints(weapon);
      const points = deathmatchKillPoints(weapon) + bonusPoints;
      if (attacker === "player") {
        this.deathmatchScore += points;
        this.deathmatchAward = `${points} points for neutralizing an enemy with the ${weapons[weapon].name}`;
        this.deathmatchAwardUntil = this.animationTime + 2;
        if (bonusPoints > 0) {
          this.deathmatchBonusAward = bonusPoints;
          this.deathmatchBonusAwardUntil = this.animationTime + 2;
          this.soundscape.play("dm-bonus-kill");
        }
      } else attacker.deathmatchScore += points;
      if (victim !== undefined) {
        const { assister } = this.deathmatchCombat.kill(
          this.deathmatchActor(attacker),
          this.deathmatchActor(victim),
        );
        const victimName = victim === "player" ? "YOU" : victim.name;
        this.deathmatchAssisters.delete(victimName);
        if (assister !== undefined) {
          this.deathmatchAssisters.set(
            victimName,
            assister === "player" ? "YOU" : this.bots[assister].name,
          );
          if (assister === "player") {
            this.deathmatchScore += 5;
            this.deathmatchAward = `5 points for assisting in neutralizing ${victim === "player" ? playerName() : victim.name}`;
            this.deathmatchAwardUntil = this.animationTime + 2;
          } else if (this.bots[assister]) this.bots[assister].deathmatchScore += 5;
        }
      }
    }
    if (!this.teamMode) return;
    const mode = this.competitive ? "competitive" : "casual";
    const amount = friendly ? this.rules.teamKillPenalty : killReward(weapon, mode);
    if (attacker === "player") this.money = addMoney(this.money, amount, mode);
    else attacker.money = addMoney(attacker.money, amount, mode);
  }
  damageActor(
    actor: Bot | "player",
    damage: number,
    data: { head?: boolean; height?: number; crouch?: boolean },
    weapon: number,
    attackerTeam: AgentTeam,
    kind: "bullet" | "other" = "bullet",
    attacker: Bot | "player" = "player",
  ) {
    const victim = actor === "player" ? this : actor;
    if (this.mode === "deathmatch" && actor !== "player" && actor.spawnProtection > 0) return;
    if (this.teamMode && victim.team === attackerTeam)
      damage *= friendlyFireScale(this.competitive ? "competitive" : "casual", kind);
    const region = hitRegion(!!data.head, data.height ?? 1.1, data.crouch);
    const result = applyArmorDamage(
      damage,
      region,
      victim.armor,
      victim.helmet,
      isKnife(weapon) ? 1.7 : weapons[weapon].armorRatio,
    );
    if (actor === "player" && result.healthDamage > 0) this.groundInventory.invalidateEquipment();
    victim.armor = result.armor;
    victim.health = Math.max(0, victim.health - Math.floor(result.healthDamage));
    this.recordDeathDamage(actor, attacker, Math.floor(result.healthDamage));
  }
  private deathmatchActor(actor: Bot | "player") {
    return actor === "player" ? "player" : this.bots.indexOf(actor);
  }
  recordDeathDamage(victim: Bot | "player", attacker: Bot | "player", damage: number) {
    if (victim === attacker) return;
    if (this.mode === "deathmatch") {
      this.deathmatchCombat.record(
        this.deathmatchActor(victim),
        this.deathmatchActor(attacker),
        damage,
      );
    }
    if (victim === "player" && attacker !== "player")
      this.deathDamage.record(`bot:${this.bots.indexOf(attacker)}`, "taken", damage);
    else if (attacker === "player" && victim !== "player")
      this.deathDamage.record(`bot:${this.bots.indexOf(victim)}`, "given", damage);
  }
  updateBuyMenu() {
    this.groundInventory.updateEquipmentRefunds();
    this.utility.updateBuyMenu();
    el("loadout").dataset.layout = "columns";
    el("loadout").dataset.team = this.team;
    el("loadout").dataset.practice = String(!this.teamMode);
    const allowed = this.canBuy();
    const indices = this.inventory();
    setText(
      "buy-money",
      this.teamMode
        ? `$${this.money.toLocaleString()}`
        : this.mode === "deathmatch"
          ? "DEATHMATCH LOADOUT"
          : "FREE PRACTICE LOADOUT",
    );
    const seconds = Math.max(0, Math.ceil(this.buyRemaining));
    setText(
      "buy-rules",
      !this.teamMode
        ? this.mode === "deathmatch"
          ? "Choose weapons during spawn protection"
          : "Practice - Unlimited buying"
        : `Buy Time Remaining  ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
    );
    setText("buy-wallet", this.teamMode ? `$${this.money.toLocaleString()}` : "");
    const nearby = this.groundInventory.drops.filter(
      (drop) => drop.mesh.position.distanceToSquared(this.position) < 36,
    );
    const dropped = el("buy-dropped-items");
    dropped.parentElement!.classList.toggle("hidden", this.mode === "deathmatch");
    const signature = nearby.map((drop) => drop.id).join(",");
    if (dropped.dataset.items !== signature) {
      dropped.dataset.items = signature;
      dropped.innerHTML = nearby
        .map(
          (drop) =>
            `<div title="${weapons[drop.id].name} - Pick up nearby with E"><img src="${weaponBuyIcon(drop.id)}" alt="${weapons[drop.id].name}"></div>`,
        )
        .join("");
    }
    el("buy-dropped-items").parentElement!.classList.toggle("has-drops", nearby.length > 0);
    for (const button of document.querySelectorAll<HTMLButtonElement>("#loadout [data-weapon]")) {
      const index = Number(button.dataset.weapon);
      button.title =
        this.mode === "deathmatch"
          ? "Click to buy and equip."
          : "Click to buy and equip. Cmd/Ctrl-click to buy and drop.";
      const owned = indices.includes(index);
      const available =
        !this.teamMode ||
        isKnife(index) ||
        (weaponAvailable(index, this.team) && this.groundInventory.allowed(index));
      button.hidden = !available;
      const loadout = this.groundInventory.roundLoadout ?? this.groundInventory.loadouts[this.team];
      button.parentElement!.style.order = String(loadout.indexOf(index));
      button.dataset.slot = String(
        loadout.filter((id) => loadoutCategory(id) === loadoutCategory(index)).indexOf(index) + 1,
      );
      const price = this.teamMode && !isKnife(index) ? weaponPrice(index) : 0;
      button.classList.toggle("owned", owned);
      button.disabled = !owned && !isKnife(index) && (!available || !allowed || this.money < price);
      button.querySelector(".buy-state")!.textContent = price
        ? `$${price.toLocaleString()}`
        : "FREE";
      button.setAttribute(
        "aria-label",
        `${weapons[index].name} - ${owned ? "Owned, equip" : price ? `$${price}, buy` : "Free, equip"}`,
      );
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-refund]")) {
      button.hidden = !this.groundInventory.canRefund(Number(button.dataset.refund));
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-equipment]")) {
      const kind = button.dataset.equipment as "kevlar" | "helmet" | "kit";
      button.hidden = kind === "kit" && this.team === "t";
      const owned =
        kind === "kit" ? this.defuseKit : this.armor >= 100 && (kind === "kevlar" || this.helmet);
      const price = this.teamMode
        ? equipmentPrice(kind === "kevlar" ? "vest" : kind, this.armor, this.helmet)
        : 0;
      button.disabled =
        owned || !allowed || this.money < price || (kind === "kit" && this.team !== "ct");
      button.querySelector("small")!.textContent = owned ? "EQUIPPED" : `$${price}`;
    }
  }
  equip(index: number) {
    if (index !== this.selected) this.emptyClick = undefined;
    this.bombSelected = this.bombAutoSelected = false;
    this.bombDrawTime = 0;
    if (this.network && !this.network.applying) {
      this.utility.cancelThrow();
      this.utility.selected = null;
      this.network.request.select = index;
      return;
    }
    if (!this.inventory().includes(index)) return;
    this.healthshotAction.cancel();
    this.suppressors[this.selected].cancel();
    this.utility.cancelThrow();
    this.utility.selected = null;
    this.burstRemaining = 0;
    this.revolverCharge = 0;
    this.alternateShot = false;
    this.lastShot = this.emptyReload = false;
    this.knifeTime = this.inspectTime = this.weaponTime = 0;
    this.inspectRewinding = false;
    this.knifeAlternate = true;
    this.knifeContact = false;
    this.shotTime = 0;
    this.knifePending = false;
    this.setScope(0);
    this.rescope = this.boltTime = 0;
    this.magazines[this.selected] = { ammo: this.ammo, reserve: this.reserve };
    this.selected = index;
    this.ammo = this.magazines[index].ammo;
    this.reserve = this.magazines[index].reserve;
    this.reload = 0;
    this.magazineInserted = false;
    this.shots = 0;
    this.drawTime = weaponDrawDuration(this.selected);
    this.cooldown = Math.max(
      weapons[index].deploy,
      this.weaponCooldowns[index],
      this.reloadLockouts[index],
    );
    if (weapons[index].unzoomsAfterShot && this.weaponCooldowns[index] > 0)
      this.boltTime = this.weaponCooldowns[index];
    // View models are cached per team and weapon; animateGun fully re-poses them.
    unregisterGloveModel(this.gun);
    bindWeaponInstance(this.gun, null);
    this.view.remove(this.gun);
    this.gun = this.viewGun(index);
    bindWeaponInstance(this.gun, this.groundInventory.playerWeapon(index));
    this.flash.position.copy(this.gun.userData.muzzle);
    this.gun.add(this.flash);
    this.view.add(this.gun);
    this.textureViewCheck = -Infinity;
    this.updateTextureQuality();
    this.setScope(0);
    if (this.active) {
      this.animationSounds("draw", -1, 0);
    }
    this.updateUI();
  }
  updateInventory() {
    const observer =
      this.dead && this.teamMode && this.spectatorMode === "first" ? this.spectated : undefined;
    const remote = observer ? this.network?.stateForBot(observer) : undefined;
    const selected = observer?.rig.weaponIndex ?? this.selected;
    const instances = (index: number) =>
      remote?.appearances[index] ??
      (observer?.rig.weaponIndex === index
        ? observer.rig.weaponInstance
        : this.groundInventory.playerWeapon(index));
    const indices = remote
      ? [
          remote.primary,
          remote.magazines[remote.secondary] ? remote.secondary : null,
          remote.knife,
        ].filter((id): id is number => id !== null)
      : observer
        ? [...new Set([selected, 4])]
        : this.inventory();
    const inventory =
      remote?.grenades ??
      (observer
        ? (this.utility.botInventories.get(this.bots.indexOf(observer)) ?? this.utility.inventory)
        : this.utility.inventory);
    const utility = observer ? null : (this.utility.selected ?? this.utility.throwingKind);
    const owned = grenadeTypes.filter((kind) => inventory[kind] > 0);
    const healthshots =
      this.mode === "deathmatch" && !observer
        ? this.deathmatchCombat.life("player").healthshots
        : 0;
    const healthshot = !observer && this.healthshotAction.selected;
    const signature = `${indices.map((id) => `${id}:${instances(id).serial}:${instances(id).skin.id}`).join(",")}:${this.carryingBomb}:${this.bombSelected}:${utility ?? selected}:${owned.map((kind) => `${kind}:${inventory[kind]}`).join(",")}:${healthshots}:${healthshot}`;
    if (signature === this.inventorySignature) return;
    this.inventorySignature = signature;
    const fragment = document.createDocumentFragment();
    for (const index of indices) {
      const slot = weaponSlot(index);
      const row = document.createElement("div");
      const active = !this.bombSelected && !utility && !healthshot && index === selected;
      row.className = `inventory-weapon ${active ? "active" : ""}`;
      row.dataset.weaponIndex = String(index);
      row.setAttribute("role", "listitem");
      row.setAttribute(
        "aria-label",
        `${weaponInstanceName(instances(index))}${active ? ", equipped" : ""}`,
      );
      if (active) row.setAttribute("aria-current", "true");
      const image = document.createElement("img");
      const silhouette = isKnife(index)
        ? assetUrl(`/icons/${weaponIcons[index]}.png`)
        : weaponBuyIcon(index);
      image.alt = "";
      image.src = silhouette;
      const art = document.createElement("span");
      art.className = "inventory-art";
      art.append(image);
      const key = document.createElement("span");
      key.className = "inventory-key";
      key.textContent = String(slot);
      const name = document.createElement("span");
      name.className = "inventory-name";
      name.textContent = weaponInstanceName(instances(index));
      row.append(art, key, name);
      fragment.append(row);
    }
    if (healthshots) {
      const row = document.createElement("div");
      row.className = `inventory-weapon inventory-healthshot ${healthshot ? "active" : ""}`;
      row.dataset.healthshot = String(healthshots);
      row.setAttribute("role", "listitem");
      row.setAttribute(
        "aria-label",
        `Medi-Shot, ${healthshots} available${healthshot ? ", equipped" : ""}`,
      );
      if (healthshot) row.setAttribute("aria-current", "true");
      const art = document.createElement("span");
      art.className = "inventory-art";
      const image = document.createElement("img");
      image.src = assetUrl("/icons/buy/healthshot.svg");
      image.alt = "";
      art.append(image);
      const key = document.createElement("span");
      key.className = "inventory-key";
      key.textContent = keyLabel(this.settings.bindings.KeyX);
      const name = document.createElement("span");
      name.className = "inventory-name";
      name.textContent = `Medi-Shot${healthshots > 1 ? ` ×${healthshots}` : ""}`;
      row.append(art, key, name);
      fragment.append(row);
    }
    if (owned.length) {
      const row = document.createElement("div");
      row.className = `inventory-weapon inventory-grenades ${utility ? "active" : ""}`;
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-label", "Grenades");
      const icons = document.createElement("div");
      icons.className = "inventory-grenade-icons";
      for (const kind of owned) {
        const item = document.createElement("span");
        item.className = `inventory-grenade ${utility === kind ? "active" : ""}`;
        item.dataset.grenadeKind = kind;
        item.dataset.count = String(inventory[kind]);
        item.setAttribute("role", "img");
        item.setAttribute(
          "aria-label",
          `${grenadeData[kind].name}, ${inventory[kind]} owned${utility === kind ? ", equipped" : ""}`,
        );
        if (utility === kind) item.setAttribute("aria-current", "true");
        const art = document.createElement("span");
        art.className = "inventory-art inventory-grenade-art";
        const image = document.createElement("img");
        image.alt = "";
        image.src = assetUrl(`/icons/buy/${grenadeIcons[kind]}.svg`);
        art.append(image);
        item.append(art);
        if (inventory[kind] > 1) {
          const count = document.createElement("small");
          count.textContent = String(inventory[kind]);
          item.append(count);
        }
        icons.append(item);
      }
      const key = document.createElement("span");
      key.className = "inventory-key";
      key.textContent = "4";
      const name = document.createElement("span");
      name.className = "inventory-name";
      name.textContent = utility ? grenadeData[utility].name : "Grenades";
      row.append(icons, key, name);
      fragment.append(row);
    }
    if (!observer && this.carryingBomb) {
      const row = document.createElement("div");
      row.className = `inventory-weapon ${this.bombSelected ? "active" : ""}`;
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-label", `C4${this.bombSelected ? ", equipped" : ""}`);
      if (this.bombSelected) row.setAttribute("aria-current", "true");
      row.innerHTML = `<span class="inventory-art"><img src="${assetUrl("/icons/buy/c4.svg")}" alt=""></span><span class="inventory-key">5</span><span class="inventory-name">C4</span>`;
      fragment.append(row);
    }
    el("inventory").replaceChildren(fragment);
  }

  fireKnife(stab = false) {
    if (this.healthshotAction.selected) return;
    if (this.bombSelected) return;
    if (this.network) {
      if (stab) this.network.request.stab = true;
      else this.network.request.fire = true;
      return;
    }
    if (
      !this.active ||
      !this.locked ||
      this.dead ||
      !isKnife(this.selected) ||
      this.cooldown > 0 ||
      this.weaponsFrozen
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
    this.knifeContact = false;
    this.knifeFirstSwing = this.animationTime - this.knifeLastAttack > 0.9;
    this.knifeLastAttack = this.animationTime;
    this.knifeDuration = weaponKnifeAttackDuration(this.selected, stab, this.knifeAlternate);
    this.knifeTime = this.knifeDuration;
    this.knifePending = true;
    this.cooldown = stab ? 1 : 0.4;
    for (let index = 0; index < weapons.length; index++)
      if (isKnife(index)) this.weaponCooldowns[index] = this.cooldown;
    this.soundscape.play(this.knifeAlternate ? "knife-swing1" : "knife-swing2");
  }
  meleeHit(stab: boolean) {
    this.updateAimCamera();
    this.ray.set(
      this.camera.position,
      new T.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion),
    );
    this.ray.far = knifeRange(stab);
    let impact = this.meleeTrace();
    if (!impact) {
      // Short fan approximates the forgiving melee hull while each candidate
      // remains cover-occluded. A central wall hit never searches around it.
      const direction = this.ray.ray.direction.clone();
      for (const [x, y] of [
        [-0.12, 0],
        [0.12, 0],
        [0, -0.12],
        [0, 0.12],
      ]) {
        this.ray.ray.direction.set(x, y, -1).normalize().applyQuaternion(this.camera.quaternion);
        const candidate = this.meleeTrace();
        if (
          candidate &&
          candidate.actor !== undefined &&
          (!impact || candidate.distance < impact.distance)
        )
          impact = candidate;
      }
      this.ray.ray.direction.copy(direction);
    }
    if (!impact) return;
    this.knifeContact = true;
    const index = impact.actor;
    if (index === undefined) {
      if (impact.breakableId) {
        const point = this.ray.ray.at(impact.distance, new T.Vector3());
        this.damageMapBreakable(
          impact.breakableId,
          knifeDamage(stab, this.knifeFirstSwing, false),
          "melee",
          point,
          this.ray.ray.direction,
        );
      }
      if (impact.doorId) {
        this.world.doors.damage(
          impact.doorId,
          knifeDamage(stab, this.knifeFirstSwing, false),
          "melee",
        );
        this.syncMapDoors();
      }
      this.soundscape.play("knife-wall");
      return;
    }
    const b = this.bots[index];
    if (this.mode === "casual" && b.team === this.team) return;
    // A narrow, non-penetrating melee trace: solid cover always blocks it.
    const back = knifeBackstab(this.position, b.group.position, b.group.rotation.y);
    const damage = knifeDamage(stab, this.knifeFirstSwing, back);
    this.damageActor(b, damage, { height: 1.1 }, this.selected, this.team, "other");
    {
      const remaining = Math.max(
        0,
        (stab ? 1.1 : 0.5) - (this.animationTime - this.knifeLastAttack),
      );
      this.cooldown = remaining;
      for (let index = 0; index < weapons.length; index++)
        if (isKnife(index)) this.weaponCooldowns[index] = remaining;
    }
    this.hit = 0.13;
    this.soundscape.play(stab ? "knife-stab" : "knife-hit");
    el("hitmarker").style.color = "#fff";
    if (b.health <= 0) {
      this.rewardKill("player", b.team, this.selected, b);
      b.deaths++;
      b.speed = 0;
      b.respawn = this.teamMode ? Infinity : this.mode === "practice" ? 1.8 : 3;
      if (this.teamMode) this.dropBomb(index);
      this.feed("YOU", b.name, false, this.selected);
    }
    this.updateUI();
  }
  shellDuration() {
    return this.shellPhase === "intro"
      ? 0.4
      : this.shellPhase === "loop"
        ? weapons[this.selected].reload
        : 0.9;
  }
  reloadProgress() {
    if (weapons[this.selected].reloadStyle !== "shell")
      return 1 - this.reload / weapons[this.selected].reload;
    const phases = nativeReloadPhases(this.selected) ?? {
      introEnd: 11 / 49,
      loopEnd: 24 / 49,
      addAmmo: 20 / 49,
    };
    const start =
      this.shellPhase === "intro"
        ? 0
        : this.shellPhase === "loop"
          ? phases.introEnd
          : phases.loopEnd;
    const end =
      this.shellPhase === "intro"
        ? phases.introEnd
        : this.shellPhase === "loop"
          ? phases.loopEnd
          : 1;
    return start + (end - start) * (1 - this.reload / this.shellDuration());
  }
  queueEmptyClick(weapon: number) {
    this.emptyClick = { weapon, remaining: weapons[weapon].delay };
  }
  private updateEmptyClick(dt: number) {
    const cue = this.emptyClick;
    if (!cue) return;
    if (!this.active || this.dead || this.selected !== cue.weapon || this.ammo || this.reserve) {
      this.emptyClick = undefined;
      return;
    }
    cue.remaining -= dt;
    if (cue.remaining <= 0) {
      this.emptyClick = undefined;
      this.soundscape.play("dry-fire");
    }
  }
  beginReload() {
    if (this.healthshotAction.selected) return;
    if (this.bombSelected) return;
    if (this.network) {
      this.network.request.reload = true;
      return;
    }
    if (this.planting || this.suppressors[this.selected].action) return;
    const w = weapons[this.selected];
    if (!this.reserve && this.mode === "practice") this.reserve = w.reserve;
    if (isKnife(this.selected) || this.reload || this.ammo === w.mag || !this.reserve) {
      // Sample the same clip backwards instead of replacing it with idle.
      // Combat lockouts are independent of this cosmetic direction change.
      if (this.inspectTime > 0) this.inspectRewinding = true;
      return;
    }
    this.inspectRewinding = false;
    this.drawTime = this.inspectTime = this.shotTime = 0;
    this.lastShot = false;
    this.emptyReload = this.selected === 8 && this.ammo === 0;
    this.setScope(0);
    this.rescope = 0;
    this.burstRemaining = 0;
    this.shellPhase = "intro";
    this.shellInserted = false;
    this.magazineInserted = false;
    this.revolverCharge = 0;
    this.reload = w.reloadStyle === "shell" ? this.shellDuration() : w.reload;
    this.boltTime = 0;
    this.animationSounds("reload", -1, 0);
    this.updateUI();
  }
  sound(kind: WeaponSound | "hit" | "head", pan = 0, distance = 0, weapon = this.selected) {
    if (!this.audio || !this.noise || !this.settings.volume || !this.settings.effectsVolume) return;
    if (isKnife(weapon) && kind !== "hit" && kind !== "head" && kind !== "bot") return;
    if (kind !== "hit" && kind !== "head") {
      this.weaponAudio.play(
        this.audio,
        kind,
        weapon,
        100,
        pan,
        distance,
        undefined,
        this.isSuppressed(weapon),
      );
      return;
    }
    this.soundscape.play(kind);
  }
  worldSound(kind: "bot", position: T.Vector3, weapon = 0, suppressed = true) {
    if (!this.audio || !this.settings.volume || !this.settings.effectsVolume) return;
    const range = weaponSoundRange(weapon, suppressed).maxDistance;
    if (position.distanceToSquared(this.camera.position) > range * range) return;
    this.weaponAudio.play(this.audio, kind, weapon, 100, 0, 0, position, suppressed);
  }
  // Legacy bank has only concrete/sand CT-left clips. The actual support
  // surface travels end to end; unimported native bindings retain this explicit
  // compatibility fallback instead of guessing material families from height.
  playFootstep(
    cue: Omit<Extract<MatchEvent, { kind: "footstep" }>, "kind" | "actor">,
    firstPerson = false,
  ) {
    if (!this.audio || !this.settings.volume || !this.settings.effectsVolume) return;
    const point = new T.Vector3(cue.point.x, cue.point.y + 0.15, cue.point.z);
    if (!firstPerson && point.distanceToSquared(this.camera.position) > 35 * 35) return;
    this.soundscape.play(
      "step",
      false,
      cue.surface === "sand" ? "sand" : "concrete",
      firstPerson ? undefined : point,
    );
  }
  emitFootstep(position: T.Vector3, team: AgentTeam, side: FootstepSide, firstPerson = false) {
    const support = this.world.collision?.supportingSurface(position.x, position.z, position.y);
    if (support)
      this.playFootstep(
        {
          team,
          side,
          point: { x: position.x, y: support.height, z: position.z },
          surface: support.surface,
        },
        firstPerson,
      );
  }
  private audioSteps = new WeakMap<Bot, FootstepStride>();
  makeBot(
    index: number,
    override?: AgentTeam,
    appearance?: Parameters<typeof createSoldier>[2],
  ): Bot {
    const team =
      override ??
      (this.mode === "deathmatch"
        ? index % 2 === 0
          ? "ct"
          : "t"
        : this.teamMode && index >= this.teamSize
          ? this.team
          : this.team === "ct"
            ? "t"
            : "ct");
    const rig = createSoldier(index, team, appearance, !this.network, defaultGloveChoice());
    this.scene.add(rig.group);
    return {
      name: names[index],
      aimPunch: createAimPunch(),
      weaponRecoil: createWeaponRecoil(),
      weaponAccuracy: createWeaponAccuracy(),
      recoilWeapon: team === "t" ? 7 : 2,
      team,
      target: null,
      memory: new T.Vector3(),
      lastSight: new T.Vector3(),
      suppressTime: 0,
      suppressShots: 0,
      aim: new T.Vector3(),
      cover: new T.Vector3(),
      report: 0,
      tactic: 0,
      reposition: false,
      ammo: 12,
      reserve: 48,
      reloadTime: 0,
      burst: 0,
      alert: 0,
      stuck: 0,
      progressTime: 0,
      progressPosition: new T.Vector3(),
      recoveries: 0,
      quiet: 0,
      regrouping: false,
      goal: new T.Vector3(),
      vertical: 0,
      ladderState: createLadderState(),
      navCrouch: false,
      blockedAreas: new Set(),
      navArea: 0,
      group: rig.group,
      rig,
      speed: 0,
      moving: false,
      tracking: false,
      health: 100,
      armor: 0,
      helmet: false,
      defuseKit: false,
      money: 0,
      kills: 0,
      deaths: 0,
      respawn: 0,
      spawnProtection: 0,
      deathmatchScore: 0,
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
  spawnBot(b: Bot, index: number, preserve = false) {
    this.audioSteps.delete(b);
    if (this.mode === "deathmatch") this.deathmatchCombat.spawn(index);
    const saved = preserve
      ? {
          weapon: b.rig.weaponIndex,
          instance: b.rig.weaponInstance,
          suppressed: b.rig.suppressed,
          armor: b.armor,
          helmet: b.helmet,
          kit: b.defuseKit,
        }
      : null;
    const deathmatchSpawn = this.deathmatchSpawn(b.group.position, b);
    if (deathmatchSpawn) {
      b.group.position.copy(deathmatchSpawn);
      b.group.rotation.y = Math.random() * Math.PI * 2;
      b.navArea = this.world.navigation.nearest(b.group.position);
    } else if (this.dust) {
      const points = this.dust.navigation.data.spawns[b.team];
      const slot =
        this.bots.slice(0, index).filter((bot) => bot.team === b.team).length +
        (b.team === this.team ? 1 : 0);
      b.group.position.fromArray(points[slot % points.length]);
      groundSpawn(b.group.position, this.dust.collision);
      b.navArea = this.dust.navigation.nearest(b.group.position);
    }
    b.target = null;
    b.aim.copy(b.group.position).add(new T.Vector3(0, 1.3, 3));
    b.cover.copy(b.group.position);
    b.report = b.tactic = b.reloadTime = b.burst = b.suppressTime = b.suppressShots = 0;
    b.lastSight.copy(b.group.position);
    b.reposition = false;
    const weapon =
      saved?.weapon ??
      (this.mode === "deathmatch"
        ? [b.team === "t" ? 0 : 1, 3, 8, 10, b.team === "t" ? 26 : 11][index % 5]
        : b.team === "t"
          ? 7
          : 2);
    b.aimPunch = createAimPunch();
    b.weaponRecoil = createWeaponRecoil();
    b.weaponAccuracy = createWeaponAccuracy();
    b.recoilWeapon = weapon;
    b.ammo = weapons[weapon].mag;
    b.reserve = weapons[weapon].reserve;
    b.armor = this.teamMode ? (this.rules.freeArmor ? 100 : (saved?.armor ?? 0)) : 100;
    b.helmet = this.teamMode ? this.rules.freeArmor || saved?.helmet || false : true;
    b.defuseKit = (this.teamMode && b.team === "ct" && this.rules.freeKit) || saved?.kit || false;
    b.alert = b.stuck = 0;
    b.progressTime = b.recoveries = b.quiet = 0;
    b.regrouping = false;
    b.progressPosition.copy(b.group.position);
    b.goal.copy(b.group.position);
    b.vertical = 0;
    b.ladderState = createLadderState();
    b.navCrouch = false;
    b.blockedAreas.clear();
    b.health = 100;
    b.speed = 0;
    b.moving = b.tracking = false;
    resetSoldier(b.rig);
    b.anim = 0;
    b.velocity.set(0, 0);
    b.facing = b.group.rotation.y;
    b.respawn = 0;
    b.spawnProtection = this.mode === "deathmatch" ? 10 : 0;
    b.group.visible = true;
    setSoldierWeapon(
      b.rig,
      weapon,
      saved?.suppressed ?? true,
      saved?.instance ?? createWeaponInstance(weapon, `bot:${index}`),
    );
    b.buyTime = this.mode === "practice" ? Infinity : 2 + (index % 7) * 0.3;
    b.shot = 0.8 + Math.random();
    b.reaction = 0.7;
    b.path = [];
    b.nav = 0;
  }
  findPath(from: T.Vector3, to: T.Vector3) {
    return this.world.navigation.path(from, to);
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
  muzzlePosition() {
    const muzzle = (this.gun.userData.muzzle as T.Vector3).clone();
    if (this.scopeLevel && weapons[this.selected].zoomLevels > 1) muzzle.set(0, -0.02, -0.25);
    else {
      this.gun.localToWorld(muzzle);
      // Match the viewmodel's on-screen barrel despite its independent FOV.
      viewmodelPointToWorld(muzzle, this.viewCamera, this.camera);
      if (!this.visible(this.camera.position, muzzle)) muzzle.copy(this.camera.position);
      return muzzle;
    }
    muzzle.applyQuaternion(this.camera.quaternion).add(this.camera.position);
    if (!this.visible(this.camera.position, muzzle)) muzzle.copy(this.camera.position);
    return muzzle;
  }
  trace(
    from: T.Vector3,
    to: T.Vector3,
    weapon: number,
    suppressed = weapon === this.selected ? this.isSuppressed(weapon) : weapons[weapon].suppressed,
  ) {
    this.utility.bullet(from, to);
    if (suppressed) return;
    const distance = from.distanceTo(to);
    if (distance < 0.01) return;
    let tracer = this.tracers.find((t) => t.life <= 0);
    if (!tracer && this.tracers.length >= 32)
      tracer = this.tracers.reduce((a, b) => (b.life < a.life ? b : a));
    if (!tracer) {
      tracer = createTracer();
      this.tracers.push(tracer);
      this.scene.add(tracer.mesh);
    }
    launchTracer(tracer, from, to, weapon);
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
  syncDoorAudio(silent = false) {
    const doors = this.world?.doors;
    if (doors)
      this.doorAudio.observe(
        doors.definitions,
        doors.states,
        (definition, kind) => this.doorAudio.play(this.soundscape, definition, kind),
        silent,
      );
  }
  syncMapDoors() {
    const world = this.world;
    if (world?.doors && world.doorView?.sync(world.doors.states))
      world.sun.shadow.needsUpdate = true;
  }
  private updateMapDoors(dt: number) {
    const world = this.world;
    if (!this.active || world !== this.dust || !world.doors?.states.length) return;
    let count = 0;
    const append = (position: T.Vector3, height: number) => {
      const actor = (this.doorActors[count++] ??= { x: 0, y: 0, z: 0, height });
      actor.x = position.x;
      actor.y = position.y;
      actor.z = position.z;
      actor.height = height;
    };
    if (!this.dead) append(this.position, this.hullHeight);
    for (const bot of this.bots)
      if (bot.health > 0) append(bot.group.position, this.botHullHeight(bot));
    this.doorActors.length = count;
    const objectiveUse =
      (this.carryingBomb &&
        mapTriggers(world).bombSites.contains(this.position, {
          halfWidth: movement.hullRadius,
          height: this.hullHeight,
        })) ||
      (this.bomb?.planted &&
        this.team === "ct" &&
        this.position.distanceTo(this.bomb.position) < 1.8);
    this.doorFrom.copy(this.position);
    this.doorFrom.y += this.eye;
    this.doorDirection.set(0, 0, -1).applyEuler(this.doorAim.set(this.viewPitch, this.yaw, 0));
    if (
      world.doors.use(
        "player",
        this.keys.has("KeyE"),
        this.doorFrom,
        this.doorDirection,
        !this.dead && this.locked && this.freezeTime <= 0 && !this.halftime && !objectiveUse,
      )
    )
      this.doorUseConsumed = true;
    world.doors.step(dt, this.doorActors);
    this.syncDoorAudio();
    this.syncMapDoors();
  }
  syncMapBreakables(animate = false, point?: T.Vector3, direction?: T.Vector3) {
    const world = this.world;
    if (!world) return;
    const broken = world.breakableView.sync(world.breakables.states, animate, point, direction);
    if (world.breakableView.visibilityChanged) world.sun.shadow.needsUpdate = true;
    for (const definition of broken) {
      const position =
        point ??
        new T.Vector3()
          .fromArray(definition.bounds[0])
          .add(new T.Vector3().fromArray(definition.bounds[1]))
          .multiplyScalar(0.5);
      this.propBreakAudio.play(this.soundscape, definition, position);
    }
  }
  damageMapBreakable(
    id: string,
    damage: number,
    kind: BreakableDamageKind,
    point?: T.Vector3,
    direction?: T.Vector3,
  ) {
    if (this.network) return false;
    const change = this.world.breakables.damage(id, damage, kind);
    if (change) this.syncMapBreakables(true, point, direction);
    return !!change?.broken;
  }
  // Cover remains authoritative; animated actors use separate small hitboxes.
  coverTargets() {
    const targets = this.targets;
    targets.length = 0;
    for (const solid of this.world.solids) {
      solid.updateWorldMatrix(true, false);
      targets.push(solid);
    }
    return targets;
  }
  meleeTrace() {
    const cover = this.ray.intersectObjects(this.coverTargets(), true)[0];
    let nearest:
      | { distance: number; actor?: number; breakableId?: string; doorId?: string }
      | undefined = cover
      ? {
          distance: cover.distance,
          breakableId: this.world.breakables.idForImpact(cover),
          doorId: this.world.doors.idForImpact(cover),
        }
      : undefined;
    this.bots.forEach((bot, index) => {
      if (bot.health <= 0) return;
      const hit = soldierHit(bot.rig, this.ray.ray, nearest?.distance ?? this.ray.far);
      if (!hit) return;
      const distance = hit.point.distanceTo(this.ray.ray.origin);
      if (!nearest || distance < nearest.distance) nearest = { distance, actor: index };
    });
    return nearest;
  }
  bulletCover(impact: T.Intersection, ray: T.Ray): BulletSurface<BulletImpactData> {
    // MapCollision already reports world normals; ordinary mesh picking uses
    // local normals and needs the world transform exactly once.
    const normal = impact.face?.normal.clone();
    const breakableId = this.world.breakables.idForImpact(impact);
    const doorId = this.world.doors.idForImpact(impact);
    if (normal && !this.world.collision) normal.transformDirection(impact.object.matrixWorld);
    return {
      distance: impact.distance,
      thickness: () =>
        this.world.collision
          ? this.world.collision.thickness(impact, ray.direction)
          : meshThickness(impact, ray),
      material: impact.object.userData.bulletMaterial || "concrete",
      id: breakableId
        ? `breakable:${breakableId}`
        : doorId
          ? `door:${doorId}`
          : this.world.collision
            ? undefined
            : `solid:${impact.object.uuid}`,
      exit: normal ? normal.dot(ray.direction) > 0 : false,
      data: { point: impact.point, normal, breakableId, doorId },
    };
  }
  bulletBody(
    actor: number | "player",
    point: T.Vector3,
    head: boolean,
    ray: T.Ray,
    hitHeight?: number,
  ): BulletSurface<BulletImpactData> {
    const bot = typeof actor === "number" ? this.bots[actor] : undefined;
    const feet = bot ? bot.group.position : this.position;
    return {
      distance: point.distanceTo(ray.origin),
      thickness: fleshThickness(ray.direction, bot ? bot.group.rotation.y : this.yaw, head),
      material: "flesh",
      stop: this.mode === "casual" && !!bot && bot.team === this.team,
      id: `actor:${actor}`,
      data: {
        point,
        actor,
        head,
        height: hitHeight ?? (bot ? soldierHitHeight(bot.rig, point) : point.y - feet.y),
        crouch: actor === "player" && this.crouching,
      },
    };
  }
  fire(continuingBurst = false, alternate = false) {
    if (this.healthshotAction.selected) {
      this.useHealthshot();
      return;
    }
    if (this.bombSelected) return;
    if (this.network) {
      this.network.request.fire = true;
      this.network.request.alternate = alternate;
      return;
    }
    if (this.utility.selected || this.utility.throwingKind) return;
    if (
      this.reload &&
      weapons[this.selected].reloadStyle === "shell" &&
      this.ammo > 0 &&
      this.active &&
      this.locked &&
      !this.dead
    ) {
      this.reload = 0;
    }
    if (
      this.dead ||
      !this.active ||
      this.reload ||
      this.cooldown > 0 ||
      !this.locked ||
      this.suppressors[this.selected].action
    )
      return;
    if (
      this.teamMode &&
      (this.weaponsFrozen ||
        this.bomb?.defuser === "player" ||
        (this.bomb?.carrier === "player" && this.bomb.plantProgress > 0))
    )
      return;
    if (isKnife(this.selected)) {
      this.fireKnife();
      return;
    }
    if (!this.ammo) {
      this.beginReload();
      return;
    }
    if (this.selected === 17 && !alternate && this.revolverCharge < REVOLVER_COCK_TIME) {
      if (!this.revolverCharge) {
        this.revolverCharge = Number.EPSILON;
        this.inspectTime = this.shotTime = 0;
        this.soundscape.play("revolver-prepare");
      }
      return;
    }
    this.drawTime = 0;
    this.alternateShot =
      this.selected === 17 ? alternate : this.selected === 18 && this.ammo % 2 === 0;
    this.revolverCharge = 0;
    this.updateAimCamera(1);
    const w = weapons[this.selected];
    this.lastShot = this.selected === 8 && this.ammo === 1;
    this.emptyReload = false;
    this.ammo--;
    if (!this.ammo && !this.reserve) this.queueEmptyClick(this.selected);
    if (this.burstMode) {
      this.burstRemaining = continuingBurst
        ? Math.max(0, this.burstRemaining - 1)
        : Math.min(2, this.ammo);
    }
    const shotDelay = this.selected === 17 && alternate ? w.alternateDelay : w.delay;
    // Burst cycle starts with the first bullet; internal shots do not reset it.
    if (!continuingBurst)
      this.weaponCooldowns[this.selected] = this.burstMode ? w.burstCycle : shotDelay;
    this.cooldown = this.burstMode
      ? this.burstRemaining
        ? w.burstSpacing
        : this.weaponCooldowns[this.selected]
      : shotDelay;
    this.shots = this.weaponRecoil[this.selected].index + 1;
    this.kick = 0.07;
    this.inspectTime = 0;
    this.shotTime = weapons[this.selected].unzoomsAfterShot
      ? 0
      : nativeShotDuration(this.selected, this.alternateShot, this.lastShot);
    const recoilMode =
      this.burstMode ||
      this.scopeLevel > 0 ||
      this.isSuppressed(this.selected) ||
      (this.selected === 17 && alternate)
        ? 1
        : 0;
    const accuracyPose = this.playerAccuracyPose(this.selected, recoilMode);
    const inaccuracy = weaponInaccuracy(
      this.selected,
      this.weaponAccuracy[this.selected],
      accuracyPose,
    );
    const stats = ballistics[this.selected];
    const offsets = weaponShotSpread(
      this.selected,
      recoilMode,
      this.weaponRecoil[this.selected].index,
      inaccuracy,
      w.pellets,
    );
    for (const offset of offsets) {
      const direction = new T.Vector3(offset.x, offset.y, -1)
        .normalize()
        .applyQuaternion(this.camera.quaternion);
      this.ray.set(this.camera.position, direction);
      this.ray.far = stats.range / SOURCE_UNITS_PER_METER;
      const impacts = this.ray.intersectObjects(this.coverTargets(), true);
      const surfaces: BulletSurface<BulletImpactData>[] = [];
      for (const impact of impacts) {
        surfaces.push(this.bulletCover(impact, this.ray.ray));
      }
      this.bots.forEach((bot, index) => {
        if (bot.health <= 0) return;
        const hit = soldierHit(bot.rig, this.ray.ray, this.ray.far);
        if (hit)
          surfaces.push(this.bulletBody(index, hit.point, hit.head, this.ray.ray, hit.height));
      });
      const result = solveBullet(stats, surfaces);
      if (this.world === this.dust) this.dust.ball.shoot(this.ray.ray, result.endDistance);
      const end = this.camera.position.clone().addScaledVector(direction, result.endDistance);
      const damagedBreakables = new Set<string>();
      for (const { surface, damage, passed } of result.contacts) {
        const data = surface.data;
        if (data.doorId) {
          this.world.doors.damage(data.doorId, damage, "bullet");
          this.syncMapDoors();
        }
        if (data.breakableId && !damagedBreakables.has(data.breakableId)) {
          damagedBreakables.add(data.breakableId);
          this.damageMapBreakable(data.breakableId, damage, "bullet", data.point, direction);
        }
        if (typeof data.actor === "number") {
          const index = data.actor;
          const b = this.bots[index];
          if (this.mode === "casual" && b.team === this.team) continue;
          const head = data.head!;
          const multiplier = hitgroupMultiplier(head, data.height!, w.head, data.crouch);
          this.damageActor(b, damage * multiplier, data, this.selected, this.team);
          b.memory.copy(this.position);
          b.alert = 5;
          b.tactic = 0;
          b.facing = Math.atan2(
            this.position.x - b.group.position.x,
            this.position.z - b.group.position.z,
          );
          this.hit = 0.13;
          this.sound(head ? "head" : "hit");
          el("hitmarker").style.color = head ? "#efac51" : "#fff";
          if (b.health <= 0) {
            this.rewardKill("player", b.team, this.selected, b);
            b.deaths++;
            b.speed = 0;
            b.respawn = this.teamMode ? Infinity : this.mode === "practice" ? 1.8 : 3;
            if (this.teamMode) this.dropBomb(index);
            this.feed(
              "YOU",
              b.name,
              head,
              this.selected,
              weapons[this.selected].zoomLevels > 1 && !this.scopeLevel,
              passed,
            );
          }
        } else if (
          data.normal &&
          (!data.breakableId || this.world.breakables.health(data.breakableId)! > 0)
        ) {
          this.decal(decalPoint.copy(data.point).addScaledVector(direction, -0.015), data.normal);
        }
      }
      const muzzle = this.muzzlePosition();
      this.trace(muzzle, end, this.selected);
    }
    applyFiringInaccuracy(
      this.weaponAccuracy[this.selected],
      this.selected,
      recoilMode,
      accuracyPose,
    );
    applyWeaponRecoil(this.aimPunch, this.weaponRecoil[this.selected], this.selected, recoilMode);
    this.updateAimCamera();
    this.sound("shot");
    if (weapons[this.selected].unzoomsAfterShot) {
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
    label?: string,
    metadata?: {
      appearance?: import("./weapon-instance").WeaponInstance;
      killerTeam?: AgentTeam;
      victimTeam?: AgentTeam;
      killerId?: string;
      killerAvatar?: string;
    },
  ) {
    if (!this.network && this.teamMode && !this.roundPause && !this.freezeTime) {
      const id: RoundActor =
        killer === "YOU" ? "player" : this.bots.findIndex((bot) => bot.name === killer);
      const killerTeam = id === "player" ? this.team : this.bots[id]?.team;
      const victimTeam =
        victim === "YOU" ? this.team : this.bots.find((bot) => bot.name === victim)?.team;
      if (killerTeam && victimTeam && killerTeam !== victimTeam) {
        const stats = this.roundHighlights.get(id) ?? { headshots: 0, knives: 0, grenades: 0 };
        if (head) stats.headshots++;
        if (weapon >= 0 && isKnife(weapon)) stats.knives++;
        if (label) stats.grenades++;
        this.roundHighlights.set(id, stats);
        this.roundFirstKill ??= {
          name: killer === "YOU" ? playerName() : killer,
          seconds: this.roundElapsed,
        };
      }
    }
    const environmentDeath = killer === "World" && weapon < 0 && !label;
    const utilityKind = grenadeTypes.find((kind) => grenadeData[kind].name === label);
    const killerInstance =
      metadata?.appearance ??
      (killer === "YOU"
        ? this.groundInventory.playerWeapon(weapon >= 0 ? weapon : this.selected)
        : this.bots.find((bot) => bot.name === killer)?.rig.weaponInstance);
    const weaponName =
      label ??
      (weapon < 0
        ? environmentDeath
          ? "World"
          : "C4"
        : killerInstance?.weapon === weapon
          ? weaponInstanceName(killerInstance)
          : weapons[weapon].name);
    const nativeIcons: Record<string, string> = {
      "ak-47": "ak47",
      "m4a1-s": "m4a1_silencer",
      "usp-s": "usp_silencer",
      m4a4: "m4a1",
    };
    const weaponIcon =
      weapon >= 0
        ? isKnife(weapon)
          ? `/icons/${weaponIcons[weapon]}.png`
          : `/icons/buy/${nativeIcons[weaponIcons[weapon]] ?? weaponIcons[weapon]}.svg`
        : `/icons/buy/${utilityKind ? grenadeIcons[utilityKind] : "c4"}.svg`;
    if (victim === "YOU") {
      const killerBot = this.bots.findIndex((b) => b.name === killer);
      const killerTeam = metadata?.killerTeam ?? this.bots[killerBot]?.team ?? "t";
      showDeathcam(
        this.deathDamage.exchange(metadata?.killerId ?? `bot:${killerBot}`),
        metadata?.killerAvatar ?? botPortrait(killerTeam, this.bots[killerBot]?.rig.agentId),
      );
      setText("death-killer", killer);
      el("death-killer").className =
        (metadata?.killerTeam ?? this.bots.find((b) => b.name === killer)?.team) === "ct"
          ? "feed-ct"
          : "feed-t";
      setText("death-weapon", weaponName);
      toggle("death-weapon-icon", !environmentDeath);
      if (!environmentDeath)
        setDeathcamWeaponArtwork(label ? -1 : weapon, killerInstance, weaponIcon);
      toggle("death-banner", !environmentDeath);
      this.deathBannerUntil = performance.now() + 3000;
    }
    const container = el("killfeed");
    // Rows only shift when the oldest is trimmed; measure layout just then.
    const before =
      container.children.length >= 5
        ? new Map(
            [...container.children].map((child) => [child, child.getBoundingClientRect().top]),
          )
        : undefined;
    const row = document.createElement("div");
    row.className = "feed" + (killer === "YOU" || victim === "YOU" ? " feed-local" : "");
    row.setAttribute("role", "listitem");
    const name = (text: string, team?: AgentTeam) => {
      const node = document.createElement("span");
      node.className =
        (team ??
          (text === "YOU"
            ? this.team
            : (this.bots.find((b) => b.name === text)?.team ??
              (this.team === "ct" ? "t" : "ct")))) === "ct"
          ? "feed-ct"
          : "feed-t";
      node.textContent = text === "YOU" ? playerName() : text;
      return node;
    };
    const icon = (file: string, label: string, className: string) => {
      const img = document.createElement("img");
      img.src = assetUrl(`/icons/${file}.png`);
      img.alt = label;
      img.className = className;
      return img;
    };
    row.append(name(killer, metadata?.killerTeam));
    const assister = this.mode === "deathmatch" ? this.deathmatchAssisters.get(victim) : undefined;
    this.deathmatchAssisters.delete(victim);
    if (assister) {
      row.append(" + ", name(assister));
      if (assister === "YOU") row.classList.add("feed-local");
    }
    const icons = document.createElement("span");
    icons.className = "feed-icons";
    if (utilityKind === "molotov" || utilityKind === "incendiary") {
      const flame = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      flame.setAttribute("viewBox", "0 0 24 24");
      flame.setAttribute("role", "img");
      flame.setAttribute("aria-label", weaponName);
      flame.classList.add("feed-fire");
      flame.innerHTML =
        '<path fill="currentColor" d="M13 1c2 6-4 7-2 11 1-2 3-3 4-5 5 5 7 9 3 13-3 3-8 3-11 0-4-4-2-8 1-12-1 5 0 6 1 7-1-6 5-7 4-14Z"/>';
      icons.append(flame);
    } else if (!environmentDeath) {
      const image = document.createElement("img");
      image.src = assetUrl(weaponIcon);
      image.alt = weaponName;
      image.className = "feed-weapon";
      icons.append(image);
    }
    if (noScope) icons.append(icon("noscope", "NO SCOPE", "feed-modifier"));
    if (wallbang) icons.append(icon("wallbang", "PENETRATION", "feed-modifier"));
    if (head) icons.append(icon("headshot", "HEADSHOT", "feed-modifier"));
    row.append(icons);
    row.append(name(victim, metadata?.victimTeam));
    row.setAttribute(
      "aria-label",
      `${killer} eliminated ${victim} with ${weaponName}${head ? ", HEADSHOT" : ""}${noScope ? ", NO SCOPE" : ""}`,
    );
    container.append(row);
    while (container.children.length > 5) container.firstElementChild?.remove();
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
    }, 6000);
  }
  finish() {
    this.healthshotHealing.clear();
    this.healthshotAction.cancel();
    hideRoundBanner();
    this.notices.reset();
    document.body.classList.remove("match-menu-open");
    document.getElementById("loadout-editor")?.remove();
    for (const id of ["scoreboard", "settings", "skin-menu", "cosmetic-menu", "loadout"])
      toggle(id, false);
    this.utility.blind.clear();
    if (this.utility.overlay) this.utility.overlay.style.opacity = "0";
    this.setScope(0);
    this.rescope = 0;
    this.active = false;
    this.firing = false;
    if (this.locked) document.exitPointerLock();
    toggle("pause", false);
    toggle("result", true);
    const leader = this.deathmatchStandings[0];
    const won = this.teamMode
      ? this.teamScores[this.team] >= this.winTarget
      : this.mode === "deathmatch"
        ? leader.id === "player"
        : this.kills >= 20;
    el("result-title").textContent = won
      ? "VICTORY."
      : this.mode === "practice"
        ? "TIME’S UP."
        : "DEFEAT.";
    if (
      this.mode === "deathmatch" &&
      this.deathmatchStandings.filter((row) => row.score === leader.score).length > 1 &&
      this.deathmatchScore === leader.score
    )
      el("result-title").textContent = "DRAW.";
    if (this.competitive && this.teamScores.t === 12 && this.teamScores.ct === 12)
      el("result-title").textContent = "DRAW.";
    this.soundscape.playMusic("end");
    el("result").dataset.result = el("result-title").textContent.startsWith("VICTORY")
      ? "won"
      : el("result-title").textContent.startsWith("DRAW")
        ? "draw"
        : "lost";
    el("result").dataset.team = this.team;
    el("result-score").textContent = this.teamMode
      ? `${this.teamScores[this.team]} : ${this.teamScores[this.team === "ct" ? "t" : "ct"]}`
      : this.mode === "deathmatch"
        ? `${this.deathmatchScore} POINTS`
        : "";
    el("result-stats").textContent =
      `${this.kills} eliminations - ${this.deaths} deaths - ${this.deaths ? (this.kills / this.deaths).toFixed(2) : this.kills.toFixed(2)} K/D`;
  }
  updateDuckInput(dt: number) {
    this.duckCooldown = Math.max(0, this.duckCooldown - dt);
    const pressed =
      this.keys.has("ControlLeft") || this.keys.has("ControlRight") || this.keys.has("KeyC");
    // Repeated taps slow the transition; never discard a held crouch input.
    // The pinned 0.4s interval controls recovery, rather than a binary gate.
    if (pressed && !this.duckHeld) {
      this.duckTransitionRate =
        this.duckCooldown > 0 ? Math.max(5, this.duckTransitionRate * 0.65) : 15;
      this.duckCooldown = 0.4;
    }
    if (!pressed && this.duckCooldown === 0) this.duckTransitionRate = 15;
    this.duckAccepted = pressed;
    this.duckHeld = pressed;
    if (this.planting) this.duckTransitionRate = 15;
    return (
      this.planting ||
      pressed ||
      (this.eye < movement.standingEye - 0.01 &&
        this.isBlocked(
          this.position.x,
          this.position.z,
          this.position.y,
          movement.hullRadius,
          movement.standingHeight,
        ))
    );
  }
  simulate(dt: number) {
    this.updateEmptyClick(dt);
    this.plantLook = T.MathUtils.damp(this.plantLook, this.planting ? 1 : 0, 12, dt);
    if (this.network) {
      this.network.simulate(dt);
      return;
    }
    this.updateMapHazards(dt);
    this.updateMapDoors(dt);
    this.utility.update(dt);
    this.groundInventory.update(dt);
    if (this.active && this.world === this.dust) {
      if (!this.dead) this.dust.ball.touch(this.position, this.velocity.x, this.velocity.z, dt);
      for (const bot of this.bots)
        if (bot.health > 0)
          this.dust.ball.touch(bot.group.position, bot.velocity.x, bot.velocity.y, dt);
      this.dust.ball.update(dt);
    }
    this.animationTime += dt;
    const suppressor = this.suppressors[this.selected];
    if (suppressor.action) {
      if (
        this.dead ||
        !this.active ||
        this.utility.selected ||
        this.planting ||
        this.bomb?.defuser === "player"
      )
        suppressor.cancel();
      else {
        const before = suppressor.progress;
        const action = suppressor.action;
        this.animationSounds(
          action,
          before,
          Math.min(1, (suppressor.elapsed + dt) / suppressor.duration),
        );
        suppressor.update(dt);
      }
    }
    if (!this.drawTime && !this.knifeTime && !this.inspectTime) this.weaponTime += dt;
    if (this.shotTime > 0) {
      const duration = nativeShotDuration(this.selected, this.alternateShot, this.lastShot);
      this.animationSounds(
        this.alternateShot && (this.selected === 17 || this.selected === 18) ? "shoot2" : "shoot1",
        1 - this.shotTime / duration,
        1 - Math.max(0, this.shotTime - dt) / duration,
      );
    }
    this.shotTime = Math.max(0, this.shotTime - dt);
    if (!this.shotTime) this.lastShot = false;
    if (this.selected === 5 && this.inspectTime > 0 && !this.inspectRewinding && !this.dead) {
      const duration = this.inspectDuration();
      const elapsed = duration - this.inspectTime;
      const variant = ((this.inspectVariant % 3) + 1) as 1 | 2 | 3;
      // Imported knife clips lack sound events; phase offsets reconstruct the opening flip/catch.
      for (const [time, phase] of [
        [0.05, "a"],
        [duration * 0.58, "b"],
      ] as const)
        if (elapsed <= time && elapsed + dt > time)
          this.soundscape.play(`butterfly-look${variant}-${phase}`);
    }
    if (this.inspectTime > 0 && this.inspectRewinding) {
      this.inspectTime += dt * 2;
      if (this.inspectTime >= this.inspectDuration()) {
        this.inspectTime = this.weaponTime = 0;
        this.inspectRewinding = false;
      }
    } else {
      this.inspectTime = Math.max(0, this.inspectTime - dt);
      this.inspectRewinding = false;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.knifeTime = Math.max(0, this.knifeTime - dt);
    if (
      this.knifePending &&
      this.knifeDuration - this.knifeTime >= (this.knifeStab ? 0.18 : 0.1) / WEAPON_ANIMATION_RATE
    ) {
      this.knifePending = false;
      if (!this.dead && this.active && this.locked && !this.weaponsFrozen && isKnife(this.selected))
        this.meleeHit(this.knifeStab);
    }
    if (this.drawTime > 0) {
      const before = 1 - this.drawTime / weaponDrawDuration(this.selected);
      this.drawTime = Math.max(0, this.drawTime - dt);
      const after = 1 - this.drawTime / weaponDrawDuration(this.selected);
      if (!this.reload) this.animationSounds("draw", before, after);
    }
    for (let i = 0; i < this.weaponCooldowns.length; i++) {
      this.weaponCooldowns[i] = Math.max(0, this.weaponCooldowns[i] - dt);
      this.reloadLockouts[i] = Math.max(0, this.reloadLockouts[i] - dt);
    }
    if (this.scopeTransition > 0) {
      this.scopeTransition = Math.max(0, this.scopeTransition - dt);
      this.camera.fov =
        this.scopeTarget +
        ((this.scopeFrom - this.scopeTarget) * this.scopeTransition) / this.scopeDuration;
      this.camera.updateProjectionMatrix();
    }
    if (this.boltTime > 0) {
      const previous = this.boltTime;
      this.boltTime = Math.max(0, this.boltTime - dt);
      if (!this.reload && !this.dead) {
        if (!this.drawTime)
          this.animationSounds(
            "shoot1",
            1 - previous / weapons[this.selected].delay,
            1 - this.boltTime / weapons[this.selected].delay,
          );
      }
      if (
        !this.boltTime &&
        this.rescope &&
        !this.dead &&
        !this.reload &&
        weapons[this.selected].unzoomsAfterShot
      ) {
        this.setScope(this.rescope);
        this.rescope = 0;
      }
    }
    this.kick = Math.max(0, this.kick - dt * 0.65);
    this.hit = Math.max(0, this.hit - dt);
    this.damage = Math.max(0, this.damage - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (
      this.mode === "deathmatch" &&
      (Math.hypot(this.velocity.x, this.velocity.z) > 0.05 ||
        this.firing ||
        ["KeyW", "KeyA", "KeyS", "KeyD", "Space"].some((key) => this.keys.has(key)))
    )
      this.invulnerable = 0;
    for (const bot of this.bots) bot.spawnProtection = Math.max(0, bot.spawnProtection - dt);
    this.shots = this.weaponRecoil[this.selected].index;
    advanceAimPunch(this.aimPunch, dt);
    for (let i = 0; i < this.weaponRecoil.length; i++) {
      advanceWeaponAccuracy(
        this.weaponAccuracy[i],
        i,
        this.weaponRecoil[i].index,
        this.crouching,
        dt,
        this.playerAccuracyPose(i),
      );
      advanceWeaponRecoil(this.weaponRecoil[i], i, dt);
    }
    for (const bot of this.bots) {
      if (bot.health <= 0) continue;
      if (bot.recoilWeapon !== bot.rig.weaponIndex) {
        bot.weaponRecoil = createWeaponRecoil();
        bot.weaponAccuracy = createWeaponAccuracy();
        bot.recoilWeapon = bot.rig.weaponIndex;
      }
      advanceAimPunch(bot.aimPunch, dt);
      advanceWeaponAccuracy(
        bot.weaponAccuracy,
        bot.recoilWeapon,
        bot.weaponRecoil.index,
        bot.rig.crouch > 0.5,
        dt,
        this.botAccuracyPose(bot),
      );
      advanceWeaponRecoil(bot.weaponRecoil, bot.recoilWeapon, dt);
    }
    this.notices.tick(dt);
    if (this.mode === "deathmatch") {
      if (this.dead || !this.active) {
        this.healthshotAction.cancel();
        this.healthshotHealing.clear();
      } else {
        const phase = this.healthshotAction.phase,
          elapsed = this.healthshotAction.elapsed;
        const result = this.healthshotAction.tick(dt);
        if (phase === "use")
          for (const cue of this.healthshotSounds) {
            if (elapsed < cue.time && elapsed + dt >= cue.time)
              this.soundscape.play(`healthshot-${cue.kind}`);
          }
        if (result.consumed) this.deathmatchCombat.life("player").healthshots--;
        if (result.heal) this.healthshotHealing.enqueue(result.heal);
        this.health = Math.min(100, this.health + this.healthshotHealing.tick(dt));
        if (result.finished) this.equip(this.selected);
      }
      const bonusEvent = this.deathmatch.tick(dt, deathmatchBonusWeapons);
      if (bonusEvent)
        this.soundscape.play(bonusEvent === "started" ? "dm-bonus-start" : "dm-bonus-end");
      const previousTime = this.time;
      this.time -= dt;
      if (previousTime > 10 && this.time <= 10) this.soundscape.playMusic("countdown");
      if (this.time <= 0) {
        this.finish();
        return;
      }
    }
    if (this.teamMode) {
      if (this.dead && this.spectatorMode === "free") this.moveSpectator(dt);
      this.updateRound(dt);
      if (!this.active) return;
      // Keep combat, bots and falling bodies live after a decided round.
      if (this.halftime) return;
      if (this.freezeTime > 0) {
        // Movement is frozen, but newly equipped bots must finish drawing.
        for (const bot of this.bots) if (bot.health > 0) bot.anim += dt;
        this.velocity.x = this.velocity.z = 0;
        this.vertical = 0;
        this.jumpQueued = false;
        if (!this.dead) {
          const nextEye = T.MathUtils.damp(
            this.eye,
            this.updateDuckInput(dt) ? movement.duckEye : movement.standingEye,
            this.duckTransitionRate,
            dt,
          );
          if (
            nextEye <= this.eye ||
            !this.isBlocked(
              this.position.x,
              this.position.z,
              this.position.y,
              movement.hullRadius,
              nextEye + (movement.standingHeight - movement.standingEye),
            )
          )
            this.eye = nextEye;
          this.updateAimCamera();
        }
        return;
      }
      if (this.dead) {
        this.tick++;
        this.updateBots(dt * 8, this.tick % 8);
        this.moveBots(dt);
        return;
      }
    }
    if (this.dead) {
      this.tick++;
      this.updateBots(dt * 8, this.tick % 8);
      this.moveBots(dt);
      this.dead -= dt;
      if (this.dead <= 0) {
        this.spawnPlayer();
      }
      return;
    }
    if (
      !this.ammo &&
      this.reserve > 0 &&
      !this.reload &&
      this.cooldown <= 0 &&
      !this.drawTime &&
      !this.bombSelected &&
      !this.utility.selected &&
      !this.utility.throwingKind &&
      !this.planting &&
      this.bomb?.defuser !== "player" &&
      !isKnife(this.selected)
    )
      this.beginReload();
    if (this.reload) {
      const previous = this.reload;
      this.reload = Math.max(0, this.reload - dt);
      const w = weapons[this.selected];
      if (w.reloadStyle === "shell") {
        const after = this.reloadProgress();
        const phases = nativeReloadPhases(this.selected) ?? {
          introEnd: 11 / 49,
          loopEnd: 24 / 49,
          addAmmo: 20 / 49,
        };
        const segment =
          this.shellPhase === "intro"
            ? phases.introEnd
            : this.shellPhase === "loop"
              ? phases.loopEnd - phases.introEnd
              : 1 - phases.loopEnd;
        this.animationSounds(
          "reload",
          after - ((previous - this.reload) / this.shellDuration()) * segment,
          after,
        );
        // Commit exactly at the native WPN_RELOAD_ADD_AMMO marker, so firing
        // after the shell enters the tube preserves it even before loop end.
        if (this.shellPhase === "loop" && !this.shellInserted && after >= phases.addAmmo) {
          this.ammo++;
          if (this.mode !== "deathmatch") this.reserve--;
          this.shellInserted = true;
          this.updateUI();
        }
        if (!this.reload) {
          if (this.shellPhase !== "outro") {
            const repeating = this.shellPhase === "loop";
            this.shellPhase = this.ammo < w.mag && this.reserve > 0 ? "loop" : "outro";
            this.reload = this.shellDuration();
            if (this.shellPhase === "loop") {
              this.shellInserted = false;
              // Intro already owns its endpoint cue; only repeated loops need
              // to re-enter an exact start marker excluded by the strict interval.
              if (repeating)
                this.animationSounds("reload", phases.introEnd - Number.EPSILON, phases.introEnd);
            }
          }
          this.updateUI();
        }
      } else {
        this.animationSounds("reload", 1 - previous / w.reload, 1 - this.reload / w.reload);
        if (
          !this.magazineInserted &&
          this.reloadProgress() >= nativeMagazineInsert(this.selected, this.emptyReload)
        ) {
          // The new magazine survives holstering. The remaining reload deadline
          // still gates attacks after drawing, so quick-switching only cancels
          // the visual tail, not the weapon's readiness time.
          this.magazineInserted = true;
          this.reloadLockouts[this.selected] = Math.max(
            this.reloadLockouts[this.selected],
            this.reload,
          );
          const loaded = reloadMagazine(
            this.selected,
            this.ammo,
            this.mode === "deathmatch" ? weapons[this.selected].mag : this.reserve,
          );
          this.ammo = loaded.ammo;
          if (this.mode !== "deathmatch") this.reserve = loaded.reserve;
          this.updateUI();
        }
      }
    }
    if (!this.reload) this.emptyReload = this.magazineInserted = false;
    const crouch = this.updateDuckInput(dt),
      walk = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      maxSpeed = this.healthshotAction.selected
        ? 250 * 0.0254
        : (this.scopeLevel && weapons[this.selected].scopedSpeed) || weapons[this.selected].speed,
      speed =
        maxSpeed *
        (crouch
          ? movement.crouchModifier
          : T.MathUtils.lerp(
              movement.crouchModifier,
              walk ? movement.walkModifier : 1,
              T.MathUtils.clamp(
                (this.eye - movement.duckEye) / (movement.standingEye - movement.duckEye),
                0,
                1,
              ),
            )),
      right = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0),
      forward = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0),
      dx = right * Math.cos(this.yaw) - forward * Math.sin(this.yaw),
      dz = -right * Math.sin(this.yaw) - forward * Math.cos(this.yaw);
    let actorCount = 0;
    if (this.mode !== "casual")
      for (let index = 0; index < this.bots.length; index++) {
        const bot = this.bots[index];
        if (bot.health <= 0 || !bot.group.visible) continue;
        const hull = (this.actorHulls[actorCount] ??= {
          x: 0,
          y: 0,
          z: 0,
          height: movement.standingHeight,
          radius: movement.hullRadius,
        });
        const position = bot.group.position;
        hull.id = index;
        hull.x = position.x;
        hull.y = position.y;
        hull.z = position.z;
        hull.height = T.MathUtils.lerp(
          movement.standingHeight,
          movement.duckHeight,
          bot.rig.crouch,
        );
        actorCount++;
      }
    this.actorHulls.length = actorCount;
    const wasFalling = this.vertical < -2;
    const ladderStep = this.world.collision
      ? stepLadder(
          this.position,
          { yaw: this.yaw, pitch: -this.pitch, forward, right, jump: this.jumpQueued },
          dt,
          this.world.navigation.data.ladders,
          this.world.collision,
          this.hullHeight,
          this.ladderState,
          movement.hullRadius,
          this.actorHulls,
        )
      : undefined;
    if (ladderStep) {
      this.velocity.x = ladderStep.velocity.x;
      this.velocity.z = ladderStep.velocity.z;
      this.vertical = ladderStep.velocity.y;
      this.grounded = ladderStep.grounded;
      this.jumpQueued = false;
      this.actorCarrier = null;
    } else {
      if (this.actorCarrier !== null && this.grounded) {
        const carrier = this.actorHulls.find((hull) => hull.id === this.actorCarrier);
        const top = actorCarry(this.position, this.actorCarrierTop, carrier, movement.hullRadius);
        const ceiling =
          top !== undefined && top > this.position.y
            ? this.world.collision?.ceiling(
                this.position.x,
                this.position.z,
                this.position.y + this.hullHeight,
                top + this.hullHeight,
                movement.hullRadius,
              )
            : undefined;
        if (
          top !== undefined &&
          !Number.isFinite(ceiling) &&
          !this.isBlocked(
            this.position.x,
            this.position.z,
            top,
            movement.hullRadius,
            this.hullHeight,
          )
        ) {
          this.position.y = top;
          this.actorCarrierTop = top;
        } else {
          this.actorCarrier = null;
          this.grounded = false;
        }
      } else this.actorCarrier = null;
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
      if (
        this.world.collision?.recoverGround(this.position, movement.hullRadius, this.hullHeight)
      ) {
        this.grounded = this.vertical <= 0;
        if (this.grounded) this.vertical = 0;
      }
      const followGround = this.grounded;
      this.actorStart.copy(this.position);
      // Walking/ducking limit the target speed, while ground acceleration keeps
      // weapon-speed strength against stopspeed friction (especially in a crouch).
      accelerate(this.velocity, dx, dz, speed, dt, this.grounded, this.grounded ? maxSpeed : speed);
      const previousY = this.position.y;
      const falling = fallStep(this.vertical, dt);
      this.position.y += falling.distance;
      this.vertical = falling.vertical;
      if (this.world.collision && this.vertical > 0) {
        const ceiling = this.world.collision.ceiling(
          this.position.x,
          this.position.z,
          previousY + this.hullHeight,
          this.position.y + this.hullHeight,
          movement.hullRadius,
        );
        if (Number.isFinite(ceiling)) {
          this.position.y = ceiling - this.hullHeight;
          this.vertical = 0;
        }
      }
      this.grounded = false;
      let ground = this.world.collision
        ? this.world.collision.support(
            this.position.x,
            this.position.z,
            previousY + (followGround ? 0.46 : 0.001),
            this.position.y - 0.2,
            movement.hullRadius,
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
          previousY + this.hullHeight <= b.y &&
          this.position.y + this.hullHeight > b.y
        ) {
          this.position.y = b.y - this.hullHeight;
          this.vertical = 0;
        }
      }
      if (this.vertical <= 0 && this.position.y <= ground) {
        this.position.y = ground;
        this.vertical = 0;
        this.grounded = true;
      }
      if (
        this.world.collision &&
        !this.world.collision.resolveHorizontal(this.position, movement.hullRadius, this.hullHeight)
      ) {
        // A tight corner may have no horizontal escape. Keep the last clear
        // height so input can still move away instead of embedding the player.
        this.position.y = previousY;
        this.grounded = this.vertical <= 0;
        this.vertical = 0;
      }
      if (this.world.collision) {
        this.world.collision.moveHorizontal(
          this.position,
          this.velocity,
          dt,
          movement.hullRadius,
          this.hullHeight,
          this.vertical <= 0 && (followGround || this.grounded),
        );
      } else {
        const nextX = this.position.x + this.velocity.x * dt;
        if (
          !this.isBlocked(
            nextX,
            this.position.z,
            this.position.y,
            movement.hullRadius,
            this.hullHeight,
          )
        )
          this.position.x = nextX;
        else this.velocity.x = 0;
        const nextZ = this.position.z + this.velocity.z * dt;
        if (
          !this.isBlocked(
            this.position.x,
            nextZ,
            this.position.y,
            movement.hullRadius,
            this.hullHeight,
          )
        )
          this.position.z = nextZ;
        else this.velocity.z = 0;
      }
      if (this.world.collision && this.vertical <= 0 && (followGround || this.grounded)) {
        this.grounded = this.world.collision.followGround(
          this.position,
          movement.hullRadius,
          this.hullHeight,
        );
        if (this.grounded) this.vertical = 0;
      }
      if (this.actorHulls.length) {
        const staticGrounded = this.grounded;
        const staticFeet = this.position.y;
        const landing =
          this.vertical <= 0
            ? actorLanding(this.actorStart, this.position, this.actorHulls, movement.hullRadius)
            : -Infinity;
        if (Number.isFinite(landing)) this.position.y = landing;
        const hit = slideActors(
          this.actorStart,
          this.position,
          this.hullHeight,
          this.actorHulls,
          movement.hullRadius,
        );
        if (hit.hitX) this.velocity.x = 0;
        if (hit.hitZ) this.velocity.z = 0;
        if (
          this.world.collision &&
          !this.world.collision.resolveHorizontal(
            this.position,
            movement.hullRadius,
            this.hullHeight,
          )
        ) {
          this.position.x = this.actorStart.x;
          this.position.z = this.actorStart.z;
        }
        const actorFloor = actorSupport(
          this.position.x,
          this.position.z,
          previousY,
          this.position.y,
          this.actorHulls,
          movement.hullRadius,
          followGround,
        );
        this.actorCarrier = null;
        if (
          this.vertical <= 0 &&
          Number.isFinite(actorFloor) &&
          Math.abs(this.position.y - actorFloor) <= 0.001
        ) {
          this.position.y = actorFloor;
          this.vertical = 0;
          this.grounded = true;
          this.actorCarrier =
            this.actorHulls.find(
              (hull) =>
                Math.abs(hull.y + hull.height - actorFloor) < 0.001 &&
                Math.abs(hull.x - this.position.x) < hull.radius + movement.hullRadius &&
                Math.abs(hull.z - this.position.z) < hull.radius + movement.hullRadius,
            )?.id ?? null;
          this.actorCarrierTop = actorFloor;
        } else {
          // A head can stop descent during this step while horizontal motion
          // carries the rider off its edge. That endpoint is already airborne.
          this.grounded = staticGrounded && Math.abs(this.position.y - staticFeet) < 0.001;
        }
      } else this.actorCarrier = null;
      if (!followGround && this.grounded) {
        applyLandingInaccuracy(
          this.weaponAccuracy[this.selected],
          this.selected,
          this.playerAccuracyPose().mode,
          Math.max(0, -falling.vertical),
        );
      }
    }
    const nextEye = T.MathUtils.damp(
      this.eye,
      crouch ? movement.duckEye : movement.standingEye,
      this.duckTransitionRate,
      dt,
    );
    // In air, ducking pulls the feet up while preserving the head's trajectory.
    // Reversing the posture lowers the feet again, so toggling cannot add height.
    const nextFeet = this.position.y + (this.grounded || this.ladder ? 0 : this.eye - nextEye);
    const floorInExtension =
      !this.grounded && nextFeet < this.position.y
        ? this.world.collision?.support(this.position.x, this.position.z, this.position.y, nextFeet)
        : undefined;
    const ceilingInExtension =
      nextFeet + nextEye + (movement.standingHeight - movement.standingEye) >
      this.position.y + this.hullHeight + 1e-8
        ? this.world.collision?.ceiling(
            this.position.x,
            this.position.z,
            this.position.y + this.hullHeight,
            nextFeet + nextEye + (movement.standingHeight - movement.standingEye),
            movement.hullRadius,
          )
        : undefined;
    if (
      nextEye <= this.eye ||
      (!Number.isFinite(floorInExtension) &&
        !Number.isFinite(ceilingInExtension) &&
        !this.isBlocked(
          this.position.x,
          this.position.z,
          nextFeet,
          movement.hullRadius,
          nextEye + (movement.standingHeight - movement.standingEye),
        ))
    ) {
      this.position.y = nextFeet;
      this.eye = nextEye;
    }
    if (
      !this.ladder &&
      this.world.collision?.recoverGround(this.position, movement.hullRadius, this.hullHeight)
    ) {
      this.grounded = this.vertical <= 0;
      if (this.grounded) this.vertical = 0;
    }
    this.updateAimCamera();
    if (!this.bombSelected) {
      if (this.burstRemaining && this.burstMode && !this.reload) this.fire(true);
      else if (this.firing && this.selected === 17 && !this.reload && this.cooldown <= 0) {
        if (!this.revolverCharge) this.fire();
        this.revolverCharge += dt;
        if (this.revolverCharge >= REVOLVER_COCK_TIME) this.fire();
      } else if (this.firing && isKnife(this.selected)) this.fireKnife();
      else if (this.firing && weapons[this.selected].auto && !this.burstMode) this.fire();
    }
    const magnitude = Math.hypot(this.velocity.x, this.velocity.z);
    this.sway += magnitude * dt * 1.8;
    const foot = this.footstepStride.advance(
      {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
        spawn: 0,
        audible: this.grounded && !this.ladder && !walk && !crouch,
      },
      dt,
    );
    if (foot) this.emitFootstep(this.position, this.team, foot, true);
    if (this.grounded && wasFalling) this.soundscape.play("land");
    this.tick++;
    this.updateBots(dt * 8, this.tick % 8);
    this.moveBots(dt);
  }
  useWorld() {
    this.doorAudio.reset();
    this.footstepStride.reset();
    this.audioSteps = new WeakMap();
    this.radar.reset();
    this.groundInventory.clearDrops();
    for (const tracer of this.tracers) {
      tracer.life = 0;
      tracer.mesh.visible = false;
    }
    if (!this.dust) return;
    for (const world of this.nativeWorlds.values()) world.root.visible = world === this.dust;
    this.world = this.dust;
    this.propBreakAudio.validate(this.world.breakables.definitions);
    this.mapHazards = new MapHazards(this.world.triggers?.hurt);
    this.bombReset = new BombReset(this.world.triggers);
    this.pruneNativeWorlds();
    activateNativeMapGrade(this.dust.grade);
    const radar = el("radar") as HTMLCanvasElement;
    radar.width = this.world.navigation ? 900 : 180;
    radar.height = radar.width;
    document.querySelector(".radar-wrap")!.classList.toggle("callouts", !!this.world.navigation);
    el("location").textContent = MAPS[this.mapId].name.toUpperCase();
    this.scene.background = this.dust.skybox ? null : this.dust.sky;
    this.scene.environment = this.dust.sky;
    // VRF panoramas start at +X, whereas Three's equirectangular lookup starts
    // half a turn earlier. The native sky mesh samples the original cube directly.
    this.scene.backgroundRotation.y = Math.PI;
    this.scene.environmentRotation.y = Math.PI;
    // Retain the bounded global specular fallback; actors use local native probes.
    this.scene.backgroundIntensity = this.dust.config.backgroundIntensity ?? 1;
    this.scene.environmentIntensity = this.dust.config.environmentIntensity ?? 0.35;
    this.scene.fog = this.dust.skybox
      ? null
      : this.dust.config.fog
        ? new T.Fog(this.dust.config.fog.color, this.dust.config.fog.near, this.dust.config.fog.far)
        : null;
    this.camera.far = this.world.collision ? 250 : 110;
    this.camera.updateProjectionMatrix();
  }
  configureBots(
    casual: boolean,
    count = casual ? this.teamSize * 2 - 1 : this.mode === "deathmatch" ? 10 : 5,
  ) {
    this.botStrategies = null;
    for (const bot of this.bots) {
      this.scene.remove(bot.group);
      disposeSoldier(bot.rig);
    }
    this.bots = Array.from({ length: count }, (_, i) => this.makeBot(i));
  }
  isBlocked(x: number, z: number, y: number, radius = 0.3, height = 1.65) {
    return this.world.collision
      ? this.world.collision.blocked(x, z, y, radius, height)
      : blocked(x, z, y, this.world.walls, radius, height);
  }
  startRound() {
    this.doorAudio.reset();
    this.mapHazards.reset();
    this.bombReset.reset();
    this.radar.reset();
    this.world.breakables.reset();
    this.world.doors?.reset();
    this.doorUseConsumed = false;
    this.syncMapDoors();
    this.syncMapBreakables(false);
    this.utility.reset(true);
    this.groundInventory.clearDrops();
    for (const tracer of this.tracers) {
      tracer.life = 0;
      tracer.mesh.visible = false;
    }
    hideRoundBanner();
    this.notices.reset();
    const halftime = this.competitive && this.round === 13;
    if (halftime) {
      const records = this.bots.map((b) => ({ kills: b.kills, deaths: b.deaths }));
      this.team = this.team === "t" ? "ct" : "t";
      this.teamScores = { t: this.teamScores.ct, ct: this.teamScores.t };
      this.configureBots(true);
      this.bots.forEach((b, i) => {
        b.kills = records[i].kills;
        b.deaths = records[i].deaths;
        b.money = this.rules.startMoney;
      });
      this.money = this.rules.startMoney;
      this.lossStreak = { t: this.rules.startingLossLevel, ct: this.rules.startingLossLevel };
    }
    this.groundInventory.roundLoadout = this.teamMode
      ? [...this.groundInventory.loadouts[this.team]]
      : null;
    const preserve = this.round > 1 && !halftime;
    this.time = this.rules.roundTime;
    this.freezeTime = this.rules.freezeTime;
    this.buyRemaining = this.rules.buyTime + this.freezeTime;
    this.roundPause = 0;
    this.spawnPlayer(preserve && !this.dead);
    this.bots.forEach((b, i) => {
      const surviving = preserve && b.health > 0;
      this.spawnBot(b, i, surviving);
      this.utility.buyBot(i, surviving);
    });
    const carrier = this.team === "t" ? "player" : this.bots.findIndex((b) => b.team === "t");
    this.bomb = {
      position: new T.Vector3(),
      planted: false,
      timer: 40,
      progress: 0,
      defuser: null,
      carrier,
      plantProgress: 0,
      beepRemaining: 1,
      beepPulse: 0,
    };
    this.rememberMapBomb();
    this.bombMesh.visible = false;
    this.resetBotStrategies();
    this.roundElapsed = 0;
    this.roundHighlights.clear();
    this.roundFirstKill = undefined;
    this.roundStartKills = new Map<number | "player", number>([
      ["player", this.kills],
      ...this.bots.map((bot, id) => [id, bot.kills] as [number, number]),
    ]);
    this.soundscape.playMusic("start");
    this.updateUI();
  }
  endRound(winner: AgentTeam, reason: string) {
    if (this.roundPause) return;
    this.teamScores[winner]++;
    this.roundHistory.push({ winner, reason });
    const mode = this.competitive ? "competitive" : "casual";
    const outcome =
      reason === "Bomb detonated"
        ? "bomb"
        : reason === "Bomb defused"
          ? "defuse"
          : reason === "Time expired"
            ? "timeout"
            : "elimination";
    const payout = (team: AgentTeam, alive: boolean) =>
      team === "t" && alive && outcome === "timeout"
        ? 0
        : roundReward(
            mode,
            team === winner,
            outcome,
            this.lossStreak[team],
            team === "t" && !!this.bomb?.planted,
          );
    this.money = addMoney(this.money, payout(this.team, !this.dead), mode);
    for (const bot of this.bots)
      bot.money = addMoney(bot.money, payout(bot.team, bot.health > 0), mode);
    for (const team of ["t", "ct"] as const)
      this.lossStreak[team] = nextLossLevel(this.lossStreak[team], team === winner);
    this.roundPause = this.rules.roundEndTime;
    if (this.halftime) this.firing = false;
    this.setScope(0);
    this.rescope = this.boltTime = 0;
    this.notices.clearAlert();
    const players = [
      { id: "player" as number | "player", name: playerName(), team: this.team, kills: this.kills },
      ...this.bots.map((bot, id) => ({ id, name: bot.name, team: bot.team, kills: bot.kills })),
    ];
    const mvp = roundMvp(
      players,
      winner,
      reason,
      this.roundStartKills,
      reason === "Bomb defused" ? this.bomb?.defuser : this.bomb?.planter,
    );
    if (mvp) this.mvpCounts.set(mvp.id, (this.mvpCounts.get(mvp.id) ?? 0) + 1);
    this.soundscape.playRoundMusic(
      winner === this.team,
      mvp ? (mvp.id === "player" ? "local" : "other") : null,
    );
    // The result is settled; completed bomb actions must not block surviving players.
    if (this.bomb) {
      this.bomb.defuser = null;
      this.bomb.progress = 0;
      if (this.halftime) this.bomb.plantProgress = 0;
    }
    const winners = players.filter((player) => player.team === winner);
    const fact = roundFact({
      winner,
      reason,
      seconds: this.roundElapsed,
      enemyCount: players.length - winners.length,
      winningDeaths: winners.filter((player) =>
        player.id === "player" ? this.dead > 0 : this.bots[player.id].health <= 0,
      ).length,
      players: winners.map((player) => ({
        name: player.name,
        kills: Math.max(0, player.kills - (this.roundStartKills.get(player.id) ?? player.kills)),
        ...(this.roundHighlights.get(player.id) ?? { headshots: 0, knives: 0, grenades: 0 }),
      })),
      firstKill: this.roundFirstKill,
    });
    showRoundBanner(winner, this.team, reason, mvp, fact);
    this.updateUI();
    if (this.teamScores[winner] >= this.winTarget || (this.competitive && this.round >= 24))
      this.finish();
  }
  bombDamageFor(actor: Bot | "player") {
    if (!this.bomb || !this.dust) return 0;
    const position = actor === "player" ? this.position : actor.group.position;
    const crouched = actor === "player" ? this.crouching : actor.rig.crouch > 0.5;
    const height = actor === "player" ? this.eye : crouched ? 1.1 : 1.65;
    const sample = position.clone().add(new T.Vector3(0, height * 0.5, 0));
    const field = this.dust.bombDamage;
    if (!field) return 0;
    let hit = field.lookup(this.bomb.position, sample);
    if (!hit) return 0;
    const node = new T.Vector3(hit.nodePosition.x, hit.nodePosition.y, hit.nodePosition.z);
    // Native lookup retries at the ground-corrected collision center if the
    // chosen field node is occluded. The map's existing hull-support solver
    // approximates the engine's downward physics trace/filter here.
    if (!this.dust.collision.visible(sample, node)) {
      const ground = this.dust.collision.support(
        position.x,
        position.z,
        position.y,
        position.y - 2 * 16384 * Math.sqrt(3) * 0.0254,
        0.3,
      );
      if (Number.isFinite(ground)) {
        hit =
          field.lookup(this.bomb.position, groundCorrectedBombSample(sample, position, ground)) ??
          hit;
      }
    }
    const direction =
      actor === "player"
        ? new T.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch),
          )
        : new T.Vector3(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y));
    return field.playerDamage(hit, direction, crouched);
  }
  detonateBomb() {
    if (!this.bomb) return;
    const field = this.world.bombDamage;
    if (
      field &&
      this.world.breakables.damageRadius(
        this.bomb.position,
        Infinity,
        (_distance, point) => field.lookup(this.bomb!.position, point)?.damage ?? 0,
        "explosion",
        false,
      ).length
    )
      this.syncMapBreakables(true, this.bomb.position);
    if (field) {
      this.world.doors.damageRadius(
        this.bomb.position,
        Infinity,
        (_distance, point) => field.lookup(this.bomb!.position, point)?.damage ?? 0,
        "explosion",
        false,
      );
      this.syncMapDoors();
    }
    const apply = (actor: Bot | "player") => {
      const target = actor === "player" ? this : actor;
      if (target.health <= 0 || (actor === "player" && this.dead)) return;
      // The reconstructed native player query returns health damage, including
      // stance/facing bias. Applying firearm armor here would reduce it twice.
      target.health = Math.max(0, target.health - this.bombDamageFor(actor));
      if (target.health > 0) return;
      target.deaths++;
      if (actor === "player") {
        this.dead = Infinity;
        this.firing = false;
        this.revolverCharge = this.reload = this.knifeTime = this.inspectTime = 0;
        this.lastShot = this.emptyReload = false;
        this.knifePending = false;
        this.soundscape.play("death");
      } else {
        actor.respawn = Infinity;
        actor.moving = false;
      }
      this.feed("C4", actor === "player" ? "YOU" : actor.name, false, -1);
    };
    apply("player");
    this.bots.forEach(apply);
  }
  private rememberMapBomb() {
    const carrier = this.bomb?.carrier;
    if (carrier === undefined || carrier === -1 || this.bomb?.planted) return;
    const bot = typeof carrier === "number" ? this.bots[carrier] : undefined;
    const position = bot?.group.position ?? this.position;
    this.bombReset.remember(
      position,
      bot ? bot.health > 0 && bot.vertical === 0 : !this.dead && this.grounded,
      (point) => supportedBombPosition(this.world.collision, point),
    );
  }
  private restoreMapBomb(dt = 0) {
    if (!this.bomb) return;
    if (
      this.bombReset.advance(
        this.bomb.position,
        dt,
        this.world.collision,
        this.bomb.planted || this.bomb.carrier !== -1,
      )
    ) {
      this.bombMesh.position.copy(this.bomb.position).y += 0.005;
      this.bombMesh.visible = true;
    }
  }
  private updateMapHazards(dt: number) {
    if (!this.active || this.network || !this.world) return;
    this.rememberMapBomb();
    if (this.mapHazards.hasTriggers) {
      const actors: {
        id: number | "player";
        position: T.Vector3;
        hull: { halfWidth: number; height: number };
      }[] = [];
      if (!this.dead && this.health > 0)
        actors.push({
          id: "player",
          position: this.position,
          hull: { halfWidth: movement.hullRadius, height: this.hullHeight },
        });
      this.bots.forEach((bot, id) => {
        if (bot.health > 0)
          actors.push({
            id,
            position: bot.group.position,
            hull: { halfWidth: movement.hullRadius, height: this.botHullHeight(bot) },
          });
      });
      for (const hit of this.mapHazards.update(dt, actors)) {
        const actor = hit.actor === "player" ? this : this.bots[hit.actor];
        if (!actor || actor.health <= 0) continue;
        actor.health = Math.max(0, actor.health - Math.floor(hit.damage));
        if (hit.actor === "player") {
          this.groundInventory.invalidateEquipment();
          this.damage = 0.25;
        }
        if (actor.health > 0) continue;
        actor.deaths++;
        if (hit.actor === "player") {
          this.dead = this.teamMode ? Infinity : 2.5;
          this.firing = this.knifePending = this.lastShot = this.emptyReload = false;
          this.revolverCharge = this.reload = this.knifeTime = this.inspectTime = this.shotTime = 0;
          this.rescope = this.boltTime = this.burstRemaining = 0;
          this.suppressors[this.selected].cancel();
          this.utility.cancelThrow();
          this.healthshotAction.cancel();
          this.healthshotHealing.clear();
          this.setScope(0);
          this.soundscape.play("death");
        } else {
          const bot = this.bots[hit.actor];
          bot.speed = 0;
          bot.moving = false;
          bot.reloadTime = 0;
          bot.respawn = this.teamMode ? Infinity : this.mode === "practice" ? 1.8 : 3;
        }
        if (this.teamMode) this.dropBomb(hit.actor);
        if (this.bomb?.defuser === hit.actor) {
          this.bomb.defuser = null;
          this.bomb.progress = 0;
        }
        this.feed("World", hit.actor === "player" ? "YOU" : this.bots[hit.actor].name, false, -1);
        this.updateUI();
      }
    }
    this.restoreMapBomb(dt);
  }
  dropBomb(carrier: number | "player") {
    if (!this.bomb || this.bomb.planted || this.bomb.carrier !== carrier) return;
    const position = carrier === "player" ? this.position : this.bots[carrier].group.position;
    this.bomb.position.copy(position);
    this.bomb.carrier = -1;
    this.bomb.plantProgress = 0;
    this.restoreMapBomb();
    this.bombMesh.position.copy(this.bomb.position).y += 0.005;
    this.bombMesh.visible = true;
    this.updateBombSelection(0);
    this.updateUI();
  }
  get planting() {
    return (
      this.active &&
      !this.dead &&
      !this.halftime &&
      this.bomb?.carrier === "player" &&
      !this.bomb.planted &&
      this.bomb.plantProgress > 0
    );
  }
  updateRound(dt: number) {
    if (!this.bomb) return;
    this.updateBombSelection(dt);
    if (this.roundPause > 0) {
      this.roundPause -= dt;
      if (this.roundPause <= 0) {
        this.round++;
        this.startRound();
      } else if (!this.halftime) this.updateBombPlant(dt, true);
      return;
    }
    this.buyRemaining = Math.max(0, this.buyRemaining - dt);
    if (this.freezeTime > 0) {
      this.freezeTime = Math.max(0, this.freezeTime - dt);
      // The authored StartAction event replaces freeze-time round-start music.
      if (this.freezeTime === 0) this.soundscape.playMusic("action");
      this.updateBotPurchases(dt * 8, this.tick++ % 8);
      return;
    }
    this.roundElapsed += dt;
    const previousRoundTime = this.time;
    this.time = Math.max(0, this.time - dt);
    if (!this.bomb.planted && previousRoundTime > 10 && this.time <= 10)
      this.soundscape.playMusic("countdown");
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
    if (!bomb.planted) {
      this.updateBombPlant(dt);
      return;
    }
    const previousBombTime = bomb.timer;
    bomb.timer -= dt;
    if (previousBombTime > 10 && bomb.timer <= 10) this.soundscape.playMusic("bomb-countdown");
    bomb.beepRemaining -= dt;
    bomb.beepPulse = Math.max(0, bomb.beepPulse - dt);
    if (bomb.beepRemaining <= 0 && bomb.timer > 0) {
      this.soundscape.play(
        bomb.timer <= 10 ? "bomb-beep-fast" : "bomb-beep",
        false,
        "concrete",
        bomb.position,
      );
      // Tighten the pulse interval continuously from one second to 150 ms.
      bomb.beepRemaining = 0.15 + 0.85 * Math.max(0, bomb.timer / 40);
      bomb.beepPulse = 0.08;
    }
    if (bomb.timer <= 0) {
      this.soundscape.play("bomb-explode", false, "concrete", bomb.position);
      this.detonateBomb();
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
          (!b.tracking || b.group.position.distanceTo(b.memory) > 8) &&
          b.group.position.distanceTo(bomb.position) < 1.6,
      );
      if (index >= 0) defuser = index;
    }
    if (bomb.defuser !== defuser) {
      if (defuser !== null)
        this.soundscape.play("bomb-defuse-start", false, "concrete", bomb.position);
      bomb.progress = 0;
      if (defuser === "player") {
        this.revolverCharge = this.reload = this.inspectTime = this.knifeTime = this.shotTime = 0;
        this.lastShot = this.emptyReload = false;
        this.knifePending = false;
        this.rescope = 0;
        this.setScope(0);
      }
    }
    bomb.defuser = defuser;
    if (defuser !== null) {
      const duration = (defuser === "player" ? this.defuseKit : this.bots[defuser].defuseKit)
        ? 5
        : 10;
      bomb.progress += dt;
      if (defuser === "player") {
        this.firing = false;
        this.velocity.x = this.velocity.z = 0;
      } else this.bots[defuser].moving = false;
      if (bomb.progress >= duration) {
        this.notices.completeAction("defuse");
        this.soundscape.play("bomb-defuse", false, "concrete", bomb.position);
        const mode = this.competitive ? "competitive" : "casual";
        if (defuser === "player") this.money = addMoney(this.money, this.rules.defuseReward, mode);
        else
          this.bots[defuser].money = addMoney(
            this.bots[defuser].money,
            this.rules.defuseReward,
            mode,
          );
        this.endRound("ct", "Bomb defused");
      }
    } else bomb.progress = 0;
  }
  updateBombPlant(dt: number, postRound = false) {
    const bomb = this.bomb;
    if (!bomb || bomb.planted) return;
    const stationary = !["KeyW", "KeyA", "KeyS", "KeyD", "Space"].some((key) => this.keys.has(key));
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
      const atSite = mapTriggers(this.dust ?? {}).bombSites.contains(position, {
        halfWidth: 0.3,
        height:
          bomb.carrier === "player"
            ? this.eye
            : this.bots[bomb.carrier].rig.crouch > 0.5
              ? 1.1
              : 1.65,
      });
      const planting =
        atSite &&
        (bomb.carrier !== "player" ||
          (!this.dead &&
            this.grounded &&
            stationary &&
            this.bombSelected &&
            this.bombDrawTime === 0 &&
            (this.keys.has("KeyE") || this.firing)));
      if (planting && bomb.carrier === "player" && bomb.plantProgress === 0) {
        this.revolverCharge = this.reload = this.inspectTime = this.knifeTime = this.shotTime = 0;
        this.lastShot = this.emptyReload = false;
        this.knifePending = false;
        this.rescope = 0;
        this.setScope(0);
      }
      const previousPlantProgress = bomb.plantProgress;
      bomb.plantProgress = planting ? bomb.plantProgress + dt : 0;
      this.soundscape.playBombPlant(
        previousPlantProgress,
        bomb.plantProgress,
        bomb.carrier === "player" ? undefined : bomb.position,
      );
      if (planting) {
        if (bomb.carrier === "player") {
          this.velocity.x = this.velocity.z = 0;
        } else this.bots[bomb.carrier].moving = false;
      }
      if (bomb.plantProgress >= PLANT_DURATION) {
        const mode = this.competitive ? "competitive" : "casual";
        if (!postRound && bomb.carrier === "player")
          this.money = addMoney(this.money, this.rules.plantReward, mode);
        else if (!postRound && typeof bomb.carrier === "number")
          this.bots[bomb.carrier].money = addMoney(
            this.bots[bomb.carrier].money,
            this.rules.plantReward,
            mode,
          );
        if (bomb.carrier === "player") this.firing = false;
        bomb.planted = true;
        if (!postRound) this.soundscape.playMusic("bomb");
        bomb.planter = bomb.carrier;
        bomb.carrier = -1;
        this.updateBombSelection(0);
        bomb.plantProgress = 0;
        bomb.timer = 40;
        this.bombMesh.position.copy(position).y += 0.005;
        this.bombMesh.visible = true;
        this.notices.completeAction("plant");
        this.notices.showBombPlanted(bomb.timer);
        this.soundscape.play("bomb-plant", false, "concrete", bomb.position);
        this.bots.forEach((b) => {
          b.nav = 0;
        });
      }
      return;
    }
  }
  takeOverBot() {
    if (this.network) return;
    const bot = this.spectated;
    if (
      !this.active ||
      !this.locked ||
      !this.teamMode ||
      !this.dead ||
      this.roundPause > 0 ||
      this.spectatorMode === "free" ||
      !bot ||
      bot.team !== this.team ||
      bot.health <= 0 ||
      !this.bots.includes(bot)
    )
      return false;
    const index = this.bots.indexOf(bot);
    const weapon = bot.rig.weaponIndex;
    this.position.copy(bot.group.position);
    this.velocity = { x: bot.velocity.x, z: bot.velocity.y };
    this.vertical = bot.vertical;
    this.ladderState = { ...bot.ladderState };
    this.grounded = bot.vertical === 0 && !this.ladder;
    this.yaw = bot.group.rotation.y + Math.PI;
    this.pitch = 0;
    if (bot.tracking) {
      const direction = bot.aim
        .clone()
        .sub(this.position)
        .sub(new T.Vector3(0, 1.45, 0));
      this.yaw = Math.atan2(-direction.x, -direction.z);
      this.pitch = clamp(
        Math.atan2(direction.y, Math.hypot(direction.x, direction.z)),
        -1.45,
        1.45,
      );
    }
    this.groundInventory.reset();
    this.groundInventory.instances.set(weapon, bot.rig.weaponInstance);
    this.utility.takeover(this.bots.indexOf(bot));
    this.health = bot.health;
    this.armor = bot.armor;
    this.helmet = bot.helmet;
    this.defuseKit = bot.defuseKit;
    this.invulnerable = 0;
    // Keep the consumed body's posture, including native low passages where
    // standing would put the player's hull through the ceiling. Normal duck
    // release checks let the player stand once there is clearance again.
    const crouch =
      bot.navCrouch ||
      this.isBlocked(
        this.position.x,
        this.position.z,
        this.position.y,
        movement.hullRadius,
        movement.standingHeight,
      )
        ? 1
        : clamp(bot.rig.crouch, 0, 1);
    this.eye = T.MathUtils.lerp(movement.standingEye, movement.duckEye, crouch);
    this.duckHeld = this.duckAccepted = this.jumpQueued = false;
    this.duckCooldown = 0;
    this.duckTransitionRate = 15;
    this.dead = 0;
    this.deathDamage.reset();
    hideDeathcam();
    this.keys.clear();
    this.takeoverUseHeld = true;
    this.firing = false;
    this.kick = this.damage = this.hit = 0;
    this.weaponAudio.stop();
    this.weaponCooldowns.fill(0);
    this.reloadLockouts.fill(0);
    this.weaponCooldowns[weapon] = Math.max(0, bot.shot);
    this.primary = weaponSlot(weapon) === 1 ? weapon : null;
    this.secondary = weaponSlot(weapon) === 2 ? weapon : this.team === "t" ? 7 : 2;
    if (weaponSlot(weapon) === 1)
      this.groundInventory.instances.set(
        this.secondary,
        createWeaponInstance(this.secondary, bot.rig.weaponInstance.creator),
      );
    this.magazines = weapons.map(() => ({ ammo: 0, reserve: 0 }));
    this.ammo = this.reserve = 0;
    this.suppressors = weapons.map(() => new SuppressorState());
    this.suppressors[weapon].attached = bot.rig.suppressed;
    this.equip(weapon);
    this.aimPunch = { ...bot.aimPunch };
    this.weaponRecoil = weapons.map(() => createWeaponRecoil());
    this.weaponAccuracy = weapons.map(() => createWeaponAccuracy());
    this.actorCarrier = null;
    this.weaponRecoil[weapon] = { ...bot.weaponRecoil };
    this.weaponAccuracy[weapon] = { ...bot.weaponAccuracy };
    this.ammo = bot.ammo;
    this.reserve = bot.reserve;
    this.magazines[weapon] = { ammo: this.ammo, reserve: this.reserve };
    // Bots can fall back to their faction pistol once their primary runs dry.
    if (weapon !== this.secondary)
      this.magazines[this.secondary] = {
        ammo: weapons[this.secondary].mag,
        reserve: weapons[this.secondary].reserve,
      };
    this.drawTime = 0;
    this.cooldown = Math.max(0, bot.shot);
    this.boltTime = weapons[weapon].unzoomsAfterShot ? this.cooldown : 0;
    // Magazine reloads share the same transfer point. Bot shell reloads use a
    // different timeline: cancel the uncommitted shell, preserving existing ammo.
    this.reload = weapons[weapon].reloadStyle === "shell" ? 0 : bot.reloadTime;
    this.emptyReload = this.reload > 0 && weapon === 8 && this.ammo === 0;
    this.shellPhase = "intro";
    this.shellInserted = false;
    if (this.bomb?.carrier === index) {
      this.bomb.carrier = "player";
      this.bomb.plantProgress = 0;
    }
    if (this.bomb?.defuser === index) {
      this.bomb.defuser = null;
      this.bomb.progress = 0;
    }
    // Keep stable bot indices for bomb and AI references; consume this body
    // without spawning a corpse or awarding a kill. The next round restores it.
    bot.health = 0;
    bot.group.visible = false;
    bot.respawn = Infinity;
    bot.moving = false;
    bot.reloadTime = 0;
    for (const other of this.bots) if (other.target === index) other.target = "player";
    this.spectated = undefined;
    this.spectatorMode = "first";
    this.spectatorShotAt = -Infinity;
    this.spectatorLastShot = false;
    toggle("death-banner", false);
    this.updateUI();
    if (!el("scoreboard").classList.contains("hidden")) this.scoreboard();
    return true;
  }
  cycleSpectatorMode(direction: number) {
    if (this.competitive) {
      this.spectatorMode = "first";
      this.keys.clear();
      this.spectate();
      return;
    }
    const current = spectatorModes.indexOf(this.spectatorMode);
    this.spectatorMode =
      spectatorModes[(current + direction + spectatorModes.length) % spectatorModes.length];
    this.keys.clear();
    this.spectatorShotAt = -Infinity;
    this.spectatorLastShot = false;
    if (this.spectatorMode === "free") {
      // Start flight at the current viewpoint, without moving the dead player's body.
      this.spectatorYaw = this.camera.rotation.y;
      this.spectatorPitch = this.camera.rotation.x;
    } else {
      this.spectatorYaw = 0;
      this.spectatorPitch = 0.21;
    }
    this.spectate();
  }
  moveSpectator(dt: number) {
    if (this.competitive) {
      this.spectate();
      return;
    }
    const right = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const forward = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const up =
      Number(this.keys.has("Space")) -
      Number(
        this.keys.has("ControlLeft") || this.keys.has("ControlRight") || this.keys.has("KeyC"),
      );
    this.camera.rotation.set(this.spectatorPitch, this.spectatorYaw, 0);
    this.spectatorOffset.set(right, 0, -forward).applyEuler(this.camera.rotation);
    this.spectatorOffset.y += up;
    const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 24 : 8;
    this.camera.position.addScaledVector(this.spectatorOffset.normalize(), speed * dt);
  }
  spectate(cycle = 0) {
    if (this.competitive) this.spectatorMode = "first";
    if (this.spectatorMode === "free") {
      this.camera.rotation.set(this.spectatorPitch, this.spectatorYaw, 0);
      return;
    }
    let teammate = this.spectated;
    const current = teammate ? this.bots.indexOf(teammate) : -1;
    if (
      cycle ||
      current < 0 ||
      !teammate ||
      (this.competitive && teammate.team !== this.team) ||
      teammate.health <= 0
    ) {
      teammate = undefined;
      const direction = cycle < 0 ? -1 : 1;
      const start = current < 0 && direction < 0 ? 0 : current;
      for (let offset = 1; offset <= this.bots.length; offset++) {
        const index = (start + direction * offset + this.bots.length) % this.bots.length;
        const candidate = this.bots[index];
        if ((!this.competitive || candidate.team === this.team) && candidate.health > 0) {
          teammate = candidate;
          break;
        }
      }
    }
    if (this.spectated !== teammate) {
      this.spectatorShotAt = -Infinity;
      this.spectatorLastShot = false;
    }
    this.spectated = teammate;
    if (!teammate) {
      if (this.competitive) {
        const bomb = this.bomb;
        const carrier =
          bomb && !bomb.planted && typeof bomb.carrier === "number"
            ? this.bots[bomb.carrier]
            : undefined;
        this.spectatorFocus.copy(carrier?.group.position ?? bomb?.position ?? this.position).y +=
          0.1;
        const pitch = clamp(this.spectatorPitch, 0.35, 1.55);
        this.spectatorOffset.set(0, Math.sin(pitch), Math.cos(pitch));
        this.spectatorRay.set(this.spectatorFocus, this.spectatorOffset);
        const obstruction = this.world.collision?.intersections(this.spectatorRay, 3)[0];
        this.camera.position
          .copy(this.spectatorFocus)
          .addScaledVector(
            this.spectatorOffset,
            obstruction ? Math.max(0.15, obstruction.distance - 0.15) : 3,
          );
        this.camera.lookAt(this.spectatorFocus);
      }
      return;
    }
    const p = teammate.group.position,
      yaw = teammate.group.rotation.y;
    if (this.spectatorMode === "first") {
      this.camera.position.copy(p).y += 1.6;
      const target =
        teammate.target === "player"
          ? this.position
          : teammate.target !== null
            ? this.bots[teammate.target]?.group.position
            : undefined;
      if (teammate.tracking && target) {
        this.spectatorFocus.copy(target).y += 1.3;
        this.camera.lookAt(this.spectatorFocus);
      } else this.camera.rotation.set(0, yaw + Math.PI, 0);
      this.camera.rotation.x += teammate.aimPunch.pitch * RECOIL_VIEW_SCALE;
      this.camera.rotation.y += teammate.aimPunch.yaw * RECOIL_VIEW_SCALE;
      this.network?.syncSpectatorView();
      return;
    }
    this.spectatorFocus.copy(p).y += 1.4;
    const orbit = yaw + this.spectatorYaw;
    const horizontal = Math.cos(this.spectatorPitch) * 3.07;
    this.spectatorOffset.set(
      -Math.sin(orbit) * horizontal,
      Math.sin(this.spectatorPitch) * 3.07,
      -Math.cos(orbit) * horizontal,
    );
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
  }
  perceiveBot(b: Bot, dt: number) {
    const pos = b.group.position;
    const from = pos.clone().add(new T.Vector3(0, 1.45, 0));
    const oldTarget = b.target;
    const candidates: {
      id: number | "player";
      position: T.Vector3;
      distance: number;
      score: number;
    }[] = [];
    const consider = (id: number | "player", position: T.Vector3, attacking: boolean) => {
      const distance = pos.distanceTo(position);
      if (
        distance > 65 ||
        !inBotView(b.facing, position.x - pos.x, position.z - pos.z, b.alert > 0)
      )
        return;
      const aim = position
        .clone()
        .add(new T.Vector3(0, id === "player" && this.eye < 1.35 ? 0.9 : 1.3, 0));
      if (
        !this.utility.blind.has(this.bots.indexOf(b)) &&
        this.visible(from, aim) &&
        this.utility.clearSight(from, aim)
      )
        candidates.push({
          id,
          position,
          distance,
          score: targetPriority(distance, id === oldTarget, attacking),
        });
    };
    if (!this.dead && (!this.teamMode || b.team !== this.team))
      consider("player", this.position, this.firing);
    if (this.teamMode || this.mode === "deathmatch")
      this.bots.forEach((other, index) => {
        if (other !== b && other.health > 0 && (!this.teamMode || other.team !== b.team))
          consider(index, other.group.position, other.tracking);
      });
    candidates.sort((a, c) => a.score - c.score);
    const target = candidates[0];
    b.alert = Math.max(0, b.alert - dt);
    b.report = Math.max(0, b.report - dt);
    b.suppressTime = Math.max(0, b.suppressTime - dt);
    b.target = target?.id ?? null;
    b.tracking = !!target;
    if (target) {
      if (oldTarget !== target.id) {
        b.reaction = 0.22 + (b.group.id % 5) * 0.025;
        b.burst = 0;
      }
      b.memory.copy(target.position);
      b.alert = 5;
      b.report = 1.5;
      const height =
        target.id === "player" && this.eye < 1.35
          ? 0.85
          : b.group.id % 4 === 0 && target.distance < 24
            ? 1.53
            : 1.22;
      const aim = target.position.clone().add(new T.Vector3(0, height, 0));
      // Acquisition and tracking have finite speed; strafing can evade a shot.
      b.aim.lerp(aim, 1 - Math.exp(-dt * 11));
      b.facing = Math.atan2(b.aim.x - pos.x, b.aim.z - pos.z);
      b.reaction = Math.max(0, b.reaction - dt);
      if (b.reaction === 0) {
        b.lastSight.copy(aim);
        b.suppressTime = 0.65;
        b.suppressShots = 3;
      }
    } else {
      b.reaction = 0.3;
      if (b.suppressTime > 0) b.aim.copy(b.lastSight);
      // Reports are copies of recently seen positions, never live wall tracking.
      const teammate = this.teamMode
        ? this.bots.find(
            (other) =>
              other !== b &&
              other.team === b.team &&
              other.health > 0 &&
              other.tracking &&
              other.report > 0 &&
              other.group.position.distanceTo(pos) < 24,
          )
        : undefined;
      if (teammate && b.alert < 2) {
        b.memory.copy(teammate.memory);
        b.alert = 2;
      }
      // Only loud running/fire reveals a last-known player position. Walking,
      // crouching and standing behind cover do not give bots a tracking target.
      const distance = pos.distanceTo(this.position);
      const running = Math.hypot(this.velocity.x, this.velocity.z) > 3.5;
      if (
        !this.dead &&
        (!this.teamMode || b.team !== this.team) &&
        ((this.shotTime > 0 && distance < (this.isSuppressed(this.selected) ? 12 : 32)) ||
          (running && distance < 9))
      ) {
        b.memory.copy(this.position);
        b.memory.x += Math.sin(b.group.id) * 1.4;
        b.memory.z += Math.cos(b.group.id) * 1.4;
        b.alert = Math.max(b.alert, 2);
      }
      if (b.alert > 0 && !b.moving) b.facing = Math.atan2(b.memory.x - pos.x, b.memory.z - pos.z);
    }
    return target;
  }
  botCombat(b: Bot, target: ReturnType<Game["perceiveBot"]> | undefined, dt: number) {
    if (this.utility.blind.has(this.bots.indexOf(b))) {
      b.tracking = false;
      b.suppressTime = 0;
      b.burst = 0;
      return;
    }
    const weapon = weapons[b.rig.weaponIndex];
    const suppressing = !target && b.suppressTime > 0 && b.suppressShots > 0;
    const distanceToAim = target?.distance ?? b.group.position.distanceTo(b.lastSight);
    b.shot -= dt;
    if (b.reloadTime > 0) {
      b.reloadTime = Math.max(0, b.reloadTime - dt);
      if (!b.reloadTime) {
        if (weapon.reloadStyle === "shell") {
          b.ammo++;
          if (this.mode !== "deathmatch") b.reserve--;
        } else {
          const loaded = reloadMagazine(
            b.rig.weaponIndex,
            b.ammo,
            this.mode === "deathmatch" ? weapon.mag : b.reserve,
          );
          b.ammo = loaded.ammo;
          if (this.mode !== "deathmatch") b.reserve = loaded.reserve;
        }
        if (weapon.reloadStyle === "shell" && !target && b.ammo < weapon.mag && b.reserve > 0)
          b.reloadTime = weapon.reload;
      }
      return;
    }
    if (b.ammo === 0 || (!target && b.alert < 3 && b.ammo < weapon.mag * 0.45)) {
      if (b.reserve > 0) b.reloadTime = weapon.reload;
      // Once the rifle is dry, keep fighting with a finite sidearm magazine.
      else if (b.rig.weaponIndex !== 2 && b.rig.weaponIndex !== 7) {
        setSoldierWeapon(b.rig, b.team === "t" ? 7 : 2);
        b.ammo = weapons[b.rig.weaponIndex].mag;
        b.reserve = weapons[b.rig.weaponIndex].reserve;
        b.shot = 0.5;
      }
      return;
    }
    if (
      (!target && !suppressing) ||
      (!suppressing && b.reaction > 0) ||
      b.shot > 0 ||
      b.speed > 1.1 ||
      this.mode === "practice"
    )
      return;
    if (
      this.bomb &&
      ((this.bomb.carrier === this.bots.indexOf(b) && this.bomb.plantProgress > 0) ||
        this.bomb.defuser === this.bots.indexOf(b))
    )
      return;
    const from = b.group.position.clone().add(new T.Vector3(0, 1.45, 0));
    const direction = b.aim.clone().sub(from).normalize();
    // Do not fire through a teammate who has crossed the firing lane.
    const line = new T.Ray(from, direction);
    if (
      this.teamMode &&
      (this.bots.some(
        (other) =>
          other !== b &&
          other.team === b.team &&
          other.health > 0 &&
          other.group.position.distanceTo(from) < distanceToAim &&
          botBodyHit(line, other.group.position),
      ) ||
        (b.team === this.team &&
          !this.dead &&
          this.position.distanceTo(from) < distanceToAim &&
          botBodyHit(line, this.position, this.eye < 1.35)))
    ) {
      b.cover.copy(this.botCover(b, false) ?? b.group.position);
      b.reposition = true;
      b.tactic = 1.4;
      b.nav = 0;
      return;
    }
    const stats = ballistics[b.rig.weaponIndex];
    const mode = (weapon.suppressed && b.rig.suppressed) || weapon.zoomLevels > 0 ? 1 : 0;
    const accuracyPose = this.botAccuracyPose(b);
    const inaccuracy = weaponInaccuracy(b.rig.weaponIndex, b.weaponAccuracy, accuracyPose);
    // Bot aiming error remains separate from physical weapon dispersion.
    const aimError =
      botAimSpread(distanceToAim, b.speed, b.burst, suppressing ? 0 : b.reaction) +
      (suppressing ? 0.012 : 0);
    b.spawnProtection = 0;
    b.ammo--;
    if (suppressing) b.suppressShots--;
    b.burst++;
    b.shot = weapon.delay;
    if (b.burst >= burstLength(distanceToAim, weapon.auto)) {
      b.shot = Math.max(weapon.delay, distanceToAim > 20 ? 0.32 : 0.19);
      b.burst = 0;
    }
    b.rig.recoil = 1;
    b.rig.shotTime = 0.25;
    if (b === this.spectated) {
      this.spectatorShotAt = this.animationTime;
      this.spectatorLastShot = b.rig.weaponIndex === 8 && b.ammo === 0;
    }
    this.worldSound("bot", from, b.rig.weaponIndex, b.rig.suppressed);
    const shotPitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
    const shotYaw = Math.atan2(-direction.x, -direction.z);
    const basis = new T.Quaternion().setFromEuler(
      new T.Euler(shotPitch + b.aimPunch.pitch, shotYaw + b.aimPunch.yaw, 0, "YXZ"),
    );
    const aimOffset = spreadOffset(aimError * 0.5, Math.random(), Math.random());
    const offsets = weaponShotSpread(
      b.rig.weaponIndex,
      mode,
      b.weaponRecoil.index,
      inaccuracy,
      weapon.pellets,
    );
    for (const offset of offsets) {
      const shot = new T.Vector3(aimOffset.x + offset.x, aimOffset.y + offset.y, -1)
        .normalize()
        .applyQuaternion(basis);
      const ray = new T.Ray(from, shot);
      const caster = new T.Raycaster(from, shot, 0, stats.range / SOURCE_UNITS_PER_METER);
      const cover = this.world.collision
        ? this.world.collision.intersections(ray, caster.far)
        : caster.intersectObjects(this.world.solids, false);
      const surfaces = cover.map((impact) => this.bulletCover(impact, ray));
      const intersect = (id: number | "player", feet: T.Vector3, crouch = false) => {
        const hit =
          typeof id === "number"
            ? soldierHit(this.bots[id].rig, ray, caster.far)
            : botBodyHit(ray, feet, crouch);
        if (!hit) return;
        const surface = this.bulletBody(
          id,
          hit.point,
          hit.head,
          ray,
          "height" in hit && typeof hit.height === "number" ? hit.height : undefined,
        );
        const friendly =
          this.teamMode && (id === "player" ? b.team === this.team : this.bots[id].team === b.team);
        surface.stop = friendly && !this.competitive;
        surfaces.push(surface);
      };
      if (!this.dead) intersect("player", this.position, this.crouching);
      this.bots.forEach((other, index) => {
        if (other !== b && other.health > 0)
          intersect(index, other.group.position, other.rig.crouch > 0.5);
      });
      const result = solveBullet(stats, surfaces);
      this.trace(
        from,
        from.clone().addScaledVector(shot, result.endDistance),
        b.rig.weaponIndex,
        weapons[b.rig.weaponIndex].suppressed && b.rig.suppressed,
      );
      const damagedBreakables = new Set<string>();
      for (const { surface, damage: rawDamage, passed } of result.contacts) {
        const data = surface.data;
        if (data.doorId) {
          this.world.doors.damage(data.doorId, rawDamage, "bullet");
          this.syncMapDoors();
        }
        if (data.breakableId && !damagedBreakables.has(data.breakableId)) {
          damagedBreakables.add(data.breakableId);
          this.damageMapBreakable(data.breakableId, rawDamage, "bullet", data.point, shot);
        }
        const victim = data.actor;
        if (victim === undefined) {
          if (
            data.normal &&
            (!data.breakableId || this.world.breakables.health(data.breakableId)! > 0)
          )
            this.decal(decalPoint.copy(data.point).addScaledVector(shot, -0.015), data.normal);
          continue;
        }
        const head = data.head!;
        const damage = rawDamage * hitgroupMultiplier(head, data.height!, weapon.head, data.crouch);
        if (victim === "player") {
          if ((this.mode === "casual" && b.team === this.team) || this.invulnerable > 0) continue;
          this.damageActor("player", damage, data, b.rig.weaponIndex, b.team, "bullet", b);
          this.damage = 0.25;
          this.soundscape.play("damage");
          if (!this.health) {
            this.deaths++;
            this.rewardKill(b, this.team, b.rig.weaponIndex, "player");
            this.dead = this.teamMode ? Infinity : 2.5;
            this.revolverCharge = this.knifeTime = this.inspectTime = 0;
            this.knifePending = false;
            this.setScope(0);
            this.firing = false;
            this.rescope = this.boltTime = this.reload = 0;
            this.lastShot = this.emptyReload = false;
            if (this.teamMode) this.dropBomb("player");
            if (
              !["bomb", "bomb-countdown", "countdown", "mvp"].includes(
                this.soundscape.currentMusic ?? "",
              )
            )
              this.soundscape.playMusic("deathcam");
            this.soundscape.play("death");
            this.feed(b.name, "YOU", head, b.rig.weaponIndex, false, passed);
          }
          this.updateUI();
        } else {
          const other = this.bots[victim];
          if (this.mode === "casual" && other.team === b.team) continue;
          this.damageActor(other, damage, data, b.rig.weaponIndex, b.team, "bullet", b);
          other.memory.copy(b.group.position);
          other.alert = 5;
          other.tactic = 0;
          other.facing = Math.atan2(
            b.group.position.x - other.group.position.x,
            b.group.position.z - other.group.position.z,
          );
          if (other.health <= 0) {
            other.deaths++;
            this.rewardKill(b, other.team, b.rig.weaponIndex, other);
            other.respawn = this.teamMode ? Infinity : 3;
            other.moving = false;
            if (this.teamMode) this.dropBomb(victim);
            this.feed(b.name, other.name, head, b.rig.weaponIndex, false, passed);
          }
        }
      }
    }
    applyFiringInaccuracy(b.weaponAccuracy, b.rig.weaponIndex, mode, accuracyPose);
    applyWeaponRecoil(b.aimPunch, b.weaponRecoil, b.rig.weaponIndex, mode);
  }
  botCover(b: Bot, retreat: boolean) {
    const pos = b.group.position;
    const threat = b.memory.clone().add(new T.Vector3(0, 1.4, 0));
    let best: T.Vector3 | null = null;
    let score = -Infinity;
    for (let k = 0; k < 8; k++) {
      const angle = b.facing + (k * Math.PI) / 4;
      const point = pos.clone().add(new T.Vector3(Math.sin(angle) * 3, 0, Math.cos(angle) * 3));
      if (this.isBlocked(point.x, point.z, pos.y, 0.35)) continue;
      if (this.teamMode && !this.botSupport(b, point.x, point.z, pos.y + 0.45, pos.y - 0.6))
        continue;
      const hidden = !this.visible(threat, point.clone().add(new T.Vector3(0, 1.4, 0)));
      const space = Math.min(
        ...this.bots
          .filter((other) => other !== b && other.health > 0)
          .map((other) => other.group.position.distanceTo(point)),
        5,
      );
      const value =
        (hidden === retreat ? 8 : 0) +
        space +
        (retreat ? point.distanceTo(b.memory) - pos.distanceTo(b.memory) : -Math.abs(k - 2) * 0.15);
      if (value > score) {
        score = value;
        best = point;
      }
    }
    return best;
  }
  resetBotStrategies() {
    if (!this.dust || !this.teamMode || this.network) {
      this.botStrategies = null;
      return;
    }
    const nav = this.dust.navigation;
    if (!this.botStrategyRoutes || this.botStrategyNavigation !== nav) {
      this.botStrategyRoutes = buildBotStrategyRoutes(nav);
      this.botStrategyNavigation = nav;
    }
    const create = (team: AgentTeam) =>
      new BotRoundStrategy({
        team,
        round: this.round,
        seed: this.botStrategySeed,
        members: this.bots.flatMap((b, index) => (b.team === team ? [index] : [])),
        routes: this.botStrategyRoutes!,
        roundTime: this.rules.roundTime,
      });
    this.botStrategies = { t: create("t"), ct: create("ct") };
    this.botStrategyRound = this.round;
    this.botStrategyThink = 0.25;
    this.updateBotStrategies(0);
  }
  updateBotStrategies(dt: number) {
    if (!this.botStrategies || !this.bomb || !this.dust) return;
    const bomb = this.bomb;
    const point = (p: T.Vector3): StrategyPoint => [p.x, p.y, p.z];
    for (const team of ["t", "ct"] as const) {
      // This boundary deliberately supplies own-team positions and finite
      // sight reports only. Hidden opponents never enter the coordinator.
      const allies = this.bots.flatMap((b, index) =>
        b.team === team
          ? [
              {
                index,
                position: point(b.group.position),
                alive: b.health > 0,
              },
            ]
          : [],
      );
      if (this.team === team)
        allies.push({ index: -2, position: point(this.position), alive: !this.dead });
      const reports = this.bots.flatMap((b) =>
        b.team === team && b.health > 0 && b.report > 0
          ? [
              {
                position: point(b.memory),
                age: Math.max(0, 1.5 - b.report),
              },
            ]
          : [],
      );
      let position: StrategyPoint | null = null;
      if (bomb.planted) position = point(bomb.position);
      else if (team === "t") {
        const carrier =
          bomb.carrier === "player"
            ? this.position
            : bomb.carrier >= 0
              ? this.bots[bomb.carrier]?.group.position
              : null;
        position = point(carrier ?? bomb.position);
      }
      const site = bomb.planted
        ? bomb.position.distanceToSquared(this.dust.navigation.site(0)) <
          bomb.position.distanceToSquared(this.dust.navigation.site(1))
          ? "a"
          : "b"
        : undefined;
      this.botStrategies[team].update({
        dt,
        remaining: this.time,
        allies,
        reports,
        bomb: { planted: bomb.planted, position, carrier: team === "t" ? bomb.carrier : -1, site },
      });
    }
  }
  updateCasualBots(dt: number, phase: number) {
    const nav = this.dust!.navigation,
      bomb = this.bomb!;
    if (!this.botStrategies || this.botStrategyRound !== this.round) this.resetBotStrategies();
    if (phase === 0) {
      this.botStrategyThink -= dt;
      if (this.botStrategyThink <= 0) {
        this.botStrategyThink = 0.25;
        this.updateBotStrategies(0.25);
      }
    }
    const defuser = bomb.planted
      ? nearestDefuser(
          this.bots.flatMap((b, index) =>
            b.team === "ct" && b.health > 0
              ? [{ index, distance: b.group.position.distanceTo(bomb.position), busy: b.tracking }]
              : [],
          ),
          bomb.defuser,
        )
      : null;
    for (let i = phase; i < this.bots.length; i += 8) {
      const b = this.bots[i];
      if (b.health <= 0) continue;
      const pos = b.group.position;
      const target = this.perceiveBot(b, dt);
      this.botCombat(b, target, dt);
      b.tactic -= dt;
      let goal: T.Vector3;
      const order = this.botStrategies?.[b.team].order(i);
      b.quiet = target || b.alert > 0 ? 0 : b.quiet + dt;
      const objectiveCommit =
        (!bomb.planted && bomb.carrier === i) || (bomb.planted && defuser === i);
      let committed = order?.urgent || objectiveCommit;
      // Clear the chosen site with spaced goals. CTs anchor initially,
      // then sweep quiet approaches; a stationary carrier never holds a squad.
      const site = order
        ? order.site === "a"
          ? 0
          : 1
        : b.team === "t"
          ? this.round % nav.data.sites.length
          : i % nav.data.sites.length;
      goal = order
        ? new T.Vector3().fromArray(order.goal)
        : nav.site(
            site,
            b.team === "ct" ? ((i % 3) - 1) * 4 : ((i % 3) - 1) * 2,
            b.team === "ct" ? (i % 2 ? 4 : -4) : 0,
          );
      const objective = nav.site(site);
      // The carrier must reach the plant trigger, not an offset squad anchor.
      if (!order && bomb.carrier === i && !bomb.planted) goal = nav.site(site);
      if (
        !order &&
        !bomb.planted &&
        !committed &&
        b.quiet > 12 &&
        (b.team === "ct" || pos.distanceTo(goal) < 12)
      )
        goal = b.nav <= dt ? botSearchGoal(nav.areas, goal, i, b.quiet) : b.goal;
      if (bomb.planted && (defuser === i || !order)) {
        goal = bomb.position.clone();
        if (b.team === "t" || defuser !== i) {
          const angle = (i * 2.4) % (Math.PI * 2);
          goal.add(new T.Vector3(Math.sin(angle) * 5, 0, Math.cos(angle) * 5));
        }
      } else if (!order && bomb.carrier === -1 && b.team === "t") goal = bomb.position;
      if (
        (!order || (target && target.distance < 12)) &&
        b.alert > 0 &&
        !(bomb.planted && defuser === i) &&
        bomb.carrier !== i &&
        (!bomb.planted || pos.distanceTo(b.memory) < 20)
      )
        goal = b.memory;
      // A distant contact must not strand an escort after its squad advances.
      const leaderId = b.team === "t" && !bomb.planted ? bomb.carrier : defuser;
      const leader =
        leaderId === "player"
          ? !this.dead && this.team === b.team
            ? this.position
            : null
          : typeof leaderId === "number" &&
              leaderId >= 0 &&
              leaderId !== i &&
              this.bots[leaderId]?.health > 0 &&
              this.bots[leaderId].team === b.team
            ? this.bots[leaderId].group.position
            : null;
      const independent = b.team === "t" && i % 4 === 0;
      const leaderOrder =
        typeof leaderId === "number" && leaderId >= 0
          ? this.botStrategies?.[b.team].order(leaderId)
          : null;
      const sameAssignment =
        !order || (!!order.urgent && (!leaderOrder || order.lane === leaderOrder.lane));
      const regroup =
        sameAssignment && leader && (!independent || b.regrouping || pos.distanceTo(leader) > 18)
          ? botRegroupGoal(
              pos,
              leader,
              i,
              b.regrouping,
              bomb.planted ? bomb.position : objective,
              leaderId === "player"
                ? Math.hypot(this.velocity.x, this.velocity.z) > 0.8
                : typeof leaderId === "number" &&
                    this.bots[leaderId]?.moving &&
                    this.bots[leaderId].speed > 0.8,
            )
          : null;
      b.regrouping = !!regroup;
      if (regroup && !committed) {
        goal = regroup;
        committed = true;
      }
      const retreat = b.reloadTime > 0 || b.health < 32;
      if (
        !objectiveCommit &&
        b.alert > 0 &&
        b.tactic <= 0 &&
        (retreat || target) &&
        (!committed || retreat)
      ) {
        b.cover.copy(this.botCover(b, retreat) ?? pos);
        b.tactic = retreat ? 2.2 : 1.4 + (i % 3) * 0.2;
        b.reposition = retreat || (b.burst === 0 && b.shot > 0.16);
        if (b.reposition) b.nav = 0;
      }
      if (!objectiveCommit && b.reposition && b.tactic > 0 && pos.distanceTo(b.cover) > 0.5)
        goal = b.cover;
      else b.reposition = false;
      goal = this.utility.botGoal(i, goal);
      b.moving = botShouldMove({
        distance: pos.distanceTo(goal),
        arrival: committed ? 0.6 : 1.3,
        targetDistance: target?.distance ?? null,
        suppressing: b.suppressTime > 0,
        reposition: b.reposition,
        committed,
        interacting: (bomb.plantProgress > 0 && bomb.carrier === i) || bomb.defuser === i,
      });
      if (!b.moving && !target && b.alert <= 0) {
        if (order?.watch) b.facing = Math.atan2(order.watch[0] - pos.x, order.watch[2] - pos.z);
        else b.facing += dt * 0.28;
      }
      b.nav -= dt;
      // New orders invalidate an old route, including a local recovery route.
      const changedGoal = b.goal.distanceTo(goal) > 3;
      if (changedGoal) b.nav = 0;
      if (b.nav <= 0 && b.moving && (b.vertical === 0 || !b.path.length)) {
        b.nav = 0.75 + (i % 5) * 0.09;
        // Keep a viable route while neighbours move. Repeated congestion
        // replans can make the entire squad reverse course around each other.
        if (!changedGoal && b.path.length && !b.reposition) continue;
        b.goal.copy(goal);
        b.path = nav.path(
          pos,
          goal,
          this.bots
            .filter((other) => other !== b && other.team === b.team && other.health > 0)
            .map((other) => other.group.position),
          b.blockedAreas,
          true,
          nav.areas[b.navArea],
        );
        if (!b.path.length) b.blockedAreas.clear();
      }
    }
  }
  // Each bot thinks at 16 Hz, distributing perception/pathfinding over 8 steps.
  updateBotPurchases(dt: number, phase: number) {
    for (let i = phase; i < this.bots.length; i += 8) {
      const b = this.bots[i];
      if (b.health <= 0 || b.buyTime <= 0) continue;
      b.buyTime -= dt;
      if (b.buyTime <= 0) {
        if (
          this.teamMode &&
          (this.roundPause > 0 ||
            this.buyRemaining <= 0 ||
            !mapTriggers(this.dust ?? {}).buyZones.contains(b.group.position, b.team, {
              halfWidth: 0.3,
              height: b.rig.crouch > 0.5 ? 1.1 : 1.65,
            }))
        )
          continue;
        const mode = this.competitive ? "competitive" : "casual";
        if (this.teamMode && (b.armor < 100 || !b.helmet)) {
          const kind = b.money >= equipmentPrice("helmet", b.armor, b.helmet) ? "helmet" : "vest";
          const price = equipmentPrice(kind, b.armor, b.helmet);
          if (b.money >= price) {
            b.money = addMoney(b.money, -price, mode);
            b.armor = 100;
            if (kind === "helmet") b.helmet = true;
          }
        }
        const loadout =
          b.team === "t"
            ? [0, 20, 26, 10, 3, 8, 22, 30, 25, 36]
            : [1, 9, 11, 19, 3, 8, 21, 30, 24, 35];
        if (weaponSlot(b.rig.weaponIndex) !== 1) {
          const preferred = loadout[i % loadout.length];
          const choice = [preferred, b.team === "t" ? 26 : 11, 10, 13].find(
            (id) => !this.teamMode || (weaponAvailable(id, b.team) && b.money >= weaponPrice(id)),
          );
          if (choice !== undefined && choice !== b.rig.weaponIndex) {
            if (this.teamMode) b.money = addMoney(b.money, -weaponPrice(choice), mode);
            setSoldierWeapon(b.rig, choice);
            b.ammo = weapons[choice].mag;
            b.reserve = weapons[choice].reserve;
          }
        }
        if (
          this.teamMode &&
          b.team === "ct" &&
          !b.defuseKit &&
          b.money >= equipmentPrice("kit", b.armor, b.helmet)
        ) {
          b.money = addMoney(b.money, -equipmentPrice("kit", b.armor, b.helmet), mode);
          b.defuseKit = true;
        }
        b.reloadTime = 0;
      }
    }
  }
  updateBots(dt: number, phase: number) {
    this.updateBotPurchases(dt, phase);
    if (this.teamMode) {
      this.updateCasualBots(dt, phase);
      return;
    }
    for (let i = phase; i < this.bots.length; i += 8) {
      const b = this.bots[i];
      if (b.health <= 0) {
        b.respawn -= dt;
        if (b.respawn <= 0) this.spawnBot(b, i);
        continue;
      }
      const target = this.perceiveBot(b, dt);
      if (this.mode === "practice") {
        b.moving = false;
        continue;
      }
      this.botCombat(b, target, dt);
      b.tactic -= dt;
      const retreat = b.reloadTime > 0 || b.health < 32;
      if (target && b.tactic <= 0) {
        b.cover.copy(this.botCover(b, retreat) ?? b.group.position);
        b.tactic = retreat ? 2 : 1.2;
        b.reposition = retreat || (b.burst === 0 && b.shot > 0.16);
        b.nav = 0;
      }
      if (b.group.position.distanceTo(b.cover) < 0.5) b.reposition = false;
      b.moving = target || b.suppressTime > 0 ? b.reposition : true;
      b.nav -= dt;
      if (b.nav <= 0 && b.moving) {
        b.nav = 0.9 + (i % 3) * 0.15;
        // Patrol fixed routes when no contact is known, rather than pursuing
        // the hidden player's current position through walls.
        const routes = this.world.navigation.areas;
        const patrol = routes[(i + Math.floor(this.time / 9)) % routes.length].center;
        const goal =
          b.reposition && b.tactic > 0
            ? b.cover
            : b.alert > 0
              ? b.memory
              : new T.Vector3().fromArray(patrol);
        b.path = this.findPath(b.group.position, goal);
      }
    }
  }
  botSupport(b: Bot, x: number, z: number, ceiling: number, bottom: number) {
    const nav = this.world.navigation;
    return nav?.support(x, z, ceiling, bottom, nav.areas[b.navArea]);
  }
  botHullHeight(b: Bot) {
    return b.navCrouch ? 1.1 : T.MathUtils.lerp(1.65, 1.1, b.rig.crouch);
  }
  private ladderActors(bot: Bot) {
    let count = 0;
    if (this.mode !== "casual") {
      for (const other of this.bots) {
        if (other === bot || other.health <= 0) continue;
        const hull = (this.botLadderHulls[count++] ??= {
          x: 0,
          y: 0,
          z: 0,
          height: 0,
          radius: movement.hullRadius,
        });
        Object.assign(hull, other.group.position);
        hull.height = T.MathUtils.lerp(
          movement.standingHeight,
          movement.duckHeight,
          other.rig.crouch,
        );
      }
      if (!this.dead) {
        const hull = (this.botLadderHulls[count++] ??= {
          x: 0,
          y: 0,
          z: 0,
          height: 0,
          radius: movement.hullRadius,
        });
        Object.assign(hull, this.position);
        hull.height = this.hullHeight;
      }
    }
    this.botLadderHulls.length = count;
    return this.botLadderHulls;
  }
  private botClearBreakable(b: Bot, heading: T.Vector2) {
    if (
      this.network ||
      !this.world.breakables.states.length ||
      this.weaponsFrozen ||
      b.tracking ||
      b.shot > 0 ||
      b.reloadTime > 0 ||
      b.ammo <= 0 ||
      heading.lengthSq() < 0.01 ||
      this.utility.blind.has(this.bots.indexOf(b))
    )
      return false;
    const from = b.group.position.clone().add(new T.Vector3(0, this.botHullHeight(b) * 0.85, 0));
    const direction = new T.Vector3(heading.x, 0, heading.y).normalize();
    const ray = new T.Ray(from, direction);
    const impact = this.world.collision.intersections(ray, 2.5)[0];
    if (!impact) return false;
    const id = this.world.breakables.idForImpact(impact);
    if (!id) return false;
    // Clear a genuine route obstruction, without acquiring actors through it
    // or firing across an actor who entered the short firing lane. Normal
    // perception/combat handles actors rather than treating them as cover.
    const blockedBy = (feet: T.Vector3) => {
      const hit = botBodyHit(ray, feet);
      return hit && hit.point.distanceTo(from) < impact.distance;
    };
    if (
      this.bots.some(
        (other) => other !== b && other.health > 0 && blockedBy(other.group.position),
      ) ||
      (!this.dead && blockedBy(this.position))
    )
      return false;
    const weapon = weapons[b.rig.weaponIndex];
    if (isKnife(b.rig.weaponIndex)) return false;
    b.ammo--;
    b.shot = weapon.delay;
    b.aim.copy(impact.point);
    b.rig.recoil = 1;
    b.rig.shotTime = 0.25;
    const mode = (weapon.suppressed && b.rig.suppressed) || weapon.zoomLevels > 0 ? 1 : 0;
    applyFiringInaccuracy(b.weaponAccuracy, b.rig.weaponIndex, mode, this.botAccuracyPose(b));
    applyWeaponRecoil(b.aimPunch, b.weaponRecoil, b.rig.weaponIndex, mode);
    this.worldSound("bot", from, b.rig.weaponIndex, b.rig.suppressed);
    this.trace(from, impact.point, b.rig.weaponIndex, b.rig.suppressed);
    return this.damageMapBreakable(
      id,
      ballistics[b.rig.weaponIndex].damage,
      "bullet",
      impact.point,
      direction,
    );
  }
  moveBots(dt: number) {
    this.detours = 0;
    for (let index = 0; index < this.bots.length; index++) {
      const b = this.bots[index];
      // Visual animation accumulates simulated time and is applied per rendered frame.
      if (b.health <= 0) {
        this.audioSteps.delete(b);
        if (b.group.visible) {
          stepSoldierRagdoll(b.rig, b.vertical, dt, this.world);
          b.anim += dt;
        }
        continue;
      }
      // Finish a committed jump before stopping to engage or changing routes.
      if (b.vertical !== 0 && b.path.length) b.moving = true;
      const desired = botDesired.set(0, 0);
      const pos = b.group.position,
        previousX = pos.x,
        previousY = pos.y,
        previousZ = pos.z,
        previousArea = b.navArea;
      const nav = this.world.navigation;
      const currentArea = this.teamMode ? nav.areas[b.navArea] : nav.areas[nav.nearest(pos)];
      const upcoming = b.path.find(
        (point) => point instanceof T.Vector3 && point.distanceTo(pos) < 1.5,
      );
      const nextArea = upcoming instanceof T.Vector3 ? nav.areas[nav.nearest(upcoming)] : undefined;
      const needsCrouch =
        !!((currentArea?.flags ?? 0) & 0x10000) || !!((nextArea?.flags ?? 0) & 0x10000);
      // Lower before entering a short native NAV polygon. Remain lowered until
      // the standing hull actually clears the ceiling, even after its flag ends.
      if (this.mode === "deathmatch" && b.moving) b.spawnProtection = 0;
      b.navCrouch = needsCrouch || (b.navCrouch && this.isBlocked(pos.x, pos.z, pos.y, 0.35, 1.65));
      const botHeight = this.botHullHeight(b);
      if (b.moving) {
        let target = b.path[0];
        while (
          target &&
          (!(target instanceof T.Vector3) ||
            (target.y <= pos.y + 0.6 &&
              !(
                Math.abs(target.y - pos.y) > 0.03 &&
                this.world.navigation.data.ladders?.some(
                  (ladder) =>
                    Math.hypot(ladder.bottom[0] - pos.x, ladder.bottom[2] - pos.z) < 1 &&
                    pos.y > (ladder.exitBottom?.[1] ?? ladder.bottom[1]) + 0.05,
                )
              ))) &&
          Math.hypot(
            target.x - pos.x,
            (target instanceof T.Vector3 ? target.z : target.y) - pos.z,
          ) < 0.35
        ) {
          b.path.shift();
          target = b.path[0];
        }
        if (target) {
          if (this.world.doors?.states.length) {
            this.doorFrom.copy(pos);
            this.doorFrom.y += botHeight - 0.2;
            this.doorDirection
              .set(target.x - pos.x, 0, (target instanceof T.Vector3 ? target.z : target.y) - pos.z)
              .normalize();
            this.world.doors.openAhead(this.doorFrom, this.doorDirection);
          }
          const direction = desired.copy(target);
          direction.x -= pos.x;
          direction.y = (target instanceof T.Vector3 ? target.z : target.y) - pos.z;
          direction
            .normalize()
            .multiplyScalar(
              Math.min(weapons[b.rig.weaponIndex].speed, b.alert > 0 && !b.reposition ? 3.2 : 4.8) *
                (b.navCrouch ? movement.crouchModifier : 1),
            );
          if (!b.tracking) b.facing = Math.atan2(direction.x, direction.y);
        }
      }
      if (this.teamMode && b.moving && b.vertical === 0) {
        const headingX = desired.x,
          headingZ = desired.y;
        for (const other of this.bots) {
          if (other === b || other.health <= 0 || Math.abs(other.group.position.y - pos.y) > 1.2)
            continue;
          steerAroundTeammate(
            desired,
            other.group.position.x - pos.x,
            other.group.position.z - pos.z,
            headingX,
            headingZ,
          );
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
      const supportingPlayer =
        this.mode !== "casual" &&
        !this.dead &&
        this.grounded &&
        Math.abs(this.position.y - (pos.y + 1.65 - b.rig.crouch * 0.55)) < 0.06 &&
        Math.abs(this.position.x - pos.x) < 0.6 &&
        Math.abs(this.position.z - pos.z) < 0.6;
      if (supportingPlayer) desired.set(0, 0);
      b.velocity.x = T.MathUtils.damp(b.velocity.x, desired.x, 12, dt);
      b.velocity.y = T.MathUtils.damp(b.velocity.y, desired.y, 12, dt);
      const ladderTarget = b.path[0];
      const climb =
        b.moving && ladderTarget instanceof T.Vector3 && Math.abs(ladderTarget.y - pos.y) > 0.02
          ? Math.sign(ladderTarget.y - pos.y)
          : 0;
      const ladderStep = this.world.collision
        ? stepLadder(
            pos,
            { yaw: -b.facing, pitch: 0, forward: 0, right: 0, jump: false, climb },
            dt,
            this.world.navigation.data.ladders,
            this.world.collision,
            botHeight,
            b.ladderState,
            movement.hullRadius,
            () => this.ladderActors(b),
          )
        : undefined;
      if (ladderStep) {
        // Native vents can cover a ladder's connected landing. Clear the
        // actual short firing lane before stepping off the ladder lip.
        if (b.ladderState.exit && desired.lengthSq() > 0.01) this.botClearBreakable(b, desired);
        b.velocity.set(ladderStep.velocity.x, ladderStep.velocity.z);
        b.vertical = ladderStep.velocity.y;
        b.progressPosition.copy(pos);
        b.progressTime = b.stuck = 0;
        b.navArea = this.world.navigation.nearest(pos);
        b.group.userData.groundY = pos.y;
      } else {
        if (this.world.collision && b.moving && b.vertical === 0 && desired.lengthSq() > 0) {
          const ahead = botAhead.copy(desired).normalize().multiplyScalar(0.7);
          const raised =
            this.botSupport(b, pos.x + ahead.x, pos.z + ahead.y, pos.y + 1.05, pos.y - 0.1)
              ?.height ??
            this.world.collision.floor(pos.x + ahead.x, pos.z + ahead.y, pos.y + 1.05, pos.y - 0.1);
          let target = b.path[0];
          // Native jump links can start with a floor-height takeoff portal.
          // Look through that point to the raised landing before hitting its face.
          if (
            target instanceof T.Vector3 &&
            target.y <= pos.y + 0.45 &&
            Math.hypot(target.x - pos.x, target.z - pos.z) < 1.8
          )
            target = b.path[1] ?? target;
          if (
            (raised > pos.y + 0.4 && raised < pos.y + 1.05) ||
            (target instanceof T.Vector3 &&
              target.y > pos.y + 0.45 &&
              target.y < pos.y + 1.35 &&
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
              previousY + botHeight,
              pos.y + botHeight,
            );
            if (Number.isFinite(ceiling)) {
              pos.y = ceiling - botHeight;
              b.vertical = -0.01;
            }
          }
        }
        if (this.world.collision) {
          // NAV describes route connectivity, not physical clearance. Sweep the
          // same hull/18-unit stair support as players so steering cannot put
          // a bot through a stair side or land it inside an adjacent wall.
          const velocity = { x: b.velocity.x, z: b.velocity.y };
          this.world.collision.moveHorizontal(pos, velocity, dt, 0.35, botHeight, b.vertical === 0);
          b.velocity.set(velocity.x, velocity.z);
          if (b.vertical === 0) this.world.collision.followGround(pos, 0.35, botHeight);
          b.navArea = nav.nearest(pos);
          const floor = this.world.collision.support(
            pos.x,
            pos.z,
            pos.y + (b.vertical > 0 ? 0 : 0.46),
            pos.y - 8,
            0.35,
          );
          if (Number.isFinite(floor)) {
            if (b.vertical <= 0 && pos.y <= floor + 0.45) {
              pos.y = floor;
              if (b.vertical < 0)
                applyLandingInaccuracy(
                  b.weaponAccuracy,
                  b.rig.weaponIndex,
                  this.botAccuracyPose(b).mode,
                  -b.vertical,
                );
              b.vertical = 0;
              b.group.userData.groundY = floor;
            } else if (b.vertical === 0) b.vertical = -0.01;
          } else {
            pos.x = previousX;
            pos.z = previousZ;
            b.navArea = previousArea;
            b.nav = 0;
          }
          // Net progress catches corner pacing and crowd oscillations, which
          // can have nonzero velocity without leaving the same small area.
          if (
            !b.moving ||
            !b.path.length ||
            Math.hypot(pos.x - b.progressPosition.x, pos.z - b.progressPosition.z) > 1.2
          ) {
            b.progressPosition.copy(pos);
            b.progressTime = b.recoveries = 0;
          } else b.progressTime += dt;
          b.stuck =
            b.moving &&
            b.path.length > 0 &&
            Math.hypot(pos.x - previousX, pos.z - previousZ) < dt * 0.25
              ? b.stuck + dt
              : 0;
          if (b.progressTime > 2.5) b.stuck = Math.max(b.stuck, 0.81);
          if (
            b.stuck > 0.2 &&
            Math.floor(b.stuck * 16) !== Math.floor((b.stuck - dt) * 16) &&
            this.botClearBreakable(b, desired)
          ) {
            b.stuck = b.progressTime = 0;
          }
          // Local detours are synchronous searches; allow one per simulation step.
          if (b.stuck > 0.8 && !this.detours) {
            this.detours++;
            // Repair shallow landing overlaps with the same bounded contact
            // correction used by player movement before trying another route.
            const contactX = pos.x,
              contactZ = pos.z;
            if (
              this.world.collision.resolveHorizontal(pos, 0.35, botHeight) &&
              (pos.x !== contactX || pos.z !== contactZ)
            )
              b.navArea = this.dust!.navigation.nearest(pos);
            const route = b.path.filter((p): p is T.Vector3 => p instanceof T.Vector3);
            const goalIndex = route.findIndex((p) => Math.hypot(p.x - pos.x, p.z - pos.z) > 4);
            const index = goalIndex >= 0 ? goalIndex : route.length - 1;
            b.recoveries++;
            const local =
              index >= 0 && b.recoveries < 3 ? detour(this.world.collision, pos, route[index]) : [];
            if (local.length) {
              // Bounded detours can stop before the waypoint: retain that goal.
              b.path = [...local, ...route.slice(index)];
              b.nav = Math.max(3, local.length * 0.3);
            } else {
              const nav = this.dust!.navigation;
              const area = nav.areas[nav.nearest(pos)];
              // Smoothed waypoints may skip the adjacent area entirely. Inspect
              // the raw route so a failed exit actually changes the next plan.
              const onward = nav.path(
                pos,
                route.at(-1) ?? b.goal,
                [],
                b.blockedAreas,
                false,
                nav.areas[b.navArea],
              );
              const next = onward
                .map((point) => nav.areas[nav.nearest(point)].id)
                .find((id) => id !== area.id && area.links.includes(id));
              if (next !== undefined) b.blockedAreas.add(next);
              if (b.blockedAreas.size > 8) b.blockedAreas.clear();
              b.path = [];
              b.nav = 0;
            }
            b.stuck = 0;
            b.progressTime = 0;
          }
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
      b.rig.airborne = b.vertical !== 0 && b.ladderState.id === null;
      b.rig.jumping = b.vertical > 0 && b.ladderState.id === null;
      b.rig.plant =
        this.bomb?.carrier === index && !this.bomb.planted
          ? this.bomb.plantProgress / PLANT_DURATION
          : 0;
      b.rig.crouch = T.MathUtils.damp(
        b.rig.crouch,
        b.navCrouch || this.bomb?.defuser === index || b.rig.plant > 0 ? 1 : 0,
        12,
        dt,
      );
      let stride = this.audioSteps.get(b);
      if (!stride) this.audioSteps.set(b, (stride = new FootstepStride()));
      const foot = stride.advance(
        {
          x: pos.x,
          y: pos.y,
          z: pos.z,
          spawn: 0,
          audible:
            this.active &&
            this.locked &&
            b.vertical === 0 &&
            !b.ladderState.id &&
            !b.navCrouch &&
            b.rig.crouch < 0.1,
        },
        dt,
      );
      if (foot)
        this.emitFootstep(
          pos,
          b.team,
          foot,
          b === this.spectated && this.spectatorMode === "first",
        );
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
    const shadows = !this.teamMode && this.renderer.shadowMap.enabled;
    for (const b of this.bots) {
      if (!b.group.visible) continue;
      botSphere.copy(agentBounds).center.add(b.group.position);
      if (b.rig.ragdoll) botSphere.center.copy(b.rig.ragdoll.points[0].position);
      const onScreen = frustum.intersectsSphere(botSphere);
      b.rig.model.visible = onScreen || shadows;
      if (b.anim <= 0) continue;
      const interval = !onScreen
        ? 0.1
        : botSphere.center.distanceToSquared(this.camera.position) > 40 * 40
          ? 1 / 30
          : 0;
      if (b.anim < interval) continue;
      b.rig.reloadTime = b.reloadTime;
      animateSoldier(b.rig, b.speed, b.anim, b.health > 0);
      b.anim = 0;
    }
  }
  // The Dust II radar layer is drawn once per world,
  // canvas size and style, then composited under the live markers.
  drawMap(canvas: HTMLCanvasElement, live: boolean) {
    const follow = this.dead && this.teamMode ? this.spectated : undefined;
    if (live)
      updateRadarLocation(
        this.world.navigation,
        follow?.group.position ?? this.position,
        this.mapId,
      );
    // Native overview ranges are converted into browser Y metres during
    // import. Observer origin is provisional until a native boundary capture
    // establishes whether CS2 selects its layer using origin or eye height.
    const radarLayer = this.radarOverview
      ? radarLayerAt(this.radarOverview, (follow?.group.position ?? this.position).y)
      : undefined;
    if (radarLayer) this.radarImage = radarLayer.image;
    const ctx = canvas.getContext("2d")!,
      w = canvas.width,
      h = canvas.height,
      key = `${this.mapId}:${radarLayer?.section?.name ?? "base"}:${live}:${w}x${h}`;
    let layer = this.radarLayers.get(key);
    if (!layer) {
      layer = document.createElement("canvas");
      layer.width = w;
      layer.height = h;
      this.drawMapLayer(layer.getContext("2d")!, w, h, live);
      this.radarLayers.set(key, layer);
    }
    if (!live) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(layer, 0, 0);
      return;
    }
    const wrap = document.querySelector<HTMLElement>(".radar-wrap")!;
    const fullMap = wrap.classList.contains("expanded");
    const scoreboard = !el("scoreboard").classList.contains("hidden");
    wrap.dataset.scoreboard = String(scoreboard);
    wrap.dataset.bomb = String(!!this.bomb?.planted);
    wrap.dataset.square = String(
      fullMap ||
        this.settings.radarSquare ||
        (!!this.dead && this.teamMode && this.settings.radarSquareSpectator) ||
        (scoreboard && this.settings.radarSquareScoreboard),
    );
    wrap.style.setProperty("--radar-hud-scale", String(this.settings.radarHudScale));
    wrap.style.setProperty("--radar-blur", this.settings.radarBlur ? "blur(8px)" : "none");
    const now = performance.now() / 1000;
    const frame = this.radar.sample(this, now);
    drawRadar(ctx, {
      layer,
      projection: this.mapProjection(w, h),
      position: follow?.group.position ?? this.position,
      yaw: follow ? Math.PI + follow.group.rotation.y : this.yaw,
      ...frame,
      settings: this.settings,
      fullMap,
      scoreboard,
      spectating: !!this.dead && this.teamMode,
      teamColors: this.competitive,
      now,
      alternate: this.radarAlternate,
      sites:
        this.mode === "deathmatch"
          ? []
          : this.world.navigation.data.sites.map(([x, y, z]) => ({ x, y, z })),
    });
  }
  mapProjection(w: number, h: number) {
    const overview = this.dust?.config.radar;
    if (overview && this.radarImage) {
      const width = this.radarImage.naturalWidth,
        height = this.radarImage.naturalHeight;
      const scale = Math.min(w / width, h / height);
      const left = (w - width * scale) / 2,
        top = (h - height * scale) / 2;
      return {
        scale,
        left,
        top,
        px: (x: number) => left + ((x / 0.0254 - overview.pos_x) / overview.scale) * scale,
        pz: (z: number) => top + ((overview.pos_y + z / 0.0254) / overview.scale) * scale,
      };
    }
    const [minX, minZ, maxX, maxZ] = this.world.navigation.data.bounds;
    const scale = Math.min(w / (maxX - minX), h / (maxZ - minZ));
    const left = (w - (maxX - minX) * scale) / 2;
    const top = (h - (maxZ - minZ) * scale) / 2;
    return {
      scale,
      left,
      top,
      px: (x: number) => left + (x - minX) * scale,
      pz: (z: number) => top + (z - minZ) * scale,
    };
  }

  drawMapLayer(ctx: CanvasRenderingContext2D, w: number, h: number, _live: boolean) {
    if (this.world.navigation) {
      if (this.radarImage) {
        const { left, top, scale } = this.mapProjection(w, h);
        ctx.drawImage(
          this.radarImage,
          left,
          top,
          this.radarImage.naturalWidth * scale,
          this.radarImage.naturalHeight * scale,
        );
      } else {
        const { px, pz } = this.mapProjection(w, h);
        ctx.fillStyle = "#737e84";
        ctx.strokeStyle = "#323b40";
        ctx.lineWidth = 0.5;
        for (const area of this.world.navigation.areas) {
          ctx.beginPath();
          area.corners.forEach((corner, i) =>
            i ? ctx.lineTo(px(corner[0]), pz(corner[2])) : ctx.moveTo(px(corner[0]), pz(corner[2])),
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.font = `bold ${Math.min(w, h) / 24}px Stratum2, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#e7c173";
        this.world.navigation.data.sites.forEach((site, i) =>
          ctx.fillText(i ? "B" : "A", px(site[0]), pz(site[2])),
        );
      }
      return;
    }
  }
  scoreboard() {
    const rows = [
      {
        id: "player" as number | "player",
        name: playerName(),
        avatar: playerAvatar(),
        ping: this.network ? this.network.connection.ping : 0,
        kills: this.kills,
        deaths: this.deaths,
        score: this.deathmatchScore,
        assists:
          this.mode === "deathmatch" ? this.deathmatchCombat.life("player").assists : undefined,
        team: this.team,
        alive: !this.dead,
        mvps: this.mvpCounts.get("player") ?? 0,
        money: this.teamMode ? this.money : undefined,
        weapon: isKnife(this.selected)
          ? this.inventory().find((weapon) => !isKnife(weapon))
          : this.selected,
        weaponHolstered: isKnife(this.selected) || !!this.utility.selected,
        armor: this.armor,
        helmet: this.helmet,
        kit: this.defuseKit,
      },
      ...this.bots.map((b, id) => ({
        id,
        name: b.name,
        avatar: this.network?.stateForBot(b)?.avatar ?? botPortrait(b.team, b.rig.agentId),
        bot: !this.network,
        kills: b.kills,
        deaths: b.deaths,
        score: b.deathmatchScore,
        assists: this.mode === "deathmatch" ? this.deathmatchCombat.life(id).assists : undefined,
        team: b.team,
        alive: b.health > 0,
        mvps: this.mvpCounts.get(id) ?? 0,
        money: this.teamMode && b.team === this.team ? b.money : undefined,
        weapon: this.mode === "deathmatch" || b.team === this.team ? b.rig.weaponIndex : undefined,
        armor: this.mode === "deathmatch" || b.team === this.team ? b.armor : undefined,
        helmet: this.mode === "deathmatch" || b.team === this.team ? b.helmet : undefined,
        kit: this.mode === "deathmatch" || b.team === this.team ? b.defuseKit : undefined,
      })),
    ].sort(
      (a, b) =>
        (this.mode === "deathmatch" ? b.score - a.score : 0) ||
        b.kills - a.kills ||
        a.deaths - b.deaths,
    );
    const seconds = Math.max(
      0,
      Math.ceil(
        this.freezeTime > 0 && this.teamMode
          ? this.freezeTime
          : this.teamMode && this.bomb?.planted
            ? this.bomb.timer
            : this.time,
      ),
    );
    const footer = el("scoreboard").querySelector("small");
    if (footer)
      footer.textContent = `HOLD TAB TO VIEW SCOREBOARD - ${this.network ? "MULTIPLAYER" : "SINGLE PLAYER"}`;
    const data = {
      map: this.mapId,
      rows,
      seconds,
      mode: this.mode,
      round: this.round,
      history: this.roundHistory,
      scores: this.teamScores,
      teamMode: this.teamMode,
      competitive: this.competitive,
      teamSize: this.teamSize,
      winTarget: this.winTarget,
      carrier: this.bomb?.carrier,
      planted: !!this.bomb?.planted,
      roundPause: this.roundPause > 0,
    };
    const signature = JSON.stringify(data);
    if (signature === this.scoreboardSignature) return;
    this.scoreboardSignature = signature;
    renderScoreboard(data);
  }

  updateUI() {
    updateDeathmatchHud(
      this.active && this.mode === "deathmatch",
      this.active && this.mode === "deathmatch" ? this.deathmatchStandings : [],
      this.dead ? 0 : this.invulnerable,
      {
        bonus: this.deathmatch.bonus,
        randomWeapons: this.deathmatchRandomWeapons,
        randomKey: keyLabel(this.settings.bindings.F3),
        bonusKey: keyLabel(this.settings.bindings.KeyG),
        award: this.animationTime < this.deathmatchAwardUntil ? this.deathmatchAward : undefined,
        bonusAward:
          this.animationTime < this.deathmatchBonusAwardUntil ? this.deathmatchBonusAward : 0,
      },
    );
    const observer =
      this.dead && this.teamMode && this.spectatorMode === "first" ? this.spectated : undefined;
    const selected = observer?.rig.weaponIndex ?? this.selected;
    const holdingBomb = !observer && this.bombSelected && !!this.carryingBomb;
    toggle("bomb-carrier", !!this.carryingBomb);
    if (this.bomb?.planted) this.notices.updateBombTimer(this.bomb.timer);
    const freezeTint = el("buy-phase-tint");
    freezeTint.dataset.team = this.team;
    freezeTint.style.opacity = String(
      this.active && this.teamMode && !this.dead && this.roundPause === 0
        ? 0.14 * T.MathUtils.clamp(this.freezeTime / 2, 0, 1)
        : 0,
    );
    el("hud").classList.toggle("spectating", this.teamMode && this.dead > 0 && !observer);
    setText("health", String(Math.ceil(Math.max(0, observer?.health ?? this.health))));
    setText("armor", String(Math.ceil(observer?.armor ?? this.armor)));
    const armorState = el("armor-state");
    const helmet = String(observer?.helmet ?? this.helmet);
    const emptyArmor = String((observer?.armor ?? this.armor) <= 0);
    if (armorState.dataset.helmet !== helmet) armorState.dataset.helmet = helmet;
    if (armorState.dataset.empty !== emptyArmor) armorState.dataset.empty = emptyArmor;
    setText("money", this.teamMode ? `$${(observer?.money ?? this.money).toLocaleString()}` : "");
    this.updateBuyMenu();
    el("health-fill").style.width = `${clamp(observer?.health ?? this.health, 0, 100)}%`;
    const teamIcon = el("hud-team-icon");
    if (teamIcon.dataset.team !== this.team) {
      teamIcon.dataset.team = this.team;
      teamIcon.style.maskImage = `url("${assetUrl(`/icons/hud/team-${this.team}.svg`)}")`;
      teamIcon.setAttribute("aria-label", this.team === "ct" ? "Counter-Terrorists" : "Terrorists");
    }
    const utility = observer ? null : (this.utility.selected ?? this.utility.throwingKind);
    const healthshot = !observer && this.healthshotAction.selected;
    setText(
      "ammo",
      healthshot
        ? String(this.deathmatchCombat.life("player").healthshots)
        : utility
          ? String(this.utility.inventory[utility])
          : holdingBomb || isKnife(selected)
            ? ""
            : String(observer?.ammo ?? this.ammo),
    );
    el("ammo").parentElement!.classList.toggle(
      "knife-equipped",
      !utility && !healthshot && (holdingBomb || isKnife(selected)),
    );
    el("ammo").parentElement!.classList.toggle("utility-equipped", !!utility || healthshot);
    this.updateInventory();
    setText("reserve", String(observer?.reserve ?? this.reserve));
    setText(
      "gun-name",
      healthshot
        ? "Medi-Shot"
        : holdingBomb
          ? "C4"
          : utility
            ? grenadeData[utility].name
            : weaponInstanceName(
                observer?.rig.weaponInstance ?? this.groundInventory.playerWeapon(this.selected),
              ),
    );
    for (const team of ["ct", "t"] as const) {
      const alive =
        this.bots.filter((b) => b.team === team && b.health > 0).length +
        (this.team === team && !this.dead ? 1 : 0);
      setText(`${team}-alive`, String(alive));
      const score = this.teamMode
        ? this.teamScores[team]
        : team === this.team
          ? this.kills
          : Math.max(...this.bots.map((b) => b.kills), 0);
      setText(team === "ct" ? "score" : "enemy-score", String(score));
    }
    const planted = this.teamMode && !!this.bomb?.planted;
    el("clock").classList.toggle("bomb-planted", planted);
    el("clock").setAttribute("aria-label", planted ? "Time until bomb explosion" : "Round time");
    const sec = Math.max(
      0,
      Math.ceil(
        this.freezeTime > 0 && this.teamMode
          ? this.freezeTime
          : this.teamMode && this.bomb?.planted
            ? this.bomb.timer
            : this.time,
      ),
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
      suppressed: this.isSuppressed(this.selected),
      suppressorAction: this.suppressors[this.selected].action,
      suppressorProgress: this.suppressors[this.selected].progress,
      clock: this.animationTime,
      reload: this.reload ? this.reloadProgress() : 0,
      draw: this.drawTime / weaponDrawDuration(this.selected),
      bolt: this.boltTime ? 1 - this.boltTime / weapons[this.selected].delay : 0,
      recoil: this.kick,
      reloadActive: this.reload > 0,
      emptyReload: this.emptyReload,
      boltActive: this.boltTime > 0,
      shot: this.shotTime
        ? 1 - this.shotTime / nativeShotDuration(this.selected, this.alternateShot, this.lastShot)
        : 0,
      shotActive: this.shotTime > 0,
      revolverCharge:
        this.revolverCharge > 0 ? Math.min(1, this.revolverCharge / REVOLVER_COCK_TIME) : undefined,
      alternateShot: this.alternateShot,
      lastShot: this.lastShot,
      bob,
      sway,
      knife: this.knifeTime > 0 ? 1 - this.knifeTime / this.knifeDuration : 0,
      knifeElapsed: this.knifeDuration - this.knifeTime,
      stab: this.knifeStab,
      knifeActive: this.knifeTime > 0,
      knifeContact: this.knifeContact,
      alternate: this.knifeAlternate,
      time: this.weaponTime,
      inspect: this.inspectTime ? 1 - this.inspectTime / this.inspectDuration() : 0,
      inspectActive: this.inspectTime > 0,
      inspectDraw: this.inspectDraw,
      inspectVariant: this.inspectVariant,
    });
    this.flash.position.copy(this.gun.userData.muzzle);
  }
  get previewingViewmodel() {
    return (
      this.assetsReady &&
      !el("settings").classList.contains("hidden") &&
      el("settings").dataset.category === "viewmodel"
    );
  }
  renderViewmodelPreview(clock: number) {
    const preview = this.viewGun(this.viewmodelPreviewWeapon);
    if (this.lastViewmodelPreview && this.lastViewmodelPreview !== preview)
      unregisterGloveModel(this.lastViewmodelPreview);
    this.lastViewmodelPreview = preview;
    const parent = preview.parent;
    const visibility = this.view.children.map((child) => [child, child.visible] as const);
    for (const child of this.view.children) if (!(child instanceof T.Light)) child.visible = false;
    this.view.add(preview);
    preview.visible = true;
    const flashVisible = this.flash.visible;
    this.flash.visible = false;
    animateGun(preview, {
      reload: 0,
      draw: 0,
      bolt: 0,
      recoil: 0,
      bob: 0,
      sway: 0,
      time: clock,
      clock,
    });
    this.updateViewLighting(preview, 1 / 60);
    this.renderer.clearDepth();
    this.renderer.render(this.view, this.viewCamera);
    this.flash.visible = flashVisible;
    if (parent !== this.view) {
      preview.removeFromParent();
      parent?.add(preview);
    }
    for (const [child, visible] of visibility) child.visible = visible;
  }
  renderSpectatorWeapon(bot: Bot) {
    const index = bot.rig.weaponIndex;
    const state = this.network?.stateForBot(bot);
    if (state?.scope && weapons[index].zoomLevels > 1) {
      this.flash.visible = false;
      return;
    }
    const melee = bot.group.userData.networkMelee as
      | { at: number; stab: boolean; alternate: boolean; hit: boolean }
      | undefined;
    const meleeTime = melee ? this.animationTime - melee.at : Infinity;
    const meleeDuration = isKnife(index)
      ? weaponKnifeAttackDuration(index, !!melee?.stab, !!melee?.alternate)
      : 1;
    const gun = this.viewGun(index);
    if (this.lastSpectatorViewmodel && this.lastSpectatorViewmodel !== gun)
      unregisterGloveModel(this.lastSpectatorViewmodel);
    this.lastSpectatorViewmodel = gun;
    bindWeaponInstance(gun, bot.rig.weaponInstance);
    const elapsed = this.animationTime - this.spectatorShotAt;
    const duration = nativeShotDuration(index, false, this.spectatorLastShot);
    this.gun.visible = false;
    this.flash.visible = elapsed < 0.08 && !bot.rig.suppressed;
    this.flash.position.copy(gun.userData.muzzle);
    if (gun !== this.gun) this.view.add(gun);
    gun.visible = true;
    animateGun(gun, {
      gloveTeam: bot.team,
      gloveChoice: state?.glove ?? bot.rig.gloveChoice,
      gloveAgent: state?.agent ?? bot.rig.agentId,
      suppressed: bot.rig.suppressed,
      clock: this.animationTime,
      time: this.animationTime,
      reload: state?.reloadTime ? networkReloadProgress(state, { shell: state.reloadPhase }) : 0,
      reloadActive: !!state?.reloadTime,
      emptyReload: state?.reloadEmpty,
      draw: 0,
      bolt: 0,
      recoil: bot.rig.recoil * 0.03,
      shot: Math.min(1, elapsed / duration),
      shotActive: elapsed < duration,
      lastShot: this.spectatorLastShot && elapsed < duration,
      bob: Math.sin(bot.rig.time * 8) * bot.speed * 0.0017,
      sway: 0,
      knife: Math.min(1, meleeTime / meleeDuration),
      knifeElapsed: meleeTime,
      knifeContact: melee?.hit,
      knifeActive: !!this.network && isKnife(index) && meleeTime < meleeDuration,
      stab: melee?.stab,
      alternate: melee?.alternate,
    });
    this.renderer.clearDepth();
    this.renderer.render(this.view, this.viewCamera);
    if (gun !== this.gun) this.view.remove(gun);
    this.gun.visible = true;
  }
  updateViewLighting(model: T.Object3D, dt: number) {
    const source = this.world === this.dust && this.dust.sourceLighting;
    this.probeMatrix.makeRotationFromQuaternion(this.camera.quaternion);
    this.probeRotation.setFromMatrix4(this.probeMatrix);
    updateActorLighting(
      model,
      this.camera.position,
      source ? sampleSourceProbe : undefined,
      dt,
      this.probeRotation,
      sampleSourceProbeSun,
      sampleSourceProbeLocalShadows,
      source ? undefined : this.world === this.dust ? (this.dust?.nativeProbes ?? null) : null,
      this.world === this.dust ? this.dust?.nativeReflections : undefined,
    );
    // Unsupported native-cubemap devices must not fall back to the brightly
    // lit armory used by cosmetic previews while standing in a dark room.
    if (this.world === this.dust && !source && !this.dust?.nativeReflections)
      setActorReflection(model, null);
  }
  updateSceneLighting(dt: number) {
    const source = this.world === this.dust && this.dust.sourceLighting;
    for (const bot of this.bots) {
      if (!bot.group.visible) continue;
      this.probePosition.copy(bot.group.position);
      this.probePosition.y += bot.rig.dying ? 0.3 : 1;
      updateActorLighting(
        bot.group,
        this.probePosition,
        source ? sampleSourceProbe : undefined,
        dt,
        undefined,
        sampleSourceProbeSun,
        sampleSourceProbeLocalShadows,
        source ? undefined : this.world === this.dust ? (this.dust?.nativeProbes ?? null) : null,
        this.world === this.dust ? this.dust?.nativeReflections : undefined,
        this.world === this.dust ? this.dust?.nativeFog : undefined,
      );
    }
    if (this.bombMesh.visible) {
      this.probePosition.copy(this.bombMesh.position);
      this.probePosition.y += 0.15;
      updateActorLighting(
        this.bombMesh,
        this.probePosition,
        source ? sampleSourceProbe : undefined,
        dt,
        undefined,
        sampleSourceProbeSun,
        sampleSourceProbeLocalShadows,
        source ? undefined : this.world === this.dust ? (this.dust?.nativeProbes ?? null) : null,
        this.world === this.dust ? this.dust?.nativeReflections : undefined,
        this.world === this.dust ? this.dust?.nativeFog : undefined,
      );
    }
    const ball = this.dust?.ball?.mesh;
    if (ball)
      updateActorLighting(
        ball,
        ball.position,
        source ? sampleSourceProbe : undefined,
        dt,
        undefined,
        sampleSourceProbeSun,
        sampleSourceProbeLocalShadows,
        source ? undefined : this.world === this.dust ? (this.dust?.nativeProbes ?? null) : null,
        this.world === this.dust ? this.dust?.nativeReflections : undefined,
        this.world === this.dust ? this.dust?.nativeFog : undefined,
      );
    if (source) {
      // Viewmodels render in their own camera space; keep the map sun fixed in
      // world space as the player turns, with native probe visibility indoors.
      const pitch = T.MathUtils.degToRad(50),
        yaw = T.MathUtils.degToRad(43);
      this.viewSun.color.setHex(0xffdebd);
      this.viewSun.intensity = 2.5 * Math.PI;
      this.viewSun.position
        .set(-Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw))
        .applyQuaternion(this.probeInverse.copy(this.camera.quaternion).invert());
    } else if (this.dust) {
      const sun = this.dust.config.sun;
      const pitch = T.MathUtils.degToRad(sun.pitch),
        yaw = T.MathUtils.degToRad(sun.yaw);
      this.viewSun.color.setHex(sun.color);
      this.viewSun.intensity = sun.intensity;
      if (this.world === this.dust && !this.dust.nativeProbes) {
        // Conservative geometry visibility when the device cannot run LPVs;
        // this fallback does not reconstruct the native indirect light field.
        this.probePosition
          .set(-Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw))
          .multiplyScalar(150)
          .add(this.camera.position);
        if (!this.world.collision.visible(this.camera.position, this.probePosition))
          this.viewSun.intensity = 0;
      }
      this.viewSun.position
        .set(-Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw))
        .applyQuaternion(this.probeInverse.copy(this.camera.quaternion).invert());
    }
    const viewModel = this.healthshotView.visible
      ? this.healthshotView
      : this.active &&
          this.dead &&
          this.teamMode &&
          this.spectatorMode === "first" &&
          this.spectated
        ? this.viewGun(this.spectated.rig.weaponIndex)
        : this.gun;
    this.updateViewLighting(viewModel, dt);
    if (this.bombView.visible) this.updateViewLighting(this.bombView, dt);
    if (this.defuseView.visible) this.updateViewLighting(this.defuseView, dt);
    const reflectionActors = source
      ? [
          { root: viewModel, position: this.camera.position },
          ...(this.bombView.visible
            ? [{ root: this.bombView, position: this.camera.position }]
            : []),
          ...this.bots
            .filter((bot) => bot.group.visible)
            .sort(
              (a, b) =>
                a.group.position.distanceToSquared(this.camera.position) -
                b.group.position.distanceToSquared(this.camera.position),
            )
            .map((bot) => ({ root: bot.group, position: bot.group.position })),
          ...(this.bombMesh.visible
            ? [{ root: this.bombMesh, position: this.bombMesh.position }]
            : []),
          ...(ball ? [{ root: ball, position: ball.position }] : []),
        ]
      : [];
    this.actorReflections.update(this.renderer, reflectionActors);
    if (this.world === this.dust && !source && !this.dust?.nativeReflections)
      setActorReflection(viewModel, null);
  }
  get simulationRunning() {
    return this.active && !this.matchLoading;
  }
  teamPreview?: (dt: number) => void;
  lastRender = 0;
  frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    // No scene work behind the loading overlay or in a background tab. Menus
    // keep their camera animation at 30 Hz without burning gameplay-level GPU.
    if (
      document.hidden ||
      (!this.assetsReady && (!this.menuReady || this.active)) ||
      this.matchLoading
    ) {
      this.last = now;
      return;
    }
    showNativeMapGrade(this.active || !!this.teamPreview);
    this.updateTextureQuality();
    const elapsed = (now - this.last) / 1000;
    const dt = Math.min(elapsed, 0.05);
    if (this.simulationRunning) this.world.breakableView.update(dt);
    this.last = now;
    if (this.deathBannerUntil > 0 && now >= this.deathBannerUntil) {
      this.deathBannerUntil = 0;
      hideDeathcam();
    }
    this.fpsTime += elapsed;
    if (this.fpsTime > 1) {
      this.fps = Math.round(this.frames / this.fpsTime);
      const frameMs = this.frames ? ((this.fpsTime * 1000) / this.frames).toFixed(1) : "–";
      this.frames = 0;
      this.fpsTime = 0;
      setText(
        "telemetry",
        `${this.fps} FPS | ${frameMs} MS FRAME ${this.network ? ` | ${this.network.connection.ping} MS PING` : ""}`,
      );
    }
    if (this.simulationRunning) {
      this.accumulator += dt;
      while (this.accumulator >= step && this.simulationRunning) {
        this.simulate(step);
        this.accumulator -= step;
      }
      this.uiTime += dt;
      if (this.uiTime > 0.1) {
        this.updateUI();
        this.uiTime = 0;
      }
    } else {
      this.accumulator = 0;
      if (!this.active && el("result").classList.contains("hidden")) {
        const angle = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : now * 0.000018;
        if (this.world.collision) {
          // A gentle looping dolly above A site, away from walls and roofs.
          this.camera.position.set(
            36 + Math.sin(angle) * 8,
            14 + Math.sin(angle * 2) * 1.5,
            -45 + (Math.cos(angle) - 1) * 5,
          );
          this.camera.lookAt(25 + Math.sin(angle) * 3, 2, -63);
        } else {
          this.camera.position.set(17 + Math.sin(angle) * 2, 8.5, 20);
          this.camera.lookAt(-3, 1, -3);
        }
      }
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
    const renderClock = advanceRenderClock(
      this.lastRender,
      now,
      this.active && this.locked ? this.settings.fpsCap : this.settings.menuFpsCap,
    );
    if (renderClock === null) return;
    const renderDt = Math.min((now - this.lastRender) / 1000, 0.1);
    this.lastRender = renderClock;
    this.frames++;
    if (!this.previewingViewmodel && this.lastViewmodelPreview) {
      unregisterGloveModel(this.lastViewmodelPreview);
      this.lastViewmodelPreview = undefined;
    }
    if (
      (!this.active || !this.dead || this.spectatorMode !== "first") &&
      this.lastSpectatorViewmodel
    ) {
      unregisterGloveModel(this.lastSpectatorViewmodel);
      this.lastSpectatorViewmodel = undefined;
    }
    if (this.teamPreview) {
      this.teamPreview(renderDt);
      return;
    }
    if (
      this.cosmeticPreview?.render(
        this.renderer,
        () =>
          this.homeScene.renderInspectionBackdrop(
            this.renderer,
            this.cosmeticPreview!.inspectionCamera,
          ),
        this.homeScene.inspectionEnvironment,
        renderDt,
      )
    )
      return;
    if (!this.active && !el("menu").classList.contains("hidden")) {
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      if (document.getElementById("loadout-editor"))
        this.groundInventory.renderPreviews(this.renderer);
      else if (
        !this.weaponInspectPreview?.render(
          this.renderer,
          () =>
            this.homeScene.renderInspectionBackdrop(
              this.renderer,
              this.weaponInspectPreview!.inspectionCamera,
            ),
          this.homeScene.inspectionEnvironment,
          renderDt,
        ) &&
        !this.musicKitPreview?.render(
          this.renderer,
          () =>
            this.homeScene.renderInspectionBackdrop(
              this.renderer,
              this.musicKitPreview!.inspectionCamera,
            ),
          this.homeScene.inspectionEnvironment,
          renderDt,
        )
      )
        this.homeScene.render(this.renderer, this.team, renderDt, !this.previewingViewmodel);
      if (this.previewingViewmodel) this.renderViewmodelPreview(now / 1000);
      return;
    }
    this.notices.updateAction(
      this.planting
        ? { kind: "plant", elapsed: this.bomb!.plantProgress, duration: PLANT_DURATION, kit: false }
        : this.active && !this.dead && this.roundPause === 0 && this.bomb?.defuser === "player"
          ? {
              kind: "defuse",
              elapsed: this.bomb.progress,
              duration: this.defuseKit ? 5 : 10,
              kit: this.defuseKit,
            }
          : undefined,
    );
    for (const tracer of this.tracers) updateTracer(tracer, renderDt);
    if (this.active) this.drawMap(el("radar") as HTMLCanvasElement, true);
    const speed = Math.hypot(this.velocity.x, this.velocity.z),
      bob = this.active && this.locked && this.grounded ? Math.sin(this.sway) * speed * 0.0017 : 0;
    // The spectator renderer owns the cached viewmodel while dead; sampling the
    // player's interrupted action too would restart its transition every frame.
    if (!this.dead || !this.teamMode)
      this.animateWeapon(bob, Math.cos(this.sway * 0.5) * speed * 0.001);

    this.flash.visible = this.kick > 0.048 && !this.isSuppressed(this.selected);
    const planting = this.planting;
    const defusing =
      this.active &&
      !this.dead &&
      this.roundPause === 0 &&
      this.bomb?.planted &&
      this.bomb.defuser === "player";
    const holdingBomb = this.bombSelected && !!this.carryingBomb;
    this.bombView.visible = !!planting || holdingBomb;
    this.defuseView.visible = !!defusing;
    this.defuseView.wires.visible = !!defusing;
    this.utility.renderSelection();
    this.healthshotView.visible =
      this.active && !this.dead && this.mode === "deathmatch" && this.healthshotAction.selected;
    if (this.healthshotView.visible) {
      this.healthshotView.sample(
        this.healthshotAction.phase,
        this.healthshotAction.elapsed,
        this.team,
        gloveChoices[this.team],
        selectedAgentId(this.team),
      );
      this.flash.visible = false;
    }
    this.gun.visible =
      !planting &&
      !holdingBomb &&
      !defusing &&
      !this.utility.selected &&
      !this.utility.throwingKind &&
      !this.healthshotView.visible;
    if (defusing) {
      this.defuseView.userData.gloveTeam = this.team;
      this.defuseView.sample(this.bomb!.progress / (this.defuseKit ? 5 : 10), this.defuseKit);
      this.defuseView.connect(this.bomb!.position, this.camera, this.viewCamera);
      this.flash.visible = false;
    }
    if (holdingBomb && !planting) {
      this.bombView.userData.gloveTeam = this.team;
      this.bombView.draw(BOMB_DRAW_DURATION - this.bombDrawTime);
      this.flash.visible = false;
    }
    if (planting) {
      this.bombView.userData.gloveTeam = this.team;
      this.bombView.sample(this.bomb!.plantProgress / PLANT_DURATION);
      this.flash.visible = false;
    }
    this.flash.rotation.z = Math.random() * 6;
    setStyle(
      "crosshair",
      "--gap",
      `${this.settings.crosshairGap + (this.settings.crosshairDynamic ? speed * 2 + Math.min(this.shots, 20) * 0.5 + (this.grounded ? 0 : 14) : 0)}px`,
    );
    setStyle("hitmarker", "opacity", this.hit > 0 ? "1" : "0");
    setStyle("damage", "opacity", String(this.damage * 3));
    if (this.active && this.dead && this.teamMode) this.spectate();
    if (!this.dead || !this.active) this.spectated = undefined;
    if (this.audio) {
      this.soundscape.spatial.useNativeProbes = this.teamMode && !!this.dust?.sourceLighting;
      this.soundscape.spatial.update(this.audio, this.camera);
    }
    this.animateBots();
    this.bombMesh.update(
      this.bomb?.planted ?? false,
      this.bomb?.timer ?? 0,
      this.roundPause === 0,
      (this.bomb?.beepPulse ?? 0) > 0,
    );
    this.updateSceneLighting(renderDt);
    // A close wall can compress the chase camera into the followed body. Hide
    // that body only for this render, retaining visibility for game state.
    const observing = this.active && this.dead > 0 && this.teamMode;
    const firstPerson = observing && this.spectatorMode === "first" ? this.spectated : undefined;
    const followed = observing && this.spectatorMode !== "free" ? this.spectated?.group : undefined;
    const hideFollowed =
      followed &&
      (firstPerson || this.camera.position.distanceToSquared(this.spectatorFocus) < 0.81);
    const wasVisible = followed?.visible;
    if (hideFollowed) followed.visible = false;
    const buying = !el("loadout").classList.contains("hidden");
    this.renderer.toneMapping = T.CustomToneMapping;
    this.world.nativeEffects?.update(now / 1000);
    this.world.nativeEnvironment?.update(now / 1000);
    this.world.nativeCoverage?.update(now / 1000);
    this.renderMapFrame(() => {
      this.renderer.clear();
      try {
        this.utility.renderWorld();
      } finally {
        if (followed && hideFollowed) followed.visible = wasVisible!;
      }
      if (this.previewingViewmodel) this.renderViewmodelPreview(now / 1000);
      else if (
        !buying &&
        this.active &&
        !this.dead &&
        (!this.scopeLevel || weapons[this.selected].zoomLevels === 1)
      ) {
        this.renderer.clearDepth();
        this.renderer.render(this.view, this.viewCamera);
      } else if (firstPerson && !buying) this.renderSpectatorWeapon(firstPerson);
    });
    if (this.assetsReady) this.buyPreview.render(this.renderer, this.team, this.selected);
    if (
      !this.weaponInspectPreview?.render(
        this.renderer,
        () =>
          this.homeScene.renderInspectionBackdrop(
            this.renderer,
            this.weaponInspectPreview!.inspectionCamera,
          ),
        this.homeScene.inspectionEnvironment,
        renderDt,
      )
    )
      this.musicKitPreview?.render(
        this.renderer,
        () =>
          this.homeScene.renderInspectionBackdrop(
            this.renderer,
            this.musicKitPreview!.inspectionCamera,
          ),
        this.homeScene.inspectionEnvironment,
        renderDt,
      );
  }
}
