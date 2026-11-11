import { describe, expect, it, vi } from "vitest";
import * as T from "three";
import { createEnvironmentWorldFrame } from "./native-environment-frame";
import {
  applyNativeMapFoliage,
  validateNativeFoliageMaterial,
  type NativeFoliageMaterial,
} from "./native-map-foliage";
const source = (): NativeFoliageMaterial => ({
  shader: "csgo_foliage.vfx",
  nativeResource: "synthetic-admission.vmat",
  IntParams: {
    F_VERTEX_ANIMATION: 1,
    F_ALPHA_TEST: 1,
    F_RENDER_BACKFACES: 1,
    F_TRANSMISSIVE_BACKFACE_NDOTL: 1,
  },
  FloatParams: Object.fromEntries(
    [
      "g_flAlphaTestReference",
      "g_flAlphaBoostDistance",
      "g_flAlphaBoostStrength",
      "g_flGrazingAngleMask",
      "g_flVertexAmbientOcclusionAmount",
      "g_flVertexAmbientOcclusionPower",
      "g_flHeightGradientAmount",
      "g_flHeightGradientPower",
      "g_flReflectance",
      "g_fTextureNormalContrast",
      "g_fTextureRoughnessContrast",
      "g_fTextureRoughnessBrightness",
      "g_flSwayAmount",
      "g_flSwaySpeed",
      "g_flSwayNoiseScale",
      "g_flSwayFalloff",
      "g_flFlutterAmount",
      "g_flFlutterSpeed",
      "g_flFlutterNoiseScale",
      "g_flFlutterFalloff",
    ].map((name) => [name, name === "g_flHeightGradientAmount" ? 0 : 1]),
  ),
  VectorParams: {},
  textures: {},
  resolvedMaterialInputs: {
    g_bDontFlipBackfaceNormals: 0,
    g_bRenderBackfaceNormals: 1,
    g_bTransmissiveShadows: 1,
    g_bApplyColorCorrectionToTransmissiveColor: 0,
    g_vTexCoordXform0: [1, 0, 0, 0],
    g_vTexCoordXform1: [0, 1, 0, 0],
    g_vTexCoordScrollSpeed: [0, 0, 0, 0],
  },
});
describe("native foliage admission", () => {
  it("rejects animation branches outside the demonstrated source programs", () => {
    const x = source();
    expect(() => validateNativeFoliageMaterial(x)).not.toThrow();
    x.IntParams.F_VERTEX_ANIMATION = 3;
    expect(() => validateNativeFoliageMaterial(x)).toThrow(/animation selection/);
  });
  it("admits proved bare0 without requiring mode1 fields and rejects unresolved mode2 fields", () => {
    const x = source();
    x.IntParams = {};
    x.resolvedMaterialInputs.g_bRenderBackfaceNormals = 0;
    delete x.FloatParams.g_flSwaySpeed;
    expect(() => validateNativeFoliageMaterial(x)).not.toThrow();
    x.IntParams.F_VERTEX_ANIMATION = 2;
    expect(() => validateNativeFoliageMaterial(x)).toThrow(/g_flNoise1Strength/);
  });
  it("does not silently replace authored brightness with identity", () => {
    const x = source();
    x.FloatParams.g_fTextureColorBrightness = 1.2;
    expect(() => validateNativeFoliageMaterial(x)).toThrow(/explicit qualified color matrix/);
    x.colorCorrectionMatrix = [1.2, 0, 0, 0, 1.2, 0, 0, 0, 1.2];
    expect(() => validateNativeFoliageMaterial(x)).not.toThrow();
  });
  it("rejects absent native defaults and unsupported UV/face selections", () => {
    const x = source();
    delete x.FloatParams.g_flReflectance;
    expect(() => validateNativeFoliageMaterial(x)).toThrow(/g_flReflectance/);
    const y = source();
    y.resolvedMaterialInputs.g_vTexCoordXform0 = [2, 0, 0, 0];
    expect(() => validateNativeFoliageMaterial(y)).toThrow(/affine UV/);
    const z = source();
    z.resolvedMaterialInputs.g_bTransmissiveShadows = 0;
    expect(() => validateNativeFoliageMaterial(z)).toThrow(/transmission selection/);
  });
});

it("shares one owned coverage material across source instances and preserves no-cast policy after broad setup", () => {
  const definition = source();
  definition.IntParams.F_USE_ALBEDO_FOR_TRANSMISSIVE = 1;
  definition.IntParams.F_DO_NOT_CAST_SHADOWS = 1;
  definition.textures = { g_tColor: "color", g_tNormal: "normal", g_tAmbientOcclusion: "ao" };
  const root = new T.Group(),
    geometry = new T.PlaneGeometry();
  geometry.computeTangents();
  geometry.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(16).fill(1), 4));
  const material = new T.MeshStandardMaterial();
  material.name = "leaf";
  const a = new T.Mesh(geometry, material),
    b = new T.Mesh(geometry, material);
  root.add(a, b);
  const noise = new T.Data3DTexture(new Uint8Array(32), 2, 2, 2);
  noise.colorSpace = T.NoColorSpace;
  const textures = new Map(
    ["color", "normal", "ao"].map((key) => [key, new T.DataTexture(new Uint8Array(4), 1, 1)]),
  );
  const lookup = new T.DataTexture(new Uint8Array(4), 1, 1);
  const view = applyNativeMapFoliage(
    root,
    {
      materials: { leaf: definition },
      textures,
      lookup,
      noise,
      source: { model: "controlled", noise: "controlled" },
    },
    { windState: { direction: [1, 0, 0], strength: 1, timeSeconds: 0 } },
  );
  expect(view.depthScene.children).toHaveLength(2);
  const depth = (view.depthScene.children[0] as T.Mesh).material;
  expect((view.depthScene.children[1] as T.Mesh).material).toBe(depth);
  a.castShadow = b.castShadow = true;
  view.applyShadowPolicy();
  expect(a.castShadow).toBe(false);
  expect(b.castShadow).toBe(false);
  let depthDisposals = 0,
    geometryDisposals = 0;
  for (const d of Array.isArray(depth) ? depth : [depth])
    d.addEventListener("dispose", () => depthDisposals++);
  geometry.addEventListener("dispose", () => geometryDisposals++);
  view.dispose();
  view.dispose();
  expect(depthDisposals).toBe(1);
  expect(geometryDisposals).toBe(0);
});

it("alpha coverage preserves Source camera distance under translated rotated sky scale", () => {
  for (const scale of [1, 16]) {
    const definition = source();
    definition.FloatParams.g_flAlphaBoostDistance = 20000;
    definition.IntParams.F_USE_ALBEDO_FOR_TRANSMISSIVE = 1;
    definition.textures = { g_tColor: "color", g_tNormal: "normal", g_tAmbientOcclusion: "ao" };
    const placement = new T.Matrix4().compose(
      new T.Vector3(11, -3, 7),
      new T.Quaternion().setFromEuler(new T.Euler(0.1, 0.7, -0.2)),
      new T.Vector3(scale, scale, scale),
    );
    const root = new T.Group(),
      geometry = new T.PlaneGeometry();
    geometry.computeTangents();
    geometry.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(16).fill(1), 4));
    const material = new T.MeshStandardMaterial();
    material.name = "leaf";
    root.add(new T.Mesh(geometry, material));
    const noise = new T.Data3DTexture(new Uint8Array(32), 2, 2, 2);
    noise.colorSpace = T.NoColorSpace;
    const textures = new Map(
      ["color", "normal", "ao"].map((key) => [key, new T.DataTexture(new Uint8Array(4), 1, 1)]),
    );
    const lookup = new T.DataTexture(new Uint8Array(4), 1, 1);
    const view = applyNativeMapFoliage(
      root,
      {
        materials: { leaf: definition },
        textures,
        noise,
        lookup,
        source: {
          model: "controlled",
          noise: "controlled",
        },
      },
      {
        sourceWorldFrame: createEnvironmentWorldFrame(placement.clone().invert()),
        windState: { direction: [1, 0, 0], strength: 0, timeSeconds: 0 },
      },
    );
    const depth = (view.depthScene.children[0] as T.Mesh).material as T.MeshDepthMaterial;
    const shader = {
      uniforms: {},
      vertexShader: T.ShaderLib.depth.vertexShader,
      fragmentShader: T.ShaderLib.depth.fragmentShader,
    } as T.WebGLProgramParametersWithUniforms;
    depth.onBeforeCompile(shader, {} as T.WebGLRenderer);
    const mesh = root.children[0] as T.Mesh,
      color = mesh.material as T.MeshStandardMaterial;
    const passes = [
      [color, T.ShaderLib.standard],
      [mesh.customDepthMaterial!, T.ShaderLib.depth],
      [mesh.customDistanceMaterial!, T.ShaderLib.distance],
    ] as const;
    expect(color.depthFunc).toBe(T.EqualDepth);
    expect(depth.depthFunc).toBe(T.LessEqualDepth);
    expect(shader.vertexShader.match(/invariant gl_Position;/g)).toHaveLength(1);
    for (const [material, template] of passes) {
      const pass = {
        uniforms: {},
        vertexShader: template.vertexShader,
        fragmentShader: template.fragmentShader,
      } as T.WebGLProgramParametersWithUniforms;
      material.onBeforeCompile(pass, {} as T.WebGLRenderer);
      expect(pass.vertexShader.match(/invariant gl_Position;/g)).toHaveLength(1);
      expect(pass.vertexShader).toContain("vec3 transformed=foliagePosition(position)");
      expect(pass.uniforms.nativeFoliageTime).toBe(shader.uniforms.nativeFoliageTime);
      expect(pass.uniforms.nativeFoliageWorldToOwn).toBe(shader.uniforms.nativeFoliageWorldToOwn);
    }

    const sourceEye = new T.Vector3(0, 0, 1200),
      sourcePoint = new T.Vector3(0, 0, 0);
    const browserEye = sourceEye.clone().multiplyScalar(0.0254).applyMatrix4(placement),
      browserPoint = sourcePoint.clone().multiplyScalar(0.0254).applyMatrix4(placement);
    const nativeFraction = sourceEye.distanceTo(sourcePoint) / 20000;
    expect(
      browserEye.distanceTo(browserPoint) /
        (shader.uniforms.nativeFoliageCoverage.value as T.Vector4).w,
    ).toBeCloseTo(nativeFraction, 12);
    expect(browserEye.distanceTo(browserPoint) / 20000).not.toBeCloseTo(nativeFraction, 3);
    view.dispose();
    geometry.dispose();
    material.dispose();
    noise.dispose();
    lookup.dispose();
    for (const t of textures.values()) t.dispose();
  }
});

it("instanced coverage follows dynamic and managed transforms, visibility, and source count bounds", () => {
  const definition = source();
  definition.IntParams.F_USE_ALBEDO_FOR_TRANSMISSIVE = 1;
  definition.textures = { g_tColor: "color", g_tNormal: "normal", g_tAmbientOcclusion: "ao" };
  const geometry = new T.PlaneGeometry();
  geometry.computeTangents();
  geometry.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(16).fill(1), 4));
  const material = new T.MeshStandardMaterial();
  material.name = "leaf";
  const mesh = new T.InstancedMesh(geometry, material, 2);
  const ancestor = new T.Group(),
    root = new T.Group();
  ancestor.add(root);
  root.add(mesh);
  ancestor.position.set(5, 6, 7);
  mesh.position.set(1, 2, 3);
  mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(3, 4, 5));
  mesh.setMatrixAt(1, new T.Matrix4().makeRotationY(0.6));
  const noise = new T.Data3DTexture(new Uint8Array(32), 2, 2, 2);
  noise.colorSpace = T.NoColorSpace;
  const lookup = new T.DataTexture(),
    textures = new Map(
      ["color", "normal", "ao"].map((k) => [k, new T.DataTexture(new Uint8Array(4), 1, 1)]),
    );
  const view = applyNativeMapFoliage(
    root,
    {
      materials: { leaf: definition },
      textures,
      lookup,
      noise,
      source: { model: "unit", noise: "unit" },
    },
    {
      windState: { direction: [1, 0, 0], strength: 0.1, timeSeconds: 0 },
      instanceBounds: new Map([[mesh, new T.Sphere(new T.Vector3(3, 4, 5), 10)]]),
    },
  );
  const depth = view.depthScene.children[0] as T.InstancedMesh;
  expect(depth).toBeInstanceOf(T.InstancedMesh);
  expect(depth.instanceMatrix).not.toBe(mesh.instanceMatrix);
  expect(depth.instanceMatrix.array).toBe(mesh.instanceMatrix.array);
  expect(mesh.frustumCulled).toBe(true);
  expect(depth.frustumCulled).toBe(true);
  mesh.count = 1;
  mesh.instanceMatrix.needsUpdate = true;
  view.syncDepth();
  expect(depth.count).toBe(1);
  expect(depth.matrix.elements).toEqual(mesh.matrixWorld.elements);
  expect(new T.Vector3().setFromMatrixPosition(depth.matrix).toArray()).toEqual([6, 8, 10]);
  ancestor.position.x = 10;
  view.syncDepth();
  expect(new T.Vector3().setFromMatrixPosition(depth.matrix).toArray()).toEqual([11, 8, 10]);
  // Frozen map objects may still receive explicitly managed door/breakable
  // transforms and visibility changes. Coverage must copy them every pass.
  root.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  });
  mesh.matrixWorld.makeTranslation(21, 22, 23);
  root.visible = false;
  mesh.count = 2;
  const traversal = vi.spyOn(root, "updateWorldMatrix");
  view.syncDepth();
  expect(traversal).not.toHaveBeenCalled();
  expect(new T.Vector3().setFromMatrixPosition(depth.matrix).toArray()).toEqual([21, 22, 23]);
  expect(depth.visible).toBe(false);
  expect(depth.count).toBe(2);
  root.visible = true;
  view.syncDepth();
  expect(depth.visible).toBe(true);
  traversal.mockRestore();
  let sourceReleased = 0,
    depthReleased = 0;
  mesh.instanceMatrix.addEventListener("dispose", () => sourceReleased++);
  depth.instanceMatrix.addEventListener("dispose", () => depthReleased++);
  view.dispose();
  view.dispose();
  expect(sourceReleased).toBe(0);
  expect(depthReleased).toBe(1);
  mesh.dispose();
  geometry.dispose();
  material.dispose();
  noise.dispose();
  lookup.dispose();
  for (const t of textures.values()) t.dispose();
});
