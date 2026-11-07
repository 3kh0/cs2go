import { homeMenuMarkup, setupHomeMenu } from "./home-menu";
import { setupSkinMenu } from "./skin-menu";
import { setupCosmeticMenu } from "./cosmetic-menu";
import "./fonts.css";
import "./style.css";
import "./home-menu.css";
import "./match-menu.css";
import "./settings-page.css";
import "./pause-menu.css";
import "./dropdowns.css";
import { matchNoticesMarkup } from "./match-notices";
import { buyMenuMarkup } from "./buy-menu";
import { saveAndCloseSettings } from "./settings-reload";
import { setupSettingsTabs } from "./settings-tabs";
import { setupControlSettings } from "./control-settings";
import { Game } from "./game";
import { MultiplayerMatch } from "./multiplayer-match";
import { validRoom } from "@cs2go/protocol";
import { prepareTeamSelector } from "./team-select";
import { openMatchLoading } from "./match-loading";
import { setupSteamAccount } from "./steam-account";
import { startIntro } from "./intro";
import { startAssetCache } from "./asset-cache";

document.addEventListener(
  "keydown",
  (event) => {
    if (event.code === "Escape" && document.querySelector("select:open")) event.stopPropagation();
  },
  true,
);

const loadProgress = startIntro();
startAssetCache();
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<canvas id="game"></canvas>
${homeMenuMarkup()}
<div id="hud" class="hidden">
 <svg class="hud-icon-filter" width="0" height="0" aria-hidden="true"><defs><filter id="hud-icon-tint" color-interpolation-filters="sRGB"><feFlood flood-color="var(--hud-accent)"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs></svg>
 <div id="buy-phase-tint" aria-hidden="true"></div>
 <div id="scope" class="hidden" aria-label="AWP scope"><div class="scope-lens"><i class="scope-horizontal"></i><i class="scope-vertical"></i></div></div>
 <div class="radar-wrap"><div id="location">DUST II</div><canvas id="radar" width="900" height="948" aria-label="Player-centered heading-up radar; hold M for the full north-up map"></canvas><div id="bomb-carrier" class="hidden" role="img" aria-label="Carrying the bomb"><img src="/icons/buy/c4.svg" alt=""></div><div id="economy-hud"><strong id="money"></strong></div></div>
 <div class="match-top" role="group" aria-label="Match status"><div class="match-alive ct" aria-label="Counter-Terrorists alive"><strong id="ct-alive">0</strong><small>ALIVE</small></div><div class="match-center"><strong id="clock" aria-label="Round time">5:00</strong><div class="match-scores"><span class="ct" id="score" aria-label="Counter-Terrorists score">0</span><span class="t" id="enemy-score" aria-label="Terrorists score">0</span></div></div><div class="match-alive t" aria-label="Terrorists alive"><strong id="t-alive">0</strong><small>ALIVE</small></div></div>
 <div id="killfeed" role="list" aria-label="Eliminations" aria-live="polite"></div><div id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hitmarker">×</div><div id="damage"></div>
 <div id="death-banner" class="hidden" role="status"><div class="death-details"><strong id="death-killer"></strong><div><span class="death-message">killed you with the </span><span id="death-weapon"></span></div></div><img id="death-weapon-icon" alt=""></div>
 ${matchNoticesMarkup()}<div id="inventory" role="list" aria-label="Weapon inventory"></div><div class="hud-bottom"><div class="vitals"><span class="armor" aria-label="Armor"><svg viewBox="0 0 40 46" aria-hidden="true"><path d="M8 10V5h24v5l5 4v14c0 8-9 13-17 16C12 41 3 36 3 28V14Z" fill="none" stroke="currentColor" stroke-width="2"/></svg><b id="armor">100</b></span><span class="health-stat" aria-label="Health"><b id="health">100</b><span class="health-track"><i id="health-fill"></i></span></span></div><div class="hud-team" aria-label="Your team"><span></span><img id="hud-team-icon" src="/icons/team-ct.png" alt="Counter-Terrorists"><span></span></div><div class="ammo"><div id="gun-name">USP-S</div><b id="ammo">12</b><span>/ <span id="reserve">48</span></span></div></div>

 <div id="telemetry">0 FPS &nbsp; - &nbsp; – MS FRAME &nbsp; - &nbsp; 128 TICK</div>
 <div id="scoreboard" class="hidden" role="region" aria-label="Match scoreboard"><header class="scoreboard-title"><h2></h2><span id="scoreboard-clock"></span></header><div id="scoreboard-rows"></div><footer id="scoreboard-lobby" hidden><span>LOBBY ID <strong id="lobby-pin"></strong></span><span id="lobby-server"></span></footer></div>
</div>
<div id="pause" class="overlay hidden"><nav class="pause-toolbar" aria-label="Match menu"><button id="resume"><span aria-hidden="true">↶</span>RESUME GAME</button><button id="pause-skins"><img src="/icons/buy/ak47.svg" alt="">INVENTORY</button><button id="pause-teams"><span aria-hidden="true">⇄</span>SWAP TEAMS</button><button id="pause-settings"><img src="/ui/home/settings.svg" alt="">SETTINGS</button><button id="leave"><img src="/ui/home/power.svg" alt="">DISCONNECT</button></nav><section id="leave-confirm" class="popup-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title" aria-describedby="leave-confirm-message"><div class="home-popup"><h2 id="leave-confirm-title">LEAVE MATCH</h2><p id="leave-confirm-message">Do you wish to stop playing now?</p><div class="home-popup-actions"><button id="leave-yes">YES</button><button id="leave-no">NO</button></div></div></section></div>
<div id="settings" class="overlay hidden"><section class="dialog settings"><div class="dialog-heading"><div><div class="eyebrow">MAKE IT YOURS</div><h2>SETTINGS</h2></div><button class="close" id="close-settings" aria-label="Close settings">×</button></div><label class="select-label">Play as<select id="agent-team"><option value="ct">Counter terrorist</option><option value="t">Terrorist</option></select></label><label>Mouse sensitivity <output id="sensitivity-value">1.0</output><input id="sensitivity" type="range" min="0.2" max="3" step="0.1" value="1"></label><label>Field of view <output id="fov-value">90°</output><input id="fov" type="range" min="75" max="110" step="1" value="90"></label><label class="hud-hue-setting">HUD hue <output id="hudHue-value">110°</output><input id="hudHue" type="range" min="0" max="360" step="1" value="110"><small>Health, armor, and weapon icons</small></label><label>Master volume <output id="volume-value">60%</output><input id="volume" type="range" min="0" max="100" value="60"></label><label>Music volume <output id="musicVolume-value">25%</output><input id="musicVolume" type="range" min="0" max="100" value="25"></label><label>Effects volume <output id="effectsVolume-value">100%</output><input id="effectsVolume" type="range" min="0" max="100" value="100"></label><label class="toggle-label" for="auto-bunnyhop"><span>Auto bunnyhop<small>Hold Space to jump as soon as you land.</small></span><input id="auto-bunnyhop" type="checkbox" role="switch"></label><label class="select-label">Graphics preset<select id="quality"></select></label><div class="controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Look / fire</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>CTRL / C</kbd> Crouch</span><span><kbd>SHIFT</kbd> Walk quietly</span><span><kbd>R</kbd> Reload</span><span><kbd>1 2 3 / SCROLL / B</kbd> Equip / buy weapon</span><span><kbd>E</kbd> Plant / defuse</span><span><kbd>TAB</kbd> Scoreboard</span><span><kbd>RIGHT CLICK</kbd> AWP zoom / knife stab</span></div><p class="hint">Stop before you shoot. Tap the opposite movement key to counter-strafe. Pull your mouse down to control a spray.</p></section></div>
${buyMenuMarkup()}
<div id="result" class="overlay hidden"><section class="dialog"><div class="eyebrow">MATCH COMPLETE</div><h2 id="result-title">WELL PLAYED.</h2><strong id="result-score"></strong><p id="result-stats"></p><button class="deploy" id="again">PLAY AGAIN <span>↗</span></button><button class="text-button" id="result-menu">RETURN TO MENU</button></section></div>
<div id="unsupported" class="overlay hidden"><section class="dialog"><h2>DESKTOP REQUIRED</h2><p>Grab a mouse and keyboard, and open this page in a desktop browser with WebGL to play.</p></section></div>`;

setupSkinMenu((index) => {
  game.knife = index;
  if (game.active && !game.dead) game.buy(index);
  game.updateUI();
});
const game = new Game(loadProgress);
setupControlSettings(game);
setupSettingsTabs(game);
setupHomeMenu(game);
const cosmeticMenu = setupCosmeticMenu(game);
setupSteamAccount();
// Panorama navigation switches full pages; it must not stack their overlays.
document.addEventListener(
  "click",
  (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".home-header button")) return;
    game.groundInventory.closeLoadout();
    if (!document.getElementById("cosmetic-menu")!.classList.contains("hidden"))
      cosmeticMenu.close();
    for (const id of ["skin-menu", "settings", "home-panel"])
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
    el("play").setAttribute("aria-label", `Play ${selectedMode}`);
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
const server = el("match-server") as HTMLSelectElement;
const room = el("match-room") as HTMLInputElement;
const invitation = new URLSearchParams(location.search);
// Local endpoints are available only in development; production uses the two fleet servers.
if (import.meta.env.DEV) {
  for (const port of [3001, 3002])
    server.add(new Option(`Local server :${port}`, `ws://127.0.0.1:${port}/ws`));
}
const invitedServer = invitation.get("server");
if ([...server.options].some((option) => option.value === invitedServer))
  server.value = invitedServer!;
room.value = validRoom(invitation.get("room")) ? invitation.get("room")! : "";
let creating = false;
room.oninput = () => {
  el("match-status").textContent = "";
};
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-session]"))
  button.onclick = () => {
    session = button.dataset.session as typeof session;
    el("menu").dataset.session = session;
    el("multiplayer-options").hidden = session !== "multi";
    document
      .querySelectorAll<HTMLButtonElement>("[data-session]")
      .forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
  };
if (invitation.has("room") || invitedServer) {
  document.querySelector<HTMLButtonElement>('[data-session="multi"]')!.click();
  el("menu").dataset.page = "play";
}
if (invitation.get("mode") === "competitive")
  document.querySelector<HTMLButtonElement>('[data-mode="competitive"]')!.click();
el("match-create").onclick = () => {
  if (el("play").hasAttribute("disabled") || game.matchLoading) return;
  creating = true;
  el("match-status").textContent = "";
  void prepareMatchSelection();
};
el("play").onclick = async () => {
  if (game.matchLoading) return;
  creating = false;
  if (session === "multi") {
    if (!validRoom(room.value)) {
      el("match-status").textContent = "Enter a six-digit lobby PIN, or create a lobby.";
      room.focus();
      return;
    }
    const play = el("play") as HTMLButtonElement;
    play.disabled = true;
    (el("match-create") as HTMLButtonElement).disabled = true;
    el("match-status").textContent = "Finding lobby…";
    try {
      const url = new URL(server.value);
      url.protocol = url.protocol === "wss:" ? "https:" : "http:";
      url.pathname = `/lobbies/${room.value}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.status === 404) throw new Error("Lobby not found. Check the PIN and server.");
      if (!response.ok) throw new Error("Server unavailable. Try the other server.");
      const lobby = await response.json();
      if (lobby.mode !== "casual" && lobby.mode !== "competitive")
        throw new Error("Incompatible server. Refresh and try again.");
      document.querySelector<HTMLButtonElement>(`[data-mode="${lobby.mode}"]`)!.click();
      el("match-status").textContent = "Lobby found. Select your team.";
    } catch (error) {
      el("match-status").textContent =
        error instanceof TypeError || (error as Error).name === "TimeoutError"
          ? "Could not reach the server. Try again or choose another server."
          : (error as Error).message;
      return;
    } finally {
      play.disabled = false;
      (el("match-create") as HTMLButtonElement).disabled = false;
    }
  }
  void prepareMatchSelection();
};
async function prepareMatchSelection(replayTeam?: "t" | "ct") {
  if (game.matchLoading || document.getElementById("team-select")) return;
  const mode = selectedMode;
  const multiplayer = replayTeam === undefined && session === "multi";
  const create = creating;
  const endpoint = server.value;
  const pin = room.value;
  const loader = openMatchLoading(mode);
  let selector: ReturnType<typeof prepareTeamSelector> | undefined;
  game.matchLoading = true;
  const enter = (team: "t" | "ct") => {
    game.setTeam(team, false);
    game.keys.clear();
    game.firing = false;
    game.accumulator = 0;
    game.last = performance.now();
    game.start(mode, { bots: !multiplayer });
    el("scoreboard-lobby").hidden = !multiplayer;
    if (multiplayer && game.active) {
      el("lobby-pin").textContent = "CONNECTING…";
      el("lobby-server").textContent = new URL(endpoint).hostname;
      game.network = new MultiplayerMatch(game, endpoint, pin, create, mode);
    }
  };
  const cancelPreview = () => selector?.close();
  loader.signal.addEventListener("abort", cancelPreview, { once: true });
  try {
    await loader.stage("Preparing Dust II…", 0);
    await game.prepareMatch(mode, !multiplayer, loader.signal);
    await loader.stage("Preparing the match…", 1);
    if (replayTeam === undefined) {
      selector = prepareTeamSelector(enter, mode === "competitive" ? 5 : 10, game);
      await selector.ready;
    }
    await loader.stage("Ready", 3);
    loader.close();
    game.matchLoading = false;
    if (replayTeam !== undefined) enter(replayTeam);
    else selector!.show();
  } catch (error) {
    selector?.close();
    game.menu();
    if (loader.signal.aborted) {
      loader.close();
      el("home-play").focus();
    } else {
      console.error("Match preparation failed", error);
      loader.error();
    }
  } finally {
    loader.signal.removeEventListener("abort", cancelPreview);
    game.matchLoading = false;
  }
}

el("resume").onclick = () => game.lock();
el("pause-teams").onclick = async () => {
  if (!game.active || game.matchLoading || document.getElementById("team-select")) return;
  const button = el("pause-teams") as HTMLButtonElement;
  button.disabled = true;
  let selector: ReturnType<typeof prepareTeamSelector> | undefined;
  try {
    selector = prepareTeamSelector(
      (team) => {
        game.switchTeam(team);
        void game.lock();
      },
      game.teamSize,
      game,
    );
    await selector.ready;
    if (game.active) selector.show();
    else selector.close();
  } catch (error) {
    selector?.close();
    console.error("Team selection failed", error);
    game.notices.showAlert("Could not open team selection. Try again.");
  } finally {
    button.disabled = false;
  }
};
const leaveConfirm = el("leave-confirm");
const closeLeaveConfirm = () => {
  leaveConfirm.classList.add("hidden");
  el("leave").focus();
};
el("leave").onclick = () => {
  leaveConfirm.classList.remove("hidden");
  el("leave-no").focus();
};
el("leave-no").onclick = closeLeaveConfirm;
el("leave-yes").onclick = () => {
  leaveConfirm.classList.add("hidden");
  game.menu();
};
leaveConfirm.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeLeaveConfirm();
  } else if (event.key === "Tab") {
    const first = el("leave-yes");
    const last = el("leave-no");
    if (document.activeElement === (event.shiftKey ? first : last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
});
el("result-menu").onclick = () => game.menu();
el("again").onclick = () => {
  void prepareMatchSelection(game.team);
};
el("settings-button").onclick = el("pause-settings").onclick = () => {
  el("settings").classList.remove("hidden");
  (el("settings").querySelector('[role="tab"][aria-selected="true"]') as HTMLElement).focus();
};
el("close-settings").onclick = () => saveAndCloseSettings(game);
el("close-loadout").onclick = () => {
  el("loadout").classList.add("hidden");
  void game.lock();
};
document.addEventListener(
  "mousedown",
  (event) => {
    if (event.button !== 2 || el("loadout").classList.contains("hidden")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    el("close-loadout").click();
  },
  { capture: true },
);
document.querySelectorAll<HTMLButtonElement>("[data-weapon]").forEach(
  (b) =>
    (b.onclick = (event) => {
      const drop = event.metaKey || event.ctrlKey;
      if (!game.buy(Number(b.dataset.weapon), drop)) return;
      if (drop) return;
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
