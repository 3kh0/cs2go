// Version every wire-format or simulation compatibility change together.
export const PROTOCOL_VERSION = 1;
export const TICK_RATE = 128;
export const SNAPSHOT_RATE = 32;
export const MAX_PLAYERS = 10;
export const MAX_PENDING_INPUTS = 128;
export const MAX_BATCH = 8;
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
  reload: boolean;
};
export type PlayerState = Vec3 & {
  id: string;
  name: string;
  team: Team;
  vx: number;
  vz: number;
  vertical: number;
  eye: number;
  grounded: boolean;
  yaw: number;
  pitch: number;
  health: number;
  ammo: number;
  reserve: number;
  cooldown: number;
  reloadTime: number;
  respawnTime: number;
  spawn: number;
  kills: number;
  deaths: number;
  ack: number;
};
export type MatchEvent =
  | { kind: "shot"; shooter: string; from: Vec3; to: Vec3 }
  | { kind: "kill"; killer: string; victim: string; headshot: boolean };
export type ServerMessage =
  | { type: "welcome"; version: number; id: string; room: string; map: "yard" }
  | { type: "snapshot"; tick: number; players: PlayerState[]; events: MatchEvent[] }
  | { type: "pong"; time: number }
  | { type: "error"; message: string };
export type ClientMessage =
  | { type: "join"; version: number; room: string; name: string; password: string }
  | { type: "inputs"; inputs: Input[] }
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
    ["jump", "duck", "walk", "fire", "reload"].every((key) => typeof value[key] === "boolean")
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
    value.password.length <= 128
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
    reload: false,
  };
}
