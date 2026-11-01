import type { Game } from "./game";
import { graphicsPreset, graphicsPresets } from "./graphics-settings";

export function setupGraphicsSettings(panel: HTMLElement, game: Game) {
  const preset = panel.querySelector<HTMLSelectElement>("#quality")!;
  preset.closest("label")!.innerHTML =
    `Graphics preset<select id="quality"><option value="performance">Performance</option><option value="balanced">Balanced - recommended</option><option value="quality">Quality</option><option value="custom" disabled>Custom</option></select>`;
  panel.insertAdjacentHTML(
    "beforeend",
    `
    <h3 class="settings-section-title">Frame pacing</h3>
    <label class="select-label">VSync<select disabled aria-label="VSync"><option>Browser controlled</option></select></label>
    <p class="hint">The browser synchronizes presentation to your display. Disabling VSync is not available here. Frame limits reduce GPU usage without changing the 128 Hz simulation.</p>
    <label class="select-label">Gameplay frame limit<select id="fps-cap"><option value="0">Display refresh - no extra cap</option>${[30, 60, 90, 120, 144, 165, 240, 360, 500].map((n) => `<option value="${n}">${n} FPS</option>`).join("")}</select></label>
    <label class="select-label">Menu frame limit<select id="menuFpsCap"><option value="30">30 FPS - recommended</option><option value="60">60 FPS</option><option value="120">120 FPS</option></select></label>
    <h3 class="settings-section-title">Rendering detail</h3>
    <label class="select-label">Anti-aliasing<select id="antialias"><option value="off">Off - fastest</option><option value="msaa">MSAA - browser selected samples</option></select></label>
    <p class="hint">Anti-aliasing smooths geometry edges and requires a reload. All other video changes apply immediately.</p>
    <button id="graphics-reload" class="secondary" hidden>Reload to apply anti-aliasing</button>
    <label class="select-label">Resolution budget<select id="resolutionLimit">${[720, 1080, 1440, 2160].map((n) => `<option value="${n}">Up to ${n}p</option>`).join("")}<option value="0">Native - up to 2× pixel density</option></select></label>
    <label>Render scale<output id="resolutionScale-value"></output><input id="resolutionScale" type="range" min="50" max="100" step="5"></label>
    <p class="hint">Render scale adjusts the resolution budget, keeping the HUD sharp. Lower this first if the game is slow at high screen resolutions.</p>
    <label class="select-label">Shadow detail<select id="shadowDetail"><option value="off">Off</option><option value="low">Low - 1024</option><option value="medium">Medium - 2048</option><option value="high">High - 4096</option></select></label>
    <label class="select-label">Shadow filtering<select id="shadowFilter"><option value="hard">Hard - fastest</option><option value="soft">Soft - PCF</option></select></label>
    <label class="select-label">Texture resolution<select id="texture-quality"><option value="high">High - original detail</option><option value="medium">Medium - half resolution</option><option value="low">Low - quarter resolution</option></select></label>
    <label class="select-label">Texture filtering<select id="textureFiltering"><option value="1">Bilinear mipmaps</option>${[2, 4, 8, 16].map((n) => `<option value="${n}">Anisotropic ${n}×</option>`).join("")}</select></label>
    <label class="select-label">Smoke rendering<select id="effectsDetail"><option value="low">Performance</option><option value="high">Quality</option></select></label>
    <p class="hint">Filtering sharpens angled surfaces and is limited by your GPU. Texture resolution reduces GPU uploads; original downloads and baked lighting stay unchanged. Smoke quality changes render sampling, keeping gameplay obstruction and grenade physics unchanged. Choices are saved on this device.</p>
  `,
  );
  const graphics = panel.querySelector<HTMLSelectElement>("#quality")!;
  const controls = {
    antialias: "antialias",
    fpsCap: "fps-cap",
    menuFpsCap: "menuFpsCap",
    resolutionLimit: "resolutionLimit",
    shadowDetail: "shadowDetail",
    shadowFilter: "shadowFilter",
    textureQuality: "texture-quality",
    textureFiltering: "textureFiltering",
    effectsDetail: "effectsDetail",
  } as const;
  const scale = panel.querySelector<HTMLInputElement>("#resolutionScale")!;
  const reload = panel.querySelector<HTMLButtonElement>("#graphics-reload")!;
  reload.onclick = () => location.reload();
  function sync() {
    reload.hidden = (game.settings.antialias === "msaa") === game.antialiasAtStartup;
    graphics.value = graphicsPreset(game.settings);
    for (const [key, id] of Object.entries(controls)) {
      const select = panel.querySelector<HTMLSelectElement>(`#${id}`)!;
      const value = String(game.settings[key as keyof typeof controls]);
      // Older saved caps can be any value between 30 and 500.
      if (key === "fpsCap" && !Array.from(select.options).some((o) => o.value === value))
        select.add(new Option(`${value} FPS`, value));
      select.value = value;
    }
    scale.value = String(game.settings.resolutionScale);
    panel.querySelector("#resolutionScale-value")!.textContent =
      `${game.settings.resolutionScale}%`;
    panel.querySelector<HTMLSelectElement>("#shadowFilter")!.disabled =
      game.settings.shadowDetail === "off";
  }
  graphics.onchange = () => {
    const selected = graphicsPresets[graphics.value as keyof typeof graphicsPresets];
    if (!selected) return;
    Object.assign(game.settings, selected);
    game.saveSettings();
    sync();
  };
  for (const [key, id] of Object.entries(controls)) {
    panel.querySelector<HTMLSelectElement>(`#${id}`)!.onchange = (event) => {
      const value = (event.target as HTMLSelectElement).value;
      Object.assign(game.settings, {
        [key]:
          typeof game.settings[key as keyof typeof controls] === "number" ? Number(value) : value,
      });
      game.saveSettings();
      sync();
    };
  }
  scale.oninput = () => {
    game.settings.resolutionScale = Number(scale.value);
    game.saveSettings();
    sync();
  };
  sync();
}
