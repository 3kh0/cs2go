import * as T from "three";
import { nativeSkyFrame } from "../src/native-sky-frame";
import { applyNativeMapLighting } from "../src/native-map-lighting";
import { applyNativeMapReflections } from "../src/native-map-reflections";
import type { SourceReflections } from "../src/source-reflections";

const center = new T.Vector3(10, 40, 64);
const ownCenter = new T.Vector3(center.x, center.z, -center.y).multiplyScalar(0.0254);
const placement = (scale: number) => ({
  skyCamera: { origin: [8, 40, 64], scale },
  skyboxReference: { origin: [100, 200, 300], angles: [10, 35, 15] },
});
function setup() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(64, 64);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(64, 64);
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const pixel = new Uint8Array(4);
  return { renderer, target, pixel };
}
function cameraFor(frame: ReturnType<typeof nativeSkyFrame>) {
  const camera = new T.PerspectiveCamera(45, 1, 0.01, 1000);
  camera.position
    .copy(ownCenter)
    .add(new T.Vector3(0, 0, 3))
    .applyMatrix4(frame.worldFromSkyBrowser);
  camera.up.set(0, 1, 0).transformDirection(frame.worldFromSkyBrowser);
  camera.lookAt(ownCenter.clone().applyMatrix4(frame.worldFromSkyBrowser));
  return camera;
}
function place(mesh: T.Mesh, frame: ReturnType<typeof nativeSkyFrame>) {
  mesh.matrixAutoUpdate = false;
  mesh.matrix
    .copy(frame.worldFromSkyBrowser)
    .multiply(new T.Matrix4().makeTranslation(...ownCenter.toArray()));
  mesh.updateMatrixWorld(true);
}
function texture(values: number[]) {
  const value = new T.DataTexture(new Float32Array(values), 1, 1, T.RGBAFormat, T.FloatType);
  value.minFilter = value.magFilter = T.NearestFilter;
  value.needsUpdate = true;
  return value;
}

/** Synthetic source-lightmap field with deliberately curved authored normals.
 * Uniform geometry/camera scaling must cancel the Source-unit curvature term. */
export function renderNativeSkyCurvatureFixture() {
  const { renderer, target, pixel } = setup();
  const irradiance = texture([0.2, 0.2, 0.2, 1]),
    directional = texture([0.99, 0.5, 0.3, 1]),
    shadows = texture([0, 0, 0, 1]),
    normal = texture([0.8535534, 0.5, 0.8535534, 1]);
  const results = [];
  for (const [scale, unitScale] of [
    [1, 1],
    [16, 16],
    [16, 1],
  ]) {
    const frame = nativeSkyFrame(placement(scale)),
      scene = new T.Scene();
    const geometry = new T.PlaneGeometry(2, 2, 32, 1);
    const positions = geometry.getAttribute("position"),
      normals = geometry.getAttribute("normal");
    const value = new T.Vector3();
    for (let i = 0; i < positions.count; i++) {
      value.set(positions.getX(i) * 2, 0, 1).normalize();
      normals.setXYZ(i, value.x, value.y, value.z);
    }
    geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
    geometry.computeTangents();
    const material = new T.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      normalMap: normal,
    });
    const mesh = new T.Mesh(geometry, material);
    place(mesh, frame);
    scene.add(mesh);
    const adapted = applyNativeMapLighting(scene, { irradiance, directional, shadows }, unitScale);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, cameraFor(frame));
    renderer.readRenderTargetPixels(target, 32, 32, 1, 1, pixel);
    results.push({
      scale,
      unitScale,
      pixel: Array.from(pixel.slice(0, 3)),
      error: renderer.getContext().getError(),
    });
    geometry.dispose();
    material.dispose();
    adapted.materials.forEach((entry) => entry.dispose());
  }
  [irradiance, directional, shadows, normal].forEach((entry) => entry.dispose());
  target.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}

/** Six independently colored synthetic native face layers. The same authored
 * surface and camera, placed through rotated/nonzero sky frames, must sample
 * the same own-world face; omitting the inverse frame misses the raw box. */
export function renderNativeSkyReflectionFixture() {
  const { renderer, target, pixel } = setup();
  const colors = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
  ];
  const bytes = new Uint8Array(4 * 4 * 6 * 4);
  for (let face = 0; face < 6; face++)
    for (let i = 0; i < 16; i++) bytes.set([...colors[face], 255], (face * 16 + i) * 4);
  const cube = new T.CompressedArrayTexture(
    [{ width: 4, height: 4, data: bytes }],
    4,
    4,
    6,
    T.RGB_BPTC_UNSIGNED_Format,
  );
  Object.assign(cube, { format: T.RGBAFormat, type: T.UnsignedByteType });
  cube.minFilter = cube.magFilter = T.NearestFilter;
  cube.needsUpdate = true;
  const nativeToLocal = new T.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
  const data: SourceReflections = {
    lightmapVersion: [8, 2],
    lastLod: 0,
    cubeSize: 4,
    arraySplit: 1,
    combined: true,
    textures: [cube],
    volumes: [
      {
        index: 0,
        origin: center.toArray(),
        min: [-80, -80, -80],
        max: [80, 80, 80],
        fade: [1, 1, 1],
        normalizationSH: [0, 0, 0, 0],
        worldToLocal: nativeToLocal.toArray(),
        localToWorld: nativeToLocal.clone().invert().toArray(),
        worldAABB: [center.toArray().map((v) => v - 80), center.toArray().map((v) => v + 80)],
      },
    ],
    uniforms: [
      {
        origin: center.clone(),
        index: 0,
        mins: new T.Vector3(-80, -80, -80),
        maxs: new T.Vector3(80, 80, 80),
        invEdge: new T.Vector3(1, 1, 1),
        sh: new T.Vector4(0, 0, 0, 0),
        worldToLocal: nativeToLocal,
        localToWorld: nativeToLocal.clone().invert(),
      },
    ],
  };
  const results = [];
  for (const [scale, applyFrame] of [
    [1, true],
    [16, true],
    [16, false],
  ] as const) {
    const frame = nativeSkyFrame(placement(scale)),
      scene = new T.Scene(),
      geometry = new T.PlaneGeometry(2, 2);
    const source = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 });
    const mesh = new T.Mesh(geometry, source);
    place(mesh, frame);
    scene.add(mesh);
    applyNativeMapReflections(
      scene,
      data,
      [],
      [],
      applyFrame ? { worldToNative: frame.skyBrowserFromWorld } : {},
    );
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, cameraFor(frame));
    renderer.readRenderTargetPixels(target, 32, 32, 1, 1, pixel);
    results.push({
      scale,
      applyFrame,
      pixel: Array.from(pixel.slice(0, 3)),
      error: renderer.getContext().getError(),
    });
    geometry.dispose();
    (mesh.material as T.Material).dispose();
    source.dispose();
  }
  cube.dispose();
  target.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}
