import type { DeathmatchBonus } from "./deathmatch-state";
import { deathmatchKillPoints } from "./deathmatch-scoring";
import { weapons } from "./physics";
import { weaponBuyIcon } from "./buy-menu";

export type DeathmatchHudState = {
  bonus: DeathmatchBonus | null;
  randomWeapons: boolean;
  randomKey: string;
  bonusKey: string;
  award?: string;
  bonusAward?: number;
};

export function updateDeathmatchStatus(
  active: boolean,
  immunity: number,
  state?: DeathmatchHudState,
) {
  const hud = document.getElementById("hud")!;
  let panel = document.getElementById("deathmatch-bonus");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "deathmatch-bonus";
    panel.innerHTML = `<div class="dm-bonus-timer"><b></b><span></span></div><div class="dm-bonus-details"><div>BONUS WEAPON: <strong></strong></div><img alt=""><small></small></div><span class="dm-bonus-kill" hidden></span>`;
    hud.append(panel);
  }
  panel.hidden = !active || !state?.bonus;
  if (!active) {
    const award = document.getElementById("deathmatch-award");
    if (award) award.hidden = true;
  }
  if (state?.bonus && active) {
    const { bonus } = state;
    panel.style.setProperty("--bonus-progress", String(bonus.remaining / bonus.duration));
    panel.querySelector("b")!.textContent = String(Math.ceil(bonus.remaining));
    panel.querySelector(".dm-bonus-timer span")!.textContent =
      `+${Math.trunc(deathmatchKillPoints(bonus.weapon) * 0.5)} POINTS`;
    panel.querySelector("strong")!.textContent = weapons[bonus.weapon].name;
    const image = panel.querySelector("img")!;
    if (panel.dataset.weapon !== String(bonus.weapon)) {
      panel.dataset.weapon = String(bonus.weapon);
      image.src = weaponBuyIcon(bonus.weapon);
      image.alt = weapons[bonus.weapon].name;
    }
    const award = panel.querySelector<HTMLElement>(".dm-bonus-kill")!;
    const awardText = state.bonusAward ? `+${state.bonusAward}` : "";
    award.hidden = !awardText;
    if (award.textContent !== awardText) award.textContent = awardText;
    panel.querySelector("small")!.textContent = `[${state.bonusKey}] Switch to bonus weapon`;
  }
  const status = document.getElementById("deathmatch-status")!;
  status.hidden = !active;
  if (!active) return;
  const hint = immunity > 0 ? `INVULNERABLE ${Math.ceil(immunity)}s` : "INVULNERABILITY CANCELLED";
  const signature = `${hint}:${state?.randomWeapons}:${state?.randomKey}`;
  if (status.dataset.state !== signature) {
    status.dataset.state = signature;
    const label = document.createElement("div");
    label.textContent = hint;
    const rules = document.createElement("div");
    rules.textContent = immunity > 0 ? "Move or fire to cancel" : "Buy time expired";
    status.replaceChildren(label, rules);
    if (state) {
      const random = document.createElement("div");
      random.append(`[${state.randomKey}] Random Weapons `);
      const value = document.createElement("strong");
      value.className = state.randomWeapons ? "dm-enabled" : "dm-disabled";
      value.textContent = state.randomWeapons ? "ON" : "OFF";
      random.append(value);
      status.append(random);
    }
  }
  let award = document.getElementById("deathmatch-award");
  if (!award) {
    award = document.createElement("div");
    award.id = "deathmatch-award";
    award.setAttribute("role", "status");
    hud.append(award);
  }
  award.hidden = !state?.award;
  if (award.textContent !== (state?.award ?? "")) award.textContent = state?.award ?? "";
}
