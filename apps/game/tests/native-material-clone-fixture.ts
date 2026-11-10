import * as T from "three";
import { applyNativeMapLegacy, type NativeLegacyMaterial } from "../src/native-map-legacy";
import { applyNativeMapLighting } from "../src/native-map-lighting";
import { applyNativeMapProbes } from "../src/native-map-probes";
import { applyNativeMapReflections } from "../src/native-map-reflections";
import type { SourceReflections } from "../src/source-reflections";

function texture(values: number[]) {
  const texture = new T.DataTexture(new Float32Array(values), 1, 1, T.RGBAFormat, T.FloatType);
  texture.minFilter = texture.magFilter = T.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}
/** Reproduce the complete map clone chain, rather than compiling the adapter's
 * original material. Three resets StandardMaterial.defines in copy(). */
export function nativeMaterialCloneFrames() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const source: NativeLegacyMaterial = {
    shader: "csgo_simple.vfx",
    nativeResource: "qualified-clone-regression.vmat",
    IntParams: { F_METALNESS_TEXTURE: 1, F_AMBIENT_OCCLUSION_TEXTURE: 1 },
    FloatParams: {},
    VectorParams: {},
    textures: { g_tColor: "c", g_tNormal: "n", g_tAmbientOcclusion: "a", g_tMetalness: "m" },
    resolvedMaterialInputs: {
      g_flReflectance: 0.04,
      g_bUseSecondaryUvForAmbientOcclusion: 0,
      g_flAmbientOcclusionScale: 0.75,
      g_flInverseBlendTint: 1,
    },
  };
  const textures = new Map([
    ["c", texture([0.3, 0.6, 0.2, 0.31])],
    ["n", texture([0.8, 0.2, 0.25, 0.9])],
    ["a", texture([1, 1, 1, 1])],
    ["m", texture([0.1, 0.7, 0.3, 0.8])],
  ]);
  const lookup = texture([0.2, 0.7, 0, 1]);
  const cube = new T.CompressedArrayTexture(
    [{ data: new Uint8Array(24).fill(255), width: 1, height: 1 }],
    1,
    1,
    6,
    T.RGBAFormat as T.CompressedPixelFormat,
    T.UnsignedByteType,
  );
  cube.needsUpdate = true;
  cube.minFilter = cube.magFilter = T.NearestFilter;
  const reflections: SourceReflections = {
    textures: [cube],
    lastLod: 0,
    cubeSize: 1,
    arraySplit: 1,
    volumes: [
      {
        index: 0,
        origin: [0, 0, 0],
        min: [-1000, -1000, -1000],
        max: [1000, 1000, 1000],
        fade: [1, 1, 1],
        normalizationSH: [1, 0, 0, 0],
      },
    ],
    uniforms: [
      {
        origin: new T.Vector3(),
        index: 0,
        mins: new T.Vector3(-1000, -1000, -1000),
        maxs: new T.Vector3(1000, 1000, 1000),
        invEdge: new T.Vector3(1, 1, 1),
        sh: new T.Vector4(1, 0, 0, 0),
      },
    ],
  };
  const probeAtlas = new T.DataArrayTexture(new Uint8Array(24).fill(255), 1, 1, 6),
    probeShadow = new T.DataArrayTexture(new Uint8Array(4).fill(255), 1, 1, 1);
  probeAtlas.needsUpdate = probeShadow.needsUpdate = true;
  const results = [];
  for (const path of [
    "original",
    "atlas",
    "probe",
    "atlas-reflection",
    "probe-reflection",
    "lost-defines-control",
  ]) {
    const scene = new T.Scene(),
      geometry = new T.PlaneGeometry(2, 2);
    geometry.computeTangents();
    if (path.includes("atlas")) geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
    const original = new T.MeshStandardMaterial();
    original.name = "clone";
    const mesh = new T.Mesh(geometry, original);
    scene.add(mesh);
    applyNativeMapLegacy(scene, { materials: { clone: source }, textures, lookup });
    const before = original.onBeforeCompile.bind(original);
    original.onBeforeCompile = (shader, renderer) => {
      before(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "gl_FragColor=vec4(normal*.5+.5,roughnessFactor);",
      );
    };
    if (path.includes("atlas"))
      applyNativeMapLighting(scene, {
        irradiance: textures.get("a")!,
        shadows: textures.get("a")!,
      });
    if (path.includes("probe"))
      applyNativeMapProbes(scene, {
        textures: [probeAtlas, probeShadow],
        frames: Array.from({ length: 8 }, () => new Float32Array([1, 1, 1])),
        sky: Array.from({ length: 3 }, () => new T.Vector4()),
        depth: 1,
        count: 1,
      });
    if (path.includes("reflection")) applyNativeMapReflections(scene, reflections);
    const material = mesh.material as T.MeshStandardMaterial;
    if (path === "lost-defines-control") {
      // Negative control proves the original failure at the final material,
      // without deliberately compiling an invalid program into the renderer.
      const broken = material.clone();
      results.push({
        path,
        missing: !Object.hasOwn(broken.defines ?? {}, "USE_NORMALMAP_TANGENTSPACE"),
      });
      broken.dispose();
      geometry.dispose();
      continue;
    }
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixel = new Float32Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    results.push({
      path,
      pixel: [...pixel],
      error: renderer.getContext().getError(),
      defines: material.defines,
      cloned: material !== original,
    });
    material.dispose();
    original.dispose();
    geometry.dispose();
  }
  for (const texture of new Set([...textures.values(), lookup, cube, probeAtlas, probeShadow]))
    texture.dispose();
  target.dispose();
  renderer.dispose();
  return results;
}
