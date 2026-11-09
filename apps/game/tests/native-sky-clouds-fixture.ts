import * as T from "three";
import { createNativeSkyEffect, type NativeSkyEffectParameters } from "../src/native-sky-clouds";

export function renderNativeSkyEffectFixture() {
  const renderer = new T.WebGLRenderer();
  renderer.setSize(32, 32);
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(32, 32, { type: T.FloatType });
  const depthTarget = new T.WebGLRenderTarget(32, 32);
  depthTarget.depthTexture = new T.DepthTexture(32, 32);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  camera.updateMatrixWorld(true);
  const geometry = new T.PlaneGeometry(2, 2);
  const colors = new Float32Array(geometry.getAttribute("position").count * 4);
  for (let i = 0; i < colors.length; i += 4) colors.set([0.8, 0.6, 0.4, 0.5], i);
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 4));
  const source = new T.MeshStandardMaterial({
    color: new T.Color().setRGB(0.6, 0.8, 1),
    opacity: 0.75,
  });
  const owned: T.Texture[] = [];
  const constant = (rgba: number[]) => {
    const t = new T.DataTexture(new Float32Array(rgba), 1, 1, T.RGBAFormat, T.FloatType);
    t.needsUpdate = true;
    owned.push(t);
    return t;
  };
  const textures = new Map<string, T.Texture>([
    ["color", constant([0.25, 0.5, 0.75, 0.8])],
    ["m1", constant([0.5, 0, 0, 1])],
    ["m2", constant([0.25, 0, 0, 1])],
    ["m3", constant([0.75, 0, 0, 1])],
  ]);
  const params: NativeSkyEffectParameters = {
    IntParams: { F_DO_NOT_CAST_SHADOWS: 1, g_bFogEnabled: 0 },
    FloatParams: {
      g_flColorBoost: 1.5,
      g_flOpacityScale: 0.8,
      g_flFadeDistance: 1,
      g_flFresnelExponent: 0.001,
      g_flFeatherDistance: 1,
      g_flFeatherFalloff: 2,
    },
    VectorParams: {},
    TextureParams: { g_tColor: "color", g_tMask1: "m1", g_tMask2: "m2", g_tMask3: "m3" },
  };
  const time = { value: 0 };
  const uniforms = {
    time,
    depth: { value: depthTarget.depthTexture },
    resolution: { value: new T.Vector2(32, 32) },
    inverseProjection: { value: camera.projectionMatrixInverse },
  };
  const materials: T.ShaderMaterial[] = [];
  const scene = new T.Scene();
  scene.background = new T.Color(0, 0, 0);
  const make = (definition: NativeSkyEffectParameters) => {
    const m = createNativeSkyEffect(source, definition, textures, uniforms);
    materials.push(m);
    return m;
  };
  const mesh = new T.Mesh(geometry, make(params));
  scene.add(mesh);
  const pixel = () => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const buffer = new Float32Array(4);
    renderer.readRenderTargetPixels(target, 16, 16, 1, 1, buffer);
    return Array.from(buffer).slice(0, 3);
  };
  const native = pixel();
  const viewLength = Math.sqrt(3 ** 2 + 2 * (1 / 32) ** 2);
  const fresnel = Math.pow(3 / viewLength, 0.001);
  const alpha = 0.8 * 0.5 * 0.75 * 0.8 * 0.5 * 0.25 * 0.75 * fresnel;
  const expected = [0.25 * 0.6 * 0.8 * 1.5, 0.5 * 0.8 * 0.6 * 1.5, 0.75 * 1 * 0.4 * 1.5].map(
    (v) => v * alpha,
  );
  const opaqueScene = new T.Scene();
  const opaqueGeometry = new T.PlaneGeometry(2, 2),
    opaqueMaterial = new T.MeshBasicMaterial();
  const opaque = new T.Mesh(opaqueGeometry, opaqueMaterial);
  opaque.position.z = -0.0127;
  opaqueScene.add(opaque);
  renderer.setRenderTarget(depthTarget);
  renderer.render(opaqueScene, camera);
  mesh.material = make({ ...params, IntParams: { ...params.IntParams, F_DEPTH_FEATHER: 1 } });
  const feathered = pixel();
  const scaled = createNativeSkyEffect(
    source,
    { ...params, IntParams: { ...params.IntParams, F_DEPTH_FEATHER: 1 } },
    textures,
    { ...uniforms, sourceScale: 16 },
  );
  materials.push(scaled);
  mesh.material = scaled;
  const scaledFeathered = pixel();
  const background = [0.1, 0.2, 0.3];
  scene.background.setRGB(...(background as [number, number, number]));
  mesh.material = make({ ...params, IntParams: { ...params.IntParams, F_ADDITIVE_BLEND: 1 } });
  const additive = pixel();
  scene.background.setRGB(0, 0, 0);
  const ramp = new Uint8Array(64 * 4);
  for (let i = 0; i < 64; i++) ramp.set([Math.round((i / 63) * 255), 0, 0, 255], i * 4);
  const moving = new T.DataTexture(ramp, 64, 1);
  moving.wrapS = moving.wrapT = T.RepeatWrapping;
  moving.needsUpdate = true;
  owned.push(moving);
  textures.set("m1", moving);
  mesh.material = make({ ...params, VectorParams: { g_vMask1PanSpeed: [0.25, 0] } });
  const start = pixel();
  time.value = 1;
  const panned = pixel();
  const result = {
    native,
    expected,
    feathered,
    featherExpected: expected.map((v) => v * 0.25),
    scaledFeathered,
    scaledFeatherExpected: expected.map((v) => v * (0.0127 / (0.0254 * 16)) ** 2),
    additive,
    additiveExpected: expected.map((v, i) => v + background[i]),
    start,
    panned,
    glError: renderer.getContext().getError(),
  };
  materials.forEach((m) => m.dispose());
  owned.forEach((t) => t.dispose());
  geometry.dispose();
  source.dispose();
  opaqueGeometry.dispose();
  opaqueMaterial.dispose();
  depthTarget.dispose();
  target.dispose();
  renderer.dispose();
  return result;
}
