import * as T from "three";
import { loadNativeMap } from "../src/dust2";
import { activateNativeMapGrade } from "../src/native-map-color";
import { enableTextureTranscoding } from "../src/gltf";

export async function nativeSkyCompositionFixture() {
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1440, 900);
  renderer.toneMapping = T.CustomToneMapping;
  enableTextureTranscoding(renderer);
  document.body.replaceChildren(renderer.domElement);
  const scene = new T.Scene(),
    world = await loadNativeMap(scene, renderer, "mirage");
  world.root.visible = true;
  scene.environment = world.sky;
  scene.environmentIntensity = 0.35;
  activateNativeMapGrade(world.grade);
  const layer = world.nativeSky!;
  const camera = new T.PerspectiveCamera(74, 1440 / 900, 0.05, 254);
  camera.position.set(-333 * 0.0254, -136 * 0.0254, 1910 * 0.0254);
  const pitch = T.MathUtils.degToRad(-16),
    yaw = T.MathUtils.degToRad(249);
  camera.lookAt(
    camera.position
      .clone()
      .add(
        new T.Vector3(
          Math.cos(pitch) * Math.cos(yaw),
          -Math.sin(pitch),
          -Math.cos(pitch) * Math.sin(yaw),
        ),
      ),
  );
  const forward = new T.Vector3();
  camera.getWorldDirection(forward);
  const foreground = new T.Mesh(
    new T.BoxGeometry(0.5, 0.5, 0.2),
    new T.MeshBasicMaterial({ color: 0x00ff00, toneMapped: false }),
  );
  foreground.position.copy(camera.position).addScaledVector(forward, 2);
  scene.add(foreground);
  const gl = renderer.getContext(),
    pixel = new Uint8Array(4);
  const render = () => {
    camera.updateMatrixWorld(true);
    renderer.render(scene, camera);
    gl.finish();
  };
  render();
  render();
  gl.readPixels(720, 450, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  const withSky = Array.from(pixel);
  layer.background.visible = false;
  render();
  gl.readPixels(720, 450, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  const withoutSky = Array.from(pixel);
  layer.background.visible = true;
  camera.far = 5;
  camera.updateProjectionMatrix();
  render();
  const p = layer.skyCamera.projectionMatrix.elements,
    ownFar = p[14] / (p[10] + 1);
  const farClippingSafe = ownFar > 1000;
  camera.far = 254;
  camera.updateProjectionMatrix();
  foreground.visible = false;
  const timings = { enabled: [] as number[], disabled: [] as number[] },
    calls = { enabled: [] as number[], disabled: [] as number[] };
  for (let pair = 0; pair < 20; pair++)
    for (const enabled of pair % 2 ? [false, true] : [true, false]) {
      layer.background.visible = enabled;
      camera.position.x += (enabled ? 1 : -1) * 0.001;
      const start = performance.now();
      render();
      const key = enabled ? "enabled" : "disabled";
      timings[key].push(performance.now() - start);
      calls[key].push(renderer.info.render.calls);
    }
  const stats = (data: number[]) => {
    const sorted = [...data].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  };
  const result = {
    withSky,
    withoutSky,
    farClippingSafe,
    ownFar,
    scale: layer.manifest.nativeTransform.skyCamera.scale,
    skyOpaqueMeshes: layer.scene.children[0].children.length,
    skyEffectMeshes: layer.overlay.children.length,
    viewport: [1440, 900],
    samples: 20,
    method:
      "Alternating paired native A camera, 1mm camera movement forces sky refresh, renderer.render plus gl.finish; world-only, no agents",
    timings: { enabled: stats(timings.enabled), disabled: stats(timings.disabled) },
    calls: { enabled: stats(calls.enabled), disabled: stats(calls.disabled) },
    glError: gl.getError(),
  };
  activateNativeMapGrade();
  renderer.dispose();
  return result;
}
