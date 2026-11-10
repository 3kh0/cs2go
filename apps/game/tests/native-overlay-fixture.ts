import * as T from "three";
import { applyNativeStaticOverlays } from "../src/native-static-overlay";
import {
  activateNativeMapGrade,
  gradeNativeMapColors,
  loadNativeMapGrade,
} from "../src/native-map-color";

export function renderNativeOverlay() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(8, 8);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const texture = new T.DataTexture(new Uint8Array([64, 128, 192, 255]), 1, 1);
  texture.colorSpace = T.SRGBColorSpace;
  texture.needsUpdate = true;
  const geometry = new T.PlaneGeometry(2, 2);
  const background = new T.Mesh(
    geometry,
    new T.MeshBasicMaterial({ color: new T.Color().setRGB(0.25, 0.4, 0.5) }),
  );
  scene.add(background);
  const results = [];
  for (const tint of [
    [1, 1, 1],
    [0.2547888, 0.5610618, 1],
  ])
    for (const alpha of [0, 0.368627, 1]) {
      const material = new T.MeshStandardMaterial({
        map: texture,
        opacity: alpha,
        color: new T.Color().fromArray(tint),
      });
      material.name = "native overlay";
      const overlay = new T.Mesh(geometry, material);
      overlay.position.z = 0.01;
      scene.add(overlay);
      applyNativeStaticOverlays(overlay, [
        {
          name: material.name,
          staticOverlay: {
            IntParams: { F_BLEND_MODE: 3 },
            FloatParams: { g_flOpacityScale: 1 },
            VectorParams: {},
          },
        },
      ]);
      renderer.render(scene, camera);
      const gl = renderer.getContext(),
        bytes = new Uint8Array(4);
      gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      results.push({
        alpha,
        tint,
        actual: Array.from(bytes).slice(0, 3),
        expected: [64, 128, 192].map((value, i) =>
          Math.round(
            2 * (0.5 + ((value / 255) * tint[i] - 0.5) * alpha) * [0.25, 0.4, 0.5][i] * 255,
          ),
        ),
        error: gl.getError(),
      });
      scene.remove(overlay);
      const adapted = overlay.material;
      if (adapted.map !== texture) adapted.map?.dispose();
      overlay.material.dispose();
      material.dispose();
    }
  geometry.dispose();
  background.material.dispose();
  texture.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}

/** A raw-read native sampler must filter raw bytes before tinting. Separately,
 * a zero-alpha factor must preserve an already graded destination exactly. */
export async function renderNativeOverlaySampling() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(8, 8);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const geometry = new T.PlaneGeometry(2, 2),
    background = new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({ color: new T.Color().setRGB(0.25, 0.4, 0.5) }),
    );
  scene.add(background);
  const texture = new T.DataTexture(new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = texture.minFilter = T.LinearFilter;
  texture.needsUpdate = true;
  const original = new T.MeshStandardMaterial({ map: texture });
  original.name = "raw-read native overlay";
  const overlay = new T.Mesh(geometry, original);
  overlay.position.z = 0.01;
  scene.add(overlay);
  // Sample the exact boundary between the two texels for every output pixel.
  texture.repeat.set(0, 0);
  texture.offset.set(0.5, 0.5);
  texture.updateMatrix();
  applyNativeStaticOverlays(overlay, [
    {
      name: original.name,
      staticOverlay: { IntParams: { F_BLEND_MODE: 3 }, FloatParams: {}, VectorParams: {} },
    },
  ]);
  const read = () => {
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      p = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
    return { pixel: [...p].slice(0, 3), error: gl.getError() };
  };
  const raw = read();
  const config = await (await fetch("/models/maps/mirage-config.json")).json();
  const grade = await loadNativeMapGrade(config.postprocess);
  activateNativeMapGrade(grade);
  gradeNativeMapColors(scene);
  overlay.visible = false;
  const graded = read();
  overlay.visible = true;
  overlay.material.opacity = 0;
  const neutral = read();
  activateNativeMapGrade();
  grade.texture.dispose();
  overlay.material.map?.dispose();
  overlay.material.dispose();
  original.dispose();
  texture.dispose();
  background.material.dispose();
  geometry.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return { raw, graded, neutral };
}
