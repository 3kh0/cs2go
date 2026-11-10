import * as T from "three";
import {
  nativeWaterSSR,
  nativeWaterOil,
  nativeWaterSSRDeclarations,
  waterSSRProjectionFromBrowser,
} from "../src/native-water-ssr";
export function renderNativeWaterSSR() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.toneMapping = T.NoToneMapping;
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType }),
    scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10),
    projection = new T.PerspectiveCamera(65, 1, 0.05, 250).projectionMatrix;
  const sourceDepth = { value: 0 },
    depthData = new Float32Array([0, 0, 0, 1]),
    depth = new T.DataTexture(depthData, 1, 1, T.RGBAFormat, T.FloatType);
  depth.needsUpdate = true;
  const colors = new Float32Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++)
      colors.set([(x + 0.5) / 32, (y + 0.5) / 32, 0.3, 1], (y * 64 + x) * 4);
  const color = new T.DataTexture(colors, 64, 64, T.RGBAFormat, T.FloatType);
  color.minFilter = color.magFilter = T.LinearFilter;
  color.needsUpdate = true;
  const uniforms = {
    g_tSceneDepth: { value: depth },
    g_tRefractionMap: { value: color },
    waterForwardSource: { value: new T.Vector3(0, 0, 0) },
    waterSourceViewTranspose: { value: new T.Matrix4() },
    waterSSRViewToClip: { value: waterSSRProjectionFromBrowser(projection) },
    waterDepthCoefficients: { value: new T.Vector2(0.0254 / 0.05 - 0.0254 / 250, -0.0254 / 0.05) },
    waterTime: { value: 0 },
    testMode: { value: 0 },
    testSourcePosition: { value: new T.Vector3(0, 0, -100) },
    testSourceNormal: { value: new T.Vector3(0, 0, 1) },
    testA: { value: 0.25 },
    testThickness: { value: 0.05 },
  };
  const prefix = `uniform sampler2D g_tSceneDepth,g_tRefractionMap;uniform vec3 waterForwardSource;uniform mat4 waterSourceViewTranspose;uniform vec2 waterDepthCoefficients;uniform float waterTime;uniform int testMode;uniform float testA,testThickness;uniform vec3 testSourcePosition,testSourceNormal;
 struct NativeWaterState{vec3 normal;float distance,alphaEdge,debrisEdge,thickness;};NativeWaterState waterState;
 const uint g_nSSRMaxForwardSteps=32u;const float g_flSSRSampleJitter=.01,g_flSSRMaxThickness=3.,g_flSSRStepSize=.3,g_flSSRBoost=0.,g_flSSRBoostThreshold=1.,g_flSSRBrightness=1.,g_flDebrisOilyness=.1;
 ${nativeWaterSSRDeclarations}`;
  const body = `void main(){waterState.normal=testSourceNormal;waterState.distance=100.;waterState.alphaEdge=2.*(testA-.5);waterState.debrisEdge=max(0.,1.-2.*testA);waterState.thickness=testThickness;nativeWaterSSRPosition=testSourcePosition;nativeWaterSSRNoise=.5;nativeWaterSSRLod=0.;nativeWaterSSRCos=1.;nativeWaterSSRFresnel=.05;gl_FragColor=vec4(testMode==1?nativeWaterFountainOil(vec3(1.)):nativeWaterFountainReflection(vec3(.1,.2,.8),vec3(0.)),1.);}`;
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: prefix + nativeWaterSSR + nativeWaterOil + body,
  });
  scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), material));
  const pixel = new Float32Array(4),
    rows: { name: string; pixel: number[]; error: number }[] = [];
  const draw = (name: string) => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    rows.push({ name, pixel: [...pixel], error: renderer.getContext().getError() });
  };
  const setDepth = (z: number) => {
    const clip = new T.Vector4(0, 0, z * 0.0254, 1).applyMatrix4(projection);
    sourceDepth.value = (clip.z / clip.w) * 0.5 + 0.5;
    depthData[0] = sourceDepth.value;
    depth.needsUpdate = true;
  };
  setDepth(-90);
  draw("hit");
  setDepth(-1000);
  draw("miss");
  setDepth(-90);
  uniforms.waterForwardSource.value.z = -1;
  draw("zeroSteps");
  uniforms.waterForwardSource.value.z = 0;
  material.fragmentShader = (prefix + nativeWaterSSR + nativeWaterOil + body)
    .replaceAll("0.001953125", "0.0625")
    .replaceAll("0.00390625", "0.125");
  material.needsUpdate = true;
  draw("wrongResolutionOffsets");
  material.fragmentShader = prefix + nativeWaterSSR + nativeWaterOil + body;
  material.needsUpdate = true;
  const sourceToBrowser = new T.Matrix4().set(
    0.0254,
    0,
    0,
    0,
    0,
    0,
    0.0254,
    0,
    0,
    -0.0254,
    0,
    0,
    0,
    0,
    0,
    1,
  );
  for (const [name, position, targetPoint, fov, near, far] of [
    ["translatedRotated", [3, 5, 7], [0, 0, 0], 65, 0.05, 250],
    ["differentFovNearFar", [-8, 2, 1], [4, -3, 9], 95, 0.5, 50],
  ] as const) {
    const c = new T.PerspectiveCamera(fov, 1, near, far);
    c.position.fromArray(position);
    c.lookAt(targetPoint[0], targetPoint[1], targetPoint[2]);
    c.updateMatrixWorld();
    const point = new T.Vector3(0, 0, -2.54).applyMatrix4(c.matrixWorld),
      normal = new T.Vector3(0, 0, 1).transformDirection(c.matrixWorld);
    uniforms.testSourcePosition.value.set(point.x, -point.z, point.y).divideScalar(0.0254);
    uniforms.testSourceNormal.value.set(normal.x / 6, -normal.z / 6, normal.y).normalize();
    uniforms.waterSourceViewTranspose.value
      .copy(new T.Matrix4().makeScale(1 / 0.0254, 1 / 0.0254, 1 / 0.0254))
      .multiply(c.matrixWorldInverse)
      .multiply(sourceToBrowser)
      .transpose();
    uniforms.waterSSRViewToClip.value.copy(waterSSRProjectionFromBrowser(c.projectionMatrix));
    projection.copy(c.projectionMatrix);
    uniforms.waterDepthCoefficients.value.set(0.0254 / near - 0.0254 / far, -0.0254 / near);
    setDepth(-90);
    draw(name);
    if (name === "translatedRotated") {
      uniforms.waterSSRViewToClip.value.copy(
        waterSSRProjectionFromBrowser(c.projectionMatrix.clone().multiply(c.matrixWorldInverse)),
      );
      draw("wrongWorldProjection");
    }
  }
  uniforms.testMode.value = 1;
  draw("oilActiveNoVisibleDebris");
  uniforms.testA.value = 0.5;
  draw("oilAlphaHalf");
  uniforms.testA.value = 0.25;
  uniforms.testThickness.value = 0.2;
  draw("oilDeep");
  uniforms.testThickness.value = 0.05;
  uniforms.waterTime.value = 0.5;
  draw("oilTime");
  const programs = (renderer.info.programs ?? []).map((p) => {
    const gl = renderer.getContext();
    return {
      linked: gl.getProgramParameter(p.program as WebGLProgram, gl.LINK_STATUS),
      log: gl.getProgramInfoLog(p.program as WebGLProgram),
    };
  });
  target.dispose();
  depth.dispose();
  color.dispose();
  material.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return { rows, programs };
}

export async function renderActualNativeFountain(
  path = "/models/maps/inferno-water-09/source.json",
) {
  const { loadNativeMapWater } = await import("../src/native-map-water");
  const { renderNativeWater } = await import("./native-water-fixture");
  const renderer = new T.WebGLRenderer({ antialias: false });
  const bundle = await loadNativeMapWater(renderer, path);
  const source = bundle.materials.inferno_fountain;
  const proof = {
    resource: source.nativeResource,
    contract: source.selectedContract,
    nativeSourceSha256: source.nativeSourceSha256,
    textures: bundle.textures.size,
    banks: bundle.banks.arrays.length,
  };
  return { ...renderNativeWater(source, { renderer, bundle }), proof };
}
