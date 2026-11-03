import * as T from "three";
import { applySourceBarns, loadSourceBarns } from "../src/source-barn";
import { applySourceMapLighting } from "../src/source-map-lighting";
import {
  registerActorLighting,
  updateActorLighting,
  disposeActorLighting,
} from "../src/actor-lighting";
import { loadSourceLighting, sampleSourceProbeLocalShadows } from "../src/source-lighting";

export async function renderSourceBarns() {
  await Promise.all([loadSourceBarns(), loadSourceLighting()]);
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(64, 64);
  const scene = new T.Scene();
  const center = new T.Vector3(-1040 * 0.0254, 0, -1424.563354 * 0.0254);
  const camera = new T.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 20);
  camera.position.copy(center).add(new T.Vector3(0, 8, 0));
  camera.up.set(0, 0, -1);
  camera.lookAt(center);
  const masks = { value: new T.Vector2() };
  const geometry = new T.PlaneGeometry(2, 2);
  const material = new T.MeshStandardMaterial({
    color: new T.Color().setRGB(0.01, 0.01, 0.01),
    roughness: 1,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.testBarnShadows = masks;
    shader.fragmentShader = "uniform vec2 testBarnShadows;\n" + shader.fragmentShader;
    applySourceBarns(shader, { mask: 1, shadows: "testBarnShadows" });
  };
  material.customProgramCacheKey = () => "native-barn-fixture";
  const mesh = new T.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(center);
  scene.add(mesh);
  const render = (targetScene = scene, targetCamera = camera) => {
    renderer.render(targetScene, targetCamera);
    const gl = renderer.getContext();
    const rgba = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    return [...rgba];
  };
  const front = render();
  masks.value.set(1, 0);
  const blockedG = render();
  masks.value.set(0, 1);
  const blockedB = render();
  masks.value.set(0, 0);
  mesh.position.y = -2;
  const farther = render();
  mesh.position.y = 3;
  const behind = render();
  mesh.position.copy(center).add(new T.Vector3(6.35, 0, 0));
  camera.position.x += 6.35;
  camera.lookAt(mesh.position);
  const outside = render();
  camera.position.x -= 6.35;
  mesh.position.copy(center).add(new T.Vector3(3.5, 0, 3.5));
  camera.position.x += 3.5;
  camera.position.z += 3.5;
  camera.lookAt(mesh.position);
  const corner = render();
  camera.position.x -= 3.5;
  camera.position.z -= 3.5;
  camera.lookAt(center);

  mesh.position.copy(center);
  const actorMaterial = new T.MeshStandardMaterial({ color: material.color, roughness: 1 });
  mesh.material = actorMaterial;
  registerActorLighting(mesh);
  const sample = (
    _position: { x: number; y: number; z: number },
    _normal: { x: number; y: number; z: number },
    out: T.Color,
  ) => {
    out.setRGB(0, 0, 0);
    return true;
  };
  const clear = (_position: { x: number; y: number; z: number }, out: T.Vector2) => {
    out.set(0, 0);
  };
  updateActorLighting(mesh, center, sample, 1, undefined, () => 1, clear);
  const worldActor = render();
  updateActorLighting(
    mesh,
    center,
    (_p, _n, out) => {
      out.setRGB(0, 0, 0);
      return false;
    },
    1,
    undefined,
    () => 1,
    clear,
  );
  const noProbeActor = render();
  mesh.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const viewGeometry = geometry
    .clone()
    .applyMatrix4(mesh.matrixWorld)
    .applyMatrix4(camera.matrixWorldInverse);
  const viewMaterial = new T.MeshStandardMaterial({ color: material.color, roughness: 1 });
  const view = new T.Mesh(viewGeometry, viewMaterial);
  const viewScene = new T.Scene();
  viewScene.add(view);
  const viewCamera = new T.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 20);
  registerActorLighting(view);
  const disabledPreview = render(viewScene, viewCamera);
  const rotation = new T.Matrix3().setFromMatrix4(camera.matrixWorld);
  updateActorLighting(view, camera.position, sample, 1, rotation, () => 1, clear);
  const viewActor = render(viewScene, viewCamera);
  updateActorLighting(
    view,
    camera.position,
    sample,
    1,
    rotation,
    () => 1,
    (_position, out) => {
      out.set(1, 1);
    },
  );
  const viewBlocked = render(viewScene, viewCamera);
  const probeG = new T.Vector2(),
    probeB = new T.Vector2();
  sampleSourceProbeLocalShadows(new T.Vector3(-1040 * 0.0254, 0, -1424 * 0.0254), probeG);
  sampleSourceProbeLocalShadows(new T.Vector3(-692 * 0.0254, 0, -1424 * 0.0254), probeB);
  mesh.visible = false;
  const mapReceiver = (probe: boolean, g: number, b: number) => {
    const geo = new T.PlaneGeometry(2, 2);
    const count = geo.getAttribute("position").count;
    const packed = (bytes: number[]) => {
      const array = new Uint8Array(count * 4);
      for (let i = 0; i < count; i++) array.set(bytes, i * 4);
      return new T.BufferAttribute(array, 4, true);
    };
    geo.setAttribute("color_1", packed(probe ? [0, 0, g, b] : [0, 128, 0, 128]));
    geo.setAttribute("color_2", packed([0, 0, 0, 255]));
    const mat = new T.MeshStandardMaterial({ color: material.color, roughness: 1 });
    const receiver = new T.Mesh(geo, mat);
    receiver.rotation.x = -Math.PI / 2;
    receiver.position.copy(center);
    const irradiance = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    const shadows = new T.DataTexture(new Uint8Array([0, probe ? 0 : g, probe ? 0 : b, 255]), 1, 1);
    irradiance.needsUpdate = shadows.needsUpdate = true;
    scene.add(receiver);
    return { receiver, geo, mat, irradiance, shadows };
  };
  const receiverPixel = async (probe: boolean, g: number, b: number) => {
    const r = mapReceiver(probe, g, b);
    applySourceMapLighting(r.receiver, {
      irradiance: r.irradiance,
      shadows: r.shadows,
      native: false,
      materialLighting: { materials: [] },
      transmissionTextures: new Map(),
      barns: await loadSourceBarns(),
    });
    const pixel = render();
    scene.remove(r.receiver);
    for (const owned of [r.geo, r.mat, r.irradiance, r.shadows]) owned.dispose();
    return pixel;
  };
  const probeGBlocked = await receiverPixel(true, 255, 0);
  const probeBOpen = await receiverPixel(true, 0, 255);
  const lightmapGBlocked = await receiverPixel(false, 255, 0);
  const lightmapOpen = await receiverPixel(false, 0, 0);
  disposeActorLighting(mesh);
  disposeActorLighting(view);
  for (const owned of [geometry, viewGeometry, material, actorMaterial, viewMaterial])
    owned.dispose();
  renderer.dispose();
  return {
    front,
    blockedG,
    blockedB,
    farther,
    behind,
    outside,
    corner,
    worldActor,
    noProbeActor,
    disabledPreview,
    viewActor,
    viewBlocked,
    probeG: probeG.toArray(),
    probeB: probeB.toArray(),
    probeGBlocked,
    probeBOpen,
    lightmapGBlocked,
    lightmapOpen,
  };
}
