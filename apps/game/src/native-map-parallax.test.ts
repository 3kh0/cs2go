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
