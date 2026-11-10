import * as T from "three";
import { applyNativeMapGlass } from "../src/native-map-glass";
import { nativeGlassSource } from "./native-glass-source-fixture";
import { nativeFogParameters, type NativeMapFog } from "../src/native-map-fog";
import { applySourceDepth, copySourceDepth } from "../src/source-depth";
export function renderNativeGlass() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType }),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const geometry = new T.PlaneGeometry(2, 2);
  geometry.computeTangents();
  const results = [];
  const cube = new T.DataArrayTexture(
    new Float32Array(Array.from({ length: 6 }, () => [0.8, 0.1, 0.4, 1]).flat()),
    1,
    1,
    6,
  );
  cube.type = T.FloatType;
  cube.needsUpdate = true;
  const definition = {
    gradient: {
      distance: [-1, 1, 1] as [number, number, number],
      color: [0.1, 0.2, 0.3] as [number, number, number],
      strength: 1,
      opacity: 0.25,
    },
    cube: {
      distance: [-1, 1, 1] as [number, number, number],
      opacity: 0.2,
      lodBias: 0,
      exposure: 1,
      angles: [0, 0, 0] as [number, number, number],
      texture: {
        file: "fixture-only",
        format: "BC6H" as const,
        gpuBytes: 96,
        mips: [{ width: 1, height: 1, bytes: 96 }],
        fallbackFile: "fixture-only",
        fallbackBytes: 48,
        fallbackMips: [{ width: 1, height: 1, bytes: 48 }],
      },
    },
  };
  const fog = { definition, parameters: nativeFogParameters(definition), cube } as NativeMapFog;
  for (const mode of [
    "front",
    "back",
    "fog",
    "blend",
    "depth-clear",
    "depth-dust",
    "depth-fog",
    "depth-clone-fade",
  ]) {
    const scene = new T.Scene(),
      material = new T.MeshStandardMaterial();
    material.name = "glass";
    material.color.setRGB(0.8, 0.6, 0.4);
    material.opacity = 0.8;
    const depth = mode.startsWith("depth"),
      clear = mode === "depth-clear" || mode === "depth-fog";
    if (depth) {
      material.color.setRGB(1, 1, 1);
      material.opacity = 1;
    }
    const samples = {
        g_tGlassDust: clear
          ? [0.2, 0.4, 0.6, 0]
          : [0.2, 0.4, 0.6, mode === "depth-clone-fade" ? 0.5 : 0.25],
        g_tGlassTintColor:
          clear || mode === "depth-clone-fade" ? [1, 1, 1, 0.5] : [0.7, 0.5, 0.9, 0.5],
        g_tNormal: [128 / 255, 128 / 255, 0.625, 1],
      },
      textures = new Map<string, T.Texture>();
    for (const [id, p] of Object.entries(samples)) {
      const t = new T.DataTexture(new Float32Array(p), 1, 1, T.RGBAFormat, T.FloatType);
      t.needsUpdate = true;
      textures.set(id, t);
    }
    const lookup = new T.DataTexture(
      new Float32Array([0.2, 0.7, 0, 1]),
      1,
      1,
      T.RGBAFormat,
      T.FloatType,
    );
    lookup.needsUpdate = true;
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    const withFog = mode === "fog" || mode === "depth-fog";
    applyNativeMapGlass(
      scene,
      { materials: { glass: nativeGlassSource }, textures, lookup },
      { fog: withFog ? fog : undefined },
    );
    if (!depth) {
      const light = new T.DirectionalLight(0xffffff, Math.PI);
      light.position.set(mode === "back" ? 0.3 : 0, 0, mode === "back" ? -3 : 3);
      scene.add(light);
      if (mode !== "blend") material.blending = T.NoBlending;
    }
    let depthMaterial: T.MeshDepthMaterial | undefined;
    if (depth) {
      depthMaterial = new T.MeshDepthMaterial({ depthPacking: T.BasicDepthPacking });
      const depthSource = mode === "depth-clone-fade" ? material.clone() : material;
      if (depthSource !== material) {
        depthSource.opacity = 0;
        copySourceDepth(material, depthSource);
      }
      applySourceDepth(depthSource, depthMaterial);
      if (depthSource !== material) depthSource.dispose();
      mesh.material = depthMaterial as unknown as T.MeshStandardMaterial;
    }
    const background = [0.3, 0.2, 0.1];
    if (mode === "blend") {
      const bg = new T.Mesh(geometry, new T.MeshBasicMaterial());
      bg.material.color.fromArray(background);
      bg.position.z = -0.1;
      scene.add(bg);
    }
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000);
    renderer.clear();
    renderer.render(scene, camera);
    const pixel = new Float32Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    const a = 0.2,
      C = [0.56, 0.3, 0.36],
      tau = C.map((c) => 0.96 * c * (1 - a)),
      D = [0.2, 0.4, 0.6];
    const lighting = mode === "back" ? Math.sqrt(1 / 1.01) * 0.5 * a : 1,
      spec = mode === "back" ? 0 : 0.1608;
    let rgb = D.map(
        (d, i) => a * d * lighting + spec + tau[i] * a * d * lighting * Math.pow(C[i], 1.6),
      ),
      t = tau.slice();
    if (withFog) {
      rgb = rgb.map(
        (r, i) =>
          (r * (1 - 0.25 * (1 - a)) + [0.1, 0.2, 0.3][i] * 0.25 * (1 - a)) * (1 - 0.2 * (1 - a)) +
          [0.8, 0.1, 0.4][i] * 0.2 * (1 - a),
      );
      t = t.map((x) => x * 0.75 * 0.8);
    }
    const luma = t[0] * 0.21250000596 + t[1] * 0.71539998055 + t[2] * 0.07209999859;
    const expected = depth
      ? [mode === "depth-clear" || mode === "depth-clone-fade" ? 0 : 1 - (3 - 0.1) / (10 - 0.1)]
      : [
          ...rgb.map((r, i) => r + (mode === "blend" ? background[i] * luma : 0)),
          mode === "blend" ? luma * luma + 1.0 - luma : luma,
        ];
    results.push({ mode, pixel: [...pixel], expected, error: renderer.getContext().getError() });
    material.dispose();
    depthMaterial?.dispose();
    textures.forEach((t) => t.dispose());
    lookup.dispose();
  }
  target.dispose();
  cube.dispose();
  geometry.dispose();
  renderer.dispose();
  return results;
}
