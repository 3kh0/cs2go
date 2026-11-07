import { weapons, isKnife } from "./physics";
import { weaponAvailable } from "./economy";

export function readHomeWeapons() {
  const choices = { ct: 9, t: 0 };
  try {
    const stored = JSON.parse(localStorage.getItem("cs2go-home-weapons") ?? "{}");
    for (const team of ["ct", "t"] as const)
      if (
        Number.isInteger(stored?.[team]) &&
        weapons[stored[team]] &&
        !isKnife(stored[team]) &&
        weaponAvailable(stored[team], team)
      )
        choices[team] = stored[team];
  } catch {
    /* Defaults work without storage. */
  }
  return choices;
}
