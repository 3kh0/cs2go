import { weapons } from "./physics";
import { skinChoices, skinName, type SkinChoice } from "./skins";
let serial = 0;
export type WeaponInstance = Readonly<{
  serial: number;
  weapon: number;
  creator: string;
  skin: Readonly<SkinChoice>;
}>;
/** Appearance is captured on creation, never inferred from the current holder. */
export function createWeaponInstance(
  weapon: number,
  creator: string,
  playerLoadout = false,
): WeaponInstance {
  return Object.freeze({
    serial: ++serial,
    weapon,
    creator,
    skin: Object.freeze(
      playerLoadout ? { ...skinChoices[weapon] } : { id: "", wear: 0.01, seed: 1 },
    ),
  });
}
export function weaponInstanceName(instance: WeaponInstance) {
  const finish = instance.skin.id ? skinName(instance.skin.id) : "";
  return weapons[instance.weapon].name + (finish ? ` | ${finish}` : "");
}
