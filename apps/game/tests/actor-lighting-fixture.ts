import * as T from "three";
import {
  registerActorLighting,
  updateActorLighting,
  disposeActorLighting,
  setActorReflection,
} from "../src/actor-lighting";
import { nativeFogParameters, type NativeFogDefinition } from "../src/native-map-fog";

export function renderActorProbes() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(32, 32);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(50, 1, 0.1, 10);
  camera.position.z = 3;
  const material = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const geometry = new T.PlaneGeometry(2, 2);
  const first = new T.Mesh(geometry, material),
    second = new T.Mesh(geometry, material);
  registerActorLighting(first, true);
  registerActorLighting(second, true);
  const sample = (_p: unknown, n: { z: number }, out: InstanceType<typeof T.Color>) => {
    out.setRGB(n.z > 0 ? Math.PI : 0, 0, n.z < 0 ? Math.PI : 0);
    return true;
  };
  scene.add(first);
  const read = () => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const bytes = new Uint8Array(4);
    renderer.readRenderTargetPixels(target, 16, 16, 1, 1, bytes);
    return [...bytes];
  };
  updateActorLighting(first, new T.Vector3(), sample, 0.1);
  const front = read();
  const rotation = new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationY(Math.PI));
  updateActorLighting(first, new T.Vector3(), sample, 0.1, rotation);
  const turned = read();
  scene.remove(first);
  scene.add(second);
  const disabled = read();
  const independent = first.material !== second.material && first.material !== material;
  const mapPrograms: number[] = [],
    mapColors: number[][] = [];
  let otherActorUnchanged = true;
  for (let index = 0; index < 12; index++) {
    const definition: NativeFogDefinition = {
      gradient: {
        distance: [0, 250, 1],
        color: index % 2 ? [0.05, 0.4, 0.15] : [0.5, 0.07, 0.03],
        opacity: 0.8,
        strength: 1,
      },
    };
    updateActorLighting(
      first,
      new T.Vector3(),
      sample,
      0.1,
      undefined,
      undefined,
      undefined,
      null,
      undefined,
      { definition, parameters: nativeFogParameters(definition) },
    );
    scene.remove(second);
    scene.add(first);
    mapColors.push(read());
    mapPrograms.push(renderer.info.programs!.length);
    scene.remove(first);
    scene.add(second);
    otherActorUnchanged &&= read().every((value, channel) => value === disabled[channel]);
  }
  disposeActorLighting(first);
  disposeActorLighting(second);
  geometry.dispose();
  material.dispose();
  target.dispose();
  renderer.dispose();
  return { front, turned, disabled, independent, mapPrograms, mapColors, otherActorUnchanged };
}

// https://en.wikipedia.org/wiki/Azimuth
export function renderActorReflections() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(32, 32);
  const pixels = new Uint8Array(64 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const at = (y * 64 + x) * 4;
      pixels[at + (x < 32 ? 0 : 2)] = 255;
      pixels[at + 3] = 255;
    }
  }
  const panorama = new T.DataTexture(pixels, 64, 32);
  panorama.mapping = T.EquirectangularReflectionMapping;
  panorama.needsUpdate = true;
  const generator = new T.PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(panorama);
  const material = new T.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0,
    envMap: environment.texture,
  });
  material.envMapRotation.set(0, 0.1, 0);
  material.envMapIntensity = 0.75;
  const geometry = new T.PlaneGeometry(2, 2);
  const mesh = new T.Mesh(geometry, material);
  registerActorLighting(mesh);
  const scene = new T.Scene();
  scene.add(mesh);
  const camera = new T.PerspectiveCamera(50, 1, 0.1, 10);
  camera.position.z = 3;
  const read = () => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixel = new Uint8Array(4);
    renderer.readRenderTargetPixels(target, 16, 16, 1, 1, pixel);
    return [...pixel];
  };
  const preview = read();
  setActorReflection(mesh, environment.texture);
  const native = read();
  setActorReflection(mesh);
  const restored = read();
  const restoredRotation = material.envMapRotation.toArray();
  const restoredIntensity = material.envMapIntensity;
  disposeActorLighting(mesh);
  geometry.dispose();
  material.dispose();
  panorama.dispose();
  environment.dispose();
  generator.dispose();
  target.dispose();
  renderer.dispose();
  return { preview, native, restored, restoredRotation, restoredIntensity };
}
