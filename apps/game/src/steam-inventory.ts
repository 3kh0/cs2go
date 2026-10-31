import { weapons } from "./physics";
import type { Skin } from "./skins";

export type SteamItem = {
  assetId: string;
  name: string;
  weaponName: string;
  finish: string;
  wear: number | null;
  seed: number | null;
  image?: string;
  type?: string;
  rarity?: string;
  color?: string;
};

const normalize = (name: string) =>
  name.normalize("NFKC").replace(/[™★]/g, "").trim().toLowerCase();
export function matchSteamSkin(item: SteamItem, catalog: Skin[]) {
  const weapon = weapons.findIndex((w) => normalize(w.name) === normalize(item.weaponName));
  return catalog.find(
    (skin) => skin.weapon === weapon && normalize(skin.name) === normalize(item.finish),
  );
}

export function steamChoice(item: SteamItem, skin: Skin) {
  if (
    typeof item.wear !== "number" ||
    !Number.isFinite(item.wear) ||
    item.wear < 0 ||
    item.wear > 1 ||
    typeof item.seed !== "number" ||
    !Number.isInteger(item.seed) ||
    item.seed < 0 ||
    item.seed > 1000
  )
    return null;
  return { id: skin.id, wear: item.wear, seed: item.seed };
}
