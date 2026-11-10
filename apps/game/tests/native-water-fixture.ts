import * as T from "three";
import { applyNativeMapWater, type loadNativeMapWater } from "../src/native-map-water";
import { SmokeComposite, SmokeRenderer, registerSceneDepthMaterial } from "../src/smoke-renderer";
import { activateNativeMapGrade, gradeNativeMapColors } from "../src/native-map-color";
import { nativeWaterSource } from "./native-water-source-fixture";
export function renderNativeWater(
  source = nativeWaterSource,
  supplied?: { renderer: T.WebGLRenderer; bundle: Awaited<ReturnType<typeof loadNativeMapWater>> },
) {
  const renderer = supplied?.renderer ?? new T.WebGLRenderer({ antialias: false });
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
  waterMaterial.name = supplied ? "inferno_fountain" : "nuke_water";
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
  const textures = supplied?.bundle.textures ?? new Map<string, T.Texture>();
  if (!supplied)
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
    materials: { [waterMaterial.name]: source },
    banks: supplied?.bundle.banks,
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
    debug = { value: 0 },
    cubeLodOverride = { value: -1 };
  let gradeState: { value: number } | undefined;
  activeMaterial.onBeforeCompile = (shader, renderer) => {
    priorCompile(shader, renderer);
    gradeState = shader.uniforms.nativeMapGradeEnabled;
    shader.uniforms.waterFixtureDebug = debug;
    shader.uniforms.cubeLodOverride = cubeLodOverride;
    shader.fragmentShader =
      "uniform float waterFixtureDebug,cubeLodOverride;vec3 waterFixtureReceiverNormal;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "_11008 = _20489;",
      "_11008 = _20489;waterFixtureReceiverNormal=_24294;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "waterPrepare();vec3 mapN=waterState.normal;",
      "waterPrepare();if(cubeLodOverride>=0.)nativeWaterSSRLod=cubeLodOverride;vec3 mapN=waterState.normal;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "#include <opaque_fragment>\nif(waterFixtureDebug>2.5)gl_FragColor=vec4(waterFixtureReceiverNormal,1.);else if(waterFixtureDebug>1.5)gl_FragColor=vec4(material.roughness);else if(waterFixtureDebug>.5)gl_FragColor=vec4(waterState.specularPower,waterState.reflectionWeight,waterState.depth,1.0);",
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
  debug.value = 3;
  draw();
  renderer.readRenderTargetPixels(debugTarget, 32, 32, 1, 1, formula);
  const receiverNormal = [...formula].slice(0, 3).map((value) => T.DataUtils.fromHalfFloat(value));
  const cubeRoughness = [];
  if (source.selectedContract === "inferno-fountain-860-d2") {
    debug.value = 2;
    for (const waveLod of [0, 0.2, 0.8]) {
      cubeLodOverride.value = waveLod;
      draw();
      renderer.readRenderTargetPixels(debugTarget, 32, 32, 1, 1, formula);
      cubeRoughness.push({ waveLod, actual: T.DataUtils.fromHalfFloat(formula[0]) });
    }
  }
  renderer.setRenderTarget(null);
  const captured = pass.target!,
    capturedPixels = new Uint16Array(captured.width * captured.height * 4);
  renderer.readRenderTargetPixels(captured, 0, 0, captured.width, captured.height, capturedPixels);
  let contrast = -1,
    edgeX = 0,
    edgeY = 0;
  for (let y = 0; y < captured.height; y += 2)
    for (let x = 0; x < captured.width; x += 2) {
      const red = [0, 1, captured.width, captured.width + 1].map((offset) =>
        T.DataUtils.fromHalfFloat(capturedPixels[(y * captured.width + x + offset) * 4]),
      );
      const difference = Math.max(...red) - Math.min(...red);
      if (difference > contrast) {
        contrast = difference;
        edgeX = x;
        edgeY = y;
      }
    }
  const expectedMip = [0, 1, 2].map(
      (channel) =>
        [0, 1, captured.width, captured.width + 1].reduce(
          (sum, offset) =>
            sum +
            T.DataUtils.fromHalfFloat(
              capturedPixels[(edgeY * captured.width + edgeX + offset) * 4 + channel],
            ),
          0,
        ) / 4,
    ),
    mipTarget = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType }),
    mipScene = new T.Scene(),
    mipGeometry = new T.PlaneGeometry(2, 2),
    mipMaterial = new T.ShaderMaterial({
      uniforms: {
        frame: { value: captured.texture },
        probeUv: {
          value: new T.Vector2((edgeX + 1) / captured.width, (edgeY + 1) / captured.height),
        },
      },
      vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader:
        "uniform sampler2D frame;uniform vec2 probeUv;void main(){gl_FragColor=textureLod(frame,probeUv,1.);}",
    });
  mipScene.add(new T.Mesh(mipGeometry, mipMaterial));
  renderer.setRenderTarget(mipTarget);
  renderer.render(mipScene, new T.Camera());
  renderer.readRenderTargetPixels(mipTarget, 0, 0, 1, 1, formula);
  const mipProbe = {
    contrast,
    expected: expectedMip,
    actual: [...formula].slice(0, 3).map((value) => T.DataUtils.fromHalfFloat(value)),
  };
  renderer.setRenderTarget(null);
  renderer.setViewport(8, 8, 48, 48);
  mipTarget.dispose();
  mipGeometry.dispose();
  mipMaterial.dispose();
  const textureCount = renderer.info.memory.textures;
  let colorDisposed = false,
    depthDisposed = false;
  captured.addEventListener("dispose", () => {
    colorDisposed = true;
  });
  water.visible = fx.visible = smoke.batch.visible = false;
  pass.render(renderer, scene, camera, [], false);
  const cancelled = colorDisposed && !pass.target;
  pass.render(renderer, scene, camera, [], false, { setDepth() {} });
  const depthTarget = pass.target!,
    depthPoint =
      depthTarget.texture.minFilter === T.NearestFilter &&
      !depthTarget.texture.generateMipmaps &&
      depthTarget.depthTexture!.magFilter === T.NearestFilter;
  depthTarget.addEventListener("dispose", () => {
    depthDisposed = true;
  });
  water.visible = fx.visible = smoke.batch.visible = true;
  debug.value = 0;
  cubeLodOverride.value = -1;
  draw();
  const colorLifecycle = {
    cancelled,
    depthPoint,
    depthDisposed,
    restoredColor: pass.target !== depthTarget && pass.target!.texture.generateMipmaps,
    texturesStable: renderer.info.memory.textures === textureCount,
  };
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
  return {
    results,
    control,
    hole,
    solid,
    nativeFormula,
    cubeRoughness,
    receiverNormal,
    mipProbe,
    colorLifecycle,
    error,
  };
}
