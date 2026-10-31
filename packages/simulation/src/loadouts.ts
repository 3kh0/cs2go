import { isKnife, weapons, weaponSlot } from "./physics";
import { weaponAvailable, type Team } from "./economy";
export const midTier = new Set([10, 11, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);
export type Loadouts = Record<Team, number[]>;
export const loadoutCategory = (id: number) =>
  weaponSlot(id) === 2 ? "Pistols" : midTier.has(id) ? "Mid-Tier" : "Rifles";
export function defaultLoadouts(): Loadouts {
  return {
    t: [7, 8, 16, 13, 15, 26, 28, 30, 10, 34, 0, 20, 3, 22, 23],
    ct: [2, 8, 18, 13, 14, 11, 28, 30, 10, 35, 1, 9, 19, 3, 21],
  };
}
export function readLoadouts(value: unknown): Loadouts {
  const defaults = defaultLoadouts();
  if (!value || typeof value !== "object") return defaults;
  for (const team of ["t", "ct"] as const) {
    const ids = (value as Loadouts)[team];
    if (!Array.isArray(ids)) continue;
    const valid = [...new Set(ids)].filter(
      (id) => Number.isInteger(id) && weapons[id] && !isKnife(id) && weaponAvailable(id, team),
    );
    if (
      ["Pistols", "Mid-Tier", "Rifles"].every(
        (category) => valid.filter((id) => loadoutCategory(id) === category).length <= 5,
      )
    ) {
      // Migrate the earlier editor's two CT starting pistols into one slot.
      const starting =
        team === "ct" ? valid.find((id) => id === 2 || id === 12) : valid.find((id) => id === 7);
      const extra = team === "ct" && valid.includes(2) && valid.includes(12);
      defaults[team] =
        starting === undefined
          ? valid
          : [starting, ...valid.filter((id) => id !== 2 && id !== 12 && id !== 7)];
      if (extra && !defaults[team].includes(18)) defaults[team].splice(2, 0, 18);
    }
  }
  return defaults;
}
export function loadoutChoices(team: Team, category: string, slot: number) {
  return weapons.flatMap((_, id) => {
    if (isKnife(id) || !weaponAvailable(id, team) || loadoutCategory(id) !== category) return [];
    if (category === "Pistols") {
      const starting = team === "ct" ? id === 2 || id === 12 : id === 7;
      if (starting !== (slot === 0)) return [];
    }
    return [id];
  });
}
export function changeLoadout(loadouts: Loadouts, team: Team, id: number) {
  if (!weapons[id] || isKnife(id) || !weaponAvailable(id, team)) return false;
  const list = loadouts[team];
  if (list.includes(id)) {
    list.splice(list.indexOf(id), 1);
    return true;
  }
  if (list.filter((other) => loadoutCategory(other) === loadoutCategory(id)).length >= 5)
    return false;
  list.push(id);
  return true;
}
