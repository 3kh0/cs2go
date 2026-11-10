import * as T from "three";
import { NativeWorldFrameComposite } from "../src/native-world-frame-composite";
import {
  activateNativeMapGrade,
  gradeNativeMapColors,
  loadNativeMapGrade,
} from "../src/native-map-color";
import { applyNativeStaticOverlays } from "../src/native-static-overlay";
export async function renderNativeWorldFrame() {
  const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(16, 16);
  renderer.toneMapping = T.CustomToneMapping;
  renderer.outputColorSpace = T.SRGBColorSpace;
  const config = await (await fetch("/models/maps/nuke-config.json")).json(),
    grade = await loadNativeMapGrade(config.postprocess);
  activateNativeMapGrade(grade);
  const geometry = new T.PlaneGeometry(2, 2),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const values = {
    base: [1.2, 0.2, 0.08],
    alpha: [0.05, 0.8, 0.1],
    add: [0.12, 0.05, 0.3],
    mod: [0.7, 0.3, 0.6],
  };
  function surface(color: number[], alpha = 1, add = false) {
    return new T.ShaderMaterial({
      transparent: alpha < 1 || add,
      depthTest: false,
      depthWrite: false,
      blending: add ? T.AdditiveBlending : T.NormalBlending,
      uniforms: { color: { value: new T.Vector3(...color) }, alpha: { value: alpha } },
      vertexShader: "void main(){gl_Position=vec4(position,1.0);}",
      fragmentShader:
        "uniform vec3 color;uniform float alpha;void main(){gl_FragColor=vec4(color,alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
    });
  }
  const materials: T.Material[] = [];
  const textures: T.Texture[] = [];
  function scene(mixed: boolean, color = values.base) {
    const scene = new T.Scene();
    const base = surface(color);
    materials.push(base);
    scene.add(new T.Mesh(geometry, base));
    if (mixed) {
      const a = surface(values.alpha, 0.35),
        b = surface(values.add, 1, true);
      materials.push(a, b);
      const am = new T.Mesh(geometry, a),
        bm = new T.Mesh(geometry, b);
      am.renderOrder = 1;
      bm.renderOrder = 2;
      scene.add(am, bm);
      const tex = new T.DataTexture(
        new Float32Array([...values.mod, 1]),
        1,
        1,
        T.RGBAFormat,
        T.FloatType,
      );
      tex.needsUpdate = true;
      textures.push(tex);
      const old = new T.MeshStandardMaterial({ map: tex, opacity: 0.4 });
      old.name = "native_mod2x";
      materials.push(old);
      const overlay = new T.Mesh(geometry, old);
      overlay.renderOrder = 3;
      scene.add(overlay);
      applyNativeStaticOverlays(scene, [
        {
          name: old.name,
          staticOverlay: {
            IntParams: { F_BLEND_MODE: 3, F_LIT: 0 },
            FloatParams: {},
            VectorParams: {},
          },
        },
      ]);
      materials.push(overlay.material as T.Material);
    }
    gradeNativeMapColors(scene);
    return scene;
  }
  const opaque = scene(false),
    mixed = scene(true),
    expectedHdr = values.base.map(
      (v, i) =>
        (v * 0.65 + values.alpha[i] * 0.35 + values.add[i]) *
        2 *
        (0.5 + (values.mod[i] - 0.5) * 0.4),
    ),
    reference = scene(false, expectedHdr);
  const composites = [
    new NativeWorldFrameComposite(renderer, grade, 0),
    new NativeWorldFrameComposite(renderer, grade, 4),
  ];
  const pixel = () => {
    const p = new Uint8Array(4);
    renderer
      .getContext()
      .readPixels(16, 16, 1, 1, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, p);
    return [...p];
  };
  function draw(scene: T.Scene) {
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, 16, 16);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
    renderer.toneMapping = T.CustomToneMapping;
    renderer.render(scene, camera);
    return pixel();
  }
  const oldOpaque = draw(opaque),
    wrongMixed = draw(mixed),
    results = [];
  for (const composite of composites) {
    draw(opaque);
    composite.render(renderer, () => renderer.render(opaque, camera));
    const newOpaque = pixel();
    composite.render(renderer, () => renderer.render(reference, camera));
    const expected = pixel();
    composite.render(renderer, () => renderer.render(mixed, camera));
    results.push({
      samples: composite.target.samples,
      newOpaque,
      expected,
      actual: pixel(),
      error: renderer.getContext().getError(),
    });
  }
  const composite = composites[0];
  const shadowScene = new T.Scene(),
    shadowMaterial = new T.MeshBasicMaterial({ color: 0xffffff }),
    caster = new T.Mesh(geometry, shadowMaterial),
    light = new T.DirectionalLight(0xffffff, 1);
  materials.push(shadowMaterial);
  caster.castShadow = true;
  light.position.set(0, 0, 3);
  light.castShadow = true;
  light.shadow.mapSize.set(16, 16);
  Object.assign(light.shadow.camera, {
    left: -1,
    right: 1,
    top: 1,
    bottom: -1,
    near: 0.1,
    far: 10,
  });
  light.shadow.camera.updateProjectionMatrix();
  shadowScene.add(caster, light, light.target);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.info.autoReset = false;
  renderer.info.reset();
  composite.render(renderer, () => renderer.render(shadowScene, camera));
  const shadowFirst = {
    calls: renderer.info.render.calls,
    needsUpdate: renderer.shadowMap.needsUpdate,
  };
  renderer.info.reset();
  composite.render(renderer, () => renderer.render(shadowScene, camera));
  const shadowSecond = {
    calls: renderer.info.render.calls,
    needsUpdate: renderer.shadowMap.needsUpdate,
  };
  const shadowResult = {
    first: shadowFirst,
    second: shadowSecond,
    error: renderer.getContext().getError(),
  };
  renderer.info.autoReset = true;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.autoUpdate = true;
  renderer.shadowMap.needsUpdate = false;
  light.shadow.dispose();
  const cold = scene(false);
  const coldMaterial = (cold.children[0] as T.Mesh).material as T.ShaderMaterial;
  coldMaterial.defines = { NATIVE_PREPARE_CONTROL: 1 };
  const prepareState = {
    tone: renderer.toneMapping,
    target: renderer.getRenderTarget(),
    viewport: renderer.getViewport(new T.Vector4()).toArray(),
  };
  composite.prepare(renderer, () => {
    renderer.compile(cold, camera);
  });
  const preparedPrograms = renderer.info.programs?.length ?? 0;
  const prepareRestored =
    prepareState.tone === renderer.toneMapping &&
    prepareState.target === renderer.getRenderTarget() &&
    JSON.stringify(prepareState.viewport) ===
      JSON.stringify(renderer.getViewport(new T.Vector4()).toArray());
  composite.render(renderer, () => renderer.render(cold, camera));
  const prepareResult = {
    preparedPrograms,
    renderedPrograms: renderer.info.programs?.length ?? 0,
    pixel: pixel(),
    restored: prepareRestored,
    error: renderer.getContext().getError(),
  };
  renderer.setViewport(1, 2, 10, 8);
  renderer.setScissor(2, 3, 5, 4);
  renderer.setScissorTest(true);
  renderer.autoClear = false;
  renderer.setClearColor(new T.Color(0.1, 0.2, 0.3), 0.6);
  const state = () => ({
    viewport: renderer.getViewport(new T.Vector4()).toArray(),
    current: renderer.getCurrentViewport(new T.Vector4()).toArray(),
    scissor: renderer.getScissor(new T.Vector4()).toArray(),
    scissorTest: renderer.getScissorTest(),
    autoClear: renderer.autoClear,
    tone: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    clear: renderer.getClearColor(new T.Color()).toArray(),
    alpha: renderer.getClearAlpha(),
    target: renderer.getRenderTarget() === null,
    shadowAuto: renderer.shadowMap.autoUpdate,
    shadowNeeds: renderer.shadowMap.needsUpdate,
  });
  const before = state();
  let threw = false;
  try {
    composite.render(renderer, () => {
      renderer.setViewport(4, 5, 6, 7);
      renderer.setScissorTest(false);
      renderer.autoClear = true;
      renderer.toneMapping = T.NoToneMapping;
      renderer.toneMappingExposure = 2;
      renderer.setClearColor(0xff0000);
      renderer.shadowMap.autoUpdate = false;
      throw Error("draw failed");
    });
  } catch {
    threw = true;
  }
  const after = state();
  const afterException = draw(opaque);
  const offscreen = new T.WebGLRenderTarget(32, 32);
  renderer.setRenderTarget(offscreen);
  renderer.setScissorTest(false);
  renderer.setClearColor(0x00ff00);
  renderer.clear();
  renderer.setViewport(1, 1, 5, 5);
  renderer.setScissor(1, 1, 4, 4);
  renderer.setScissorTest(false);
  offscreen.viewport.set(4, 6, 20, 12);
  offscreen.scissor.set(5, 7, 10, 8);
  offscreen.scissorTest = true;
  renderer.setRenderTarget(offscreen);
  const offscreenBefore = state();
  composite.render(renderer, () => renderer.render(opaque, camera));
  const offscreenAfter = state();
  const inside = new Uint8Array(4),
    outside = new Uint8Array(4);
  renderer.readRenderTargetPixels(offscreen, 8, 9, 1, 1, inside);
  renderer.readRenderTargetPixels(offscreen, 0, 0, 1, 1, outside);
  const offscreenResult = {
    before: offscreenBefore,
    after: offscreenAfter,
    inside: [...inside],
    outside: [...outside],
    error: renderer.getContext().getError(),
  };
  renderer.setRenderTarget(null);
  offscreen.dispose();
  let disposed = 0,
    borrowedDisposed = 0;
  grade.texture.addEventListener("dispose", () => borrowedDisposed++);
  for (const c of composites) {
    c.target.addEventListener("dispose", () => disposed++);
    c.dispose();
    c.dispose();
  }
  const borrowedBeforeOwnerDispose = borrowedDisposed;
  geometry.dispose();
  for (const material of new Set(materials)) material.dispose();
  textures.forEach((t) => t.dispose());
  activateNativeMapGrade();
  grade.texture.dispose();
  renderer.dispose();
  return {
    oldOpaque,
    shadowResult,
    prepareResult,
    offscreenResult,
    wrongMixed,
    expectedHdr,
    results,
    before,
    after,
    threw,
    afterException,
    disposed,
    borrowedDisposed,
    borrowedBeforeOwnerDispose,
  };
}
