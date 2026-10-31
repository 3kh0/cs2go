import type { Game } from "./game";
import { bindingActions, defaultBindings, keyLabel, validBinding } from "./key-bindings";
import "./control-settings.css";

export function setupControlSettings(game: Game) {
  const host = document.querySelector<HTMLElement>("#settings .settings")!;
  host.querySelector(".controls")?.remove();
  const section = document.createElement("section");
  section.className = "control-settings";
  section.innerHTML = `<h3>KEYBOARD BINDINGS</h3><button id="fullscreen-toggle" class="secondary">ENTER FULLSCREEN</button><p id="control-status" role="status" aria-live="polite"></p><div class="key-bindings">${bindingActions.map(([code, name]) => `<label><span>${name}</span><button data-binding="${code}" aria-label="Rebind ${name}"></button></label>`).join("")}</div><button id="reset-bindings" class="secondary">RESET KEY BINDINGS</button><p class="hint">Click a binding, then press a key. Escape cancels. Mouse: look, left click fire, right click alternate attack, scroll to switch weapons. Escape opens the live match menu.</p>`;
  host.append(section);
  const status = section.querySelector<HTMLElement>("#control-status")!;
  let pending: HTMLButtonElement | undefined;
  const render = () => {
    for (const button of section.querySelectorAll<HTMLButtonElement>("[data-binding]")) {
      button.textContent = keyLabel(game.settings.bindings[button.dataset.binding!]);
      button.classList.toggle("listening", button === pending);
    }
    if (pending) pending.textContent = "Press a key…";
  };
  for (const button of section.querySelectorAll<HTMLButtonElement>("[data-binding]"))
    button.onclick = () => {
      pending = button;
      status.textContent = "Press a new key, or Escape to cancel.";
      render();
    };
  document.addEventListener(
    "keydown",
    (event) => {
      if (!pending) return;
      if (
        document.getElementById("settings")!.classList.contains("hidden") ||
        section.closest("[hidden]")
      ) {
        pending = undefined;
        render();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === "Escape") {
        pending = undefined;
        status.textContent = "Binding unchanged.";
        render();
        return;
      }
      if (!validBinding(event.code) || event.metaKey) {
        status.textContent = "That key is reserved by the browser. Choose another key.";
        return;
      }
      const action = pending.dataset.binding!;
      const conflict = bindingActions.find(
        ([id]) => id !== action && game.settings.bindings[id] === event.code,
      );
      if (conflict) {
        status.textContent = `${keyLabel(event.code)} is already bound to ${conflict[1]}. Choose another key.`;
        return;
      }
      game.settings.bindings[action] = event.code;
      game.keys.clear();
      game.jumpQueued = false;
      game.saveSettings();
      pending = undefined;
      status.textContent = "Binding saved.";
      render();
    },
    true,
  );
  section.querySelector<HTMLButtonElement>("#reset-bindings")!.onclick = () => {
    pending = undefined;
    game.settings.bindings = defaultBindings();
    game.keys.clear();
    game.saveSettings();
    status.textContent = "Default bindings restored.";
    render();
  };
  const fullscreen = section.querySelector<HTMLButtonElement>("#fullscreen-toggle")!;
  const updateFullscreen = () => {
    fullscreen.textContent = document.fullscreenElement ? "EXIT FULLSCREEN" : "ENTER FULLSCREEN";
    fullscreen.setAttribute("aria-pressed", String(!!document.fullscreenElement));
  };
  fullscreen.disabled = !document.fullscreenEnabled;
  fullscreen.onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      updateFullscreen();
    } catch {
      status.textContent = "Fullscreen was not allowed by this browser.";
    }
  };
  document.addEventListener("fullscreenchange", updateFullscreen);
  render();
  updateFullscreen();
}
