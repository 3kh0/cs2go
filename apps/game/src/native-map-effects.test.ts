import { expect, test } from "vitest";
import * as T from "three";
import { prepareNativeMapEffectOutput, validateNativeMapEffect } from "./native-map-effects";
import { createNativeSkyEffect, type NativeSkyEffectParameters } from "./native-sky-clouds";
const source: NativeSkyEffectParameters = {
  IntParams: { F_DEPTH_FEATHER: 1 },
  FloatParams: { g_flFeatherDistance: 8 },
  VectorParams: {},
  TextureParams: { g_tColor: "color", g_tMask1: "mask", g_tMask2: "mask", g_tMask3: "mask" },
};
test("native main effects reject unsupported flags or missing source samplers", () => {
  expect(() => validateNativeMapEffect(source)).not.toThrow();
  expect(() =>
    validateNativeMapEffect({ ...source, IntParams: { F_TEXTURE_ANIMATION: 1 } }),
  ).toThrow("F_TEXTURE_ANIMATION");
  expect(() =>
    validateNativeMapEffect({ ...source, TextureParams: { g_tColor: "color" } }),
  ).toThrow("g_tMask1");
});
test("main effects retain native feather units and use map output/fog transport with viewport-relative depth", () => {
  const color = new T.Texture(),
    mask = new T.Texture(),
    depth = new T.DepthTexture(1, 1),
    base = new T.MeshStandardMaterial();
  const material = createNativeSkyEffect(
    base,
    source,
    new Map([
      ["color", color],
      ["mask", mask],
    ]),
    {
      time: { value: 0 },
      depth: { value: depth },
      resolution: { value: new T.Vector2(800, 600) },
      inverseProjection: { value: new T.Matrix4() },
      viewportOrigin: { value: new T.Vector2(40, 0) },
      sourceScale: 1,
    },
  );
  expect(material.uniforms.featherDistance.value).toBeCloseTo(8 * 0.0254);
  expect(material.fragmentShader).toContain("gl_FragCoord.xy-viewportOrigin");
  prepareNativeMapEffectOutput(material, true);
  expect(material.toneMapped).toBe(true);
  expect(material.fog).toBe(true);
  expect(material.fragmentShader).toContain("#include <colorspace_fragment>");
  expect(material.fragmentShader).toContain("#include <fog_fragment>");
  expect(material.vertexShader).toContain("mvPosition");
  expect(material.uniforms.fogColor).not.toBe(T.UniformsLib.fog.fogColor);
  expect(material.uniforms.sourceFogSky).toBeUndefined();
  material.dispose();
  base.dispose();
  color.dispose();
  mask.dispose();
  depth.dispose();
});
