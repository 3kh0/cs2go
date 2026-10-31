import actionData from "./data/weapon-actions.json";
import type { Input, PlayerState } from "@cs2go/protocol";
import { isKnife, reloadMagazine, weapons, WEAPON_ANIMATION_RATE } from "./physics";
import { REVOLVER_COCK_TIME } from "./melee";
type Clip = { duration: number; markers: Record<string, number>; loopDuration: number };
export const actionClips = actionData.weapons as Record<string, Clip>[];
export function createWeaponActions() {
  return {
    inserted: false,
    empty: false,
    shell: "intro" as "intro" | "loop" | "outro",
    burst: 0,
    burstTime: 0,
    charge: 0,
    attached: weapons.map((weapon) => weapon.suppressed),
    suppressor: "" as "" | "silencer_attach" | "silencer_detach",
    suppressorTime: 0,
    suppressorDuration: 0,
  };
}
export type WeaponActions = ReturnType<typeof createWeaponActions>;
export function shellDuration(player: PlayerState, state: Pick<WeaponActions, "shell">) {
  const w = weapons[player.weapon];
  return state.shell === "intro" ? 0.4 : state.shell === "loop" ? w.reload : 0.9;
}
export function reloadProgress(player: PlayerState, state: Pick<WeaponActions, "shell">) {
  if (weapons[player.weapon].reloadStyle !== "shell")
    return 1 - player.reloadTime / weapons[player.weapon].reload;
  const clip = actionClips[player.weapon].reload;
  const start = clip?.markers.WPN_RELOAD_LOOP ?? 11 / 49;
  const end = start + (clip?.loopDuration || 13 / 49);
  const a = state.shell === "intro" ? 0 : state.shell === "loop" ? start : end;
  const b = state.shell === "intro" ? start : state.shell === "loop" ? end : 1;
  return a + (b - a) * (1 - player.reloadTime / shellDuration(player, state));
}
export function cancelWeaponActions(player: PlayerState, state: WeaponActions) {
  player.reloadTime = 0;
  state.burst = state.charge = 0;
  state.suppressor = "";
  state.inserted = false;
}
export function beginReload(player: PlayerState, state: WeaponActions) {
  const w = weapons[player.weapon];
  if (
    isKnife(player.weapon) ||
    player.reloadTime ||
    state.suppressor ||
    player.ammo >= w.mag ||
    !player.reserve
  )
    return;
  state.empty = player.ammo === 0;
  state.inserted = false;
  state.shell = "intro";
  state.burst = state.charge = 0;
  player.reloadTime = w.reloadStyle === "shell" ? shellDuration(player, state) : w.reload;
}
/** Ammo commits at the same imported marker as the viewmodel, independently of holstering. */
export function advanceWeaponActions(
  player: PlayerState,
  state: WeaponActions,
  input: Input,
  dt: number,
) {
  const w = weapons[player.weapon];
  state.burstTime = Math.max(0, state.burstTime - dt);
  if (
    input.toggleSuppressor &&
    (player.weapon === 1 || player.weapon === 2) &&
    !state.suppressor &&
    !player.reloadTime &&
    player.cooldown <= 0
  ) {
    state.suppressor = state.attached[player.weapon] ? "silencer_detach" : "silencer_attach";
    state.suppressorDuration =
      (actionClips[player.weapon][state.suppressor]?.duration ?? 3) / WEAPON_ANIMATION_RATE;
    state.suppressorTime = 0;
  }
  if (state.suppressor) {
    const clip = actionClips[player.weapon][state.suppressor];
    state.suppressorTime += dt;
    const marker =
      clip?.markers[
        state.suppressor === "silencer_attach" ? "WPN_SILENCER_ATTACH" : "WPN_SILENCER_DETACH"
      ] ?? 1;
    if (state.suppressorTime / state.suppressorDuration >= marker)
      state.attached[player.weapon] = state.suppressor === "silencer_attach";
    if (state.suppressorTime >= state.suppressorDuration) state.suppressor = "";
  }
  if (player.reloadTime > 0) {
    player.reloadTime = Math.max(0, player.reloadTime - dt);
    const progress = reloadProgress(player, state);
    const clip =
      actionClips[player.weapon][state.empty ? "reload_empty" : "reload"] ??
      actionClips[player.weapon].reload;
    const marker = clip?.markers.WPN_RELOAD_ADD_AMMO ?? 1;
    if (w.reloadStyle === "shell") {
      if (state.shell === "loop" && !state.inserted && progress >= marker) {
        player.ammo++;
        player.reserve--;
        state.inserted = true;
      }
      if (input.fire && player.ammo > 0) player.reloadTime = 0;
      else if (player.reloadTime === 0 && state.shell !== "outro") {
        state.shell = player.ammo < w.mag && player.reserve > 0 ? "loop" : "outro";
        state.inserted = false;
        player.reloadTime = shellDuration(player, state);
      }
    } else if (!state.inserted && progress >= marker) {
      Object.assign(player, reloadMagazine(player.weapon, player.ammo, player.reserve));
      state.inserted = true;
    }
  }
  if (input.reload) beginReload(player, state);
  if (
    player.weapon === 17 &&
    input.fire &&
    !input.alternate &&
    !player.reloadTime &&
    player.cooldown <= 0
  )
    state.charge += dt;
  else state.charge = 0;
}
export function canTrigger(player: PlayerState, state: WeaponActions, input: Input, held: boolean) {
  const w = weapons[player.weapon];
  const queued = state.burst > 0 && state.burstTime === 0;
  if (player.reloadTime || state.suppressor || (player.cooldown > 0 && !queued)) return false;
  if (!(input.fire || input.alternate || (input.stab && isKnife(player.weapon)) || queued))
    return false;
  if (!player.ammo && !isKnife(player.weapon)) {
    beginReload(player, state);
    return false;
  }
  if (player.weapon === 17 && !input.alternate && state.charge < REVOLVER_COCK_TIME) return false;
  if (queued || (player.weapon === 17 && !input.alternate)) return true;
  return w.auto || isKnife(player.weapon) || !held;
}
export function commitTrigger(player: PlayerState, state: WeaponActions, input: Input) {
  const w = weapons[player.weapon];
  if (!isKnife(player.weapon)) player.ammo--;
  const bursting = input.burst && (player.weapon === 7 || player.weapon === 19);
  const continuing = state.burst > 0;
  state.burst = continuing ? state.burst - 1 : bursting ? Math.min(2, player.ammo) : 0;
  state.burstTime = w.burstSpacing;
  state.charge = 0;
  player.cooldown = isKnife(player.weapon)
    ? input.stab
      ? 1
      : 0.4
    : input.alternate
      ? w.alternateDelay
      : w.delay;
  return {
    alternate: input.alternate || (player.weapon === 18 && player.ammo % 2 === 1),
    continuing,
  };
}
