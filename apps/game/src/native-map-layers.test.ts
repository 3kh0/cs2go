import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import * as T from "three";
import { applyNativeMapLayers } from "./native-map-layers";
import type { SourceLayerMaterial } from "./source-layers";

const source = JSON.parse(
  readFileSync(
    new URL(
      "../../../packages/assets/public/models/maps/mirage-materials/layers/source.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { materials: Record<string, SourceLayerMaterial> };

function compileLayer(flags: { specularDirect?: boolean; specularIndirect: boolean }) {
  const native = { ...Object.values(source.materials)[0], ...flags };
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute("color_1", new T.Float32BufferAttribute([0, 0, 0, 0], 4));
  const material = new T.MeshStandardMaterial({ map: new T.Texture() });
  material.name = "native layer";
  const mesh = new T.Mesh(geometry, material);
  const lookup = native.specularIndirect ? new T.DataTexture() : undefined;
  const textures = new Map(
    [native.normal1, native.normal2, native.color2, native.mask, native.detail?.texture]
      .filter((key): key is string => !!key)
      .map((key) => [key, new T.Texture()]),
  );
  applyNativeMapLayers(mesh, { materials: { [material.name]: native }, textures, lookup });
  const shader = {
    uniforms: {},
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  } as T.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  const key = material.customProgramCacheKey();
  geometry.dispose();
  material.map?.dispose();
  material.dispose();
  lookup?.dispose();
  textures.forEach((texture) => texture.dispose());
  return { shader, key };
}

test("native map layers preserve historical Mirage diffuse-only flags", () => {
  expect(Object.values(source.materials).every((material) => !material.specularIndirect)).toBe(
    true,
  );
  const { shader } = compileLayer({ specularIndirect: false });
  expect(shader.uniforms.sourceSurfaceLookup).toBeUndefined();
  expect(shader.fragmentShader).not.toContain("reflectedLight.directSpecular +=");
  expect(shader.fragmentShader).not.toContain("RE_IndirectSpecular_SourceSurface");
});

test("native map layer specular flags retain direct and indirect lobes independently", () => {
  const direct = compileLayer({ specularDirect: true, specularIndirect: false });
  expect(direct.shader.fragmentShader).toContain("reflectedLight.directSpecular +=");
  expect(direct.shader.uniforms.sourceSurfaceLookup).toBeUndefined();
  const indirect = compileLayer({ specularDirect: false, specularIndirect: true });
  expect(indirect.shader.fragmentShader).not.toContain("reflectedLight.directSpecular +=");
  expect(indirect.shader.fragmentShader).toContain("RE_IndirectSpecular_SourceSurface");
  expect(indirect.shader.uniforms.sourceSurfaceLookup.value).toBeInstanceOf(T.DataTexture);
  expect(indirect.key).not.toBe(direct.key);
});
