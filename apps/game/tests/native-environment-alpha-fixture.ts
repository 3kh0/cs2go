import * as T from "three";
import {
  applyNativeMapEnvironment,
  type SourceEnvironmentMaterial,
} from "../src/native-map-environment";
import { createEnvironmentTextureBanks } from "../src/native-environment-textures";
import { applyNativeMapLighting } from "../src/native-map-lighting";
import { SmokeComposite } from "../src/smoke-renderer";
import { environmentAlphaShared } from "../src/native-environment-alpha";

/** One declared AA-off coverage policy in merged color, native shadow depth,
 * point-distance depth and the real SmokeComposite depth variant. This is not
 * evidence of native MSAA sample patterns or native Equal-depth pass order. */
export function renderNativeAlphaConsumers() {
  const renderer = new T.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setSize(16, 16);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const make = (left: number, right: number) => {
    const t = new T.DataTexture(
      new Uint8Array([
        192,
        64,
        96,
        left,
        192,
        64,
        96,
        right,
        192,
        64,
        96,
        left,
        192,
        64,
        96,
        right,
      ]),
      2,
      2,
    );
    t.minFilter = t.magFilter = T.NearestFilter;
    t.needsUpdate = true;
    return t;
  };
  const alpha = make(77, 204),
    unused = make(255, 255),
    frame = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  frame.needsUpdate = true;
  const textures = new Map([
      ["alpha", alpha],
      ["unused", unused],
      ["normal", frame],
      ["height", frame],
    ]),
    banks = createEnvironmentTextureBanks(
      new Map([
        ["alpha", alpha],
        ["unused", unused],
      ]),
      256,
    );
  const native: SourceEnvironmentMaterial = {
    shader: "csgo_environment.vfx",
    nativeResource: "native-alpha-consumer-probe",
    IntParams: { F_ALPHA_TEST: 1, g_nVertexColorMode1: 2 },
    FloatParams: { g_flAlphaTestReference: 0.5, g_flAlphaTestReference1: 0.2 },
    VectorParams: {},
    textures: { g_tColor1: "alpha", g_tHeight1: "height", g_tNormal1: "normal" },
    textureReflectivity: { g_tColor1: [0.2, 0.3, 0.4] },
    constants: { g_tHeight1: [0.5, 0.5, 1, 0], g_tNormal1: [128 / 255, 128 / 255, 0.5, 1] },
    nativeTextureDimensions: { g_tColor1: [2, 2], g_tHeight1: [1, 1], g_tNormal1: [1, 1] },
  };
  const geometry = new T.PlaneGeometry(2, 2);
  geometry.computeTangents();
  geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
  const original = new T.MeshStandardMaterial();
  original.name = "nativeAlpha";
  const mesh: T.Mesh<T.BufferGeometry, T.Material> = new T.Mesh(geometry, original);
  const scene = new T.Scene();
  scene.add(mesh);
  applyNativeMapEnvironment(mesh, {
    materials: { nativeAlpha: native },
    textures,
    banks: banks.bindings,
    lookup: frame,
    normalFrame: frame,
  });
  // Exercise the actual production clone path, not a hand-copied fake hook.
  applyNativeMapLighting(scene, { irradiance: frame, shadows: frame });
  const color = mesh.material as T.MeshStandardMaterial,
    compile = color.onBeforeCompile.bind(color);
  color.onBeforeCompile = (shader, r) => {
    compile(shader, r);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "gl_FragColor=vec4(1.0);",
    );
  };
  const camera = new T.PerspectiveCamera(90, 1, 0.1, 10);
  camera.position.z = 3;
  camera.updateMatrixWorld();
  const pixels = () => {
    const gl = renderer.getContext(),
      a = new Uint8Array(4),
      b = new Uint8Array(4);
    gl.readPixels(6, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, a);
    gl.readPixels(9, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
    return { hole: Array.from(a), surface: Array.from(b), error: gl.getError() };
  };
  renderer.setClearColor(0, 0);
  renderer.render(scene, camera);
  const display = pixels();
  renderer.setClearColor(0xffffff, 1);
  mesh.material = mesh.customDepthMaterial!;
  renderer.render(scene, camera);
  const shadow = pixels();
  const light = new T.PointLight();
  light.position.z = 3;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 10;
  light.updateMatrixWorld();
  (renderer.properties.get(mesh.customDistanceMaterial!) as { light: T.PointLight }).light = light;
  mesh.material = mesh.customDistanceMaterial!;
  renderer.render(scene, camera);
  const distance = pixels();
  mesh.material = color;
  let depth: T.DepthTexture | undefined;
  const smoke = new SmokeComposite();
  renderer.setClearColor(0, 0);
  smoke.render(renderer, scene, camera, [], false, {
    setDepth(value) {
      depth = value;
    },
  });
  const restored = mesh.material === color;
  const showDepth = new T.ShaderMaterial({
    uniforms: { depth: { value: depth } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}",
    fragmentShader:
      "uniform sampler2D depth;varying vec2 vUv;void main(){float d=texture2D(depth,vUv).r;gl_FragColor=vec4(vec3(d),1.0);}",
  });
  const quadGeometry = new T.PlaneGeometry(2, 2),
    quadScene = new T.Scene();
  quadScene.add(new T.Mesh(quadGeometry, showDepth));
  renderer.render(quadScene, camera);
  const smokeDepth = pixels();
  const result = {
    display,
    shadow,
    distance,
    smokeDepth,
    restored,
    mapDetached: color.map === null,
    alphaToCoverage: color.alphaToCoverage,
    bankDepth: banks.arrays[0].image.depth,
  };
  original.dispose();
  color.dispose();
  geometry.dispose();
  mesh.customDepthMaterial?.dispose();
  mesh.customDistanceMaterial?.dispose();
  smoke.target?.dispose();
  quadGeometry.dispose();
  showDepth.dispose();
  alpha.dispose();
  unused.dispose();
  frame.dispose();
  banks.arrays.forEach((t) => t.dispose());
  renderer.dispose();
  renderer.forceContextLoss();
  return result;
}

/** Literal native AA-on counterexample with known linear screen derivatives;
 * the engine's actual runtime AA upload remains unobserved. */
export function renderNativeAlphaEquations() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(8, 8);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(),
    camera = new T.Camera(),
    geometry = new T.PlaneGeometry(2, 2),
    results = [];
  for (const [strength, expected] of [
    [1, 69],
    [0, 125],
  ] as const) {
    const material = new T.ShaderMaterial({
      vertexShader: "void main(){gl_Position=vec4(position,1.0);}",
      fragmentShader: `${environmentAlphaShared}\nvoid main(){float alpha=.49+.04*(gl_FragCoord.x-4.5);vec2 uv=vec2(.02*gl_FragCoord.x,0.0);float coverage=environmentAlphaCoverage(alpha,uv,.5,${strength === 1 ? "1.0" : "0.0"},true);gl_FragColor=vec4(vec3(coverage),1.0);}`,
    });
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      data = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
    results.push({ strength, expected, actual: Array.from(data), error: gl.getError() });
    scene.remove(mesh);
    material.dispose();
  }
  geometry.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}
