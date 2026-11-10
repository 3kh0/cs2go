import * as T from "three";
import { applyNativeMapWater } from "../src/native-map-water";
import { SmokeComposite, SmokeRenderer, registerSceneDepthMaterial } from "../src/smoke-renderer";
import { activateNativeMapGrade, gradeNativeMapColors } from "../src/native-map-color";
import { nativeWaterSource } from "./native-water-source-fixture";
export function renderNativeWater() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(64, 64);
  renderer.setViewport(8, 8, 48, 48);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.outputColorSpace = T.SRGBColorSpace;
  const scene = new T.Scene();
  scene.background = new T.Color(0.2, 0.3, 0.4);
  const camera = new T.PerspectiveCamera(65, 1, 0.1, 100);
  camera.position.set(0, 2, 2);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const group = new T.Group();
  scene.add(group);
  const waterMaterial = new T.MeshStandardMaterial();
  waterMaterial.name = "nuke_water";
  const water = new T.Mesh(new T.PlaneGeometry(6, 6), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  group.add(water);
  const floor = new T.Mesh(
    new T.PlaneGeometry(20, 20),
    new T.MeshBasicMaterial({ color: new T.Color(1.7, 0.2, 0.05) }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  scene.add(floor);
  const cutoutTexture = new T.DataTexture(
    new Uint8Array([255, 255, 255, 0, 255, 255, 255, 255]),
    2,
    1,
  );
  cutoutTexture.needsUpdate = true;
  const cutout = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({ map: cutoutTexture, alphaTest: 0.5, side: T.DoubleSide }),
  );
  cutout.position.set(-0.5, 0.1, -1);
  scene.add(cutout);
  const sun = new T.DirectionalLight(0xffffff, 0.5);
  sun.position.set(1, 2, 1);
  scene.add(sun, new T.HemisphereLight(0xffffff, 0xffffff, 0.4));
  const textures = new Map<string, T.Texture>();
  for (const [name, data] of [
    ["g_tDebris", [128, 128, 128, 128]],
    ["g_tDebrisNormal", [128, 128, 255, 255]],
    ["g_tFoam", [128, 128, 0, 255]],
    ["g_tWavesNormalHeight", [112, 148, 140, 255]],
  ] as const) {
    const texture = new T.DataTexture(new Uint8Array(data), 1, 1);
    texture.needsUpdate = true;
    textures.set(name, texture);
  }
  const native = applyNativeMapWater(group, {
    materials: { nuke_water: nativeWaterSource },
    textures,
  });
  const fxMaterial = new T.ShaderMaterial({
    uniforms: { sceneDepth: { value: native.textures.at(-1) } },
    vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:
      "uniform sampler2D sceneDepth;void main(){gl_FragColor=vec4(texture2D(sceneDepth,gl_FragCoord.xy/64.0).xxx,1.0);}",
    depthWrite: false,
  });
  registerSceneDepthMaterial(fxMaterial);
  const fx = new T.Mesh(new T.PlaneGeometry(0.25, 0.25), fxMaterial);
  fx.position.set(1, 0.5, 0);
  scene.add(fx);
  const smoke = new SmokeRenderer([new T.Vector3(1.8, 0.4, 0)], new T.SphereGeometry(1, 8, 6));
  smoke.batch.position.set(0, 0, 0);
  scene.add(smoke.batch);
  const pass = new SmokeComposite();
  const lutBytes = new Uint8Array(32 ** 3 * 4);
  for (let z = 0; z < 32; z++)
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const i = ((z * 32 + y) * 32 + x) * 4;
        lutBytes.set([(x * 255) / 31, (y * 255) / 31, (z * 255) / 31, 255], i);
      }
  const lut = new T.Data3DTexture(lutBytes, 32, 32, 32);
  lut.minFilter = lut.magFilter = T.LinearFilter;
  lut.needsUpdate = true;
  activateNativeMapGrade({
    texture: lut,
    exposure: 1,
    parameters: {
      m_flShoulderStrength: 0,
      m_flLinearStrength: 0.0009,
      m_flLinearAngle: 0.0009,
      m_flToeStrength: 1,
      m_flToeNum: 1,
      m_flToeDenom: 1,
      m_flWhitePoint: 1.648926,
      m_flExposureBias: 0,
    },
  });
  gradeNativeMapColors(scene);
  const activeMaterial = water.material as T.MeshStandardMaterial,
    priorCompile = activeMaterial.onBeforeCompile.bind(activeMaterial),
    debug = { value: 0 };
  let gradeState: { value: number } | undefined;
  activeMaterial.onBeforeCompile = (shader, renderer) => {
    priorCompile(shader, renderer);
    gradeState = shader.uniforms.nativeMapGradeEnabled;
    shader.uniforms.waterFixtureDebug = debug;
    shader.fragmentShader = "uniform float waterFixtureDebug;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "#include <opaque_fragment>\nif(waterFixtureDebug>.5)gl_FragColor=vec4(waterState.specularPower,waterState.reflectionWeight,waterState.depth,1.0);",
    );
  };
  const draw = (low = false) => {
    native.prepareFrame(camera, 3.25, sun);
    pass.render(renderer, scene, camera, [smoke], low, {
      ...native,
      setDepth(texture, viewport, inverse) {
        native.setDepth(texture, viewport, inverse);
        fxMaterial.uniforms.sceneDepth.value = texture;
      },
    });
  };
  const readPixel = () => {
    const gl = renderer.getContext(),
      bytes = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return [...bytes];
  };
  water.visible = false;
  draw();
  const control = readPixel();
  water.visible = true;
  const results = [];
  for (const low of [false, true, false]) {
    draw(low);
    const gl = renderer.getContext(),
      pixel = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const hdr = new Uint16Array(4);
    renderer.readRenderTargetPixels(
      pass.target!,
      pass.target!.width / 2,
      pass.target!.height / 2,
      1,
      1,
      hdr,
    );
    results.push({
      error: gl.getError(),
      pixel: [...pixel],
      hdr: [...hdr].map((value) => T.DataUtils.fromHalfFloat(value)),
      size: pass.target!.width,
      fxVisible: fx.visible,
      waterVisible: water.visible,
      backgroundRestored: scene.background !== null,
      toneMapping: renderer.toneMapping,
      gradeEnabled: gradeState?.value,
      viewport: renderer.getViewport(new T.Vector4()).toArray(),
    });
  }
  const depthReadTarget = new T.WebGLRenderTarget(1, 1),
    depthScene = new T.Scene(),
    depthCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  depthCamera.position.z = 1;
  const probePoint = cutout.localToWorld(new T.Vector3(-0.25, 0, 0)).project(camera);
  const depthMaterial = new T.ShaderMaterial({
    uniforms: {
      depth: { value: pass.target!.depthTexture },
      point: { value: new T.Vector2(probePoint.x * 0.5 + 0.5, probePoint.y * 0.5 + 0.5) },
    },
    vertexShader: "void main(){gl_Position=vec4(position,1.0);}",
    fragmentShader:
      "uniform sampler2D depth;uniform vec2 point;void main(){gl_FragColor=vec4(vec3(texture2D(depth,point).r),1.0);}",
    toneMapped: false,
  });
  depthScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), depthMaterial));
  const sampleDepth = () => {
    depthMaterial.uniforms.depth.value = pass.target!.depthTexture;
    renderer.setRenderTarget(depthReadTarget);
    renderer.render(depthScene, depthCamera);
    const b = new Uint8Array(4);
    renderer.readRenderTargetPixels(depthReadTarget, 0, 0, 1, 1, b);
    renderer.setRenderTarget(null);
    renderer.setViewport(8, 8, 48, 48);
    return b[0];
  };
  const hole = sampleDepth();
  cutout.material.alphaTest = 0;
  draw();
  const solid = sampleDepth();
  cutout.material.alphaTest = 0.5;
  activateNativeMapGrade();
  renderer.toneMapping = T.NoToneMapping;
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  debug.value = 1;
  const debugTarget = new T.WebGLRenderTarget(64, 64, { type: T.HalfFloatType });
  renderer.setRenderTarget(debugTarget);
  renderer.setViewport(8, 8, 48, 48);
  draw();
  const formula = new Uint16Array(4);
  renderer.readRenderTargetPixels(debugTarget, 32, 32, 1, 1, formula);
  const nativeFormula = [...formula].map((value) => T.DataUtils.fromHalfFloat(value));
  renderer.setRenderTarget(null);
  const error = renderer.getContext().getError();
  pass.target?.dispose();
  depthReadTarget.dispose();
  depthMaterial.dispose();
  debugTarget.dispose();
  lut.dispose();
  smoke.dispose();
  for (const t of native.textures) t.dispose();
  cutoutTexture.dispose();
  renderer.dispose();
  return { results, control, hole, solid, nativeFormula, error };
}
