import { saveAndCloseSettings, promptSettingsReload } from "./settings-reload";
import { displayAspects, type DisplayAspect } from "./display-settings";
import type { Game } from "./game";
import { graphicsPreset, graphicsPresets } from "./graphics-settings";
import { rendererDiagnostics } from "./renderer-diagnostics";

export function setupGraphicsSettings(panel: HTMLElement, game: Game) {
  const preset = panel.querySelector<HTMLSelectElement>("#quality")!;
  preset.closest("label")!.innerHTML =
    `Graphics preset<select id="quality"><option value="laptop">Laptop / battery - 720p, 60 FPS</option><option value="performance">Performance - 720p, 120 FPS</option><option value="balanced">Balanced - 1080p, 144 FPS</option><option value="quality">Quality - 1440p, display refresh</option><option value="custom" disabled>Custom</option></select>`;
  const quick = document.createElement("button");
  quick.id = "graphics-laptop";
  quick.className = "secondary";
  quick.textContent = "USE LAPTOP SETTINGS";
  quick.onclick = () => {
    graphics.value = "laptop";
    graphics.dispatchEvent(new Event("change"));
  };
  panel.querySelector("#quality")!.closest("label")!.after(quick);
  const summary = document.createElement("p");
  summary.id = "graphics-summary";
  quick.after(summary);
  panel.insertAdjacentHTML(
    "beforeend",
    `
    <label class="select-label">Aspect ratio<select id="aspect-ratio"><option value="native">Native - display aspect</option>${Object.keys(
      displayAspects,
    )
      .map((aspect) => `<option value="${aspect}">${aspect} - stretched</option>`)
      .join("")}</select></label>
    <h3 class="settings-section-title">Frame pacing</h3>
    <label class="select-label">VSync<select disabled aria-label="VSync"><option>Browser controlled</option></select></label>
    <label class="select-label">Gameplay frame limit<select id="fps-cap"><option value="0">Display refresh - no extra cap</option>${[30, 60, 90, 120, 144, 165, 240, 360, 500].map((n) => `<option value="${n}">${n} FPS</option>`).join("")}</select></label>
    <label class="select-label">Menu / pause frame limit<select id="menuFpsCap"><option value="15">15 FPS - lowest power</option><option value="30">30 FPS - recommended</option><option value="60">60 FPS</option><option value="120">120 FPS</option></select></label>
    <label class="select-label">Startup CPU use<select id="startupLoad"><option value="gentle">Gentle - fewer simultaneous decodes</option><option value="standard">Standard - faster parallel loading</option></select></label>
    <h3 class="settings-section-title">Rendering detail</h3>
    <label class="select-label">Anti-aliasing<select id="antialias"><option value="off">Off - fastest</option><option value="msaa">MSAA - browser selected samples</option></select></label>
    <label class="select-label">Resolution budget<select id="resolutionLimit">${[720, 1080, 1440, 2160].map((n) => `<option value="${n}">Up to ${n}p</option>`).join("")}<option value="0">Native - up to 2× pixel density</option></select></label>
    <label>Render scale<output id="resolutionScale-value"></output><input id="resolutionScale" type="range" min="50" max="100" step="5"></label>
    <label class="select-label">Shadow detail<select id="shadowDetail"><option value="off">Off</option><option value="low">Low - 1024</option><option value="medium">Medium - 2048</option><option value="high">High - 4096</option></select></label>
    <label class="select-label">Shadow filtering<select id="shadowFilter"><option value="hard">Hard - fastest</option><option value="soft">Soft - PCF</option></select></label>
    <label class="select-label">Texture resolution<select id="texture-quality"><option value="high">High - original detail</option><option value="medium">Medium - half resolution</option><option value="low">Low - quarter resolution</option></select></label>
    <label class="select-label">Texture filtering<select id="textureFiltering"><option value="1">Bilinear mipmaps</option>${[2, 4, 8, 16].map((n) => `<option value="${n}">Anisotropic ${n}×</option>`).join("")}</select></label>
    <label class="select-label">Smoke rendering<select id="effectsDetail"><option value="low">Performance</option><option value="high">Quality</option></select></label>
  `,
  );
  const diagnostics = game.renderer
    ? rendererDiagnostics(game.renderer.getContext())
    : { name: "WebGL unavailable", software: false };
  const status = document.createElement("section");
  status.id = "renderer-status";
  status.innerHTML = `<h3>ACTIVE GPU</h3><p id="renderer-name"></p><p id="renderer-hint"></p><details><summary>Using the wrong GPU or seeing high CPU usage?</summary><p>In Edge, enable “Use graphics acceleration when available” in Settings → System and performance, then restart the browser. Open edge://gpu to check acceleration status.</p><p>On Windows laptops with multiple GPUs: Settings → System → Display → Graphics → select your browser → Options → High performance, then restart the browser. The browser and OS choose the adapter; this game requests high performance.</p><p><a href="https://support.microsoft.com/en-us/windows/hardware/display-graphics/optimizations-for-windowed-games-in-windows-11" target="_blank" rel="noopener noreferrer">Windows graphics settings help</a></p></details>`;
  status.querySelector("#renderer-name")!.textContent = diagnostics.name;
  status.querySelector("#renderer-hint")!.textContent = diagnostics.software
    ? "Software rendering detected. Enable browser graphics acceleration and check your GPU settings. Laptop settings can reduce load in the meantime."
    : "High-performance GPU requested. This is the renderer reported by the game's WebGL context; the browser may hide its exact name.";
  summary.after(status);
  const help = {
    "aspect-ratio":
      "Render the entire game, including the world, weapons, HUD and menus, at this ratio and stretch it to fill your display. Requires a reload.",
    quality: "Apply a graphics preset. Individual changes switch the preset to Custom.",
    "fps-cap":
      "Set an upper limit for the frame rate while playing. Frame limits reduce GPU usage without changing the 128 Hz simulation.",
    menuFpsCap: "Set an upper limit for the frame rate in menus to reduce GPU usage.",
    startupLoad:
      "Gentle limits model, texture and audio decoding concurrency. Applies on the next page load; it can take longer but reduces simultaneous CPU and memory work.",
    antialias:
      "Smooth geometry edges. Changing anti-aliasing requires a reload; aspect ratio also requires a reload. Other video changes apply immediately.",
    resolutionLimit: "Limit the rendering resolution while keeping the HUD sharp.",
    resolutionScale:
      "Render scale adjusts the resolution budget, keeping the HUD sharp. Lower this first if the game is slow at high screen resolutions.",
    shadowDetail: "Adjust shadow resolution. Lower settings reduce GPU usage.",
    shadowFilter: "Soften shadow edges. Available when shadows are enabled.",
    "texture-quality":
      "Reduce texture resolution to lower GPU memory use. Original downloads and baked lighting stay unchanged.",
    textureFiltering: "Sharpen textures on angled surfaces. Filtering is limited by your GPU.",
    effectsDetail:
      "Adjust smoke rendering quality. Gameplay obstruction and grenade physics stay unchanged.",
  };
  for (const [id, description] of Object.entries(help))
    panel.querySelector(`#${id}`)!.closest("label")!.dataset.settingsHelp = description;
  panel.querySelector('select[aria-label="VSync"]')!.closest("label")!.dataset.settingsHelp =
    "The browser synchronizes presentation to your display. Disabling VSync is not available here.";
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
    startupLoad: "startupLoad",
  } as const;
  const scale = panel.querySelector<HTMLInputElement>("#resolutionScale")!;
  const aspect = panel.querySelector<HTMLSelectElement>("#aspect-ratio")!;
  aspect.value = game.settings.aspectRatio;
  aspect.onchange = () => {
    game.settings.aspectRatio = aspect.value as DisplayAspect;
    promptSettingsReload(game);
  };
  panel.insertAdjacentHTML(
    "beforeend",
    '<button id="graphics-save" class="secondary">SAVE CHANGES</button>',
  );
  panel.querySelector<HTMLButtonElement>("#graphics-save")!.onclick = () =>
    saveAndCloseSettings(game, true);
  function sync() {
    graphics.value = graphicsPreset(game.settings);
    summary.textContent =
      graphics.value === "laptop"
        ? "Lower power: 720p, 60 FPS, shadows off, 15 FPS menus. Gentle loading applies next time you open the game."
        : "Choose Laptop to reduce heat and power use, or adjust the controls below. Changes apply immediately except anti-aliasing, aspect ratio and startup CPU use.";
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
    const previousAntialias = game.settings.antialias;
    Object.assign(game.settings, selected);
    game.saveSettings();
    sync();
    if (game.settings.antialias !== previousAntialias) promptSettingsReload(game);
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
      if (key === "antialias") promptSettingsReload(game);
    };
  }
  scale.oninput = () => {
    game.settings.resolutionScale = Number(scale.value);
    game.saveSettings();
    sync();
  };
  sync();
}
