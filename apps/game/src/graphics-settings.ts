import * as T from "three";

export const graphicsPresets = {
  performance: {
    antialias: "off",
    shadowDetail: "low",
    shadowFilter: "hard",
    textureQuality: "medium",
    textureFiltering: 2,
    resolutionLimit: 720,
    resolutionScale: 100,
    effectsDetail: "low",
    fpsCap: 120,
    menuFpsCap: 30,
  },
  balanced: {
    antialias: "off",
    shadowDetail: "medium",
    shadowFilter: "soft",
    textureQuality: "high",
    textureFiltering: 4,
    resolutionLimit: 1080,
    resolutionScale: 100,
    effectsDetail: "high",
    fpsCap: 144,
    menuFpsCap: 30,
  },
  quality: {
    antialias: "msaa",
    shadowDetail: "high",
    shadowFilter: "soft",
    textureQuality: "high",
    textureFiltering: 8,
    resolutionLimit: 1440,
    resolutionScale: 100,
    effectsDetail: "high",
    fpsCap: 0,
    menuFpsCap: 30,
  },
};
export type GraphicsSettings = typeof graphicsPresets.balanced;
export const graphicsDefaults = { ...graphicsPresets.balanced };
export function graphicsPreset(settings: GraphicsSettings) {
  return (
    Object.entries(graphicsPresets).find(([, preset]) =>
      (Object.keys(preset) as (keyof GraphicsSettings)[]).every(
        (key) => settings[key] === preset[key],
      ),
    )?.[0] ?? "custom"
  );
}
export function readGraphicsSettings(saved: Record<string, unknown>): GraphicsSettings {
  const result = { ...graphicsDefaults };
  // Keep existing users' previous visual choices. Fresh installs use Balanced.
  if (saved.quality === "low")
    Object.assign(result, graphicsPresets.performance, { shadowDetail: "off", fpsCap: 0 });
  if (saved.quality === "high")
    Object.assign(result, graphicsPresets.quality, { shadowDetail: "medium", antialias: "off" });
  if (saved.quality === "low" || saved.quality === "high") {
    result.textureQuality = ["low", "medium", "high"].includes(String(saved.textureQuality))
      ? String(saved.textureQuality)
      : "high";
    result.textureFiltering =
      result.textureQuality === "low" ? 1 : result.textureQuality === "medium" ? 4 : 8;
  }
  for (const [key, options] of Object.entries({
    antialias: ["off", "msaa"],
    shadowDetail: ["off", "low", "medium", "high"],
    shadowFilter: ["hard", "soft"],
    textureQuality: ["low", "medium", "high"],
    effectsDetail: ["low", "high"],
    textureFiltering: [1, 2, 4, 8, 16],
    resolutionLimit: [720, 1080, 1440, 2160, 0],
    menuFpsCap: [30, 60, 120],
  })) {
    if ((options as unknown[]).includes(saved[key])) Object.assign(result, { [key]: saved[key] });
  }
  if (typeof saved.fpsCap === "number" && Number.isFinite(saved.fpsCap))
    result.fpsCap = saved.fpsCap === 0 ? 0 : Math.max(30, Math.min(500, Math.round(saved.fpsCap)));
  if (typeof saved.resolutionScale === "number" && Number.isFinite(saved.resolutionScale))
    result.resolutionScale = Math.max(50, Math.min(100, saved.resolutionScale));
  return result;
}
/** 16:9 pixel-area limits also bound ultrawide and high-DPI canvases. */
export function graphicsPixelRatio(
  settings: GraphicsSettings,
  width: number,
  height: number,
  dpr: number,
) {
  const pixels = settings.resolutionLimit ? (settings.resolutionLimit ** 2 * 16) / 9 : Infinity;
  return (
    (settings.resolutionScale / 100) *
    Math.min(dpr, 2, Math.sqrt(pixels / Math.max(1, width * height)))
  );
}
/** Release old targets only on a real change; static map shadows regenerate once. */
export function applyShadowDetail(
  roots: T.Object3D[],
  settings: GraphicsSettings,
  maxSize: number,
) {
  const size = Math.min(
    maxSize,
    ({ off: 0, low: 1024, medium: 2048, high: 4096 } as Record<string, number>)[
      settings.shadowDetail
    ] ?? 2048,
  );
  for (const root of roots)
    root.traverse((object) => {
      if (!(object instanceof T.DirectionalLight) || !object.castShadow) return;
      const shadow = object.shadow;
      const signature = `${size}:${settings.shadowFilter}`;
      if (object.userData.graphicsShadow === signature) return;
      object.userData.graphicsShadow = signature;
      shadow.map?.dispose();
      shadow.map = null;
      shadow.mapPass?.dispose();
      shadow.mapPass = null;
      shadow.mapSize.set(Math.max(1, size), Math.max(1, size));
      shadow.needsUpdate = size > 0;
    });
}
