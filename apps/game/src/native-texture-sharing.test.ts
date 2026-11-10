import { expect, test } from "vitest";
import * as T from "three";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { nativeTextureIdentity, shareNativeTexture } from "./native-texture-sharing";
import { applyTextureQuality } from "./presentation-settings";
import { createEnvironmentTextureBanks } from "./native-environment-textures";

const id = "8bf67e03aa4091b0";
function actual(sky = false) {
  const path = `../../packages/assets/public/models/maps/${sky ? "cache-skybox/complex-special08" : "cache-complex-special08"}/`;
  const entry = JSON.parse(readFileSync(path + "source.json", "utf8")).textures[id];
  const data = gunzipSync(readFileSync(path + entry.file));
  let offset = 0;
  const mips = entry.mips.map((m: { width: number; height: number; bytes: number }) => {
    const bytes = Uint8Array.from(data.subarray(offset, offset + m.bytes));
    offset += m.bytes;
    return { width: m.width, height: m.height, data: bytes };
  });
  const texture = new T.CompressedTexture(mips, mips[0].width, mips[0].height, T.RGBA_BPTC_Format);
  texture.colorSpace = entry.srgb ? T.SRGBColorSpace : T.NoColorSpace;
  return {
    texture,
    identity: nativeTextureIdentity(entry.format, entry.mips, entry.gpuSha256, entry.nativeMip)!,
  };
}
const mesh = (map: T.Texture) =>
  new T.Mesh(new T.PlaneGeometry(), new T.MeshBasicMaterial({ map }));
test("actual Cache main/own-sky native bytes share backing/source with separate wrappers", () => {
  const a = actual(),
    b = actual(true);
  expect(a.identity).toBe(b.identity);
  expect(a.texture.mipmaps[0].data.buffer).not.toBe(b.texture.mipmaps[0].data.buffer);
  shareNativeTexture(a.texture, a.identity);
  shareNativeTexture(b.texture, b.identity);
  expect(a.texture).not.toBe(b.texture);
  expect(a.texture.source).toBe(b.texture.source);
  expect(a.texture.mipmaps).toBe(b.texture.mipmaps);
  a.texture.dispose();
  expect(b.texture.mipmaps[0].data.byteLength).toBeGreaterThan(0);
});
test("same metadata with differing actual bytes fails closed; missing hashes are not identities", () => {
  const a = actual(),
    b = actual(true);
  b.texture.mipmaps.at(-1)!.data[0] ^= 1;
  shareNativeTexture(a.texture, a.identity);
  shareNativeTexture(b.texture, b.identity);
  expect(a.texture.source).not.toBe(b.texture.source);
  expect(nativeTextureIdentity("BC7", [{ width: 4, height: 4, bytes: 16 }])).toBeUndefined();
});
test("color space and sampler differences do not share sources", () => {
  const a = actual(),
    b = actual(),
    c = actual();
  b.texture.wrapS = T.RepeatWrapping;
  c.texture.colorSpace =
    a.texture.colorSpace === T.SRGBColorSpace ? T.NoColorSpace : T.SRGBColorSpace;
  for (const t of [a, b, c]) shareNativeTexture(t.texture, t.identity);
  expect(a.texture.source).not.toBe(b.texture.source);
  expect(a.texture.source).not.toBe(c.texture.source);
});
test("independent Low/High consumers detach and equal mip ranges rejoin losslessly", () => {
  const a = actual(),
    b = actual();
  shareNativeTexture(a.texture, a.identity);
  shareNativeTexture(b.texture, b.identity);
  const high = a.texture.image.width,
    original = a.texture.mipmaps;
  applyTextureQuality([mesh(a.texture)], "low", 8);
  expect(b.texture.image.width).toBe(high);
  expect(a.texture.image.width).toBe(high / 4);
  expect(a.texture.source).not.toBe(b.texture.source);
  applyTextureQuality([mesh(b.texture)], "low", 8);
  expect(a.texture.source).toBe(b.texture.source);
  applyTextureQuality([mesh(a.texture)], "high", 8);
  expect(a.texture.image.width).toBe(high);
  expect(b.texture.image.width).toBe(high / 4);
  applyTextureQuality([mesh(b.texture)], "high", 8);
  expect(a.texture.source).toBe(b.texture.source);
  expect(a.texture.mipmaps).toEqual(original);
});
test("bank view mutation detaches a shared unbanked consumer", () => {
  const a = actual(),
    b = actual(),
    c = actual();
  shareNativeTexture(a.texture, a.identity);
  shareNativeTexture(b.texture, b.identity);
  const before = b.texture.source,
    buffer = b.texture.mipmaps[0].data.buffer;
  const { arrays } = createEnvironmentTextureBanks(
    new Map([
      ["a", a.texture],
      ["c", c.texture],
    ]),
    256,
  );
  expect(arrays).toHaveLength(1);
  expect(a.texture.source).not.toBe(before);
  expect(b.texture.source).toBe(before);
  expect(b.texture.mipmaps[0].data.buffer).toBe(buffer);
  expect(a.texture.mipmaps[0].data.buffer).toBe(arrays[0].mipmaps[0].data.buffer);
});

test("a native Texture clone created at Low can restore High without mutating its parent", () => {
  const a = actual();
  shareNativeTexture(a.texture, a.identity);
  const high = a.texture.image.width;
  applyTextureQuality([mesh(a.texture)], "low", 8);
  const clone = a.texture.clone();
  applyTextureQuality([mesh(clone)], "high", 8);
  expect(clone.image.width).toBe(high);
  expect(a.texture.image.width).toBe(high / 4);
  expect(clone.source).not.toBe(a.texture.source);
});

test("verified RGBA fallback mip chains retain independent image data across quality changes", () => {
  const make = () => {
    const mips = [8, 4, 2].map((width, level) => ({
      width,
      height: width,
      data: new Uint8Array(width * width * 4).fill(40 + level),
    }));
    const texture = new T.DataTexture(mips[0].data, 8, 8);
    texture.mipmaps = mips;
    texture.generateMipmaps = false;
    const identity = nativeTextureIdentity(
      "RGBA8",
      mips.map((mip, i) => ({
        width: mip.width,
        height: mip.height,
        bytes: mip.data.byteLength,
        sha256: String(i).repeat(64),
      })),
    )!;
    shareNativeTexture(texture, identity);
    return texture;
  };
  const a = make(),
    b = make(),
    original = b.image.data;
  expect(a.source).toBe(b.source);
  applyTextureQuality([mesh(a)], "low", 8);
  expect(a.image.width).toBe(2);
  expect(b.image.width).toBe(8);
  expect(b.image.data).toBe(original);
  applyTextureQuality([mesh(a)], "high", 8);
  applyTextureQuality([mesh(b)], "high", 8);
  expect(a.source).toBe(b.source);
  expect(a.image.data).toBe(original);
});
