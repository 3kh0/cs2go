import { expect, test } from "vitest";
import * as T from "three";
import {
  validateParallaxCube,
  validateSourceParallax,
  applyParallaxShader,
  type SourceParallaxMaterial,
} from "./native-map-parallax";
const material: SourceParallaxMaterial = {
  shader: "csgo_simple_3layer_parallax.vfx",
  nativeResource: "authored-test.vmat",
  IntParams: {},
  FloatParams: {},
  VectorParams: {},
  textures: Object.fromEntries(
    ["Color", "Normal", "Layer0Mask", "Layer1Color", "Layer2Color", "AmbientOcclusion"].map(
      (name) => ["g_t" + name, name],
    ),
  ),
};
test("parallax variants require authored samplers and reject unsupported feature/UV contracts", () => {
  expect(() => validateSourceParallax(material)).not.toThrow();
  expect(() =>
    validateSourceParallax({ ...material, IntParams: { F_SECOND_LAYER_CUBEMAP: 1 } }),
  ).toThrow("g_tLayer2Cubemap");
  expect(() => validateSourceParallax({ ...material, IntParams: { F_SECONDARY_UV: 1 } })).toThrow(
    "secondary material UV",
  );
  expect(() => validateSourceParallax({ ...material, IntParams: { F_UNKNOWN: 1 } })).toThrow(
    "F_UNKNOWN",
  );
  expect(() => validateSourceParallax({ ...material, FloatParams: { bad: Infinity } })).toThrow(
    "Nonfinite",
  );
});
test("parallax cube residency validates all six faces and every authored mip", () => {
  const cube = {
    file: "native.gz",
    format: "BC6H" as const,
    gpuBytes: 192,
    mips: [
      { width: 2, height: 2, bytes: 96 },
      { width: 1, height: 1, bytes: 96 },
    ],
    fallbackFile: "fallback.gz",
    fallbackBytes: 240,
    fallbackMips: [
      { width: 2, height: 2, bytes: 192 },
      { width: 1, height: 1, bytes: 48 },
    ],
  };
  expect(validateParallaxCube(cube)).toBe(2);
  expect(() => validateParallaxCube({ ...cube, mips: cube.mips.slice(0, 1) })).toThrow(
    "layout/budget",
  );
  expect(() => validateParallaxCube({ ...cube, fallbackBytes: 241 })).toThrow("payload budget");
  expect(() =>
    validateParallaxCube({
      ...cube,
      fallbackMips: [{ width: 2, height: 2, bytes: 96 }, cube.fallbackMips[1]],
    }),
  ).toThrow("face lengths");
});

test("native per-draw model tint remains a material uniform when shader programs are shared", () => {
  const textures = new Map(Object.values(material.textures).map((key) => [key, new T.Texture()]));
  const lookup = new T.DataTexture();
  const compile = (tint: T.Color) => {
    const shader = {
      uniforms: {},
      vertexShader: T.ShaderLib.standard.vertexShader,
      fragmentShader: T.ShaderLib.standard.fragmentShader,
    } as T.WebGLProgramParametersWithUniforms;
    applyParallaxShader(shader, material, textures, new Map(), tint, lookup);
    return shader;
  };
  const a = compile(new T.Color(0.2, 0.4, 0.6)),
    b = compile(new T.Color(0.8, 0.3, 0.1));
  expect(a.fragmentShader).toBe(b.fragmentShader);
  [0.2, 0.4, 0.6].forEach((value, index) =>
    expect((a.uniforms.sourceParallaxTintColor.value as T.Color).toArray()[index]).toBeCloseTo(
      value,
      12,
    ),
  );
  [0.8, 0.3, 0.1].forEach((value, index) =>
    expect((b.uniforms.sourceParallaxTintColor.value as T.Color).toArray()[index]).toBeCloseTo(
      value,
      12,
    ),
  );
  textures.forEach((t) => t.dispose());
  lookup.dispose();
});

test("native addressing isolates shared resources and restores all authored mip levels", async () => {
  const { createParallaxTextureBindings } = await import("./native-map-parallax");
  const { applyTextureQuality, registerSurfaceTextures } = await import("./presentation-settings");
  const original = new T.CompressedTexture(
    [4, 2, 1].map((width) => ({ width, height: width, data: new Uint8Array(16) })),
    4,
    4,
    T.RGBA_BPTC_Format,
  );
  original.wrapS = original.wrapT = T.RepeatWrapping;
  const owned = new Map([["shared", original]]);
  const source = {
    ...material,
    IntParams: { g_nTextureAddressModeU: 2, g_nTextureAddressModeV: 1 },
    textures: { g_tColor: "shared", g_tAmbientOcclusion: "shared" },
  };
  const bindings = createParallaxTextureBindings(source, owned);
  const color = bindings.get("g_tColor")! as T.CompressedTexture;
  expect(color).not.toBe(original);
  expect(bindings.get("g_tAmbientOcclusion")).toBe(original);
  expect(color.wrapS).toBe(T.ClampToEdgeWrapping);
  expect(color.wrapT).toBe(T.MirroredRepeatWrapping);
  expect(color.source).not.toBe(original.source);
  expect(color.mipmaps[0].data).toBe(original.mipmaps[0].data);
  expect(createParallaxTextureBindings(source, owned).get("g_tColor")).toBe(color);
  const m = new T.MeshStandardMaterial();
  registerSurfaceTextures(m, [...bindings.values()]);
  const root = new T.Mesh(new T.PlaneGeometry(), m);
  for (const quality of ["low", "medium", "high"]) {
    applyTextureQuality([root], quality, 8);
    expect(color.image.width).toBe(quality === "low" ? 1 : quality === "medium" ? 2 : 4);
    expect(color.mipmaps.length).toBe(quality === "low" ? 1 : quality === "medium" ? 2 : 3);
    expect(color.wrapS).toBe(T.ClampToEdgeWrapping);
    expect(original.wrapS).toBe(T.RepeatWrapping);
  }
  expect(() =>
    validateSourceParallax({ ...material, IntParams: { g_nTextureAddressModeU: 3 } }),
  ).toThrow("addressing mode: 3");
  for (const texture of owned.values()) texture.dispose();
  root.geometry.dispose();
  m.dispose();
});

test("native BC4 masks share exact authored mip layers without merging sampler states", async () => {
  const { createParallaxTextureBindings, createParallaxTextureBanks } =
    await import("./native-map-parallax");
  const make = (value: number) => {
    const texture = new T.CompressedTexture(
      [8, 4].map((width) => ({
        width,
        height: width,
        data: new Uint8Array(width === 8 ? 32 : 8).fill(value),
      })),
      8,
      8,
      T.RED_RGTC1_Format,
    );
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    return texture;
  };
  const ao = make(21),
    mask = make(87),
    originals = new Map([
      ["ao", ao],
      ["mask", mask],
    ]);
  const source = {
    ...material,
    textures: { ...material.textures, g_tAmbientOcclusion: "ao", g_tLayer0Mask: "mask" },
  };
  const bindings = createParallaxTextureBindings(source, originals);
  const banks = createParallaxTextureBanks(new Map([[source, bindings]]), 256);
  expect(banks.arrays).toHaveLength(1);
  expect(banks.arrays[0].format).toBe(T.RED_RGTC1_Format);
  expect(banks.arrays[0].image.depth).toBe(2);
  for (const [original, value] of [
    [ao, 21],
    [mask, 87],
  ] as const) {
    const bank = banks.bindings.get(original.uuid)!;
    for (let mip = 0; mip < 2; mip++) {
      const data = bank.texture.mipmaps[mip].data as Uint8Array,
        length = mip === 0 ? 32 : 8;
      expect(data.slice(bank.layer * length, (bank.layer + 1) * length)).toEqual(
        new Uint8Array(length).fill(value),
      );
    }
  }
  const clamped = { ...source, IntParams: { g_nTextureAddressModeU: 2 } };
  const clampBindings = createParallaxTextureBindings(clamped, originals);
  const isolated = createParallaxTextureBanks(new Map([[clamped, clampBindings]]), 256);
  expect(isolated.arrays).toHaveLength(0);
  expect(clampBindings.get("g_tAmbientOcclusion")).toBe(ao);
  expect(clampBindings.get("g_tLayer0Mask")?.wrapS).toBe(T.ClampToEdgeWrapping);
  [...banks.arrays, ...originals.values()].forEach((texture) => texture.dispose());
});

test("parallax bank reads preserve independent UV and authored bias arguments", async () => {
  const { createParallaxTextureBindings, createParallaxTextureBanks } =
    await import("./native-map-parallax");
  const texture = (value: number) => {
    const t = new T.DataTexture(new Uint8Array([value, 0, 0, 255]), 1, 1);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  };
  const originals = new Map(
    Object.values(material.textures).map((name, i) => [name, texture(i * 30)]),
  );
  const views = createParallaxTextureBindings(material, originals),
    banks = createParallaxTextureBanks(new Map([[material, views]]), 256),
    lookup = new T.DataTexture();
  const shader = {
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as T.WebGLProgramParametersWithUniforms;
  applyParallaxShader(
    shader,
    material,
    views,
    new Map(),
    new T.Color(1, 1, 1),
    lookup,
    1,
    0,
    banks.bindings,
  );
  expect(
    Object.keys(shader.uniforms).filter((name) => name.startsWith("sourceParallaxBank")),
  ).toHaveLength(1);
  expect(shader.fragmentShader).toContain(
    "sourceParallaxLayer1ArrayRead(sourceParallaxUV1,sourceParallaxBlur1)",
  );
  expect(shader.fragmentShader).toContain(
    "sourceParallaxLayer2ArrayRead(sourceParallaxUV2,sourceParallaxBlur2)",
  );
  expect(shader.fragmentShader).toContain("vec4 sourceParallaxAOArrayRead(vec2 uv)");
  [...originals.values(), ...banks.arrays, lookup].forEach((t) => t.dispose());
});

test("final parallax budget rejects incomplete scene capacity with private diagnostic detail", async () => {
  const { assertNativeParallaxSamplerBudget, createParallaxTextureBindings } =
    await import("./native-map-parallax");
  const textures = new Map(Object.values(material.textures).map((id) => [id, new T.DataTexture()]));
  const lookup = new T.DataTexture();
  const bundle = {
    materials: { authored: material },
    textures,
    lookup,
    cubes: new Map(),
    cubeInfo: {},
    materialTextures: new Map([[material, createParallaxTextureBindings(material, textures)]]),
  } as unknown as Parameters<typeof assertNativeParallaxSamplerBudget>[1];
  const renderer = { capabilities: { maxTextures: 16 } } as T.WebGLRenderer;
  const admitted = assertNativeParallaxSamplerBudget(renderer, bundle, 8);
  expect(admitted[0].samplers).toBe(15);
  let failure: unknown;
  try {
    assertNativeParallaxSamplerBudget(renderer, bundle, 10);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).not.toContain(material.nativeResource);
  expect((failure as Error).cause).toEqual({
    nativeResource: material.nativeResource,
    requiredSamplers: 17,
    maxSamplers: 16,
  });
  for (const texture of [...textures.values(), lookup]) texture.dispose();
});
