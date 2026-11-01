import { homeMenuMarkup, setupHomeMenu } from "./home-menu";
import { setupSkinMenu } from "./skin-menu";
import "./fonts.css";
import "./style.css";
import "./home-menu.css";
import "./settings-page.css";
import "./pause-menu.css";
import { matchNoticesMarkup } from "./match-notices";
import { buyMenuMarkup } from "./buy-menu";
import { setupSettingsTabs } from "./settings-tabs";
import { setupControlSettings } from "./control-settings";
import { Game } from "./game";
import { MultiplayerMatch } from "./multiplayer-match";
import { disposeSoldier } from "./soldier";
import { validRoom } from "@cs2go/protocol";
import { openTeamSelector } from "./team-select";
import { setupSteamAccount } from "./steam-account";
import { startIntro } from "./intro";
import { startAssetCache } from "./asset-cache";

const loadProgress = startIntro();
startAssetCache();
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<canvas id="game"></canvas>
${homeMenuMarkup()}
<div id="hud" class="hidden">
 <div id="buy-phase-tint" aria-hidden="true"></div>
 <div id="scope" class="hidden" aria-label="AWP scope"><div class="scope-lens"><i class="scope-horizontal"></i><i class="scope-vertical"></i></div></div>
 <div class="radar-wrap"><div id="location">DUST II</div><canvas id="radar" width="900" height="948" aria-label="Player-centered heading-up radar; hold M for the full north-up map"></canvas></div>
 <div class="match-top" role="group" aria-label="Match status"><div class="match-alive ct" aria-label="Counter-Terrorists alive"><strong id="ct-alive">0</strong><small>ALIVE</small></div><div class="match-center"><strong id="clock" aria-label="Round time">5:00</strong><div class="match-scores"><span class="ct" id="score" aria-label="Counter-Terrorists score">0</span><span class="t" id="enemy-score" aria-label="Terrorists score">0</span></div></div><div class="match-alive t" aria-label="Terrorists alive"><strong id="t-alive">0</strong><small>ALIVE</small></div></div>
 <div id="killfeed" role="list" aria-label="Eliminations" aria-live="polite"></div><div id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hitmarker">×</div><div id="damage"></div>
 <div id="death-banner" class="hidden" role="status"><div class="death-details"><strong id="death-killer"></strong><div><span class="death-message">killed you with the </span><span id="death-weapon"></span></div></div><img id="death-weapon-icon" alt=""></div>
 ${matchNoticesMarkup()}<div id="inventory" role="list" aria-label="Weapon inventory"></div><div class="hud-bottom"><div class="vitals"><span class="armor" aria-label="Armor"><svg viewBox="0 0 40 46" aria-hidden="true"><path d="M8 10V5h24v5l5 4v14c0 8-9 13-17 16C12 41 3 36 3 28V14Z" fill="none" stroke="currentColor" stroke-width="2"/></svg><b id="armor">100</b></span><span class="health-stat" aria-label="Health"><b id="health">100</b><span class="health-track"><i id="health-fill"></i></span></span></div><div class="hud-team" aria-label="Your team"><span></span><img id="hud-team-icon" src="/icons/team-ct.png" alt="Counter-Terrorists"><span></span></div><div class="ammo"><div id="gun-name">USP-S</div><b id="ammo">12</b><span>/ <span id="reserve">48</span></span></div></div>

 <div id="economy-hud"><strong id="money"></strong><span id="equipment-status"></span><span id="buy-status"></span></div><div id="telemetry">0 FPS &nbsp; · &nbsp; 128 TICK &nbsp; · &nbsp; LOCAL</div>
 <div id="scoreboard" class="hidden" role="region" aria-label="Match scoreboard"><header class="scoreboard-title"><h2></h2><span id="scoreboard-clock"></span></header><div id="scoreboard-summary"></div><div id="scoreboard-rows"></div><small>HOLD TAB TO VIEW SCOREBOARD · LOCAL SESSION</small></div>
</div>
<div id="pause" class="overlay hidden"><nav class="pause-toolbar" aria-label="Match menu"><button id="resume"><span aria-hidden="true">↶</span>RESUME GAME</button><button id="pause-skins"><img src="/icons/buy/ak47.svg" alt="">INVENTORY</button><button id="pause-settings"><img src="/ui/home/settings.svg" alt="">SETTINGS</button><button id="leave"><img src="/ui/home/power.svg" alt="">DISCONNECT</button></nav></div>
<div id="settings" class="overlay hidden"><section class="dialog settings"><div class="dialog-heading"><div><div class="eyebrow">MAKE IT YOURS</div><h2>SETTINGS</h2></div><button class="close" id="close-settings" aria-label="Close settings">×</button></div><label class="select-label">Play as<select id="agent-team"><option value="ct">Counter terrorist</option><option value="t">Terrorist</option></select></label><label>Mouse sensitivity <output id="sensitivity-value">1.0</output><input id="sensitivity" type="range" min="0.2" max="3" step="0.1" value="1"></label><label>Field of view <output id="fov-value">90°</output><input id="fov" type="range" min="75" max="110" step="1" value="90"></label><label class="hud-hue-setting">HUD hue <output id="hudHue-value">110°</output><input id="hudHue" type="range" min="0" max="360" step="1" value="110"><small>Health, armor, and weapon icons</small></label><label>Master volume <output id="volume-value">60%</output><input id="volume" type="range" min="0" max="100" value="60"></label><label>Music volume <output id="musicVolume-value">25%</output><input id="musicVolume" type="range" min="0" max="100" value="25"></label><label>Effects volume <output id="effectsVolume-value">100%</output><input id="effectsVolume" type="range" min="0" max="100" value="100"></label><label class="toggle-label" for="auto-bunnyhop"><span>Auto bunnyhop<small>Hold Space to jump as soon as you land.</small></span><input id="auto-bunnyhop" type="checkbox" role="switch"></label><label class="select-label">Graphics preset<select id="quality"></select></label><div class="controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Look / fire</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>CTRL / C</kbd> Crouch</span><span><kbd>SHIFT</kbd> Walk quietly</span><span><kbd>R</kbd> Reload</span><span><kbd>1 2 3 / SCROLL / B</kbd> Equip / buy weapon</span><span><kbd>E</kbd> Plant / defuse</span><span><kbd>TAB</kbd> Scoreboard</span><span><kbd>RIGHT CLICK</kbd> AWP zoom / knife stab</span></div><p class="hint">Stop before you shoot. Tap the opposite movement key to counter-strafe. Pull your mouse down to control a spray.</p></section></div>
${buyMenuMarkup()}
<div id="result" class="overlay hidden"><section class="dialog"><div class="eyebrow">MATCH COMPLETE</div><h2 id="result-title">WELL PLAYED.</h2><strong id="result-score"></strong><p id="result-stats"></p><button class="deploy" id="again">PLAY AGAIN <span>↗</span></button><button class="text-button" id="result-menu">RETURN TO MENU</button></section></div>
<div id="unsupported" class="overlay hidden"><section class="dialog"><h2>DESKTOP REQUIRED</h2><p>Grab a mouse and keyboard, and open this page in a desktop browser with WebGL to play.</p></section></div>`;

setupSkinMenu((index) => {
  game.knife = index;
  if (game.active && !game.dead) game.equip(index);
  game.updateUI();
});
const game = new Game(loadProgress);
setupControlSettings(game);
setupSettingsTabs(game);
setupHomeMenu(game);
setupSteamAccount();
// Panorama navigation switches full pages; it must not stack their overlays.
document.addEventListener(
  "click",
  (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".home-header button")) return;
    game.groundInventory.closeLoadout();
    for (const id of ["steam-account", "skin-menu", "settings", "home-panel"])
      document.getElementById(id)?.classList.add("hidden");
  },
  true,
);
if (import.meta.env.DEV) Object.assign(window, { __game: game });
const el = (id: string) => document.getElementById(id)!;
(el("agent-team") as HTMLSelectElement).onchange = (event) =>
  game.setTeam((event.target as HTMLSelectElement).value as "t" | "ct");
let selectedMode: "casual" | "competitive" = "casual";
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-mode]"))
  button.onclick = () => {
    selectedMode = button.dataset.mode as typeof selectedMode;
    el("mode-title").textContent = selectedMode.toUpperCase();
    el("mode-description").textContent = "";
    el("play").firstElementChild!.textContent = `PLAY ${selectedMode.toUpperCase()}`;
    document
      .querySelectorAll("[data-mode]")
      .forEach((node) =>
        node.setAttribute(
          "aria-pressed",
          String((node as HTMLElement).dataset.mode === selectedMode),
        ),
      );
  };
let session: "single" | "multi" = "single";
const server = el("match-server") as HTMLInputElement;
const room = el("match-room") as HTMLInputElement;
const password = el("match-password") as HTMLInputElement;
const invitation = new URLSearchParams(location.search);
server.value =
  invitation.get("server") ||
  import.meta.env.VITE_MULTIPLAYER_URL ||
  (import.meta.env.DEV ? "ws://127.0.0.1:3001/ws" : "");
room.value = validRoom(invitation.get("room"))
  ? invitation.get("room")!
  : [...crypto.getRandomValues(new Uint8Array(9))]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-session]"))
  button.onclick = () => {
    session = button.dataset.session as typeof session;
    el("multiplayer-options").hidden = session !== "multi";
    document
      .querySelectorAll<HTMLButtonElement>("[data-session]")
      .forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
  };
if (invitation.has("room"))
  document.querySelector<HTMLButtonElement>('[data-session="multi"]')!.click();
el("match-invite").onclick = async () => {
  const url = new URL(location.origin + "/");
  url.searchParams.set("room", room.value);
  url.searchParams.set("server", server.value);
  url.searchParams.set("mode", selectedMode);
  try {
    await navigator.clipboard.writeText(url.href);
    el("match-status").textContent = "Invite copied";
  } catch {
    el("match-status").textContent = url.href;
  }
};
if (invitation.get("mode") === "competitive")
  document.querySelector<HTMLButtonElement>('[data-mode="competitive"]')!.click();
el("play").onclick = () => {
  if (session === "multi") {
    try {
      const url = new URL(server.value);
      if (
        !["ws:", "wss:"].includes(url.protocol) ||
        (location.protocol === "https:" && url.protocol !== "wss:") ||
        url.pathname !== "/ws" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error("Enter a secure game server address ending in /ws.");
      if (!validRoom(room.value)) throw new Error("Room codes use 12–32 letters, numbers, - or _.");
    } catch (error) {
      el("match-status").textContent = (error as Error).message;
      return;
    }
  }
  openTeamSelector(
    (team) => {
      game.setTeam(team);
      game.start(selectedMode);
      if (session === "multi" && game.active) {
        for (const bot of game.bots) {
          game.scene.remove(bot.group);
          disposeSoldier(bot.rig);
        }
        game.bots = [];
        game.network = new MultiplayerMatch(
          game,
          server.value,
          room.value,
          password.value,
          selectedMode,
        );
      }
    },
    selectedMode === "competitive" ? 5 : 10,
  );
};
el("resume").onclick = () => game.lock();
el("leave").onclick = el("result-menu").onclick = () => game.menu();
el("again").onclick = () => game.start(selectedMode);
el("settings-button").onclick = el("pause-settings").onclick = () => {
  el("settings").classList.remove("hidden");
  (el("settings").querySelector('[role="tab"][aria-selected="true"]') as HTMLElement).focus();
};
el("close-settings").onclick = () => el("settings").classList.add("hidden");
el("close-loadout").onclick = () => {
  el("loadout").classList.add("hidden");
  void game.lock();
};
document.querySelectorAll<HTMLButtonElement>("[data-weapon]").forEach(
  (b) =>
    (b.onclick = () => {
      if (!game.buy(Number(b.dataset.weapon))) return;
      el("loadout").classList.add("hidden");
      void game.lock();
    }),
);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-equipment]"))
  button.onclick = () => {
    game.buyEquipment(button.dataset.equipment as "kevlar" | "helmet" | "kit");
  };
for (const id of [
  "sensitivity",
  "fov",
  "volume",
  "musicVolume",
  "effectsVolume",
  "hudHue",
] as const) {
  const input = el(id) as HTMLInputElement;
  input.value = String(game.settings[id]);
  input.oninput = () => {
    game.settings[id] = Number(input.value);
    el(`${id}-value`).textContent =
      id === "sensitivity"
        ? Number(input.value).toFixed(1)
        : input.value + (id === "fov" || id === "hudHue" ? "°" : "%");
    game.saveSettings();
  };
  input.dispatchEvent(new Event("input"));
}
const autoBunnyhop = el("auto-bunnyhop") as HTMLInputElement;
autoBunnyhop.checked = game.settings.autoBunnyhop;
autoBunnyhop.onchange = () => {
  game.settings.autoBunnyhop = autoBunnyhop.checked;
  game.saveSettings();
};

document.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && !el("settings").classList.contains("hidden")) {
    event.preventDefault();
    el("close-settings").click();
    return;
  }
  if (event.code === "Escape" && !el("skin-menu").classList.contains("hidden")) {
    event.preventDefault();
    el("close-skins").click();
    return;
  }
  if (event.code === "Escape" && !el("loadout").classList.contains("hidden")) {
    event.preventDefault();
    el("close-loadout").click();
  }
});
