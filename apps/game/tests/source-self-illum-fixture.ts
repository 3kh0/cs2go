import * as T from "three";
import { applySourceSelfIllumination, type SourceSelfIllumination } from "../src/source-self-illum";

export async function renderSourceSelfIllumination() {
  const metadata = await fetch("/models/maps/material-lighting.json").then((r) => r.json());
  const source = metadata.materials.find(
    (entry: { name: string }) => entry.name === "dust_hanging_light_02_on",
  ).selfIllumination as SourceSelfIllumination;
  const renderer = new T.WebGLRenderer();
  renderer.setSize(16, 16);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;
  const texture = (rgb: number[]) => {
    const map = new T.DataTexture(new Uint8Array([...rgb, 255]), 1, 1);
    map.colorSpace = T.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  };
  const mask = texture([64, 128, 192]);
  const albedo = texture([128, 128, 128]);
  const material = new T.MeshStandardMaterial({ map: albedo, emissiveMap: mask });
  applySourceSelfIllumination(material, source);
  const geometry = new T.PlaneGeometry(2, 2);
  scene.add(new T.Mesh(geometry, material));
  const render = () => {
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return Array.from(pixel).slice(0, 3);
  };
  const shadedAlbedo = render();
  const linearMask = new T.Color().setRGB(64 / 255, 128 / 255, 192 / 255, T.SRGBColorSpace);
  const expectedColor = linearMask
    .multiply(new T.Color().setRGB(...source.tint, T.SRGBColorSpace))
    .multiplyScalar(2 ** source.brightness * source.scale);
  const encoded = (color: T.Color) =>
    color
      .clone()
      .convertLinearToSRGB()
      .toArray()
      .map((value) => Math.round(Math.min(value, 1) * 255));
  const albedoLinear = new T.Color().setRGB(128 / 255, 128 / 255, 128 / 255, T.SRGBColorSpace);
  const expectedShaded = encoded(expectedColor.clone().multiply(albedoLinear));
  // Reconfigure a separate material to exercise the authored albedo-factor switch.
  const unmodulated = new T.MeshStandardMaterial({ map: albedo, emissiveMap: mask });
  applySourceSelfIllumination(unmodulated, { ...source, albedoFactor: 0 });
  (scene.children[0] as T.Mesh).material = unmodulated;
  const withoutAlbedo = render();
  unmodulated.emissiveMap = texture([0, 0, 0]);
  unmodulated.needsUpdate = true;
  const darkMask = render();
  const result = {
    shadedAlbedo,
    expectedShaded,
    withoutAlbedo,
    expectedUnmodulated: encoded(expectedColor),
    darkMask,
  };
  geometry.dispose();
  material.dispose();
  unmodulated.dispose();
  mask.dispose();
  albedo.dispose();
  unmodulated.emissiveMap.dispose();
  renderer.dispose();
  return result;
}
