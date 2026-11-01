import * as T from "three";
import { graphicsDefaults, readGraphicsSettings } from "./graphics-settings";
import { viewmodelDefaults, readViewmodelSettings } from "./viewmodel-settings";

export const presentationDefaults = {
  ...graphicsDefaults,
  ...viewmodelDefaults,
  crosshairColor: "#a8ff80",
  crosshairLength: 7,
  crosshairThickness: 2,
  crosshairGap: 4,
  crosshairOpacity: 100,
  crosshairDot: true,
  crosshairOutline: true,
  crosshairDynamic: true,
};
export type PresentationSettings = typeof presentationDefaults;
export function readPresentationSettings(saved: Record<string, unknown>): PresentationSettings {
  const settings = {
    ...presentationDefaults,
    ...readGraphicsSettings(saved),
    ...readViewmodelSettings(saved),
  };
  for (const [key, min, max] of [
    ["crosshairLength", 1, 30],
    ["crosshairThickness", 1, 8],
    ["crosshairGap", 0, 20],
    ["crosshairOpacity", 10, 100],
  ] as const) {
    const value = saved[key];
    if (typeof value === "number" && Number.isFinite(value))
      settings[key] = Math.max(min, Math.min(max, value));
  }
  for (const key of ["crosshairDot", "crosshairOutline", "crosshairDynamic"] as const)
    if (typeof saved[key] === "boolean") settings[key] = saved[key];
  if (typeof saved.crosshairColor === "string" && /^#[\da-f]{6}$/i.test(saved.crosshairColor))
    settings.crosshairColor = saved.crosshairColor;
  return settings;
}
export function applyCrosshair(settings: PresentationSettings) {
  const style = document.documentElement.style;
  style.setProperty("--crosshair-color", settings.crosshairColor);
  style.setProperty("--crosshair-length", `${settings.crosshairLength}px`);
  style.setProperty("--crosshair-thickness", `${settings.crosshairThickness}px`);
  style.setProperty("--crosshair-opacity", String(settings.crosshairOpacity / 100));
  style.setProperty("--crosshair-outline", settings.crosshairOutline ? "0 0 1px 1px #000" : "none");
  style.setProperty("--crosshair-dot", settings.crosshairDot ? "block" : "none");
  document
    .getElementById("crosshair-preview")
    ?.style.setProperty("--gap", `${settings.crosshairGap}px`);
}

type TextureSource = { image: T.Texture["image"]; mipmaps: T.Texture["mipmaps"] };
const textureSources = new WeakMap<T.Texture["source"], TextureSource>();
const textureLevels = new WeakMap<T.Texture, string>();
const sourceLevels = new WeakMap<T.Texture["source"], string>();
/** Retain immutable source references so selecting High restores original detail. */
export function applyTextureQuality(
  roots: T.Object3D[],
  quality: string,
  maxAnisotropy: number,
  filtering = quality === "high" ? 8 : quality === "medium" ? 4 : 1,
) {
  const signature = `${quality}:${Math.min(maxAnisotropy, filtering)}`;
  const seen = new Set<T.Texture>();
  for (const root of roots)
    root.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        // Don't touch lightmaps, reflection render targets or shader data textures.
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap"] as const) {
          const texture = (material as T.MeshStandardMaterial)[key];
          if (!texture || seen.has(texture) || textureLevels.get(texture) === signature) continue;
          seen.add(texture);
          let source = textureSources.get(texture.source);
          if (!source) {
            source = { image: texture.image, mipmaps: texture.mipmaps };
            textureSources.set(texture.source, source);
          }
          const dataImage = source.image as T.DataTexture["image"];
          const sourceChanged = sourceLevels.get(texture.source) !== quality;
          const skip = quality === "high" ? 0 : quality === "medium" ? 1 : 2;
          if (texture instanceof T.CompressedTexture && source.mipmaps.length > 1) {
            const level = Math.min(skip, source.mipmaps.length - 1);
            texture.mipmaps = (source.mipmaps as T.CompressedTexture["mipmaps"]).slice(level);
            const mip = texture.mipmaps[0];
            texture.image = { width: mip.width, height: mip.height };
          } else if (
            sourceChanged &&
            texture instanceof T.DataTexture &&
            texture.format === T.RGBAFormat &&
            texture.type === T.UnsignedByteType &&
            dataImage?.data instanceof Uint8Array
          ) {
            if (!skip) texture.image = dataImage;
            else {
              const factor = 2 ** skip;
              const width = Math.max(1, Math.floor(dataImage.width / factor));
              const height = Math.max(1, Math.floor(dataImage.height / factor));
              const data = new Uint8Array(width * height * 4);
              for (let y = 0; y < height; y++)
                for (let x = 0; x < width; x++) {
                  for (let channel = 0; channel < 4; channel++) {
                    let sum = 0,
                      count = 0;
                    for (let dy = 0; dy < factor && y * factor + dy < dataImage.height; dy++)
                      for (let dx = 0; dx < factor && x * factor + dx < dataImage.width; dx++) {
                        sum +=
                          dataImage.data[
                            ((y * factor + dy) * dataImage.width + x * factor + dx) * 4 + channel
                          ];
                        count++;
                      }
                    data[(y * width + x) * 4 + channel] = Math.round(sum / count);
                  }
                }
              texture.image = { data, width, height };
            }
          } else if (
            sourceChanged &&
            !(texture instanceof T.DataTexture) &&
            source.image &&
            (source.image instanceof HTMLImageElement ||
              source.image instanceof HTMLCanvasElement ||
              source.image instanceof ImageBitmap)
          ) {
            if (!skip) texture.image = source.image;
            else {
              const canvas = document.createElement("canvas");
              canvas.width = Math.max(1, Math.floor(source.image.width / 2 ** skip));
              canvas.height = Math.max(1, Math.floor(source.image.height / 2 ** skip));
              const context = canvas.getContext("2d");
              if (context) {
                context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
                texture.image = canvas;
              }
            }
          }
          texture.anisotropy = Math.min(maxAnisotropy, filtering);
          if (texture.generateMipmaps || texture.mipmaps.length > 1)
            texture.minFilter =
              filtering === 1 ? T.LinearMipmapNearestFilter : T.LinearMipmapLinearFilter;
          texture.needsUpdate = true;
          textureLevels.set(texture, signature);
          sourceLevels.set(texture.source, quality);
        }
      }
    });
}
