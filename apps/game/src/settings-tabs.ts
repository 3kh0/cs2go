import { setupGraphicsSettings } from "./graphics-controls";
import type { Game } from "./game";
import { applyCrosshair } from "./presentation-settings";

export function setupSettingsTabs(game: Game) {
  const host = document.querySelector<HTMLElement>("#settings .settings")!;
  const tabs = document.createElement("div");
  tabs.className = "settings-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Settings categories");
  host.querySelector(".dialog-heading")!.after(tabs);
  const groups = {
    Video: ["quality", "fov", "fullscreen-toggle"],
    Audio: ["volume", "musicVolume", "effectsVolume"],
    Gameplay: ["agent-team", "hudHue", "auto-bunnyhop"],
    Controls: ["sensitivity"],
    Crosshair: [],
  };
  const panels = new Map<string, HTMLElement>();
  for (const [name, ids] of Object.entries(groups)) {
    const panel = document.createElement("section");
    panel.id = `settings-${name.toLowerCase()}`;
    panel.className = "settings-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `tab-${name.toLowerCase()}`);
    for (const id of ids) {
      const input = document.getElementById(id)!;
      panel.append(input.closest("label") ?? input);
    }
    if (name === "Controls") panel.append(host.querySelector(".control-settings")!);
    host.append(panel);
    panels.set(name, panel);
    const button = document.createElement("button");
    button.id = `tab-${name.toLowerCase()}`;
    button.textContent = name;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", panel.id);
    button.onclick = () => activate(name);
    tabs.append(button);
  }
  function activate(name: string) {
    for (const [key, panel] of panels) {
      panel.hidden = key !== name;
      const button = document.getElementById(`tab-${key.toLowerCase()}`)!;
      button.setAttribute("aria-selected", String(key === name));
      button.tabIndex = key === name ? 0 : -1;
    }
  }
  tabs.addEventListener("keydown", (event) => {
    const names = Object.keys(groups);
    const index = names.findIndex(
      (name) => document.getElementById(`tab-${name.toLowerCase()}`) === document.activeElement,
    );
    if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? names.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + names.length) % names.length;
    activate(names[next]);
    document.getElementById(`tab-${names[next].toLowerCase()}`)!.focus();
  });
  host.querySelector(":scope > .hint")?.remove();
  const video = panels.get("Video")!;
  setupGraphicsSettings(video, game);
  const crosshair = panels.get("Crosshair")!;
  crosshair.innerHTML = `<div class="crosshair-preview-stage"><div id="crosshair-preview" class="crosshair-shape"><i></i><i></i><i></i><i></i><b></b></div><span>LIVE PREVIEW</span></div><label class="select-label">Color<input id="crosshairColor" type="color"></label>${[
    ["crosshairLength", "Length", 1, 30],
    ["crosshairThickness", "Thickness", 1, 8],
    ["crosshairGap", "Gap", 0, 20],
    ["crosshairOpacity", "Opacity", 10, 100],
  ]
    .map(
      ([id, label, min, max]) =>
        `<label>${label}<output id="${id}-value"></output><input id="${id}" type="range" min="${min}" max="${max}" step="1"></label>`,
    )
    .join("")}${[
    ["crosshairDot", "Center dot"],
    ["crosshairOutline", "Black outline"],
    ["crosshairDynamic", "Dynamic movement / firing spread"],
  ]
    .map(
      ([id, label]) =>
        `<label class="toggle-label"><span>${label}</span><input id="${id}" type="checkbox" role="switch"></label>`,
    )
    .join("")}`;
  for (const id of [
    "crosshairLength",
    "crosshairThickness",
    "crosshairGap",
    "crosshairOpacity",
  ] as const) {
    const input = document.getElementById(id) as HTMLInputElement;
    const sync = () => {
      document.getElementById(`${id}-value`)!.textContent =
        `${input.value}${id === "crosshairOpacity" ? "%" : "px"}`;
    };
    input.value = String(game.settings[id]);
    sync();
    input.oninput = () => {
      game.settings[id] = Number(input.value);
      sync();
      game.saveSettings();
    };
  }
  for (const id of ["crosshairDot", "crosshairOutline", "crosshairDynamic"] as const) {
    const input = document.getElementById(id) as HTMLInputElement;
    input.checked = game.settings[id];
    input.onchange = () => {
      game.settings[id] = input.checked;
      game.saveSettings();
    };
  }
  const color = document.getElementById("crosshairColor") as HTMLInputElement;
  color.value = game.settings.crosshairColor;
  color.oninput = () => {
    game.settings.crosshairColor = color.value;
    game.saveSettings();
  };
  for (const [name, panel] of panels) {
    const heading = document.createElement("h3");
    heading.className = "settings-section-title";
    heading.textContent =
      name === "Video"
        ? "Display"
        : name === "Audio"
          ? "Audio"
          : name === "Controls"
            ? "Keyboard / Mouse"
            : name;
    panel.prepend(heading);
  }
  applyCrosshair(game.settings);
  activate("Video");
}
