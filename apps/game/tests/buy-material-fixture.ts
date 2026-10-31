import * as T from "three";
import type { Game } from "../src/game";

/** Render the actual cached preview item in isolation, using the preview lights. */
export function measureBuyMaterial(game: Game) {
  const preview = game.buyPreview as unknown as { item: T.Group; scene: T.Scene };
  const scene = new T.Scene();
  const item = preview.item.clone(true);
  item.position.set(0, 0, 0);
  item.quaternion.identity();
  item.scale.set(1, 1, 1);
  scene.add(item);
  for (const object of preview.scene.children)
    if (object instanceof T.Light) scene.add(object.clone());
  const sphere = new T.Box3().setFromObject(item).getBoundingSphere(new T.Sphere());
  const camera = new T.PerspectiveCamera(40, 2, 0.001, 50);
  camera.position
    .copy(sphere.center)
    .addScaledVector(new T.Vector3(2, 1, 2.5).normalize(), sphere.radius * 3.8);
  camera.lookAt(sphere.center);
  const renderer = game.renderer;
  const target = new T.WebGLRenderTarget(256, 128);
  const previous = renderer.getRenderTarget();
  const viewport = renderer.getViewport(new T.Vector4()),
    scissor = renderer.getScissor(new T.Vector4());
  const scissorTest = renderer.getScissorTest();
  const clear = renderer.getClearColor(new T.Color()),
    alpha = renderer.getClearAlpha();
  renderer.setRenderTarget(target);
  renderer.setScissorTest(false);
  renderer.setClearColor(0, 0);
  renderer.clear();
  renderer.render(scene, camera);
  const pixels = new Uint8Array(256 * 128 * 4);
  renderer.readRenderTargetPixels(target, 0, 0, 256, 128, pixels);
  let count = 0,
    light = 0,
    visible = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    count++;
    const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    light += luminance;
    if (luminance > 10) visible++;
  }
  renderer.setRenderTarget(previous);
  renderer.setViewport(viewport);
  renderer.setScissor(scissor);
  renderer.setScissorTest(scissorTest);
  renderer.setClearColor(clear, alpha);
  target.dispose();
  return { count, mean: light / Math.max(1, count), visibleFraction: visible / Math.max(1, count) };
}
