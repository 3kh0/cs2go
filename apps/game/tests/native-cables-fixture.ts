import * as T from "three";
import { applyNativeMapProbes } from "../src/native-map-probes";
import { applySourceDepth } from "../src/source-depth";
import {
  applyNativeMapCables,
  sourceCableViewScale,
  sourceCableWidth,
} from "../src/native-map-cables";

/** Isolated native radius/coverage/blend equations, with debug white RGB to
 * remove lighting from the measurement. This is not a whole-map colour proof. */
export function renderNativeCableFixture(
  options: {
    distance?: number;
    clamp?: boolean;
    noCoverageFloor?: boolean;
    euclideanDepth?: boolean;
    centerX?: number;
    pose?: "parent" | "baked";
    wrongModelScale?: boolean;
    staleFov?: boolean;
    cloneDepth?: boolean;
    orthographic?: boolean;
    capture?: boolean;
  } = {},
) {
  const size = 64;
  const radius = 0.1;
  const distance = options.distance ?? 10;
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setSize(size, size);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.setClearColor(0, 1);
  const target = new T.WebGLRenderTarget(size, size);
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const scene = new T.Scene();
  const camera = options.orthographic
    ? new T.OrthographicCamera(-4, 4, 4, -4, 0.01, 1000)
    : new T.PerspectiveCamera(90, 1, 0.01, 1000);
  const p: number[] = [],
    n: number[] = [],
    center: number[] = [],
    radii: number[] = [],
    raw: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let ring = 0; ring < 2; ring++) {
    const x = (ring ? 2 : -2) + (options.centerX ?? 0);
    for (let side = 0; side < 5; side++) {
      const a = (side * Math.PI) / 2;
      p.push(x, Math.cos(a) * radius, -distance + Math.sin(a) * radius);
      n.push(0, Math.cos(a), Math.sin(a));
      center.push(x, 0, -distance);
      radii.push(radius);
      raw.push(1, 1, 1);
      uv.push(ring, side / 4);
    }
  }
  for (let side = 0; side < 4; side++) {
    const a = side,
      b = 5 + side;
    indices.push(a, a + 1, b + 1, a, b + 1, b);
  }
  const geometry = new T.BufferGeometry();
  for (const [name, values, width] of [
    ["position", p, 3],
    ["normal", n, 3],
    ["uv", uv, 2],
    ["color", raw, 3],
    ["_cable_center", center, 3],
    ["_cable_radius", radii, 1],
    ["_cable_height", radii, 1],
    ["_cable_raw_color", raw, 3],
  ] as const)
    geometry.setAttribute(name, new T.Float32BufferAttribute(values, width));
  geometry.setIndex(indices);
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  material.userData = {
    nativeCableBridgeVersion: 1,
    nativeShader: "cables.vfx",
    nativeMaterialName: "materials/cable/csgo_placeholder_cable.vmat",
    nativeIntParams: { F_CLAMP_MIN_RADIUS: options.clamp === false ? 0 : 1, g_bFogEnabled: 1 },
    sourceTextureConstantProof: {
      g_tNormal: { constantRGBA8: [128, 128, 255, 255] },
      g_tColor: { constantRGBA8: [129, 129, 129, 0] },
      g_tAmbientOcclusion: { constantRGBA8: [255, 255, 255, 255] },
    },
  };
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  if (options.pose) {
    const position = new T.Vector3(3, -2, 1),
      rotation = new T.Quaternion().setFromEuler(new T.Euler(0.15, 0.2, -0.3)),
      pose = new T.Matrix4().compose(position, rotation, new T.Vector3(16, 16, 16));
    camera.position.copy(position);
    camera.quaternion.copy(rotation);
    if (options.pose === "parent") {
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(pose);
    } else {
      geometry.applyMatrix4(pose);
      const centers = geometry.getAttribute("_cable_center");
      for (let i = 0; i < centers.count; i++) {
        const v = new T.Vector3().fromBufferAttribute(centers, i).applyMatrix4(pose);
        centers.setXYZ(i, v.x, v.y, v.z);
      }
      centers.needsUpdate = true;
      for (const name of ["_cable_radius", "_cable_height"]) {
        const a = geometry.getAttribute(name);
        for (let i = 0; i < a.count; i++) a.setX(i, a.getX(i) * 16);
        a.needsUpdate = true;
      }
    }
  }
  if (options.staleFov && camera instanceof T.PerspectiveCamera) camera.fov = 50;
  const lookup = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  lookup.needsUpdate = true;
  const view = applyNativeMapCables(scene, lookup);
  const previous = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "#include <opaque_fragment>\ngl_FragColor.rgb=vec3(1.);",
    );
    if (options.noCoverageFloor)
      shader.vertexShader = shader.vertexShader.replace(
        "max(nativeCablePhysical/nativeCableExpanded,.25)",
        "nativeCablePhysical/nativeCableExpanded",
      );
    if (options.wrongModelScale)
      shader.vertexShader = shader.vertexShader.replace("length(modelViewMatrix[0].xyz)", "1.");
    if (options.euclideanDepth)
      shader.vertexShader = shader.vertexShader.replace(
        "abs((modelViewMatrix*vec4(_cable_center,1.)).z)",
        "length((modelViewMatrix*vec4(_cable_center,1.)).xyz)",
      );
  };
  material.customProgramCacheKey = () =>
    `${key}:debug:${!!options.noCoverageFloor}:${!!options.euclideanDepth}`;
  if (options.staleFov) view.update(camera, size);
  else view.setNativeViewInputs(90, size);
  const extraTextures: T.Texture[] = [];
  if (options.cloneDepth) {
    const array = (layers: number) => {
      const t = new T.DataArrayTexture(new Uint8Array(layers * 4).fill(128), 1, 1, layers);
      t.needsUpdate = true;
      extraTextures.push(t);
      return t;
    };
    applyNativeMapProbes(scene, {
      textures: [array(6), array(1)],
      frames: [
        [1, 1, 1],
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
        [0, 0, 0],
        [1, 1, 1],
      ].map((x) => new Float32Array(x)),
      sky: Array.from({ length: 9 }, () => new T.Vector4()),
      count: 1,
      depth: 1,
    });
  }
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, camera);
  const bytes = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(target, 0, 0, size, size, bytes);
  let pixels = 0,
    maxRGB = 0;
  const rows = new Set<number>();
  for (let i = 0; i < bytes.length; i += 4)
    if (bytes[i] > 0) {
      pixels++;
      maxRGB = Math.max(maxRGB, bytes[i]);
      rows.add(Math.floor(i / 4 / size));
    }
  let depthPixels = 0,
    depthRows: number[] = [];
  if (options.cloneDepth) {
    const depth = new T.MeshDepthMaterial({ depthPacking: T.BasicDepthPacking }),
      active = mesh.material;
    applySourceDepth(active, depth);
    const compile = depth.onBeforeCompile.bind(depth);
    depth.onBeforeCompile = (s, r) => {
      compile(s, r);
      s.fragmentShader = s.fragmentShader.replace(
        "gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );",
        "gl_FragColor=vec4(1.);",
      );
    };
    const depthMesh = new T.Mesh(geometry, depth);
    depthMesh.matrixAutoUpdate = false;
    mesh.updateWorldMatrix(true, false);
    depthMesh.matrix.copy(mesh.matrixWorld);
    depthMesh.frustumCulled = false;
    const depthScene = new T.Scene();
    depthScene.add(depthMesh);
    renderer.clear();
    renderer.render(depthScene, camera);
    const b = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, b);
    const rows = new Set<number>();
    for (let i = 0; i < b.length; i += 4)
      if (b[i] > 0) {
        depthPixels++;
        rows.add(Math.floor(i / 4 / size));
      }
    depthRows = [...rows];
    depth.dispose();
  }
  const result = {
    depthPixels,
    depthRows,
    captured: options.capture ? Array.from(bytes) : undefined,
    streamRadius: geometry.getAttribute("_cable_radius").getX(0),
    streamHeight: geometry.getAttribute("_cable_height").getX(0),
    pixels,
    rows: [...rows],
    maxRGB,
    predicted: sourceCableWidth(radius, distance, sourceCableViewScale(90, size)),
    centerPixel: Array.from(bytes.slice((32 * size + 32) * 4, (32 * size + 32) * 4 + 4)),
    glError: renderer.getContext().getError(),
  };
  view.dispose();
  mesh.customDepthMaterial?.dispose();
  mesh.customDistanceMaterial?.dispose();
  if (mesh.material !== material) mesh.material.dispose();
  for (const t of extraTextures) t.dispose();
  material.dispose();
  geometry.dispose();
  lookup.dispose();
  target.dispose();
  renderer.dispose();
  return result;
}
