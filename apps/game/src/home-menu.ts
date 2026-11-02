import { weapons, isKnife } from "./physics";
import { weaponAvailable } from "./economy";
import type { Game } from "./game";
import {
  defaultAgent,
  loadAgentCatalog,
  selectedAgentId,
  setSelectedAgent,
  type AgentDefinition,
} from "./agent-roster";

const icon = (name: string) => `<img src="/ui/home/${name}.svg" alt="">`;

export function homeMenuMarkup() {
  return `<div id="menu" data-page="home">
    <header class="home-header">
      <div class="home-tools">
        <button id="home-button" aria-label="Home" title="Home">${icon("home")}</button>
        <button id="watch-button" aria-label="Watch" title="Watch">${icon("watch_tv")}</button>
        <button id="settings-button" aria-label="Settings" title="Settings">${icon("settings")}</button>
        <button id="quit-button" aria-label="Quit game" title="Quit game">${icon("power")}</button>
      </div>
      <nav class="home-nav" aria-label="Main menu">
        <button id="skins-button">INVENTORY</button><i></i><button id="inventory-button">LOADOUT</button><i></i>
        <button id="home-play">PLAY</button><i></i><button id="store-button">STORE</button><i></i><button id="news-button">NEWS</button>
      </nav>
    </header>
    <main class="home-content">
      <div id="home-agent-stage" aria-label="Equipped agent preview"></div>
      <aside class="home-cards">
        <section class="home-match-card">
          <div class="home-map-art"><div class="eyebrow">DUST II</div><h1 id="mode-title">CASUAL</h1></div>
          <div class="mode-options"><button data-mode="casual" aria-pressed="true">CASUAL</button><button data-mode="competitive" aria-pressed="false">COMPETITIVE</button></div>
          <div class="mode-description" id="mode-description"></div>
          <button class="deploy" id="play" disabled><span>PLAY CASUAL</span><span class="arrow">›</span></button>
          <div class="mode-options session-options"><button data-session="single" aria-pressed="true">SINGLE PLAYER</button><button data-session="multi" aria-pressed="false">MULTIPLAYER</button></div>
          <div id="multiplayer-options" hidden><label>SERVER<input id="match-server" placeholder="wss://your-server/ws"></label><label>ROOM CODE<input id="match-room" minlength="12" maxlength="32"></label><label>SERVER PASSWORD<input id="match-password" type="password" maxlength="128"></label><button id="match-invite">COPY INVITE</button><small id="match-status" role="status"></small></div>
        </section>
        <button class="home-loadout-card" id="home-loadout"><span class="home-card-kicker">YOUR LOADOUT</span><span class="home-guns"><img src="/icons/buy/ak47.svg" alt=""><img src="/icons/buy/m4a1_silencer.svg" alt=""></span><strong>Configure your buy menu</strong><small>Customize your buy slots <span>›</span></small></button>
        <button class="home-collection-card" id="home-collection"><span class="home-card-kicker">PLAY YOUR WAY</span><img src="/icons/buy/awp.svg" alt=""><strong>Weapon finishes</strong><small>Customize your skins<span>›</span></small></button>
      </aside>
      <div class="home-profile"><strong id="home-player-name">PLAYER</strong><span id="home-agent-name">SAS</span><div class="home-team-choice" role="group" aria-label="Showcase team"><button data-home-team="ct" aria-label="Show Counter-Terrorist" aria-pressed="true"><img src="/icons/team-ct.png" alt=""></button><button data-home-team="t" aria-label="Show Terrorist" aria-pressed="false"><img src="/icons/team-t.png" alt=""></button></div></div>
      <aside class="home-social" aria-label="Local session"><img id="home-profile-icon" src="/icons/team-ct.png" alt="Your team"><span class="home-status-dot" title="Local session"></span><button id="steam-account-button" aria-label="Steam account" title="Sign in with Steam"><img id="steam-avatar" alt="Steam avatar" hidden><span id="steam-account-label">SIGN IN</span></button></aside>
      <button id="home-scenery-button" aria-label="Change main menu scenery" title="Change main menu scenery">☷</button>
      <div id="home-scenery" hidden><label>SHOWCASE TEAM<select id="home-showcase-team"><option value="ct">Counter-Terrorists</option><option value="t">Terrorists</option></select></label><label>SHOWCASE AGENT<select id="home-showcase-agent"><option value="default-ct">SAS | Counter-Terrorists</option></select></label><small id="home-agent-status" role="status"></small><label>SHOWCASE WEAPON<select id="home-showcase-weapon"></select></label><label>MAIN MENU SCENERY<select id="home-background"><option value="dust2">Dust II</option><option value="close">Dust II - Close-up</option></select></label></div>
    </main>
    <section id="home-panel" class="hidden" role="dialog" aria-modal="true" aria-labelledby="home-panel-title"><div class="home-popup"><div id="home-panel-content"></div><div class="home-popup-actions"><button id="home-panel-close">OK</button></div></div></section>
  </div>`;
}

export function setupHomeMenu(game: Game) {
  const el = (id: string) => document.getElementById(id)!;
  const panel = el("home-panel");
  const navButtons = [...document.querySelectorAll<HTMLButtonElement>(".home-header button")];
  const syncNavigation = () => {
    const visible = (id: string) => {
      const node = document.getElementById(id);
      return !!node && !node.classList.contains("hidden");
    };
    const active = visible("loadout-editor")
      ? "inventory-button"
      : visible("skin-menu") || visible("cosmetic-menu")
        ? "skins-button"
        : visible("settings")
          ? "settings-button"
          : visible("home-panel")
            ? el("menu").dataset.navPopup
            : el("menu").dataset.page === "play"
              ? "home-play"
              : "home-button";
    navButtons.forEach((button) => {
      if (button.id === active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  };
  navButtons.forEach((button) =>
    button.addEventListener("click", () => {
      el("menu").dataset.navPopup = button.id;
      queueMicrotask(syncNavigation);
    }),
  );
  const navigationObserver = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node instanceof HTMLElement && ["skin-menu", "cosmetic-menu"].includes(node.id))
          navigationObserver.observe(node, { attributes: true, attributeFilter: ["class"] });
    syncNavigation();
  });
  navigationObserver.observe(document.body, { childList: true });
  for (const id of ["menu", "skin-menu", "cosmetic-menu", "settings", "home-panel"]) {
    const node = document.getElementById(id);
    if (node)
      navigationObserver.observe(node, {
        attributes: true,
        attributeFilter: ["class", "data-page"],
      });
  }
  syncNavigation();

  document.querySelector(".home-header")!.addEventListener("click", (event) => {
    if (!(event.target as Element).closest("#settings-button"))
      el("settings").classList.add("hidden");
  });
  let returnFocus: HTMLElement | null = null;
  function close() {
    panel.classList.add("hidden");
    returnFocus?.focus();
  }
  function show(title: string, content: string) {
    returnFocus = document.activeElement as HTMLElement;
    el("home-panel-content").innerHTML = `<h2 id="home-panel-title">${title}</h2>${content}`;
    panel.classList.remove("hidden");
    el("home-panel-close").focus();
  }
  el("home-panel-close").onclick = close;
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
    if (event.key === "Tab") {
      const items = [...panel.querySelectorAll<HTMLElement>("button, a[href]")];
      const next = event.shiftKey ? items.at(-1)! : items[0];
      if (document.activeElement === (event.shiftKey ? items[0] : items.at(-1))) {
        event.preventDefault();
        next.focus();
      }
    }
  });
  el("home-button").onclick = () => {
    close();
    el("menu").dataset.page = "home";
    el("home-scenery").hidden = true;
  };
  el("home-play").onclick = () => {
    close();
    el("menu").dataset.page = "play";
    el("play").focus();
  };
  el("home-loadout").onclick = () => el("inventory-button").click();
  el("home-collection").onclick = () => el("skins-button").click();
  el("store-button").onclick = () => {
    show("Store unavailable", `<p>The Store is not available in this version.</p>`);
  };
  el("news-button").onclick = () =>
    show("News unavailable", `<p>News is not available in this version.</p>`);
  el("watch-button").onclick = () =>
    show(
      "WATCH",
      `<p class="home-panel-lead">Live broadcasts and match replays are not available in this version.</p>`,
    );
  el("quit-button").onclick = () =>
    show(
      "EXIT GAME",
      `<p class="home-panel-lead">Thanks for playing! I hope you have enjoyed this :)</p><p>You can just close your browser for this lol</p>`,
    );
  el("home-scenery-button").onclick = () => {
    el("home-scenery").hidden = !el("home-scenery").hidden;
    if (!el("home-scenery").hidden) void populateAgents();
  };
  const background = el("home-background") as HTMLSelectElement;
  try {
    background.value =
      localStorage.getItem("cs2go-home-background") === "close" ? "close" : "dust2";
  } catch {
    /* Optional storage. */
  }
  background.onchange = () => {
    try {
      localStorage.setItem("cs2go-home-background", background.value);
    } catch {
      /* Session choice works. */
    }
    el("home-scenery").hidden = true;
  };
  const showcaseTeam = el("home-showcase-team") as HTMLSelectElement;
  const showcaseWeapon = el("home-showcase-weapon") as HTMLSelectElement;
  const showcaseAgent = el("home-showcase-agent") as HTMLSelectElement;
  let agentCatalog: AgentDefinition[] | undefined;
  function syncAgents() {
    const seen = new Set<string>();
    const agents = (
      agentCatalog?.filter((agent) => agent.team === game.team) ?? [defaultAgent(game.team)]
    ).filter((agent) => {
      const key = agent.model || agent.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    showcaseAgent.replaceChildren(...agents.map((agent) => new Option(agent.name, agent.id)));
    showcaseAgent.value = selectedAgentId(game.team);
    if (!showcaseAgent.value) showcaseAgent.value = defaultAgent(game.team).id;
  }
  async function populateAgents() {
    showcaseAgent.disabled = true;
    try {
      agentCatalog = await loadAgentCatalog();
      syncAgents();
      if (el("home-agent-status").dataset.owner === "catalog")
        el("home-agent-status").textContent = "";
    } catch (error) {
      console.error("Agent catalog failed to load", error);
      el("home-agent-status").dataset.owner = "catalog";
      el("home-agent-status").textContent = "Agent catalog unavailable. Open this menu to retry.";
    } finally {
      showcaseAgent.disabled = false;
    }
  }
  showcaseAgent.onchange = () => {
    setSelectedAgent(game.team, showcaseAgent.value);
  };
  const choices = { ct: 9, t: 0 };
  try {
    const stored = JSON.parse(localStorage.getItem("cs2go-home-weapons") ?? "{}");
    for (const team of ["ct", "t"] as const)
      if (
        Number.isInteger(stored[team]) &&
        weapons[stored[team]] &&
        !isKnife(stored[team]) &&
        weaponAvailable(stored[team], team)
      )
        choices[team] = stored[team];
  } catch {
    /* Defaults work without storage. */
  }
  function syncShowcase() {
    showcaseTeam.value = game.team;
    syncAgents();
    showcaseWeapon.replaceChildren(
      ...weapons.flatMap((weapon, index) => {
        if (isKnife(index) || !weaponAvailable(index, game.team)) return [];
        return [new Option(weapon.name, String(index))];
      }),
    );
    showcaseWeapon.value = String(choices[game.team]);
    game.homeScene.setWeapon(game.team, choices[game.team]);
  }
  showcaseTeam.onchange = () => {
    game.setTeam(showcaseTeam.value as "ct" | "t");
    (el("agent-team") as HTMLSelectElement).value = game.team;
    syncShowcase();
  };
  showcaseWeapon.onchange = () => {
    choices[game.team] = Number(showcaseWeapon.value);
    game.homeScene.setWeapon(game.team, choices[game.team]);
    try {
      localStorage.setItem("cs2go-home-weapons", JSON.stringify(choices));
    } catch {
      /* Session choice works. */
    }
  };
  new MutationObserver(syncShowcase).observe(el("home-agent-stage"), {
    attributes: true,
    attributeFilter: ["data-clip"],
  });
  syncShowcase();
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-home-team]"))
    button.onclick = () => {
      game.setTeam(button.dataset.homeTeam as "t" | "ct");
      syncShowcase();
      (el("agent-team") as HTMLSelectElement).value = game.team;
    };
}
