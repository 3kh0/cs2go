import { expect, test, vi } from "vitest";
import * as T from "three";
import {
  applySourceDepth,
  copySourceDepth,
  installSourceShadowDepth,
  registerSourceDepth,
} from "./source-depth";

test("source coverage survives explicit material cloning and all depth consumers without stacking transforms", () => {
  const source = new T.MeshStandardMaterial(),
    target = copySourceDepth(source, source.clone());
  expect(applySourceDepth(target, new T.MeshDepthMaterial())).toBe(false);
  const native = vi.fn((shader: T.WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader += "\nnativeCoverage";
  });
  registerSourceDepth(source, { cacheKey: "native-alpha-bank-layout", apply: native });
  copySourceDepth(source, target);
  const smoke = new T.MeshDepthMaterial({ colorWrite: false }),
    prior = vi.fn();
  smoke.onBeforeCompile = prior;
  expect(applySourceDepth(target, smoke)).toBe(true);
  const key = smoke.customProgramCacheKey();
  applySourceDepth(target, smoke);
  expect(smoke.customProgramCacheKey()).toBe(key);
  const shader = {
    vertexShader: "vertex",
    fragmentShader: "fragment",
    uniforms: {},
  } as T.WebGLProgramParametersWithUniforms;
  smoke.onBeforeCompile(shader, {} as T.WebGLRenderer);
  expect(prior).toHaveBeenCalledTimes(1);
  expect(native).toHaveBeenCalledTimes(1);
  expect(shader.fragmentShader).toBe("fragment\nnativeCoverage");
  expect(smoke.colorWrite).toBe(false);
  const mesh = new T.Mesh(new T.PlaneGeometry(), target);
  expect(installSourceShadowDepth(mesh)).toBe(true);
  expect(mesh.customDepthMaterial).toBeInstanceOf(T.MeshDepthMaterial);
  expect(mesh.customDistanceMaterial).toBeInstanceOf(T.MeshDistanceMaterial);
  const same = new T.Mesh(mesh.geometry, target);
  installSourceShadowDepth(same);
  expect(same.customDepthMaterial).toBe(mesh.customDepthMaterial);
  mesh.geometry.dispose();
  source.dispose();
  target.dispose();
  smoke.dispose();
  mesh.customDepthMaterial?.dispose();
  mesh.customDistanceMaterial?.dispose();
});
test("a mixed native alpha contract cannot silently become a solid shared shadow batch", () => {
  const native = new T.MeshStandardMaterial(),
    opaque = new T.MeshStandardMaterial();
  registerSourceDepth(native, { cacheKey: "native-cutout", apply: () => {} });
  const mesh = new T.Mesh(new T.PlaneGeometry(), [opaque, native]);
  expect(() => installSourceShadowDepth(mesh)).toThrow("Mixed native alpha depth batch");
  mesh.geometry.dispose();
  native.dispose();
  opaque.dispose();
});
