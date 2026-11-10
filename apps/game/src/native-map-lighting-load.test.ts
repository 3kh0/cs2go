import { afterEach, expect, test, vi } from "vitest";
import * as T from "three";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { loadNativeMapLighting } from "./native-map-lighting";
const paths = {
  size: 4,
  irradiance: "/atlas.exr",
  shadows: "/shadows.webp",
  directional: "/directional.webp",
};
afterEach(() => vi.restoreAllMocks());
function texture(size = 4) {
  const value = new T.DataTexture(new Uint8Array(size * size * 4), size, size);
  return { value, dispose: vi.spyOn(value, "dispose") };
}
function imageTexture(size = 4) {
  const value = new T.Texture({ width: size, height: size } as HTMLImageElement);
  return { value, dispose: vi.spyOn(value, "dispose") };
}
test("failed atlas preparation waits for late companions and disposes every successful texture", async () => {
  const shadow = imageTexture(),
    direction = imageTexture();
  let resolveShadow!: (value: T.Texture<HTMLImageElement>) => void,
    resolveDirection!: (value: T.Texture<HTMLImageElement>) => void;
  vi.spyOn(EXRLoader.prototype, "loadAsync").mockRejectedValue(
    new Error("irradiance transport failed"),
  );
  vi.spyOn(T.TextureLoader.prototype, "loadAsync").mockImplementation(
    (url) =>
      new Promise((resolve) => {
        if (url.endsWith("shadows.webp")) resolveShadow = resolve;
        else resolveDirection = resolve;
      }),
  );
  let settled = false;
  const pending = loadNativeMapLighting(paths).catch((error: unknown) => {
    settled = true;
    return error;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  resolveShadow(shadow.value);
  await Promise.resolve();
  expect(settled).toBe(false);
  resolveDirection(direction.value);
  expect(await pending).toMatchObject({ message: "irradiance transport failed" });
  expect(shadow.dispose).toHaveBeenCalledTimes(1);
  expect(direction.dispose).toHaveBeenCalledTimes(1);
});
test("declared native atlas dimensions reject a wrong but otherwise valid power-of-two image atomically", async () => {
  const irradiance = texture(),
    shadow = imageTexture(8),
    direction = imageTexture();
  vi.spyOn(EXRLoader.prototype, "loadAsync").mockResolvedValue(irradiance.value);
  vi.spyOn(T.TextureLoader.prototype, "loadAsync").mockImplementation(async (url) =>
    url.endsWith("shadows.webp") ? shadow.value : direction.value,
  );
  await expect(loadNativeMapLighting(paths)).rejects.toThrow("declared 4x4");
  for (const part of [irradiance, shadow, direction]) expect(part.dispose).toHaveBeenCalledTimes(1);
});
test("successful exact-size native atlases retain linear channels, original sampling and caller ownership", async () => {
  const irradiance = texture(),
    shadow = imageTexture(),
    direction = imageTexture();
  vi.spyOn(EXRLoader.prototype, "loadAsync").mockResolvedValue(irradiance.value);
  vi.spyOn(T.TextureLoader.prototype, "loadAsync").mockImplementation(async (url) =>
    url.endsWith("shadows.webp") ? shadow.value : direction.value,
  );
  const result = await loadNativeMapLighting(paths);
  expect(result).toEqual({
    irradiance: irradiance.value,
    shadows: shadow.value,
    directional: direction.value,
  });
  for (const part of [irradiance, shadow, direction]) {
    expect(part.dispose).not.toHaveBeenCalled();
    expect(part.value.colorSpace).toBe(T.NoColorSpace);
    expect(part.value.generateMipmaps).toBe(false);
    expect(part.value.flipY).toBe(false);
  }
});
