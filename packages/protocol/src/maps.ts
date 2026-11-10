/** Enabled native imports are available in the picker and multiplayer. Asset
 * closure and core gameplay are checked separately from ongoing visual parity. */
export const MAPS = {
  dust2: { name: "Dust II", ready: true },
  mirage: { name: "Mirage", ready: true },
  vertigo: { name: "Vertigo", ready: true },
  nuke: { name: "Nuke", ready: true },
  inferno: { name: "Inferno", ready: true },
  cache: { name: "Cache", ready: true },
} as const;

export type MapId = keyof typeof MAPS;
export const MAP_IDS: readonly MapId[] = Object.freeze(
  (Object.keys(MAPS) as MapId[]).filter((id) => MAPS[id].ready),
);

export function isMapId(value: unknown): value is MapId {
  return typeof value === "string" && Object.hasOwn(MAPS, value) && MAPS[value as MapId].ready;
}
