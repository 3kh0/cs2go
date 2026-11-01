// Version every wire-format or simulation compatibility change together.
import { isKnife, WEAPON_COUNT } from "./armory";
export { isKnife, knifeDefinitions, WEAPON_COUNT } from "./armory";
export const PROTOCOL_VERSION = 5;
export const TICK_RATE = 128;
export const SNAPSHOT_RATE = 32;
export const MAX_PLAYERS = 20;
export const MAX_PENDING_INPUTS = 128;
export const MAX_BATCH = 8;
export type GrenadeKind = "he" | "flash" | "smoke" | "molotov" | "incendiary" | "decoy";
export type GrenadeInventory = Record<GrenadeKind, number>;
export type UtilityProjectile = Vec3 & {
  id: number;
  kind: GrenadeKind;
  owner: string;
  team: Team;
  weapon: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  resting: boolean;
  lastBounce: number;
};
export type UtilityEffect = Vec3 & {
  id: number;
  kind: GrenadeKind;
  owner: string;
  team: Team;
  weapon: number;
  age: number;
  pulse: number;
  cleared: number;
  cells: Vec3[];
  holes: number[];
};
export type SkinChoice = { id: string; wear: number; seed: number };
export type WeaponAppearance = {
  serial: number;
  weapon: number;
  creator: string;
  skin: SkinChoice;
};
export type PlayerConfiguration = {
  profile?: { name: string; avatar: string | null };
  knife?: number;
  skins: Record<number, SkinChoice>;
  agents: Record<Team, string>;
  loadouts: Record<Team, number[]>;
};
export type MatchMode = "casual" | "competitive";
export type Team = "ct" | "t";
export type Vec3 = { x: number; y: number; z: number };
export type Input = {
  seq: number;
  forward: number;
  right: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  duck: boolean;
  walk: boolean;
  fire: boolean;
  utility: "" | GrenadeKind;
  grenadeBuy: "" | GrenadeKind;
  grenadeRefund: "" | GrenadeKind;
  throwKind: "" | GrenadeKind;
  throwStrength: number;
  alternate: boolean;
  burst: boolean;
  scope: number;
  toggleSuppressor: boolean;
  stab: boolean;
  drop: boolean;
  pickup: boolean;
  reload: boolean;
  use: boolean;
  select: number;
  buy: number;
  equipment: "" | "vest" | "helmet" | "kit";
  refund: number;
  refundEquipment: "" | "kevlar" | "helmet" | "kit";
  dropBomb: boolean;
};
export type PlayerState = Vec3 & {
  id: string;
  name: string;
  avatar?: string | null;
  team: Team;
  vx: number;
  vz: number;
  vertical: number;
  eye: number;
  grounded: boolean;
  yaw: number;
  pitch: number;
  allowedWeapons: number[];
  refundableWeapons: number[];
  refundableEquipment: ("kevlar" | "helmet" | "kit")[];
  grenadeReceipts: GrenadeInventory;
  appearances: Record<number, WeaponAppearance>;
  agent: string;
  grenades: GrenadeInventory;
  blind: number;
  accuracy: { penalty: number; baseline?: number; mode: 0 | 1 };
  recoilIndex: number;
  burstRemaining: number;
  scope: number;
  suppressed: boolean;
  reloadPhase: "intro" | "loop" | "outro";
  reloadEmpty: boolean;
  suppressorAction: "" | "silencer_attach" | "silencer_detach";
  suppressorTime: number;
  suppressorDuration: number;
  charge: number;
  punch: { pitch: number; yaw: number; pitchVelocity: number; yawVelocity: number };
  health: number;
  ammo: number;
  reserve: number;
  cooldown: number;
  reloadTime: number;
  respawnTime: number;
  spawn: number;
  kills: number;
  mvps: number;
  deaths: number;
  ack: number;
  weapon: number;
  primary: number | null;
  knife: number;
  secondary: number;
  magazines: Record<number, { ammo: number; reserve: number }>;
  money: number;
  armor: number;
  helmet: boolean;
  kit: boolean;
  waiting: boolean;
};
export type MatchEvent =
  | {
      kind: "shot";
      shooter: string;
      from: Vec3;
      to: Vec3;
      weapon: number;
      alternate?: boolean;
      suppressed?: boolean;
      pellet?: number;
      impacts?: { point: Vec3; normal: Vec3 }[];
      hits?: { victim: string; headshot: boolean; passed: boolean }[];
      normal?: Vec3;
      victim?: string;
      headshot?: boolean;
    }
  | { kind: "melee"; shooter: string; stab: boolean; hit: boolean }
  | {
      kind: "kill";
      killer: string;
      victim: string;
      headshot: boolean;
      weapon: number;
      utility?: GrenadeKind;
      noScope?: boolean;
      wallbang?: boolean;
      appearance?: WeaponAppearance;
    }
  | {
      kind: "utility-sound";
      sound: "bounce" | "decoy-shot" | "decoy-explode";
      utility: GrenadeKind;
      point: Vec3;
      weapon: number;
    }
  | { kind: "plant" | "defuse" | "explode"; actor: string };
export type RoundState = {
  ball: Vec3 & { qx: number; qy: number; qz: number; qw: number };
  clock: number;
  projectiles: UtilityProjectile[];
  effects: UtilityEffect[];
  drops: (Vec3 & {
    id: number;
    weapon: number;
    ammo: number;
    reserve: number;
    owner: string;
    vx: number;
    vy: number;
    vz: number;
    rx: number;
    rz: number;
    sleeping: boolean;
    tossed: boolean;
    appearance: WeaponAppearance;
    suppressed: boolean;
    yaw: number;
    age: number;
  })[];
  mode: MatchMode;
  phase: "waiting" | "freeze" | "live" | "post" | "halftime" | "finished";
  round: number;
  scores: Record<Team, number>;
  remaining: number;
  buyRemaining: number;
  pause: number;
  elapsed: number;
  result: {
    winner: Team;
    reason: string;
    fact?: string;
    mvp?: { name: string; reason: string };
  } | null;
  bomb: {
    x: number;
    y: number;
    z: number;
    carrier: string | null;
    planted: boolean;
    timer: number;
    plantProgress: number;
    defuser: string | null;
    progress: number;
    planter: string | null;
  };
};
export type ServerMessage =
  | { type: "welcome"; version: number; id: string; room: string; map: "dust2"; mode: MatchMode }
  | {
      type: "snapshot";
      tick: number;
      players: PlayerState[];
      events: MatchEvent[];
      round: RoundState;
    }
  | { type: "pong"; time: number }
  | { type: "error"; message: string };
export type ClientMessage =
  | {
      type: "join";
      version: number;
      room: string;
      name: string;
      password: string;
      mode: MatchMode;
      team: Team;
    }
  | { type: "configure"; configuration: PlayerConfiguration }
  | { type: "inputs"; inputs: Input[] }
  | { type: "stop" }
  | { type: "ping"; time: number };
export function validRoom(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{12,32}$/.test(value);
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
export function validInput(value: unknown): value is Input {
  if (!record(value)) return false;
  return (
    Number.isSafeInteger(value.seq) &&
    (value.seq as number) > 0 &&
    finite(value.forward) &&
    Math.abs(value.forward) <= 1 &&
    finite(value.right) &&
    Math.abs(value.right) <= 1 &&
    finite(value.yaw) &&
    Math.abs(value.yaw) <= Math.PI &&
    finite(value.pitch) &&
    Math.abs(value.pitch) <= 1.5 &&
    ["utility", "grenadeBuy", "grenadeRefund", "throwKind"].every((key) =>
      ["", "he", "flash", "smoke", "molotov", "incendiary", "decoy"].includes(value[key] as string),
    ) &&
    finite(value.throwStrength) &&
    value.throwStrength >= 0 &&
    value.throwStrength <= 1 &&
    Number.isInteger(value.scope) &&
    (value.scope as number) >= 0 &&
    (value.scope as number) <= 2 &&
    Number.isInteger(value.select) &&
    (value.select as number) >= -1 &&
    (value.select as number) < WEAPON_COUNT &&
    Number.isInteger(value.buy) &&
    (value.buy as number) >= -1 &&
    (value.buy as number) < WEAPON_COUNT &&
    Number.isInteger(value.refund) &&
    (value.refund as number) >= -1 &&
    (value.refund as number) < WEAPON_COUNT &&
    ["", "kevlar", "helmet", "kit"].includes(value.refundEquipment as string) &&
    ["", "vest", "helmet", "kit"].includes(value.equipment as string) &&
    [
      "jump",
      "duck",
      "walk",
      "fire",
      "alternate",
      "burst",
      "toggleSuppressor",
      "stab",
      "drop",
      "pickup",
      "reload",
      "use",
      "dropBomb",
    ].every((key) => typeof value[key] === "boolean")
  );
}
export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!record(value)) return null;
  if (value.type === "stop") return { type: "stop" };
  if (value.type === "configure" && record(value.configuration)) {
    const config = value.configuration;
    if (config.profile !== undefined) {
      const profile = config.profile;
      if (
        !record(profile) ||
        typeof profile.name !== "string" ||
        !profile.name.trim() ||
        profile.name.length > 24 ||
        Array.from(profile.name).some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ) ||
        (profile.avatar !== null &&
          (typeof profile.avatar !== "string" ||
            !/^https:\/\/avatars\.(?:fastly\.|akamai\.|cloudflare\.)?steamstatic\.com\/[a-f0-9]{40}(?:_full|_medium)?\.jpg$/.test(
              profile.avatar,
            )))
      )
        return null;
    }

    if (config.knife !== undefined && !isKnife(config.knife as number)) return null;
    if (
      !record(config.skins) ||
      Object.keys(config.skins).length > WEAPON_COUNT ||
      !record(config.agents) ||
      !record(config.loadouts)
    )
      return null;
    for (const [key, skin] of Object.entries(config.skins)) {
      if (
        !/^\d{1,2}$/.test(key) ||
        Number(key) >= WEAPON_COUNT ||
        !record(skin) ||
        typeof skin.id !== "string" ||
        !/^[a-zA-Z0-9_-]{0,128}$/.test(skin.id) ||
        !finite(skin.wear) ||
        skin.wear < 0 ||
        skin.wear > 1 ||
        !Number.isInteger(skin.seed) ||
        (skin.seed as number) < 0 ||
        (skin.seed as number) > 1000
      )
        return null;
    }
    for (const team of ["ct", "t"]) {
      if (
        typeof config.agents[team] !== "string" ||
        !/^[a-zA-Z0-9_-]{1,96}$/.test(config.agents[team] as string)
      )
        return null;
      const list = config.loadouts[team];
      if (
        !Array.isArray(list) ||
        list.length > 15 ||
        list.some((id) => !Number.isInteger(id) || id < 0 || id > 36) ||
        new Set(list).size !== list.length
      )
        return null;
    }
    return value as ClientMessage;
  }
  if (
    value.type === "join" &&
    value.version === PROTOCOL_VERSION &&
    validRoom(value.room) &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.length <= 24 &&
    !Array.from(value.name).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    typeof value.password === "string" &&
    value.password.length <= 128 &&
    (value.mode === "casual" || value.mode === "competitive") &&
    (value.team === "ct" || value.team === "t")
  )
    return value as ClientMessage;
  if (
    value.type === "inputs" &&
    Array.isArray(value.inputs) &&
    value.inputs.length > 0 &&
    value.inputs.length <= MAX_BATCH &&
    value.inputs.every(validInput)
  )
    return value as ClientMessage;
  if (value.type === "ping" && finite(value.time) && value.time >= 0) return value as ClientMessage;
  return null;
}
export function neutralInput(seq = 0): Input {
  return {
    seq,
    forward: 0,
    right: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    duck: false,
    walk: false,
    fire: false,
    utility: "",
    grenadeBuy: "",
    grenadeRefund: "",
    throwKind: "",
    throwStrength: 1,
    alternate: false,
    burst: false,
    toggleSuppressor: false,
    scope: 0,
    stab: false,
    drop: false,
    pickup: false,
    reload: false,
    use: false,
    select: -1,
    buy: -1,
    equipment: "",
    refund: -1,
    refundEquipment: "",
    dropBomb: false,
  };
}
