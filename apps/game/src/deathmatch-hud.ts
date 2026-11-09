import { assetUrl } from "./asset-url";
import { isKnife, weaponIcons, weapons } from "./physics";
import "./deathmatch-hud.css";

type Standing = {
  id: number | "player";
  name: string;
  avatar?: string | null;
  team: "ct" | "t";
  score: number;
  alive: boolean;
  weapon: number;
};
let signature = "";
export function updateDeathmatchHud(
  active: boolean,
  standings: readonly Standing[],
  immunity: number,
) {
  const hud = document.getElementById("hud")!;
  hud.classList.toggle("deathmatch", active);
  const leaders = document.getElementById("deathmatch-leaders")!;
  const status = document.getElementById("deathmatch-status")!;
  leaders.hidden = !active;
  status.hidden = !active || immunity <= 0;
  if (!active) return;
  const hint = `INVULNERABILITY ${Math.ceil(immunity)}s — move or fire to cancel`;
  if (status.textContent !== hint) status.textContent = hint;
  const next = JSON.stringify(standings);
  if (next === signature) return;
  signature = next;
  leaders.replaceChildren(
    ...standings.slice(0, 20).map((player, index) => {
      const tile = document.createElement("div");
      tile.className = `dm-player ${player.team}${player.id === "player" ? " you" : ""}${player.alive ? "" : " dead"}`;
      tile.setAttribute("role", "listitem");
      tile.setAttribute(
        "aria-label",
        `${index + 1}. ${player.name}: ${player.score} points${player.alive ? "" : ", dead"}`,
      );
      tile.title = `${player.name} — ${player.score} points`;
      const avatar = document.createElement("img");
      const fallback = assetUrl(`/icons/team-${player.team}.png`);
      avatar.src = player.avatar || fallback;
      avatar.alt = player.name;
      avatar.className = "dm-avatar";
      avatar.onerror = () => {
        avatar.onerror = null;
        avatar.src = fallback;
      };
      const points = document.createElement("strong");
      points.textContent = String(player.score);
      tile.append(avatar, points);
      if (!isKnife(player.weapon)) {
        const weapon = document.createElement("img");
        const icons: Record<string, string> = {
          "ak-47": "ak47",
          "m4a1-s": "m4a1_silencer",
          "usp-s": "usp_silencer",
          m4a4: "m4a1",
        };
        const icon = weaponIcons[player.weapon];
        weapon.src = assetUrl(`/icons/buy/${icons[icon] ?? icon}.svg`);
        weapon.alt = weapons[player.weapon].name;
        weapon.className = "dm-weapon";
        tile.append(weapon);
      }
      return tile;
    }),
  );
}
