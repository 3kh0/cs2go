import { expect, test } from "vitest";
import * as T from "three";
import {
  registerActorLighting,
  updateActorLighting,
  releaseActorLightingMaterials,
} from "./actor-lighting";

test("shared hands keep independent actor uniforms and nested cosmetic registration injects once", () => {
  const source = new T.MeshStandardMaterial();
  const roots = [new T.Group(), new T.Group()];
  for (const root of roots) root.add(new T.Mesh(new T.BoxGeometry(), source));
  registerActorLighting(roots[0]);
  registerActorLighting(roots[1]);
  const first = (roots[0].children[0] as T.Mesh).material as T.MeshStandardMaterial;
  const second = (roots[1].children[0] as T.Mesh).material as T.MeshStandardMaterial;
  expect(first).not.toBe(second);
  const arms = new T.Group();
  roots[1].add(arms);
  arms.add(new T.Mesh(new T.BoxGeometry(), second));
  registerActorLighting(arms);
  const compile = (material: T.Material) => {
    const shader = {
      uniforms: {},
      fragmentShader: "#include <common>\n#include <lights_fragment_begin>",
      vertexShader: "",
    } as T.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as T.WebGLRenderer);
    expect(shader.fragmentShader.match(/uniform float sourceActorProbeEnabled/g)).toHaveLength(1);
    return shader.uniforms.sourceActorProbeEnabled;
  };
  const a = compile(first),
    b = compile(second);
  expect(a).not.toBe(b);
  updateActorLighting(
    roots[1],
    { x: 0, y: 0, z: 0 },
    (_p, _n, out) => {
      out.setRGB(0.2, 0.3, 0.4);
      return true;
    },
    1 / 60,
  );
  expect(a.value).toBe(0);
  expect(b.value).toBe(1);
  releaseActorLightingMaterials(arms, arms);
  registerActorLighting(arms);
  compile((arms.children[0] as T.Mesh).material as T.Material);
});
