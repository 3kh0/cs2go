import { weapons, isKnife } from "./physics";
import { weaponAvailable } from "./economy";
import type { Game } from "./game";
import { assetUrl } from "./asset-url";
import { readHomeWeapons } from "./home-weapons";

const icon = (name: string) => `<img src="${assetUrl(`/ui/home/${name}.svg`)}" alt="">`;

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
        <section class="home-match-card" aria-label="Choose a match">
          <div class="mode-options session-options" role="group" aria-label="Session type"><button data-session="single" aria-pressed="true">OFFLINE</button><button data-session="multi" aria-pressed="false">ONLINE</button></div>
          <div class="mode-options" role="group" aria-label="Game mode"><button data-mode="casual" aria-pressed="true">CASUAL</button><button data-mode="competitive" aria-pressed="false">COMPETITIVE</button></div>
          <div class="match-browser">
            <section id="multiplayer-options" aria-label="Online lobby" hidden>
              <header class="lobby-heading"><span class="lobby-kicker">PLAY WITH FRIENDS</span><h2>Online Lobby</h2></header>
              <label for="match-server">SERVER</label><select id="match-server" aria-label="Server"><option value="wss://na1-cs.3kh0.dev/ws">na1-cs.3kh0.dev</option><option value="wss://na2-cs.3kh0.dev/ws">na2-cs.3kh0.dev</option></select>
              <button id="match-create" type="button">＋ CREATE LOBBY</button>
              <div class="lobby-divider"><span>OR JOIN FRIENDS</span></div>
              <label for="match-room">LOBBY PIN</label><input id="match-room" type="text" inputmode="numeric" autocomplete="off" minlength="6" maxlength="6" pattern="[0-9]{6}" placeholder="000000" aria-describedby="lobby-help">
              <p id="lobby-help">Make sure you and your friends are on the same server!</p>
              <small id="match-status" role="status" aria-live="polite"></small>
            </section>
            <div class="match-maps" role="group" aria-label="Maps"><button class="home-map-art" type="button" aria-label="Dust II, selected" aria-pressed="true"><img class="map-badge" src="/ui/home/dust2-emblem.svg" alt=""><span class="map-card-caption">Dust II</span></button></div>
          </div>
          <footer class="match-footer"><p id="mode-description" role="status"></p><button class="deploy" id="play" disabled aria-label="Play casual"><span>GO</span></button></footer>
        </section>
        <button class="home-loadout-card" id="home-loadout"><span class="home-card-kicker">YOUR LOADOUT</span><span class="home-guns"><img src="/icons/buy/ak47.svg" alt=""><img src="/icons/buy/m4a1_silencer.svg" alt=""></span><strong>Configure your buy menu</strong><small>Customize your buy slots <span>›</span></small></button>
        <button class="home-collection-card" id="home-collection"><span class="home-card-kicker">PLAY YOUR WAY</span><img src="/icons/buy/awp.svg" alt=""><strong>Weapon finishes</strong><small>Customize your skins<span>›</span></small></button>
      </aside>
      <div class="home-profile"><strong id="home-player-name">PLAYER</strong><span id="home-agent-name">SAS</span><span id="home-agent-status" role="status"></span><div class="home-team-choice" role="group" aria-label="Showcase team"><button data-home-team="ct" aria-label="Show Counter-Terrorist" aria-pressed="true"><img src="/icons/team-ct.png" alt=""></button><button data-home-team="t" aria-label="Show Terrorist" aria-pressed="false"><img src="/icons/team-t.png" alt=""></button></div></div>
      <aside class="home-social" aria-label="Local session"><img id="home-profile-icon" src="/icons/team-ct.png" alt="Your team"><span class="home-status-dot" title="Local session"></span><button id="steam-account-button" aria-label="Steam account" title="Sign in with Steam"><img id="steam-avatar" alt="Steam avatar" hidden><span id="steam-account-label">SIGN IN</span></button></aside>
      <button id="home-scenery-button" aria-label="Configure main menu" aria-expanded="false" aria-controls="home-scenery" title="Configure main menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></svg></button>
      <div id="home-scenery" hidden>
        <div class="home-scenery-branch"><button aria-expanded="false" aria-controls="home-background-options">Change Main Menu Scenery</button><div id="home-background-options" class="home-scenery-options" hidden></div></div>
        <div class="home-scenery-branch"><button aria-expanded="false" aria-controls="home-weapon-options">Change Weapon</button><div id="home-weapon-options" class="home-scenery-options" hidden></div></div>
        <button id="home-switch-team">Show Equipped T Agent</button>
        <button id="home-view-loadout">View Agent in Loadout</button>
        <select id="home-background" hidden><option value="dust2">Dust II</option><option value="close">Dust II - Close-up</option></select>
      </div>
    </main>
    <section id="home-panel" class="hidden" role="dialog" aria-modal="true" aria-labelledby="home-panel-title"><div class="home-popup"><div id="home-panel-content"></div><div class="home-popup-actions"><button id="home-panel-close">OK</button></div></div></section>
  </div>`;
}

export function setupHomeMenu(game: Game) {
  const el = (id: string) => document.getElementById(id)!;
  const panel = el("home-panel");
  const navButtons = [...document.querySelectorAll<HTMLButtonElement>(".home-header button")];
  for (const button of navButtons.filter((button) => button.closest(".home-nav"))) {
    const field = document.createElement("span");
    field.className = "nav-cell-field";
    field.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 24; index++) {
      const cell = document.createElement("i");
      cell.className = "nav-cell";
      cell.style.setProperty("--cell-duration", `${1800 + ((index * 739) % 2300)}ms`);
      cell.style.setProperty("--cell-delay", `${-((index * 997) % 4200)}ms`);
      cell.style.setProperty("--cell-peak", String(0.12 + ((index * 13) % 19) / 100));
      field.append(cell);
    }
    button.append(field);
  }
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
  navigationObserver.observe(el("app"), { childList: true });
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
    el("home-scenery").hidden = true;
    el("home-scenery-button").setAttribute("aria-expanded", "false");
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
  const scenery = el("home-scenery");
  const sceneryButton = el("home-scenery-button");
  function closeScenery() {
    scenery.hidden = true;
    sceneryButton.setAttribute("aria-expanded", "false");
    for (const button of scenery.querySelectorAll<HTMLButtonElement>("[aria-controls]")) {
      button.setAttribute("aria-expanded", "false");
      el(button.getAttribute("aria-controls")!).hidden = true;
    }
  }
  sceneryButton.onclick = () => {
    const opening = scenery.hidden;
    closeScenery();
    scenery.hidden = !opening;
    sceneryButton.setAttribute("aria-expanded", String(opening));
    if (opening) scenery.querySelector<HTMLButtonElement>("button")!.focus();
  };
  for (const button of scenery.querySelectorAll<HTMLButtonElement>("[aria-controls]")) {
    button.onclick = () => {
      const options = el(button.getAttribute("aria-controls")!);
      const opening = options.hidden;
      for (const other of scenery.querySelectorAll<HTMLButtonElement>("[aria-controls]")) {
        other.setAttribute("aria-expanded", "false");
        el(other.getAttribute("aria-controls")!).hidden = true;
      }
      options.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
    };
  }
  document.addEventListener("click", (event) => {
    if (!(event.target as Element).closest("#home-scenery, #home-scenery-button")) closeScenery();
  });
  scenery.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeScenery();
      sceneryButton.focus();
    }
  });
  el("home-view-loadout").onclick = () => {
    closeScenery();
    el("inventory-button").click();
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
    closeScenery();
  };
  el("home-background-options").replaceChildren(
    ...[...background.options].map((option) => {
      const button = document.createElement("button");
      button.textContent = option.text;
      button.onclick = () => {
        background.value = option.value;
        background.dispatchEvent(new Event("change"));
      };
      return button;
    }),
  );
  const choices = readHomeWeapons();
  function syncShowcase() {
    el("home-switch-team").textContent = `Show Equipped ${game.team === "ct" ? "T" : "CT"} Agent`;
    el("home-weapon-options").replaceChildren(
      ...weapons.flatMap((weapon, index) => {
        if (isKnife(index) || !weaponAvailable(index, game.team)) return [];
        const button = document.createElement("button");
        button.textContent = weapon.name;
        button.dataset.homeWeapon = String(index);
        button.setAttribute("aria-pressed", String(index === choices[game.team]));
        button.onclick = () => {
          choices[game.team] = index;
          try {
            localStorage.setItem("cs2go-home-weapons", JSON.stringify(choices));
          } catch {
            /* Session choice works. */
          }
          syncShowcase();
          closeScenery();
        };
        return [button];
      }),
    );
    game.homeScene.setWeapon(game.team, choices[game.team]);
  }
  el("home-switch-team").onclick = () => {
    game.setTeam(game.team === "ct" ? "t" : "ct");
    (el("agent-team") as HTMLSelectElement).value = game.team;
    syncShowcase();
    closeScenery();
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
