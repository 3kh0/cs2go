import { isKnife } from "./physics";
import { defaultKnife } from "./loadouts";
import type { AgentTeam } from "./soldier";

const key = "cs2go-equipped-knives";
export const equippedKnives = { ct: defaultKnife("ct"), t: defaultKnife("t") };
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
  for (const team of ["ct", "t"] as const)
    if (Number.isInteger(saved?.[team]) && isKnife(saved[team])) equippedKnives[team] = saved[team];
} catch {
  // Keep team defaults when storage is unavailable.
}
export function equipKnife(team: AgentTeam, id: number, notify = false) {
  if (!isKnife(id)) return;
  equippedKnives[team] = id;
  if (notify) window.dispatchEvent(new Event("cs2go-knives-change"));
  try {
    localStorage.setItem(key, JSON.stringify(equippedKnives));
  } catch {
    // Session selection remains usable.
  }
}
