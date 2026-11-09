import type { Game } from "./game";
import { radarDefaults, radarRanges } from "./radar-settings";

const toggles = [
  [
    "radarCentered",
    "Radar Centers The Player",
    "Centers the radar around you, or shifts it to show more of the map near its edges.",
  ],
  ["radarRotate", "Radar Is Rotating", "Rotate with your view, or keep north at the top."],
  [
    "radarMapBlend",
    "Radar Hud Map Blends With Background",
    "Blend the map colors with the environment behind the radar.",
  ],
  ["radarBlur", "Blur Background", "Blur the environment behind the radar."],
  [
    "radarSquareScoreboard",
    "Toggle Square Shape With Scoreboard",
    "Display the whole map in a square while the scoreboard is visible.",
  ],
  ["radarSquare", "Force Square Shape", "Always display the whole map in a square."],
  ["radarDynamic", "Radar Is Zooming Dynamically", "Adjust zoom to encompass detected elements."],
  [
    "radarSquareSpectator",
    "Square Radar While Spectating",
    "Display the whole map while observing a player after death.",
  ],
  [
    "radarSpectatorAll",
    "Show All Players While Spectating",
    "Show all players during unrestricted Casual spectating. Competitive team visibility still applies.",
  ],
] as const;
const sliders = [
  ["radarBackgroundAlpha", "Radar Hud Background Opacity"],
  ["radarHudScale", "Radar Hud Size"],
  ["radarScale", "Radar Map Zoom"],
  ["radarAlternateScale", "Radar Map Alternate Zoom"],
  ["radarIconScale", "Radar Icon Size"],
] as const;
export function setupRadarSettings(panel: HTMLElement, game: Game) {
  panel.innerHTML =
    toggles
      .map(
        ([key, label, help]) =>
          `<label class="select-label" data-settings-help="${help}">${label}<select id="${key}"><option value="1">Yes</option><option value="0">No</option></select></label>`,
      )
      .join("") +
    '<label class="select-label">Show Teammate Colors<select id="radarTeammateColors"><option value="1">Show Colors</option><option value="2">Colors and Letters</option><option value="0">No</option></select></label>' +
    sliders
      .map(([key, label]) => {
        const [min, max] = radarRanges[key];
        return `<label>${label}<output id="${key}-value"></output><input id="${key}" type="range" min="${min}" max="${max}" step="0.01"></label>`;
      })
      .join("") +
    '<button type="button" class="secondary" id="reset-radar">RESET RADAR</button>';
  const reset = panel.querySelector("#reset-radar")!;
  for (const key of [
    "radarCentered",
    "radarRotate",
    "radarMapBlend",
    "radarBlur",
    "radarBackgroundAlpha",
    "radarHudScale",
    "radarScale",
    "radarAlternateScale",
    "radarSquareScoreboard",
    "radarSquare",
    "radarDynamic",
    "radarSquareSpectator",
    "radarSpectatorAll",
    "radarIconScale",
    "radarTeammateColors",
  ])
    panel.insertBefore(panel.querySelector(`#${key}`)!.closest("label")!, reset);
  const sync = () => {
    panel.querySelector<HTMLSelectElement>("#radarTeammateColors")!.value = String(
      game.settings.radarTeammateColors,
    );
    for (const [key] of toggles)
      panel.querySelector<HTMLSelectElement>(`#${key}`)!.value = game.settings[key] ? "1" : "0";
    for (const [key] of sliders) {
      panel.querySelector<HTMLInputElement>(`#${key}`)!.value = String(game.settings[key]);
      panel.querySelector(`#${key}-value`)!.textContent = game.settings[key].toFixed(2);
    }
  };
  panel.querySelector<HTMLSelectElement>("#radarTeammateColors")!.onchange = (event) => {
    game.settings.radarTeammateColors = Number((event.target as HTMLSelectElement).value) as
      | 0
      | 1
      | 2;
    game.saveSettings();
  };
  for (const [key] of toggles)
    panel.querySelector<HTMLSelectElement>(`#${key}`)!.onchange = (event) => {
      game.settings[key] = (event.target as HTMLSelectElement).value === "1";
      game.saveSettings();
    };
  for (const [key] of sliders)
    panel.querySelector<HTMLInputElement>(`#${key}`)!.oninput = (event) => {
      game.settings[key] = Number((event.target as HTMLInputElement).value);
      game.saveSettings();
      sync();
    };
  panel.querySelector<HTMLButtonElement>("#reset-radar")!.onclick = () => {
    Object.assign(game.settings, radarDefaults);
    game.saveSettings();
    sync();
  };
  sync();
}
