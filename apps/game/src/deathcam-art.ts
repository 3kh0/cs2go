import type { Skin } from "./skins";
import type { WeaponInstance } from "./weapon-instance";
import { weapons } from "./physics";

export type DeathcamArtwork = {
  path: string;
  thumbnail: boolean;
  skin: string;
  name?: string;
};

/** Resolve the actual killing weapon's immutable appearance, never the local
 * player's current loadout. The existing inventory images are native econ art. */
export function deathcamArtwork(
  weapon: number,
  instance: WeaponInstance | undefined,
  catalog: readonly Pick<Skin, "id" | "weapon" | "name" | "image">[],
  fallback: string,
): DeathcamArtwork {
  const definition = weapons[weapon];
  if (!definition) return { path: fallback, thumbnail: false, skin: "" };
  const skin =
    instance?.weapon === weapon && instance.skin.id
      ? catalog.find((entry) => entry.weapon === weapon && entry.id === instance.skin.id)
      : undefined;
  return {
    path: skin?.image ?? `/skins/defaults/${weapon}.webp`,
    thumbnail: true,
    skin: skin?.id ?? "",
    name: definition.name + (skin ? ` | ${skin.name}` : ""),
  };
}
