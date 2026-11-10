import { expect, test } from "vitest";
import * as T from "three";
import {
  bindEnvironmentTextures,
  createEnvironmentTextureBanks,
} from "./native-environment-textures";
import type { SourceEnvironmentMaterial } from "./native-map-environment";

const compressed = (byte: number, srgb = false, width = 8) => {
  const mips = [
    { width, height: 8, data: new Uint8Array(width * 8).fill(byte) },
    { width: 4, height: 4, data: new Uint8Array(16).fill(byte + 1) },
  ];
  const texture = new T.CompressedTexture(mips, width, 8, T.RGBA_BPTC_Format);
  texture.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
  return texture;
};
test("native BC7 banks preserve each mip and layer byte-for-byte and respect GPU layer limits", () => {
  const textures = new Map(["d", "b", "c", "a", "e"].map((id, i) => [id, compressed(i * 10)]));
  const before = new Map(
    [...textures].map(([id, texture]) => [
      id,
      texture.mipmaps.map((mip) => (mip.data as Uint8Array).slice()),
    ]),
  );
  const { arrays, bindings, bytes } = createEnvironmentTextureBanks(textures, 2);
  expect(arrays.map((array) => array.image.depth)).toEqual([2, 2]);
  expect(bindings.has("e")).toBe(false);
  expect(bytes).toBe(4 * 80);
  for (const [id, binding] of bindings) {
    const original = textures.get(id)!;
    for (let mip = 0; mip < 2; mip++) {
      const wanted = before.get(id)![mip];
      expect((original.mipmaps[mip].data as Uint8Array).buffer).toBe(
        binding.texture.mipmaps[mip].data.buffer,
      );
      const bank = binding.texture.mipmaps[mip].data as Uint8Array;
      expect(
        bank.slice(binding.layer * wanted.length, (binding.layer + 1) * wanted.length),
      ).toEqual(wanted);
    }
  }
});
test("banks never merge incompatible color spaces, dimensions, filter states or payload formats", () => {
  const a = compressed(1),
    b = compressed(2, true),
    c = compressed(3, false, 4),
    d = compressed(4);
  d.magFilter = T.NearestFilter;
  const e = compressed(5);
  e.format = T.RGBA_S3TC_DXT1_Format;
  expect(
    createEnvironmentTextureBanks(new Map(Object.entries({ a, b, c, d, e })), 256).arrays,
  ).toHaveLength(0);
});
test("sampler aliases retain independent native UV reads and verified constants retain authored LOD dimensions", () => {
  const textures = new Map([
    ["a", compressed(5)],
    ["b", compressed(9)],
  ]);
  const { bindings } = createEnvironmentTextureBanks(textures, 256);
  const source = {
    textures: { g_tColor1: "a", g_tColor2: "b", g_tHeight1: "a" },
    constants: { g_tHeight1: [0.3, 0.4, 0.5, 1] },
    nativeTextureDimensions: { g_tHeight1: [2048, 1024] },
  } as unknown as SourceEnvironmentMaterial;
  const shader = { uniforms: {} } as T.WebGLProgramParametersWithUniforms;
  const result = bindEnvironmentTextures(
    source,
    ["g_tColor1", "g_tColor2", "g_tHeight1"],
    textures,
    bindings,
    shader,
  );
  expect(result.samplers).toBe(1);
  expect(Object.keys(shader.uniforms)).toEqual(["environmentBank0"]);
  expect(result.code).toContain(
    "vec4 environmentColor1Read(vec2 uv){return texture(environmentBank0,vec3(uv,0.0));}",
  );
  expect(result.code).toContain(
    "vec4 environmentColor2Read(vec2 uv){return texture(environmentBank0,vec3(uv,1.0));}",
  );
  expect(result.code).toContain(
    "vec4 environmentHeight1Read(vec2 uv){return vec4(0.3,0.4,0.5,1.0);}",
  );
  expect(result.code).toContain("vec2 environmentHeight1Size(){return vec2(2048.0,1024.0);}");
  const swapped = bindEnvironmentTextures(
    { ...source, textures: { ...source.textures, g_tColor1: "b", g_tColor2: "a" } },
    ["g_tColor1", "g_tColor2"],
    textures,
    bindings,
    { uniforms: {} } as T.WebGLProgramParametersWithUniforms,
  );
  expect(swapped.signature).not.toBe(result.signature);
});

test("decoded fallback RGBA mip banks preserve authored bytes instead of regenerating mips", () => {
  const make = (value: number) => {
    const texture = new T.DataTexture(new Uint8Array(64).fill(value), 4, 4);
    texture.mipmaps = [
      { data: new Uint8Array(64).fill(value), width: 4, height: 4 },
      { data: new Uint8Array(16).fill(value + 7), width: 2, height: 2 },
      { data: new Uint8Array(4).fill(value + 13), width: 1, height: 1 },
    ];
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.generateMipmaps = false;
    return texture;
  };
  const { arrays, bindings, bytes } = createEnvironmentTextureBanks(
    new Map([
      ["a", make(20)],
      ["b", make(40)],
    ]),
    256,
  );
  expect(arrays).toHaveLength(1);
  expect(arrays[0].format).toBe(T.RGBAFormat);
  expect(bytes).toBe(168);
  expect(arrays[0].generateMipmaps).toBe(false);
  expect(Array.from(arrays[0].mipmaps[2].data as Uint8Array)).toEqual([
    33, 33, 33, 33, 53, 53, 53, 53,
  ]);
  expect(bindings.get("b")?.layer).toBe(1);
});
