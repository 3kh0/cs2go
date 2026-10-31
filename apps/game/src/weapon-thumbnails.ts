import * as T from "three";
import { armoryReflections } from "./reflections";
import { createNativeWorldGun } from "./weapon-motion";
const cache = new Map<number, string>();
/** Small default-finish renders reuse loaded weapon assets; no new downloads. */
export function weaponThumbnail(renderer: T.WebGLRenderer, id: number) {
  const cached = cache.get(id);
  if (cached) return cached;
  const model = createNativeWorldGun(id);
  const scene = new T.Scene();
  scene.environment = armoryReflections(renderer);
  scene.environmentIntensity = 0.6;
  scene.add(model, new T.HemisphereLight(0xddeaff, 0xa38e70, 3));
  const light = new T.DirectionalLight(0xffffff, 3);
  light.position.set(0, 2, 3);
  scene.add(light);
  const box = new T.Box3().setFromObject(model),
    center = box.getCenter(new T.Vector3()),
    size = box.getSize(new T.Vector3());
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  model.position.sub(center);
  // The baked carried model's barrel is along Z. Show the left side with a
  // small overhead angle, rather than rendering straight down the barrel.
  camera.position.set(-2, 0.45, 0.05);
  camera.lookAt(0, 0, 0);
  const half = Math.max(size.z * 0.58, size.y * 0.95, 0.12);
  camera.left = -half;
  camera.right = half;
  camera.top = half * 0.6;
  camera.bottom = -half * 0.6;
  camera.updateProjectionMatrix();
  const target = new T.WebGLRenderTarget(240, 144, { depthBuffer: true });
  const previous = renderer.getRenderTarget(),
    viewport = renderer.getViewport(new T.Vector4()),
    scissor = renderer.getScissor(new T.Vector4()),
    scissorTest = renderer.getScissorTest(),
    clear = renderer.getClearColor(new T.Color()),
    alpha = renderer.getClearAlpha();
  try {
    renderer.setRenderTarget(target);
    renderer.setScissorTest(false);
    renderer.setClearColor(0, 0);
    renderer.clear();
    renderer.render(scene, camera);
    const pixels = new Uint8Array(240 * 144 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 240, 144, pixels);
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 144;
    const ctx = canvas.getContext("2d")!,
      image = ctx.createImageData(240, 144);
    for (let y = 0; y < 144; y++)
      image.data.set(pixels.subarray((143 - y) * 240 * 4, (144 - y) * 240 * 4), y * 240 * 4);
    ctx.putImageData(image, 0, 0);
    const url = canvas.toDataURL("image/webp", 0.88);
    cache.set(id, url);
    return url;
  } finally {
    renderer.setRenderTarget(previous);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    renderer.setClearColor(clear, alpha);
    target.dispose();
    model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
  }
}
