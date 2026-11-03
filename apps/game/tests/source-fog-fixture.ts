import * as T from "three";
import { applySourceFog, setSourceFogSky } from "../src/source-fog";

export function renderSourceFog() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(32, 32);
  const panorama = new T.DataTexture(new Uint8Array([150, 0, 0, 255]), 1, 1);
  panorama.needsUpdate = true;
  const cube = new T.WebGLCubeRenderTarget(4).fromEquirectangularTexture(renderer, panorama);
  setSourceFogSky(cube.texture);
  const material = new T.MeshStandardMaterial({ color: 0x000000 });
  material.onBeforeCompile = (shader) => applySourceFog(shader);
  const geometry = new T.PlaneGeometry(1000, 1000);
  const mesh = new T.Mesh(geometry, material);
  const scene = new T.Scene();
  scene.add(mesh);
  const camera = new T.PerspectiveCamera(50, 1, 0.1, 1000);
  const read = (distance: number, height = 0) => {
    camera.position.set(0, height, 0);
    mesh.position.set(0, height, -distance);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixel = new Uint8Array(4);
    renderer.readRenderTargetPixels(target, 16, 16, 1, 1, pixel);
    return [...pixel];
  };
  const near = read(5);
  const far = read(250);
  const high = read(250, 600);
  setSourceFogSky();
  const disabled = read(250);
  geometry.dispose();
  material.dispose();
  cube.dispose();
  panorama.dispose();
  target.dispose();
  renderer.dispose();
  return { near, far, high, disabled };
}
