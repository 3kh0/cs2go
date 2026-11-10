import * as T from "three";
import { StaticSkyClipping, infiniteSkyPanorama } from "../src/native-sky-clipping";
export function skyPrecisionFixture() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(64, 64);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(60, 1, 0.01, 43000);
  const geometry = new T.PlaneGeometry(600, 600),
    front = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: 0xff0000 })),
    back = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: 0xffffff }));
  front.position.z = -1000;
  back.position.z = -1000.05;
  scene.add(front, back);
  const fit = new StaticSkyClipping([scene]);
  const pixel = new Uint8Array(4),
    gl = renderer.getContext();
  let incorrectBefore = 0,
    incorrectAfter = 0;
  for (let frame = 0; frame < 24; frame++) {
    camera.position.z = frame * 0.003;
    camera.updateMatrixWorld(true);
    for (const enabled of [false, true]) {
      camera.near = enabled ? fit.near(camera) : 0.01;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (pixel[0] !== 255 || pixel[1] !== 0 || pixel[2] !== 0) {
        if (enabled) incorrectAfter++;
        else incorrectBefore++;
      }
    }
  }
  const panoramaScene = new T.Scene(),
    material = new T.MeshBasicMaterial({ color: 0x0080ff, side: T.BackSide, depthWrite: false });
  infiniteSkyPanorama(material);
  const panorama = new T.Mesh(new T.SphereGeometry(1, 32, 16), material);
  panorama.frustumCulled = false;
  panoramaScene.add(panorama);
  camera.position.set(0, 0, 0);
  camera.near = 100;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  renderer.render(panoramaScene, camera);
  gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  const result = { incorrectBefore, incorrectAfter, panorama: [...pixel], glError: gl.getError() };
  renderer.dispose();
  return result;
}
