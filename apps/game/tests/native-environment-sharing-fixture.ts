import * as T from "three";
import {
  applyNativeMapEnvironment,
  type SourceEnvironmentMaterial,
} from "../src/native-map-environment";
import { createEnvironmentTextureBanks } from "../src/native-environment-textures";

export function renderEnvironmentSharedPrograms() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(2, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(2, 1, { type: T.FloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const makeTexture = (rgba: number[]) => {
    const t = new T.DataTexture(new Uint8Array(rgba), 1, 1);
    t.minFilter = t.magFilter = T.NearestFilter;
    t.needsUpdate = true;
    return t;
  };
  const colors = [
      [64, 128, 192, 255],
      [192, 64, 32, 255],
    ],
    textures = new Map<string, T.Texture>([
      ["normal", makeTexture([128, 128, 64, 255])],
      ...colors.map((rgba, i) => [`resource${i}`, makeTexture(rgba)] as [string, T.Texture]),
    ]);
  const banks = createEnvironmentTextureBanks(textures, 256),
    lookup = makeTexture([255, 255, 255, 255]),
    normalFrame = makeTexture([128, 128, 255, 255]);
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 0.5, -0.5, 0.1, 10);
  camera.position.z = 3;
  const sources: Record<string, SourceEnvironmentMaterial> = {};
  const materials: T.MeshStandardMaterial[] = [];
  for (let i = 0; i < 2; i++) {
    sources[`material${i}`] = {
      shader: "csgo_environment.vfx",
      nativeResource: `different/native/resource${i}.vmat`,
      IntParams: {},
      FloatParams: {
        g_flModelTintAmount: 0,
        g_fTextureRoughnessContrast1: i ? 0.8 : 0.5,
        g_flHeightMapZeroPoint1: i ? 0.7 : 0.2,
      },
      VectorParams: { g_vTexCoordScale1: i ? [0.8, 0.7] : [0.2, 0.3] },
      textures: {
        g_tColor1: `resource${i}`,
        g_tNormal1: "normal",
        g_tHeight1: `verified-height-${i}`,
      },
      textureReflectivity: { g_tColor1: [0.5, 0.5, 0.5] },
      constants: { g_tHeight1: [0.5, 0, 1, 0] },
      nativeTextureDimensions: {
        g_tColor1: i ? [2048, 2048] : [1024, 1024],
        g_tNormal1: [1, 1],
        g_tHeight1: [4, 4],
      },
    };
    const material = new T.MeshStandardMaterial();
    material.name = `material${i}`;
    materials.push(material);
    const geometry = new T.PlaneGeometry(1, 1);
    geometry.computeTangents();
    const mesh = new T.Mesh(geometry, material);
    mesh.position.x = i - 0.5;
    scene.add(mesh);
  }
  applyNativeMapEnvironment(scene, {
    materials: sources,
    textures,
    banks: banks.bindings,
    lookup,
    normalFrame,
    time: { value: 0 },
  });
  for (const material of materials) {
    const prior = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      prior(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "gl_FragColor=vec4(diffuseColor.rgb,roughnessFactor);",
      );
    };
  }
  const rows = [];
  for (const reversed of [false, true]) {
    scene.children.forEach((mesh, i) => (mesh.renderOrder = reversed ? 1 - i : i));
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    const pixels = new Float32Array(8);
    renderer.readRenderTargetPixels(target, 0, 0, 2, 1, pixels);
    rows.push({
      reversed,
      pixels: [...pixels],
      programs: renderer.info.programs?.length,
      error: renderer.getContext().getError(),
      keys: materials.map((m) => m.customProgramCacheKey()),
    });
  }
  const expected = colors.flatMap((color, i) => [
    ...color.slice(0, 3).map((c) => c / 255),
    (64 / 255 - 0.5) * (i ? 0.8 : 0.5) + 0.5,
  ]);
  scene.traverse((object) => {
    if (object instanceof T.Mesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
  for (const texture of new Set([...textures.values(), ...banks.arrays, lookup, normalFrame]))
    texture.dispose();
  target.dispose();
  renderer.dispose();
  return { rows, expected, banks: banks.arrays.length };
}

/** Legacy source has per-material uniform matrices/textures too. Exact shader
 * sharing must retain each material's bindings in either draw order. */
export function renderLegacyEnvironmentSharedPrograms() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(8, 4);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(8, 4, { type: T.FloatType });
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const scene = new T.Scene(),
    lookup = new T.DataTexture();
  const textures = new Map<string, T.Texture>(),
    meshes: T.Mesh[] = [];
  const definitions: Record<string, SourceEnvironmentMaterial> = {};
  const colors = [
    [32, 64, 96],
    [128, 32, 16],
  ];
  const makeTexture = (id: string, rgba: number[]) => {
    const texture = new T.DataTexture(new Uint8Array(rgba), 1, 1);
    texture.needsUpdate = true;
    textures.set(id, texture);
    return id;
  };
  for (let i = 0; i < 2; i++) {
    const material = new T.MeshStandardMaterial({ color: new T.Color(i ? 0.3 : 1, 0.5, 0.8) });
    material.name = `legacy-${i}`;
    definitions[material.name] = {
      shader: "csgo_environment.vfx",
      nativeResource: `materials/independent-${i}.vmat`,
      IntParams: { g_bMetalness1: 0, g_nColorCorrectionMode1: 1 },
      FloatParams: { g_fTextureColorBrightness1: i + 1 },
      VectorParams: {},
      textures: {
        g_tColor1: makeTexture(`color-${i}`, [...colors[i], 255]),
        g_tHeight1: makeTexture(`height-${i}`, [128, 0, 0, 0]),
        g_tNormal1: makeTexture(`normal-${i}`, [128, 128, 220, 255]),
      },
      textureReflectivity: { g_tColor1: [0.1, 0.2, 0.3] },
    };
    const mesh = new T.Mesh(new T.PlaneGeometry(1, 2), material);
    mesh.position.x = i - 0.5;
    scene.add(mesh);
    meshes.push(mesh);
  }
  applyNativeMapEnvironment(scene, { materials: definitions, textures, lookup });
  for (const mesh of meshes) {
    const material = mesh.material as T.MeshStandardMaterial,
      prior = material.onBeforeCompile.bind(material),
      key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, r) => {
      prior(shader, r);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "gl_FragColor=vec4(diffuseColor.rgb,1.0);",
      );
    };
    material.customProgramCacheKey = () => `${key}:legacy-albedo-proof`;
  }
  const rows = [];
  for (const reverse of [false, true]) {
    meshes[0].renderOrder = reverse ? 2 : 1;
    meshes[1].renderOrder = reverse ? 1 : 2;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixels = new Float32Array(8);
    renderer.readRenderTargetPixels(target, 1, 1, 1, 1, pixels.subarray(0, 4));
    renderer.readRenderTargetPixels(target, 6, 1, 1, 1, pixels.subarray(4, 8));
    rows.push({
      reverse,
      pixels: Array.from(pixels),
      programs: renderer.info.programs?.length,
      keys: meshes.map((m) => (m.material as T.Material).customProgramCacheKey()),
      error: renderer.getContext().getError(),
    });
  }
  meshes.forEach((m) => {
    m.geometry.dispose();
    (m.material as T.Material).dispose();
  });
  textures.forEach((t) => t.dispose());
  lookup.dispose();
  target.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return {
    rows,
    expected: [
      ...colors[0].map((v) => v / 255),
      1,
      ...colors[1].map((v) => Math.min(1, (v * 2) / 255)),
      1,
    ],
  };
}
