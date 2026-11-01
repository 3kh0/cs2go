import type { Game } from "./game";
import { weapons } from "./physics";
import {
  viewmodelAspects,
  viewmodelDefaults,
  viewmodelRanges,
  type ViewmodelAspect,
} from "./viewmodel-settings";

export function setupViewmodelSettings(panel: HTMLElement, game: Game) {
  panel.innerHTML = `<label class="select-label">Preview weapon<select id="viewmodel-preview-weapon">${weapons.map((weapon, index) => `<option value="${index}">${weapon.name}</option>`).join("")}</select></label>${[
    ["viewmodelFov", "FOV"],
    ["viewmodelOffsetX", "Offset X · right"],
    ["viewmodelOffsetY", "Offset Y · forward"],
    ["viewmodelOffsetZ", "Offset Z · up"],
  ]
    .map(([key, label]) => {
      const [min, max] = viewmodelRanges[key as keyof typeof viewmodelRanges];
      return `<label>${label}<output id="${key}-value"></output><input id="${key}" type="range" min="${min}" max="${max}" step="${key === "viewmodelFov" ? 1 : 0.1}"></label>`;
    })
    .join(
      "",
    )}<div class="viewmodel-aspect"><span>Aspect ratio</span><div role="group" aria-label="Viewmodel aspect ratio">${Object.keys(
    viewmodelAspects,
  )
    .map((aspect) => `<button type="button" data-viewmodel-aspect="${aspect}">${aspect}</button>`)
    .join(
      "",
    )}</div><p class="hint">Preview how your hands and weapon fill the screen at this ratio.</p></div><button type="button" class="secondary" id="reset-viewmodel">RESET TO GAME DEFAULTS</button>`;
  const preview = panel.querySelector<HTMLSelectElement>("#viewmodel-preview-weapon")!;
  preview.value = String(game.viewmodelPreviewWeapon);
  preview.onchange = () => {
    game.viewmodelPreviewWeapon = Number(preview.value);
  };
  const sync = () => {
    for (const key of Object.keys(viewmodelRanges) as (keyof typeof viewmodelRanges)[]) {
      const input = panel.querySelector<HTMLInputElement>(`#${key}`)!;
      input.value = String(game.settings[key]);
      panel.querySelector(`#${key}-value`)!.textContent =
        key === "viewmodelFov" ? String(game.settings[key]) : game.settings[key].toFixed(1);
    }
    for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-viewmodel-aspect]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.viewmodelAspect === game.settings.viewmodelAspect),
      );
  };
  for (const key of Object.keys(viewmodelRanges) as (keyof typeof viewmodelRanges)[])
    panel.querySelector<HTMLInputElement>(`#${key}`)!.oninput = (event) => {
      game.settings[key] = Number((event.target as HTMLInputElement).value);
      game.saveViewmodelSettings();
      sync();
    };
  for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-viewmodel-aspect]"))
    button.onclick = () => {
      game.settings.viewmodelAspect = button.dataset.viewmodelAspect as ViewmodelAspect;
      game.saveViewmodelSettings();
      sync();
    };
  panel.querySelector<HTMLButtonElement>("#reset-viewmodel")!.onclick = () => {
    Object.assign(game.settings, viewmodelDefaults);
    game.saveViewmodelSettings();
    sync();
  };
  sync();
}
