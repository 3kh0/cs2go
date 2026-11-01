import { describe, expect, it, vi } from "vitest";
import * as T from "three";
import {
  applyShadowDetail,
  graphicsDefaults,
  graphicsPixelRatio,
  graphicsPreset,
  graphicsPresets,
  readGraphicsSettings,
} from "./graphics-settings";

describe("graphics choices", () => {
  it("starts balanced, preserves legacy visuals and rejects broken storage", () => {
    expect(graphicsPreset(readGraphicsSettings({}))).toBe("balanced");
    expect(readGraphicsSettings({ quality: "low" })).toMatchObject({
      shadowDetail: "off",
      resolutionLimit: 720,
      effectsDetail: "low",
    });
    expect(
      readGraphicsSettings({ quality: "high", textureQuality: "low", shadowDetail: "high" }),
    ).toMatchObject({ resolutionLimit: 1440, shadowDetail: "high", textureQuality: "low" });
    expect(
      readGraphicsSettings({
        shadowDetail: "bad",
        textureFiltering: 999,
        resolutionLimit: -1,
        menuFpsCap: 0,
        fpsCap: Infinity,
      }),
    ).toEqual(graphicsDefaults);
    expect(readGraphicsSettings({ fpsCap: 1, resolutionScale: 200 })).toMatchObject({
      fpsCap: 30,
      resolutionScale: 100,
    });
    expect(graphicsPreset({ ...graphicsDefaults, textureFiltering: 16 })).toBe("custom");
  });
  it("bounds high DPI and ultrawide pixel work independently of shadows", () => {
    for (const [width, height, dpr] of [
      [3840, 2160, 2],
      [5120, 1440, 2],
      [1920, 1080, 2],
    ]) {
      const ratio = graphicsPixelRatio(graphicsDefaults, width, height, dpr);
      expect(width * height * ratio * ratio).toBeCloseTo(1920 * 1080);
      expect(
        graphicsPixelRatio({ ...graphicsDefaults, shadowDetail: "off" }, width, height, dpr),
      ).toBe(ratio);
      expect(
        graphicsPixelRatio({ ...graphicsDefaults, resolutionScale: 50 }, width, height, dpr),
      ).toBe(ratio / 2);
    }
    expect(graphicsPixelRatio({ ...graphicsDefaults, resolutionLimit: 0 }, 1920, 1080, 3)).toBe(2);
  });
  it("rebuilds cached shadows on changes, releases targets and respects GPU size", () => {
    const sun = new T.DirectionalLight();
    sun.castShadow = true;
    sun.shadow.autoUpdate = false;
    applyShadowDetail([sun], graphicsDefaults, 4096);
    const target = new T.WebGLRenderTarget(2048, 2048);
    sun.shadow.map = target;
    const dispose = vi.spyOn(target, "dispose");
    sun.shadow.needsUpdate = false;
    applyShadowDetail([sun], graphicsDefaults, 4096);
    expect(dispose).not.toHaveBeenCalled();
    expect(sun.shadow.needsUpdate).toBe(false);
    applyShadowDetail([sun], graphicsPresets.quality, 2048);
    // Resolution is hardware-clamped and does not rebuild an identical target.
    expect(dispose).not.toHaveBeenCalled();
    applyShadowDetail([sun], { ...graphicsDefaults, shadowDetail: "off" }, 4096);
    expect(dispose).toHaveBeenCalledOnce();
    expect(sun.shadow.map).toBeNull();
    applyShadowDetail([sun], graphicsPresets.quality, 4096);
    expect(sun.shadow.mapSize.x).toBe(4096);
    expect(sun.shadow.needsUpdate).toBe(true);
    expect(sun.shadow.autoUpdate).toBe(false);
  });
});
