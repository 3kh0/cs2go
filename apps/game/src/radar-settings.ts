// Names and UI ranges follow Panorama settings_game.xml, Radar / Tablet.
export const radarDefaults = {
  radarCentered: true,
  radarRotate: true,
  radarMapBlend: true,
  radarBlur: true,
  radarBackgroundAlpha: 0.627,
  radarHudScale: 1,
  radarScale: 0.7,
  radarAlternateScale: 1,
  radarSquareScoreboard: true,
  radarSquare: false,
  radarDynamic: false,
  radarIconScale: 0.6,
  radarTeammateColors: 1 as 0 | 1 | 2,
  radarSquareSpectator: true,
  radarSpectatorAll: true,
};
export type RadarSettings = typeof radarDefaults;
export const radarRanges = {
  radarBackgroundAlpha: [0, 1],
  radarHudScale: [0.8, 1.3],
  radarScale: [0.25, 1],
  radarAlternateScale: [0.25, 1],
  radarIconScale: [0.4, 1.25],
} as const;
export function readRadarSettings(saved: Record<string, unknown>): RadarSettings {
  const settings = { ...radarDefaults };
  for (const key of Object.keys(radarDefaults) as (keyof RadarSettings)[]) {
    const value = saved[key];
    if (key in radarRanges) {
      const rangeKey = key as keyof typeof radarRanges;
      const [min, max] = radarRanges[rangeKey];
      if (typeof value === "number" && Number.isFinite(value))
        settings[rangeKey] = Math.min(max, Math.max(min, value));
    } else if (key === "radarTeammateColors") {
      if (value === 0 || value === 1 || value === 2) settings[key] = value;
    } else if (typeof value === "boolean") {
      settings[
        key as Exclude<keyof RadarSettings, keyof typeof radarRanges | "radarTeammateColors">
      ] = value;
    }
  }
  return settings;
}
