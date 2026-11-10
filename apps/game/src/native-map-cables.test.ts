import { expect, test, vi } from "vitest";
import * as T from "three";
import { applySourceDepth, copySourceDepth } from "./source-depth";
import reference from "./fixtures/native-cable-reference.json";
import {
  applyNativeMapCables,
  sourceCableClampDefault,
  sourceCableViewScale,
  sourceCableWidth,
} from "./native-map-cables";

function fixture() {
  const root = new T.Group();
  const geometry = new T.PlaneGeometry(1, 1);
  geometry.setAttribute("_cable_center", geometry.getAttribute("position").clone());
  geometry.setAttribute("_cable_radius", new T.Float32BufferAttribute([0.02, 0.02, 0.02, 0.02], 1));
  geometry.setAttribute(
    "_cable_raw_color",
    new T.Float32BufferAttribute(
      Array.from({ length: 12 }, () => 1),
      3,
    ),
  );
  const material = new T.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  material.vertexColors = true;
  material.userData = {
    nativeCableBridgeVersion: 1,
    nativeShader: "cables.vfx",
    nativeMaterialName: "materials/cable/csgo_placeholder_cable.vmat",
    nativeIntParams: { F_CLAMP_MIN_RADIUS: 1, g_bFogEnabled: 1 },
    sourceTextureConstantProof: {
      g_tNormal: { constantRGBA8: [128, 128, 255, 255] },
      g_tColor: { constantRGBA8: [129, 129, 129, 0] },
      g_tAmbientOcclusion: { constantRGBA8: [255, 255, 255, 255] },
    },
  };
  const mesh = new T.Mesh(geometry, material);
  root.add(mesh);
  return { root, geometry, material, mesh, lookup: new T.DataTexture() };
}
function shader() {
  return {
    uniforms: {},
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
    defines: {},
  } as T.WebGLProgramParametersWithUniforms;
}
test("independent recovered-program float32 controls include boundary and alpha floor", () => {
  for (const row of reference.cases)
    expect(sourceCableWidth(row.physicalRadius, row.viewDepth, row.suppliedUniform)).toEqual({
      radius: row.expandedRadius,
      coverage: row.coverageAlphaScale,
    });
  for (const row of reference.nativeWriterVectors) {
    const actual = sourceCableViewScale(row.nativeAngleField, row.nativePackedDimensionField);
    expect(actual).toBe(row.uniform);
    expect(Math.abs(actual - row.independentSeriesReference)).toBeLessThan(1e-9);
  }
});
test("native registered clamp and recovered writer keep division inside tangent", () => {
  expect(sourceCableClampDefault).toBe(1.2000000476837158);
  expect(sourceCableViewScale(90, 1080)).toBeCloseTo(0.001745330635458231, 10);
  expect(sourceCableWidth(0.5, 1024, sourceCableViewScale(90, 1080)).radius).toBeCloseTo(
    1.7872185707092285,
    6,
  );
  expect(sourceCableWidth(0.5, 1024, sourceCableViewScale(90, 2160)).radius).toBeCloseTo(
    0.893608808517456,
    6,
  );
  const conventional = (sourceCableClampDefault * 2 * Math.tan(Math.PI / 4)) / 1080;
  expect(Math.abs(sourceCableViewScale(90, 1080) - conventional)).toBeGreaterThan(0.0004);
});
test("native radius law uses absolute view depth and retains its quarter coverage floor", () => {
  const k = sourceCableViewScale(90, 1080);
  expect(sourceCableWidth(0.5, -1024, k)).toEqual(sourceCableWidth(0.5, 1024, k));
  expect(sourceCableWidth(0.5, 16384, k).coverage).toBe(0.25);
  expect(sourceCableWidth(2, 1, k)).toEqual({ radius: 2, coverage: 1 });
  expect(sourceCableWidth(0.5, 1024, 0)).toEqual({ radius: 0.5, coverage: 1 });
  expect(() => sourceCableViewScale(90, 0)).toThrow();
  expect(() => sourceCableWidth(0, 1, k)).toThrow();
});
test("clamped opaque stays in opaque HDR/depth queue with native alpha blending", () => {
  const f = fixture();
  const view = applyNativeMapCables(f.root, f.lookup);
  expect(view.materials).toBe(1);
  expect(f.material.transparent).toBe(false);
  expect(f.material.depthWrite).toBe(true);
  expect(f.material.blending).toBe(T.CustomBlending);
  expect(f.material.blendSrc).toBe(T.SrcAlphaFactor);
  expect(f.material.blendSrcAlpha).toBe(T.SrcAlphaFactor);
  expect(f.material.blendDst).toBe(T.OneMinusSrcAlphaFactor);
  const compiled = shader();
  f.material.onBeforeCompile(compiled, {} as T.WebGLRenderer);
  const camera = new T.PerspectiveCamera(75, 1, 0.1, 100);
  view.update(camera, 1080);
  const scale = compiled.uniforms.nativeCablePixelScale;
  expect(scale.value).toBeGreaterThan(0);
  camera.zoom = 2;
  camera.updateProjectionMatrix();
  view.update(camera, 1080);
  expect(compiled.uniforms.nativeCablePixelScale).toBe(scale);
  expect(scale.value).toBeLessThan(sourceCableViewScale(75, 1080));
});
test("lighting/reflection material clones retain cable expansion in smoke and shadow depth", () => {
  const f = fixture();
  const view = applyNativeMapCables(f.root, f.lookup);
  const clone = copySourceDepth(f.material, f.material.clone());
  const depth = new T.MeshDepthMaterial();
  expect(applySourceDepth(clone, depth)).toBe(true);
  const compiled = shader();
  depth.onBeforeCompile(compiled, {} as T.WebGLRenderer);
  view.setNativeViewInputs(90, 1080);
  expect(compiled.uniforms.nativeCablePixelScale.value).toBe(sourceCableViewScale(90, 1080));
  expect(compiled.vertexShader).toContain("abs((modelViewMatrix*vec4(_cable_center,1.)).z)");
  expect(f.mesh.customDepthMaterial).toBeDefined();
  expect(f.mesh.customDistanceMaterial).toBeDefined();
});
test("invalid later sidecar stream rejects admission before changing an earlier material", () => {
  const f = fixture();
  const original = Reflect.get(f.material, "onBeforeCompile");
  const broken = f.geometry.clone();
  broken.deleteAttribute("_cable_radius");
  f.root.add(new T.Mesh(broken, f.material));
  expect(() => applyNativeMapCables(f.root, f.lookup)).toThrow("stream missing");
  expect(Reflect.get(f.material, "onBeforeCompile")).toBe(original);
  expect(f.mesh.customDepthMaterial).toBeUndefined();
});
test("view disposal preserves map-owned geometry/materials and shared lookup", () => {
  const f = fixture();
  const spies = [f.geometry, f.material, f.lookup].map((x) => vi.spyOn(x, "dispose"));
  const view = applyNativeMapCables(f.root, f.lookup);
  view.dispose();
  view.dispose();
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});
