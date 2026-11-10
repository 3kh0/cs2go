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
