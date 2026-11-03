import * as T from "three";
import { applySourceLayers, type SourceLayerMaterial } from "../src/source-layers";

export function renderSourceLayers() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(128, 128);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;
  const constant = (rgba: number[]) => {
    const texture = new T.DataTexture(new Uint8Array(rgba), 1, 1);
    texture.needsUpdate = true;
    return texture;
  };
  const red = constant([255, 0, 0, 255]),
    blue = constant([0, 0, 255, 255]);
  const flat = constant([128, 128, 255, 255]),
    mask = constant([102, 128, 0, 255]);
  const white = constant([255, 255, 255, 255]);
  const normalA = constant([255, 128, 255, 255]),
    normalB = constant([0, 128, 255, 255]);
  const textures = new Map([
    ["blue", blue],
    ["flat", flat],
    ["mask", mask],
    ["white", white],
    ["normal-a", normalA],
    ["normal-b", normalB],
  ]);
  const geometry = new T.PlaneGeometry(2, 2);
  const pos = geometry.getAttribute("position");
  const weights = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) weights[i * 4] = (pos.getX(i) + 1) / 2;
  geometry.setAttribute("sourceBlend", new T.BufferAttribute(weights, 4));
  const material = new T.MeshStandardMaterial({ map: red, normalMap: red, roughness: 1 });
  const native: SourceLayerMaterial = {
    fancy: 2,
    softness: 0.05,
    border: [0, 0.05, 1],
    borderTint: [0.25, 0.25, 0.25],
    tint1: [1, 1, 1],
    tint2: [1, 1, 1],
    bevel: [4, 0, 0],
    metalness: 0,
    specularIndirect: true,
    ao: [1, 1],
    normal1: "flat",
    normal2: "flat",
    color2: "blue",
    mask: "mask",
    transforms: Object.fromEntries(
      ["Layer1", "Layer1Normal", "Layer2", "Layer2Normal", "BlendModulate"].map((key) => [
        key,
        [1, 0, 0, 0, 1, 0, 0, 0, 1],
      ]),
    ),
  };
  material.onBeforeCompile = (shader) => applySourceLayers(shader, native, textures);
  material.customProgramCacheKey = () => `layer-fixture-${native.fancy}`;
  scene.add(new T.Mesh(geometry, material));
  const ambient = new T.AmbientLight(0xffffff, Math.PI);
  scene.add(ambient);
  const render = () => {
    material.needsUpdate = true;
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      row = new Uint8Array(128 * 4);
    gl.readPixels(0, 64, 128, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
    return Array.from({ length: 128 }, (_, i) => Array.from(row.subarray(i * 4, i * 4 + 3)));
  };
  const bordered = render();
  native.border = [0, 0.05, 0];
  // Change the key to rebuild the uniform set after changing source parameters.
  material.customProgramCacheKey = () => `layer-fixture-unbordered-${native.fancy}`;
  const unbordered = render();
  native.fancy = 1;
  const maskSoftness = render();
  native.fancy = 0;
  native.normal1 = "normal-a";
  native.normal2 = "normal-b";
  native.color2 = "white";
  material.map = material.normalMap = white;
  ambient.intensity = 0;
  const sun = new T.DirectionalLight(0xffffff, Math.PI);
  sun.position.z = 5;
  scene.add(sun);
  const encodedNormals = render();
  sun.intensity = 0;
  material.color.set(0x000000);
  const face = document.createElement("canvas");
  face.width = face.height = 16;
  const context = face.getContext("2d")!;
  context.fillStyle = "#0000ff";
  context.fillRect(0, 0, 16, 16);
  const environment = new T.CubeTexture(Array.from({ length: 6 }, () => face));
  environment.needsUpdate = true;
  scene.environment = environment;
  scene.environmentIntensity = 10;
  material.customProgramCacheKey = () => `layer-fixture-specular-${native.specularIndirect}`;
  const specularOn = render();
  native.specularIndirect = false;
  const specularOff = render();
  const mixed = (row: number[][]) => row.filter(([r, , b]) => r > 10 && b > 10).length;
  const result = {
    left: bordered[12],
    right: bordered[115],
    border: bordered[63],
    plain: unbordered[63],
    narrowTransition: mixed(unbordered),
    maskTransition: mixed(maskSoftness),
    normalCenter: encodedNormals[63],
    normalEdge: encodedNormals[2],
    specularOn: specularOn[63],
    specularOff: specularOff[63],
  };
  geometry.dispose();
  material.dispose();
  for (const texture of new Set([red, ...textures.values()])) texture.dispose();
  renderer.dispose();
  environment.dispose();
  return result;
}
