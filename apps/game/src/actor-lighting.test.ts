import { expect, test, vi } from "vitest";
import * as T from "three";
import {
  registerActorLighting,
  updateActorLighting,
  releaseActorLightingMaterials,
  setActorReflection,
} from "./actor-lighting";
import * as gpu from "./source-gpu-probes";
import { sampleSourceProbe } from "./source-lighting";
import { readFileSync } from "node:fs";
import { sourceReflectionCandidates, type SourceReflections } from "./source-reflections";

function probes(count: number): gpu.SourceGpuProbes {
  return {
    count,
    depth: 4,
    textures: [new T.DataArrayTexture(), new T.DataArrayTexture()],
    frames: Array.from({ length: 8 }, () => new Float32Array(count * 3)),
    sky: Array.from({ length: 3 }, () => new T.Vector4()),
  };
}

function compileActor(material: T.Material) {
  const shader = {
    uniforms: {},
    fragmentShader:
      "#include <common>\n#include <lights_fragment_begin>\n#include <lights_fragment_maps>\n#include <lights_fragment_end>",
    vertexShader: "",
  } as T.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  return shader;
}

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

test("map-owned actor LPVs switch after registration without leaking Dust II probes or effects", () => {
  const dust = probes(43),
    mirage = probes(58),
    replacement = probes(58);
  const lookup = vi.spyOn(gpu, "sourceGpuProbes").mockReturnValue(dust);
  try {
    const material = new T.MeshStandardMaterial();
    const root = new T.Group();
    root.add(new T.Mesh(new T.BoxGeometry(), material));
    registerActorLighting(root);
    expect(compileActor(material).uniforms.sourceGpuAtlas0.value).toBe(dust.textures[0]);
    const originalKey = material.customProgramCacheKey();
    const version = material.version;
    const position = new T.Vector3(-13, -3, 34);
    const rotation = new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationY(0.8));
    updateActorLighting(root, position, undefined, 1 / 60, rotation, undefined, undefined, mirage);
    const shader = compileActor(material);
    expect(material.version).toBeGreaterThan(version);
    expect(material.customProgramCacheKey()).not.toBe(originalKey);
    expect(shader.fragmentShader).toContain("sourceGpuFrame0[58]");
    expect(shader.uniforms.sourceGpuAtlas0.value).toBe(mirage.textures[0]);
    expect(shader.uniforms.sourceGpuFrame0.value).toBe(mirage.frames[0]);
    expect(shader.uniforms.sourceActorProbeEnabled.value).toBe(1);
    expect(shader.uniforms.sourceActorGpuEnabled.value).toBe(1);
    expect(shader.uniforms.sourceActorWorldEnabled.value).toBe(1);
    expect(shader.uniforms.sourceActorDustEnabled.value).toBe(0);
    expect(shader.uniforms.sourceActorLocalFrame.value).toBe(1);
    expect(shader.uniforms.sourceActorProbeRotation.value).toEqual(rotation);
    expect(shader.uniforms.sourceActorProbeOrigin.value).toEqual(position);

    const mirageKey = material.customProgramCacheKey();
    updateActorLighting(
      root,
      position,
      undefined,
      1 / 60,
      rotation,
      undefined,
      undefined,
      replacement,
    );
    expect(material.customProgramCacheKey()).not.toBe(mirageKey);
    expect(compileActor(material).uniforms.sourceGpuAtlas0.value).toBe(replacement.textures[0]);

    // Unsupported native-map devices must not use the preloaded Dust atlas.
    updateActorLighting(root, position, undefined, 1 / 60, rotation, undefined, undefined, null);
    const fallback = compileActor(material);
    expect(fallback.uniforms.sourceGpuAtlas0).toBeUndefined();
    expect(fallback.uniforms.sourceActorGpuEnabled.value).toBe(0);
    expect(fallback.uniforms.sourceActorDustEnabled.value).toBe(0);

    updateActorLighting(root, position, sampleSourceProbe, 1 / 60);
    const restored = compileActor(material);
    updateActorLighting(root, position, sampleSourceProbe, 1 / 60);
    expect(restored.uniforms.sourceGpuAtlas0.value).toBe(dust.textures[0]);
    expect(restored.uniforms.sourceActorGpuEnabled.value).toBe(1);
    expect(restored.uniforms.sourceActorDustEnabled.value).toBe(1);
    expect(restored.fragmentShader).toContain("sourceGpuFrame0[43]");
  } finally {
    lookup.mockRestore();
  }
});

test("pending native reflections suppress studio highlights and restore originals only when inactive", () => {
  const studio = new T.Texture(),
    local = new T.Texture();
  const material = new T.MeshStandardMaterial({ envMap: studio, envMapIntensity: 1.2 });
  material.envMapRotation.set(0.2, 0.4, 0.6);
  const originalRotation = material.envMapRotation.clone();
  const root = new T.Group();
  root.add(new T.Mesh(new T.BoxGeometry(), material));
  registerActorLighting(root);
  setActorReflection(root, null);
  expect(material.envMap).toBeNull();
  expect(material.envMapIntensity).toBe(0);
  setActorReflection(root, local);
  expect(material.envMap).toBe(local);
  expect(material.envMapIntensity).toBe(1);
  setActorReflection(root);
  expect(material.envMap).toBe(studio);
  expect(material.envMapIntensity).toBe(1.2);
  expect(material.envMapRotation).toEqual(originalRotation);
});

test("native actor reflections use world-frame box bindings and cannot restore the studio map during cleanup", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL(
        "../../../packages/assets/public/models/maps/mirage-lighting/reflections/source.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { volumes: SourceReflections["volumes"] };
  const reflections: SourceReflections = {
    textures: [
      new T.CompressedArrayTexture([], 4, 4, 6, T.RGB_BPTC_UNSIGNED_Format),
      new T.CompressedArrayTexture([], 4, 4, 6, T.RGB_BPTC_UNSIGNED_Format),
    ],
    volumes: manifest.volumes,
    uniforms: manifest.volumes.map((volume) => ({
      origin: new T.Vector3().fromArray(volume.origin),
      index: volume.index,
      mins: new T.Vector3().fromArray(volume.min),
      maxs: new T.Vector3().fromArray(volume.max),
      invEdge: new T.Vector3(
        ...(volume.fade.map((value) => (value > 0 ? 1 / value : 3.402823466e38)) as [
          number,
          number,
          number,
        ]),
      ),
      sh: new T.Vector4().fromArray(volume.normalizationSH),
    })),
  };
  const studio = new T.Texture();
  const material = new T.MeshStandardMaterial({ envMap: studio, envMapIntensity: 1.2 });
  const root = new T.Group();
  root.add(new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.5), material));
  registerActorLighting(root);
  const rotation = new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationY(0.8));
  const outdoors = new T.Vector3(-10, -4.5, 55);
  const atlas = probes(58);
  updateActorLighting(
    root,
    outdoors,
    undefined,
    1 / 60,
    rotation,
    undefined,
    undefined,
    atlas,
    reflections,
  );
  const key = material.customProgramCacheKey();
  const shader = compileActor(material);
  expect(shader.fragmentShader).toContain("sourceEnvironments[8]");
  expect(shader.fragmentShader).toContain("sourceActorProbeOrigin+sourceActorProbeRotation");
  expect(shader.fragmentShader).toContain(
    "sourceActorProbeRotation*inverseTransformDirection(geometryNormal",
  );
  expect(material.envMap).toBeNull();
  setActorReflection(root);
  expect(material.envMap).toBeNull();
  expect(material.envMapIntensity).toBe(0);
  const count = shader.uniforms.sourceEnvironmentCount.value as number;
  const records = shader.uniforms.sourceEnvironments.value as SourceReflections["uniforms"];
  const candidates = sourceReflectionCandidates(
    new T.Box3().setFromCenterAndSize(outdoors, new T.Vector3(0.5, 0.5, 0.5)),
    reflections,
  );
  expect(candidates.length).toBeGreaterThan(0);
  for (const index of candidates)
    expect(records.slice(0, count).map((record) => record.index)).toContain(
      reflections.volumes[index].index,
    );
  const firstIndices = records.slice(0, count).map((record) => record.index);
  const underpass = new T.Vector3(-26.2763, -9.2456, 4.06388);
  // Keep the same LPV object while moving: only selected reflection uniforms change.
  updateActorLighting(
    root,
    underpass,
    undefined,
    1,
    rotation,
    undefined,
    undefined,
    atlas,
    reflections,
  );
  updateActorLighting(
    root,
    underpass,
    undefined,
    1 / 60,
    rotation,
    undefined,
    undefined,
    atlas,
    reflections,
  );
  expect(material.customProgramCacheKey()).toBe(key);
  const indoorCount = shader.uniforms.sourceEnvironmentCount.value as number;
  expect(records.slice(0, indoorCount).map((record) => record.index)).not.toEqual(firstIndices);
  expect(indoorCount).toBeGreaterThan(0);
  expect(indoorCount).toBeLessThanOrEqual(8);
  for (const index of sourceReflectionCandidates(
    new T.Box3().setFromCenterAndSize(underpass, new T.Vector3(0.5, 0.5, 0.5)),
    reflections,
  ))
    expect(records.slice(0, indoorCount).map((record) => record.index)).toContain(
      reflections.volumes[index].index,
    );
  updateActorLighting(root, underpass, undefined, 1 / 60);
  expect(material.envMap).toBe(studio);
});
