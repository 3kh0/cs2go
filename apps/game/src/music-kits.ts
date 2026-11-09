import { assetFetch } from "./asset-url";

export type Music =
  | "menu"
  | "start"
  | "action"
  | "selection"
  | "match-found"
  | "loading"
  | "start-gg"
  | "hostage"
  | "hostage-rescue"
  | "deathcam"
  | "win"
  | "lose"
  | "mvp"
  | "countdown"
  | "bomb"
  | "bomb-countdown"
  | "match"
  | "end";

export interface MusicKitCue {
  tracks: string[];
  loop?: boolean;
  gain?: number;
  nativeEvent?: string;
  weights?: number[];
  starts?: number[];
  ends?: number[];
  syncPoints?: number[][];
  stopAfter?: number;
  fadeOut?: number;
  priority?: number;
  fadeIn?: { start: number; end: number; from: number; to: number };
}
export interface MusicKit {
  id: string;
  name: string;
  artist?: string;
  description?: string;
  image: string;
  events: Record<string, MusicKitCue>;
  extraTracks?: string[];
}
export interface MusicKitCatalog {
  version: number;
  defaultKitId: string;
  kits: MusicKit[];
}
export const musicKitStorageKey = "cs2go-music-kit";
// An internal default keeps the existing soundtrack available before the optional
// catalog loads. Selecting its native catalog entry stores this same sentinel.
export const defaultMusicKitId = "default";
let catalog: Promise<MusicKitCatalog> | undefined;
export function loadMusicKits() {
  return (catalog ??= assetFetch("/audio/music-kits/catalog.json")
    .then(async (response) => {
      if (!response.ok) throw new Error("Music kits could not load. Please try again.");
      return (await response.json()) as MusicKitCatalog;
    })
    .catch((error: unknown) => {
      catalog = undefined;
      throw error;
    }));
}
export const musicEventLabels: Record<string, string> = {
  menu: "Main menu",
  match: "Match start",
  selection: "Team selection",
  "match-found": "Match found",
  loading: "Loading screen",
  "start-gg": "Arms Race round start",
  hostage: "Hostage picked up",
  "hostage-rescue": "Hostage near rescue",
  "mvp-preview": "MVP preview",
  extra: "Additional tracks",
  start: "Round start",
  action: "Round action",
  deathcam: "Death camera",
  win: "Round won",
  lose: "Round lost",
  mvp: "MVP anthem",
  countdown: "Round ten-second warning",
  bomb: "Bomb planted",
  "bomb-countdown": "Bomb ten-second warning",
  end: "Match end",
};

export const musicEventDescriptions: Record<string, string> = {
  menu: "Main menu background music.",
  "mvp-preview": "The anthem preview used while inspecting a music kit.",
  selection: "When choosing a team.",
  "match-found": "When a matchmaking game is found.",
  loading: "While loading into a match.",
  start: "The buy and freeze period before a round goes live.",
  action: "The beginning of live round action.",
  "start-gg": "When an Arms Race round starts.",
  bomb: "After the bomb is planted, before its final warning.",
  "bomb-countdown": "The final ten seconds of the bomb timer.",
  hostage: "When a hostage is picked up.",
  "hostage-rescue": "When a hostage is carried near rescue.",
  countdown: "The final ten seconds of a round.",
  win: "A round win, when an MVP anthem does not replace it.",
  lose: "A round loss, when an MVP anthem does not replace it.",
  deathcam: "During the death camera; objective warnings take precedence.",
  mvp: "When the round MVP is announced.",
  match: "At the start of a match.",
  end: "On the match result screen.",
  extra: "Additional recordings not assigned to a current event.",
};
