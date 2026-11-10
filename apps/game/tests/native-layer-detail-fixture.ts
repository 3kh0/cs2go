import * as T from "three";
import { applySourceLayers, type SourceLayerMaterial } from "../src/source-layers";

/** Pixel proof for the legacy two-detail blend, including authored strengths >1. */
export function renderNativeLayerDetails() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(8, 8);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene();
  scene.add(new T.AmbientLight(0xffffff, Math.PI));
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const texture = (r: number, g = r, b = r) => {
    const result = new T.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
    result.needsUpdate = true;
    return result;
  };
  const textures = new Map([
    ["normal", texture(128, 128, 255)],
    ["color2", texture(48)],
    ["mask", texture(128)],
    ["detail1", texture(80)],
    ["detail2", texture(200)],
  ]);
  const base = texture(24);
  const results = [];
  for (const blend of [0, 0.5, 1]) {
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.setAttribute(
      "sourceBlend",
      new T.Float32BufferAttribute(Array(4).fill([blend, 0, 0, 0]).flat(), 4),
    );
    const material = new T.MeshStandardMaterial({ map: base, normalMap: base, roughness: 1 });
    const native: SourceLayerMaterial = {
      fancy: 0,
      softness: 0.5,
      border: [0, 0.5, 0.5],
      borderTint: [1, 1, 1],
      tint1: [1, 1, 1],
      tint2: [1, 1, 1],
      bevel: [4, 2, 0],
      metalness: 0,
      specularIndirect: false,
      ao: [1, 1],
      normal1: "normal",
      normal2: "normal",
      color2: "color2",
      mask: "mask",
      transforms: Object.fromEntries(
        ["Layer1", "Layer1Normal", "Layer2", "Layer2Normal", "BlendModulate"].map((name) => [
          name,
          [1, 0, 0, 0, 1, 0, 0, 0, 1],
        ]),
      ),
      detail: { texture: "detail1", scale: [0.15, 0.15], tintBlend: [1, 1, 1, 2] },
      detail2: { texture: "detail2", scale: [4, 4], tintBlend: [1, 1, 1, 1] },
    };
    material.onBeforeCompile = (shader) => applySourceLayers(shader, native, textures);
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      bytes = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    // Independent scalar calculation from the pinned legacy shader's detail equation.
    const albedo = (24 * (1 - blend) + 48 * blend) / 255;
    const detail = (80 * (1 - blend) + 200 * blend) / 255;
    const strength = 2 * (1 - blend) + blend;
    results.push({
      blend,
      actual: Array.from(bytes).slice(0, 3),
      expected: Math.round(albedo * (1 + (detail * 2 - 1) * strength) * 255),
      error: gl.getError(),
    });
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
  }
  textures.forEach((value) => value.dispose());
  base.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}
