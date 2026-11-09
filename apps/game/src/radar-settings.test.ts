import { describe, expect, it } from "vitest";
import { radarDefaults, readRadarSettings } from "./radar-settings";

describe("saved radar controls", () => {
  it("keeps defaults for absent or malformed saves, clamps finite values", () => {
    expect(readRadarSettings({})).toEqual(radarDefaults);
    const settings = readRadarSettings({
      radarScale: -1,
      radarHudScale: 9,
      radarBackgroundAlpha: NaN,
      radarSquare: "false",
      radarRotate: false,
    });
    expect(settings.radarScale).toBe(0.25);
    expect(settings.radarHudScale).toBe(1.3);
    expect(settings.radarBackgroundAlpha).toBe(radarDefaults.radarBackgroundAlpha);
    expect(settings.radarSquare).toBe(false);
    expect(settings.radarRotate).toBe(false);
  });
  it("preserves independent alternate zoom, shape and background choices", () => {
    const save = {
      ...radarDefaults,
      radarAlternateScale: 0.31,
      radarSquare: true,
      radarMapBlend: false,
      radarBlur: false,
      radarBackgroundAlpha: 0,
    };
    expect(readRadarSettings(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });
});
