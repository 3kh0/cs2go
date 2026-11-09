import { weapons, isKnife } from "./physics";
import { weaponAvailable } from "./economy";
import { equippedKnives } from "./equipped-knives";
import { readLoadouts } from "./loadouts";

export function readHomeWeapons() {
  const choices = { ct: 9, t: 0 };
  try {
    const loadouts = readLoadouts(JSON.parse(localStorage.getItem("cs2go-loadouts") ?? "null"));
    const stored = JSON.parse(localStorage.getItem("cs2go-home-weapons") ?? "{}");
    for (const team of ["ct", "t"] as const)
      if (
        Number.isInteger(stored?.[team]) &&
        weapons[stored[team]] &&
        (isKnife(stored[team])
          ? stored[team] === equippedKnives[team]
          : loadouts[team].includes(stored[team])) &&
        weaponAvailable(stored[team], team)
      )
        choices[team] = stored[team];
  } catch {
    /* Defaults work without storage. */
  }
  return choices;
}
