import type { Game } from "./game";

const deferred = new WeakMap<Game, string>();

export function saveAndCloseSettings(game: Game, askAgain = false, closeAfter = true) {
  game.saveSettings();
  const settings = document.getElementById("settings")!;
  const close = () => {
    settings.classList.add("hidden");
    document.getElementById(game.active ? "pause-settings" : "settings-button")!.focus();
  };
  const needsReload =
    game.settings.aspectRatio !== game.aspectAtStartup ||
    (game.settings.antialias === "msaa") !== game.antialiasAtStartup;
  const signature = JSON.stringify([game.settings.aspectRatio, game.settings.antialias]);
  if (!needsReload || (!askAgain && deferred.get(game) === signature)) {
    if (closeAfter) close();
    return;
  }
  if (document.getElementById("settings-reload")) return;
  const overlay = document.createElement("section");
  overlay.id = "settings-reload";
  overlay.className = "popup-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "settings-reload-title");
  overlay.setAttribute("aria-describedby", "settings-reload-message");
  overlay.innerHTML = `<div class="home-popup"><h2 id="settings-reload-title">RELOAD REQUIRED</h2><p id="settings-reload-message">These changes require a reload. Reload now, or apply them the next time you reload?</p>${game.active ? "<p>Reloading will leave your current match.</p>" : ""}<div class="home-popup-actions"><button id="settings-reload-now">RELOAD NOW</button><button id="settings-reload-later">LATER</button></div></div>`;
  document.getElementById("app")!.append(overlay);
  settings.inert = true;
  const previousFocus = document.activeElement;
  const later = () => {
    deferred.set(game, signature);
    settings.inert = false;
    overlay.remove();
    if (closeAfter) close();
    else if (previousFocus instanceof HTMLElement) previousFocus.focus();
  };
  overlay.querySelector<HTMLButtonElement>("#settings-reload-now")!.onclick = () =>
    location.reload();
  overlay.querySelector<HTMLButtonElement>("#settings-reload-later")!.onclick = later;
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      later();
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const buttons = [...overlay.querySelectorAll<HTMLButtonElement>("button")];
      buttons[document.activeElement === buttons[0] ? 1 : 0].focus();
    }
  });
  overlay.querySelector<HTMLButtonElement>("#settings-reload-now")!.focus();
}

export function promptSettingsReload(game: Game) {
  saveAndCloseSettings(game, true, false);
}
