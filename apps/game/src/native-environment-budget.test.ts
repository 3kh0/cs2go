import { expect, test } from "vitest";
import * as T from "three";
import { assertNativeEnvironmentBudget } from "./native-environment-budget";
import type { loadNativeMapEnvironment } from "./native-map-environment";
import type { SourceReflections } from "./source-reflections";
import type { SourceGpuProbes } from "./source-gpu-probes";
import type { NativeMapFog } from "./native-map-fog";

function bundle() {
  return {
    materials: {
      fixture: {
        shader: "csgo_environment.vfx",
        nativeResource: "budget-fixture.vmat",
        IntParams: {},
        FloatParams: {},
        VectorParams: {},
        textures: { g_tColor1: "color", g_tHeight1: "height", g_tNormal1: "normal" },
        textureReflectivity: { g_tColor1: [0.5, 0.5, 0.5] },
        nativeTextureDimensions: { g_tColor1: [1, 1], g_tHeight1: [1, 1], g_tNormal1: [1, 1] },
      },
    },
    textures: new Map(["color", "height", "normal"].map((key) => [key, new T.Texture()])),
    lookup: new T.DataTexture(),
    time: { value: 0 },
  } as unknown as Awaited<ReturnType<typeof loadNativeMapEnvironment>>;
}
const renderer = (samplers: number, uniforms = 1024) =>
  ({ capabilities: { maxTextures: samplers, maxFragmentUniforms: uniforms } }) as T.WebGLRenderer;
const reflections = (combined: boolean, affine = false) =>
  ({
    combined,
    textures: Array.from(
      { length: combined ? 1 : 2 },
      () => new T.CompressedArrayTexture([], 1, 1, 6, T.RGBA_BPTC_Format),
    ),
    volumes: [{ worldToLocal: affine ? new T.Matrix4().toArray() : undefined }],
  }) as SourceReflections;

test("final ENV budget uses resolved cube and fog resources and rejects the extra sampler", () => {
  const data = bundle(),
    fog = { cube: new T.Texture() } as NativeMapFog;
  const one = assertNativeEnvironmentBudget(renderer(12), data, {
    reflections: reflections(true),
    fog,
  });
  expect(one.reservedSamplers).toBe(9);
  expect(one.materials[0].samplers).toBe(12);
  expect(() =>
    assertNativeEnvironmentBudget(renderer(11), data, { reflections: reflections(true), fog }),
  ).toThrow("sampler budget");
  expect(() =>
    assertNativeEnvironmentBudget(renderer(12), data, { reflections: reflections(false), fog }),
  ).toThrow("sampler budget");
});

test("final ENV uniform guard retains full LPVs and the complete affine reflection window", () => {
  const data = bundle();
  const plain = assertNativeEnvironmentBudget(renderer(16), data, {
    reflections: reflections(true),
  });
  const affine = assertNativeEnvironmentBudget(renderer(16), data, {
    reflections: reflections(true, true),
  });
  expect(
    affine.materials[0].fragmentUniformVectors - plain.materials[0].fragmentUniformVectors,
  ).toBe(64);
  const probes = {
    count: 116,
    frames: [],
    packedFrames: { values: new Float32Array(116 * 6 * 4), rotations: new Float32Array(42 * 4) },
  } as unknown as SourceGpuProbes;
  const supported = assertNativeEnvironmentBudget(renderer(16), data, {
    reflections: reflections(true, true),
    probes,
  });
  expect(supported.probeVectors).toBe(738);
  expect(() =>
    assertNativeEnvironmentBudget(
      renderer(16, supported.materials[0].fragmentUniformVectors - 1),
      data,
      { reflections: reflections(true, true), probes },
    ),
  ).toThrow("uniform budget");
  expect(probes.count).toBe(116);
  expect(probes.packedFrames?.values.length).toBe(116 * 6 * 4);
});
