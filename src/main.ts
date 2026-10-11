import "./style.css";
import { Game } from "./game";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<canvas id="game"></canvas>
<div id="menu">
 <header><a class="brand" href="./" aria-label="CS2GO home">CS<span>2</span>GO</a><div class="online"><i></i> OFFLINE / LOCAL SESSION</div></header>
 <main class="lobby">
  <div class="intro"><div class="eyebrow"><span></span> BROWSER TACTICAL FPS <span class="build">BUILD 01.0</span></div><h1>ONE MORE<br><em>ROUND.</em></h1><p>The dust. The recoil. The perfect headshot.<br>Back to the game that never gets old.</p>
  <div class="mode-tabs" role="group" aria-label="Game mode"><button class="active" data-mode="casual">CASUAL · 10V10</button><button data-mode="deathmatch">DEATHMATCH</button><button data-mode="practice">PRACTICE</button></div>
  <div class="mode-description" id="mode-description">Casual mode. Plant or defuse on Dust II. First to 8.</div>
  <div class="agent-select"><label for="agent-team">PLAY AS</label><select id="agent-team"><option value="ct">Counter terrorist</option><option value="t">Terrorist</option></select></div>
  <button class="deploy" id="play"><span>LET’S PLAY</span><span class="arrow">↗</span></button><div class="play-note">LOCAL ASSETS. OFFLINE PLAY.</div>
  </div>
  <aside class="map-card"><div class="card-top"><span>ACTIVE DUTY</span><span>01 / 01</span></div><div class="map-title"><div class="eyebrow">SELECTED MAP</div><h2>DUST II</h2><p>A familiar kind of heat.</p></div><canvas id="map-preview" width="320" height="180"></canvas><div class="map-meta"><span><i class="dot"></i> CS:GO · 2023</span><span>FULL MAP</span></div><div class="map-tags"><span>THREE LANES</span><span>CLOSE QUARTERS</span><span>ALL AIM</span></div></aside>
  <div class="world-label"><span>35° 12′ N &nbsp; 4° 18′ E</span><strong>DUST II <span> / NORTH AFRICA</span></strong></div>
 </main>
 <footer><div><span class="footer-index">01</span><strong>BUILT FOR THE FEEL</strong><span>Fast movement. Honest gunplay.</span></div><button id="settings-button">⚙ &nbsp; SETTINGS & CONTROLS</button><span class="footer-end">MADE FOR THE BROWSER <span>↗</span></span></footer>
</div>
<div id="hud" class="hidden">
 <div id="scope" class="hidden" aria-label="AWP scope"><div class="scope-lens"><i class="scope-horizontal"></i><i class="scope-vertical"></i><span id="scope-zoom">ZOOM I</span></div></div>
 <div class="radar-wrap"><div id="location">DUST II</div><canvas id="radar" width="180" height="180"></canvas><div class="radar-caption" id="radar-caption">YOU VS BOTS</div></div>
 <div class="match-top"><span class="score" id="score">0</span><div><small id="match-mode">DEATHMATCH</small><strong id="clock">5:00</strong><small id="match-goal">FIRST TO 20</small></div><span class="score enemy" id="enemy-score">0</span></div>
 <div id="killfeed" role="list" aria-label="Eliminations" aria-live="polite"></div><div id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hitmarker">×</div><div id="damage"></div>
 <div id="toast"></div><div id="inventory" role="list" aria-label="Weapon inventory"></div><div class="hud-bottom"><div class="vitals"><span>✚ <b id="health">100</b></span><span class="armor">⬡ <b id="armor">100</b></span></div><div class="bottom-tip">WASD MOVE &nbsp; · &nbsp; R RELOAD &nbsp; · &nbsp; B BUY MENU &nbsp; · &nbsp; ESC PAUSE</div><div class="ammo"><div id="gun-name">USP-S</div><b id="ammo">12</b><span>/ <span id="reserve">48</span></span><small id="reload-label"></small></div></div>
 <div id="telemetry">0 FPS &nbsp; · &nbsp; 128 TICK &nbsp; · &nbsp; LOCAL</div>
 <div id="scoreboard" class="hidden" role="region" aria-label="Match scoreboard"><header class="scoreboard-title"><h2></h2><span id="scoreboard-clock"></span></header><div id="scoreboard-summary"></div><div id="scoreboard-rows"></div><small>HOLD TAB TO VIEW SCOREBOARD · LOCAL SESSION</small></div>
</div>
<div id="pause" class="overlay hidden"><section class="dialog"><div class="eyebrow">TAKE A BREATHER</div><h2>ROUND PAUSED</h2><p>Your session is waiting for you.</p><button class="deploy" id="resume">BACK TO THE GAME <span>↗</span></button><button class="secondary" id="pause-settings">SETTINGS & CONTROLS</button><button class="text-button" id="leave">RETURN TO MENU</button></section></div>
<div id="settings" class="overlay hidden"><section class="dialog settings"><div class="dialog-heading"><div><div class="eyebrow">MAKE IT YOURS</div><h2>SETTINGS</h2></div><button class="close" id="close-settings" aria-label="Close settings">×</button></div><label>Mouse sensitivity <output id="sensitivity-value">1.0</output><input id="sensitivity" type="range" min="0.2" max="3" step="0.1" value="1"></label><label>Field of view <output id="fov-value">90°</output><input id="fov" type="range" min="75" max="110" step="1" value="90"></label><label>Master volume <output id="volume-value">60%</output><input id="volume" type="range" min="0" max="100" value="60"></label><label>Music volume <output id="musicVolume-value">25%</output><input id="musicVolume" type="range" min="0" max="100" value="25"></label><label>Effects volume <output id="effectsVolume-value">100%</output><input id="effectsVolume" type="range" min="0" max="100" value="100"></label><label class="select-label">Graphics<select id="quality"><option value="high">High · shadows + 1.5× resolution</option><option value="low">Performance · no shadows + 1×</option></select></label><div class="controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Look / fire</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>CTRL / C</kbd> Crouch</span><span><kbd>SHIFT</kbd> Walk quietly</span><span><kbd>R</kbd> Reload</span><span><kbd>1 2 3 / SCROLL / B</kbd> Equip / buy weapon</span><span><kbd>E</kbd> Plant / defuse</span><span><kbd>TAB</kbd> Scoreboard</span><span><kbd>RIGHT CLICK</kbd> AWP zoom / knife stab</span></div><p class="hint">Stop before you shoot. Tap the opposite movement key to counter-strafe. Pull your mouse down to control a spray.</p></section></div>
<div id="loadout" class="overlay hidden"><section class="dialog"><div class="dialog-heading"><div><div class="eyebrow">PRIMARY / SIDEARM / KNIFE</div><h2>BUY MENU</h2></div><button class="close" id="close-loadout" aria-label="Close buy menu">×</button></div><div class="weapon-options"><button data-weapon="0"><b>AK-47</b><span>High damage. Master the spray.</span><small class="buy-state">FREE · BUY</small></button><button data-weapon="1"><b>M4A1-S</b><span>Quiet. Controlled. Precise.</span><small class="buy-state">FREE · BUY</small></button><button data-weapon="3"><b>AWP</b><span>Bolt action. Two scope levels.</span><small class="buy-state">FREE · BUY</small></button><button data-weapon="2"><b>USP-S</b><span>Your default sidearm.</span><small class="buy-state">OWNED · EQUIP</small></button></div><p class="hint">Purchases are free. A rifle replaces your primary weapon. Every spawn starts with a USP-S and M9 Bayonet.</p></section></div>
<div id="result" class="overlay hidden"><section class="dialog"><div class="eyebrow">THAT’S A ROUND</div><h2 id="result-title">WELL PLAYED.</h2><p id="result-stats"></p><button class="deploy" id="again">ONE MORE ROUND <span>↗</span></button><button class="text-button" id="result-menu">RETURN TO MENU</button></section></div>
<div id="unsupported" class="overlay hidden"><section class="dialog"><h2>DESKTOP REQUIRED</h2><p>Grab a mouse and keyboard, and open this page in a desktop browser with WebGL to play.</p></section></div>`;

const game = new Game();
if (import.meta.env.DEV) Object.assign(window, { __game: game });
const el = (id: string) => document.getElementById(id)!;
let mode: "casual" | "deathmatch" | "practice" = "casual";
document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
  (button) =>
    (button.onclick = () => {
      mode = button.dataset.mode as typeof mode;
      document
        .querySelectorAll("[data-mode]")
        .forEach((b) => b.classList.toggle("active", b === button));
      el("mode-description").textContent =
        mode === "casual"
          ? "You + 19 bots. Plant or defuse on Dust II. First to 8 rounds."
          : mode === "deathmatch"
            ? "You against five bots. First to 20 kills wins."
            : "Stationary targets. Unlimited time. Find your aim.";
    }),
);
(el("agent-team") as HTMLSelectElement).onchange = (event) =>
  game.setTeam((event.target as HTMLSelectElement).value as "t" | "ct");
el("play").onclick = () => game.start(mode);
el("resume").onclick = () => game.lock();
el("leave").onclick = el("result-menu").onclick = () => game.menu();
el("again").onclick = () => game.start(mode);
el("settings-button").onclick = el("pause-settings").onclick = () =>
  el("settings").classList.remove("hidden");
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
for (const id of ["sensitivity", "fov", "volume", "musicVolume", "effectsVolume"]) {
  const input = el(id) as HTMLInputElement;
  input.value = String(
    game.settings[id as "sensitivity" | "fov" | "volume" | "musicVolume" | "effectsVolume"],
  );
  input.oninput = () => {
    game.settings[id as "sensitivity" | "fov" | "volume" | "musicVolume" | "effectsVolume"] =
      Number(input.value);
    el(`${id}-value`).textContent =
      id === "sensitivity"
        ? Number(input.value).toFixed(1)
        : input.value + (id === "fov" ? "°" : "%");
    game.saveSettings();
  };
  input.dispatchEvent(new Event("input"));
}
const quality = el("quality") as HTMLSelectElement;
quality.value = game.settings.quality;
quality.onchange = () => {
  game.settings.quality = quality.value;
  game.saveSettings();
};
