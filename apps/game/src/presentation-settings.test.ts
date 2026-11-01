import { describe, expect, it } from "vitest";
import * as T from "three";
import { applyTextureQuality, readPresentationSettings } from "./presentation-settings";

describe("saved presentation settings", () => {
  it("clamps malformed persisted values and rejects CSS color injection", () => {
    const saved = readPresentationSettings({
      fpsCap: 1,
      resolutionScale: -50,
      crosshairColor: "red; opacity:0",
      crosshairLength: Infinity,
      crosshairDot: "false",
    });
    expect(saved.fpsCap).toBe(30);
    expect(saved.resolutionScale).toBe(50);
    expect(saved.crosshairColor).toBe("#a8ff80");
    expect(saved.crosshairLength).toBe(7);
    expect(saved.crosshairDot).toBe(true);
  });
});
it("reduces compressed upload levels and reversibly restores their source data", () => {
  const mips = [16, 8, 4, 2, 1].map((size) => ({
    width: size,
    height: size,
    data: new Uint8Array(64),
  }));
  const texture = new T.CompressedTexture(mips, 16, 16);
  const mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ map: texture }));
  applyTextureQuality([mesh], "low", 8);
  expect(texture.image.width).toBe(4);
  expect(texture.mipmaps[0].data).toBe(mips[2].data);
  applyTextureQuality([mesh], "high", 8);
  expect(texture.image.width).toBe(16);
  expect(texture.mipmaps).toEqual(mips);
  expect(texture.anisotropy).toBe(8);
});
it("box filters baked skin maps while preserving alpha and the full quality source", () => {
  const pixels = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 80;
    pixels[i + 3] = 200;
  }
  const texture = new T.DataTexture(pixels, 4, 4, T.RGBAFormat);
  const mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ map: texture }));
  applyTextureQuality([mesh], "low", 8);
  expect(texture.image.width).toBe(1);
  expect(Array.from(texture.image.data as Uint8Array)).toEqual([80, 0, 0, 200]);
  applyTextureQuality([mesh], "high", 8);
  expect(texture.image.width).toBe(4);
  expect(texture.image.data).toBe(pixels);
});

it("preserves full source data when material texture clones share a Source", () => {
  const pixels = new Uint8Array(8 * 8 * 4).fill(128);
  const original = new T.DataTexture(pixels, 8, 8, T.RGBAFormat);
  const clone = original.clone();
  const group = new T.Group();
  for (const map of [original, clone])
    group.add(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ map })));
  applyTextureQuality([group], "low", 8);
  expect([original.image.width, clone.image.width]).toEqual([2, 2]);
  applyTextureQuality([group], "high", 8);
  expect([original.image.width, clone.image.width]).toEqual([8, 8]);
  expect(original.image.data).toBe(pixels);
  expect(clone.image.data).toBe(pixels);
});

it("changes filtering independently from resolution and clamps it to GPU support", () => {
  const mips = [16, 8, 4, 2, 1].map((size) => ({
    width: size,
    height: size,
    data: new Uint8Array(64),
  }));
  const texture = new T.CompressedTexture(mips, 16, 16);
  const mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial({ map: texture }));
  applyTextureQuality([mesh], "medium", 16, 2);
  expect(texture.image.width).toBe(8);
  expect(texture.anisotropy).toBe(2);
  applyTextureQuality([mesh], "medium", 4, 16);
  expect(texture.image.width).toBe(8);
  expect(texture.anisotropy).toBe(4);
  applyTextureQuality([mesh], "high", 16, 1);
  expect(texture.image.width).toBe(16);
  expect(texture.anisotropy).toBe(1);
});
