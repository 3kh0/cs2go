import { createEnvironmentWorldFrame } from "../src/native-environment-frame";
import { nativeFoliageSource } from "./native-foliage-source-fixture";
import * as T from "three";
import { applyNativeMapFoliage, type NativeFoliageMaterial } from "../src/native-map-foliage";
import { SmokeComposite, SmokeRenderer } from "../src/smoke-renderer";
function texture(data: number[], width = 1) {
  const t = new T.DataTexture(new Float32Array(data), width, 1, T.RGBAFormat, T.FloatType);
  t.minFilter = t.magFilter = T.NearestFilter;
  t.needsUpdate = true;
  return t;
}
export function renderNativeFoliageFixture(
  source: NativeFoliageMaterial = nativeFoliageSource,
  settings: {
    samples?: number;
    adaptRoot?: (root: T.Object3D) => void;
    alpha?: number;
    control?: number[];
    debug?: "normal" | "surface";
    backFace?: boolean;
    ambient?: number;
    normal?: number[];
    transmission?: number[];
    lightRadiance?: number;
  } = {},
) {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.setClearColor(0);
  const scene = new T.Scene(),
    root = new T.Group(),
    camera = new T.PerspectiveCamera(60, 1, 0.1, 20);
  camera.position.z = settings.backFace ? -3 : 3;
  camera.lookAt(0, 0, 0);
  scene.add(root);
  const geometry = new T.PlaneGeometry(2, 2);
  geometry.computeTangents();
  geometry.setAttribute(
    "color",
    new T.Float32BufferAttribute(
      Array.from({ length: 4 }, () => settings.control ?? [1, 0.5, 1, 0.25]).flat(),
      4,
    ),
  );
  const material = new T.MeshStandardMaterial({ color: 0xffffff });
  material.name = "leaf";
  root.add(new T.Mesh(geometry, material));
  const color = texture(
      [0.2, 0.4, 0.1, settings.alpha ?? 0, 0.2, 0.4, 0.1, settings.alpha ?? 1],
      2,
    ),
    normal = texture(settings.normal ?? [128 / 255, 128 / 255, 0.4, 1]),
    ao = texture([0.5, 0.5, 0.5, 1]),
    transmission = texture(settings.transmission ?? [0, 0, 0, 1]),
    lookup = texture([0.2, 0.7, 0, 1]);
  const noise = new T.Data3DTexture(
    new Uint8Array(Array.from({ length: 32 }, (_, i) => (i % 4 === 2 ? 255 : 180))),
    2,
    2,
    2,
  );
  noise.format = T.RGBAFormat;
  noise.colorSpace = T.NoColorSpace;
  noise.minFilter = noise.magFilter = T.LinearFilter;
  noise.wrapS = noise.wrapT = noise.wrapR = T.RepeatWrapping;
  noise.needsUpdate = true;
  const bundle = {
    materials: { leaf: source },
    textures: new Map([
      ["color", color],
      ["normal", normal],
      ["ao", ao],
      ["transmission", transmission],
    ]),
    lookup,
    noise,
    source: { model: "controlled", noise: "controlled" },
  };
  const view = applyNativeMapFoliage(root, bundle, {
    windState: { direction: [1, 0, 0], strength: 0, timeSeconds: 0 },
  });
  settings.adaptRoot?.(root);
  if (settings.debug) {
    const compile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer);
      shader.uniforms.nativeFoliageDebugViewToWorld = {
        value: new T.Matrix3().setFromMatrix4(camera.matrixWorld),
      };
      shader.fragmentShader =
        "uniform mat3 nativeFoliageDebugViewToWorld;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        settings.debug === "normal"
          ? "gl_FragColor=vec4(normalize(nativeFoliageDebugViewToWorld*normal)*.5+.5,1);"
          : "gl_FragColor=vec4(material.diffuseContribution,1);",
      );
    };
  }
  const composite = new SmokeComposite();
  // Production map lights carry pi to compensate Three's Lambert factor.
  const lightIntensity = (settings.lightRadiance ?? 0.5) * Math.PI;
  const light = new T.DirectionalLight(0xffffff, lightIntensity);
  light.position.set(0, 0, -3);
  scene.add(light);
  if (settings.ambient) scene.add(new T.HemisphereLight(0xffffff, 0xffffff, settings.ambient));
  const target =
    settings.samples === undefined
      ? undefined
      : new T.WebGLRenderTarget(32, 32, { samples: settings.samples });
  if (target) renderer.setRenderTarget(target);
  const pixels = () => {
    const out = new Uint8Array(32 * 32 * 4);
    if (target) renderer.readRenderTargetPixels(target, 0, 0, 32, 32, out);
    else
      renderer
        .getContext()
        .readPixels(
          0,
          0,
          32,
          32,
          renderer.getContext().RGBA,
          renderer.getContext().UNSIGNED_BYTE,
          out,
        );
    return out;
  };
  const draw = () => {
    composite.render(renderer, scene, camera, [], false, undefined, (camera) => {
      view.syncDepth(renderer);
      renderer.render(view.depthScene, camera);
    });
    return pixels();
  };
  const backlit = draw();
  geometry.getAttribute("color").setW(0, 1).setW(1, 1).setW(2, 1).setW(3, 1);
  geometry.getAttribute("color").needsUpdate = true;
  const aoChanged = draw();
  for (let i = 0; i < geometry.getAttribute("color").count; i++)
    geometry.getAttribute("color").setW(i, settings.control?.[3] ?? 0.25);
  geometry.getAttribute("color").needsUpdate = true;
  light.intensity = 0;
  const unlit = draw();
  light.intensity = lightIntensity;
  const blocker = new T.Mesh(new T.PlaneGeometry(1, 2), new T.MeshBasicMaterial({ color: 0 }));
  blocker.position.set(0.5, 0, 0.3);
  scene.add(blocker);
  const occluded = draw();
  scene.remove(blocker);
  root.visible = false;
  const hidden = draw();
  root.visible = true;
  const reset = draw();
  view.update(1, { direction: [1, 0, 0], strength: 1, timeSeconds: 1 });
  const moving = draw();
  view.update(0, { direction: [1, 0, 0], strength: 0, timeSeconds: 0 });
  let depthSeen = false;
  composite.render(
    renderer,
    scene,
    camera,
    [],
    false,
    {
      setDepth() {
        depthSeen = true;
      },
    },
    (camera) => {
      view.syncDepth(renderer);
      renderer.render(view.depthScene, camera);
    },
  );
  const depthConsumer = pixels();
  const sphere = new T.SphereGeometry(1, 12, 8),
    smoke = new SmokeRenderer([new T.Vector3(-0.7, 0, -1.5), new T.Vector3(0.7, 0, -1.5)], sphere);
  smoke.update(1, 1, 1, [], -1);
  scene.add(smoke.batch);
  const smokeDraw = (includeDepth: boolean) => {
    composite.render(renderer, scene, camera, [smoke], false, undefined, (passCamera) => {
      if (includeDepth || passCamera === camera) {
        view.syncDepth(renderer);
        renderer.render(view.depthScene, passCamera);
      }
    });
    return pixels();
  };
  const smokeCorrect = smokeDraw(true),
    smokeMissingDepth = smokeDraw(false);
  scene.remove(smoke.batch);
  smoke.dispose();
  sphere.dispose();
  const sample = (p: Uint8Array, x: number) =>
    Array.from(p.slice((16 * 32 + x) * 4, (16 * 32 + x) * 4 + 3));
  const sum = (p: Uint8Array) => p.reduce((s, v, i) => s + (i % 4 < 3 ? v : 0), 0);
  const different = (a: Uint8Array, b: Uint8Array) =>
    a.reduce((s, v, i) => s + (v !== b[i] ? 1 : 0), 0);
  const gl = renderer.getContext();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const result = {
    rendererIdentity: gl.getParameter(
      debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
    ) as string,
    backlit: sum(backlit),
    opaquePixel: Array.from(backlit.slice((16 * 32 + 24) * 4, (16 * 32 + 24) * 4 + 4)),
    holePixel: Array.from(backlit.slice((16 * 32 + 8) * 4, (16 * 32 + 8) * 4 + 4)),
    transmissionAoDifference: different(backlit, aoChanged),
    motionDifference: different(reset, moving),
    depthSeen,
    depthConsumer: sum(depthConsumer),
    smokeLeaf: sample(smokeCorrect, 20),
    smokeHole: sample(smokeCorrect, 12),
    smokeLeafWithoutDepth: sample(smokeMissingDepth, 20),
    unlit: sum(unlit),
    occluded: sum(occluded),
    hidden: sum(hidden),
    resetDifference: different(backlit, reset),
    glError: renderer.getContext().getError(),
    programs: renderer.info.programs?.length,
  };
  view.dispose();
  target?.dispose();
  root.traverse((object) => {
    if (object instanceof T.Mesh) {
      object.customDepthMaterial?.dispose();
      object.customDistanceMaterial?.dispose();
    }
  });
  geometry.dispose();
  root.traverse((object) => {
    if (object instanceof T.Mesh) {
      for (const m of Array.isArray(object.material) ? object.material : [object.material])
        if (m !== material) m.dispose();
    }
  });
  material.dispose();
  blocker.geometry.dispose();
  blocker.material.dispose();
  for (const t of bundle.textures.values()) t.dispose();
  lookup.dispose();
  noise.dispose();
  renderer.dispose();
  return result;
}

export async function renderActualNativeFoliage(input: {
  source: string;
  model: string;
  excludeUnadmitted?: boolean;
}) {
  const [{ loadNativeMapFoliage }, { loadGzipped }, { MapResources }] = await Promise.all([
    import("../src/native-map-foliage"),
    import("../src/gltf"),
    import("../src/map-resources"),
  ]);
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(256, 256);
  renderer.setClearColor(0x111111);
  renderer.toneMapping = T.NoToneMapping;
  const resources = new MapResources();
  const [bundle, asset] = await Promise.all([
    loadNativeMapFoliage(renderer, input.source),
    loadGzipped(input.model),
  ]);
  for (const texture of bundle.textures.values()) resources.texture(texture);
  resources.texture(bundle.noise);
  resources.capture(asset.scene);
  if (input.excludeUnadmitted) {
    const remove: T.Object3D[] = [];
    asset.scene.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        (Array.isArray(o.material) ? o.material : [o.material]).some(
          (m) => !bundle.materials[m.name],
        )
      )
        remove.push(o);
    });
    for (const node of remove) node.removeFromParent();
  }
  const scene = new T.Scene();
  scene.add(asset.scene);
  const view = applyNativeMapFoliage(asset.scene, bundle, {
    windState: { direction: [1, 0, 0], strength: 0.1, timeSeconds: 0 },
  });
  resources.capture(asset.scene);
  const selected: T.Mesh[] = [];
  asset.scene.traverse((o) => {
    if (o instanceof T.Mesh) selected.push(o);
  });
  const first = selected[0];
  const bounds = new T.Box3().setFromObject(first),
    center = bounds.getCenter(new T.Vector3()),
    radius = bounds.getSize(new T.Vector3()).length();
  const camera = new T.PerspectiveCamera(50, 1, 0.01, Math.max(radius * 10, 100));
  camera.position
    .copy(center)
    .add(new T.Vector3(0.7, 0.4, 1).normalize().multiplyScalar(radius * 1.5));
  camera.lookAt(center);
  scene.add(new T.HemisphereLight(0xffffff, 0x777777, Math.PI));
  const sun = new T.DirectionalLight(0xffffff, Math.PI);
  sun.position.copy(center).add(new T.Vector3(1, 3, -2));
  sun.target.position.copy(center);
  scene.add(sun, sun.target);
  const composite = new SmokeComposite();
  const draw = () => {
    composite.render(renderer, scene, camera, [], false, undefined, (c) => {
      view.syncDepth(renderer);
      renderer.render(view.depthScene, c);
    });
    const bytes = new Uint8Array(256 * 256 * 4);
    renderer
      .getContext()
      .readPixels(
        0,
        0,
        256,
        256,
        renderer.getContext().RGBA,
        renderer.getContext().UNSIGNED_BYTE,
        bytes,
      );
    return bytes;
  };
  const still = draw();
  view.update(2, { direction: [1, 0, 0], strength: 0.1, timeSeconds: 2 });
  const moving = draw();
  asset.scene.visible = false;
  const hidden = draw();
  asset.scene.visible = true;
  view.update(0, { direction: [1, 0, 0], strength: 0.1, timeSeconds: 0 });
  const reset = draw();
  let pixels = 0;
  for (let i = 0; i < still.length; i += 4)
    if (still[i] !== 17 || still[i + 1] !== 17 || still[i + 2] !== 17) pixels++;
  const diff = (a: Uint8Array, b: Uint8Array) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);
  const gallery = document.createElement("canvas");
  gallery.width = 256 * 4;
  gallery.height = 256;
  const context = gallery.getContext("2d")!;
  for (const [index, picture] of [still, moving, hidden, reset].entries()) {
    const flipped = new Uint8ClampedArray(picture.length);
    for (let y = 0; y < 256; y++)
      flipped.set(picture.subarray(y * 256 * 4, (y + 1) * 256 * 4), (255 - y) * 256 * 4);
    context.putImageData(new ImageData(flipped, 256, 256), 256 * index, 0);
  }
  document.body.replaceChildren(gallery);
  const result = {
    materials: Object.keys(bundle.materials).length,
    meshes: selected.length,
    sourcePixels: pixels,
    motionDifference: diff(still, moving),
    hiddenDifference: diff(still, hidden),
    resetDifference: diff(still, reset),
    noiseSize: [bundle.noise.image.width, bundle.noise.image.height, bundle.noise.image.depth],
    glError: renderer.getContext().getError(),
    programs: renderer.info.programs?.length,
  };
  view.dispose();
  resources.dispose();
  renderer.dispose();
  return result;
}

/** Same source leaf and three-point wind under posed versus baked nonzero,
 * rotated scale16 placement. Identity-frame negative control must move it. */
export function renderNativeFoliageFrameControl(
  source: NativeFoliageMaterial = nativeFoliageSource,
) {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(64, 64);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.setClearColor(0);
  const placement = new T.Matrix4().compose(
    new T.Vector3(11, -3, 7),
    new T.Quaternion().setFromEuler(new T.Euler(0.1, 0.7, -0.2)),
    new T.Vector3(16, 16, 16),
  );
  const camera = new T.PerspectiveCamera(60, 1, 1.6, 320);
  camera.position.set(0, 0, 4).applyMatrix4(placement);
  camera.lookAt(new T.Vector3().applyMatrix4(placement));
  const pictures: Uint8Array[] = [];
  for (const kind of ["posed", "baked", "wrong-frame", "instanced"]) {
    const scene = new T.Scene(),
      root = new T.Group();
    scene.add(root);
    const geometry = new T.PlaneGeometry(2, 2, 2, 2);
    geometry.computeTangents();
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute(
      "color",
      new T.Float32BufferAttribute(
        Array.from({ length: count }, (_, i) => [0.3 + (i % 3) * 0.3, 0.5, 0.7, 1]).flat(),
        4,
      ),
    );
    if (kind !== "posed" && kind !== "instanced") geometry.applyMatrix4(placement);
    const material = new T.MeshStandardMaterial();
    material.name = "leaf";
    const mesh =
      kind === "instanced"
        ? new T.InstancedMesh(geometry, material, 1)
        : new T.Mesh(geometry, material);
    if (mesh instanceof T.InstancedMesh) {
      mesh.setMatrixAt(0, placement);
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (kind === "posed") {
      mesh.matrix.copy(placement);
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorldNeedsUpdate = true;
    }
    root.add(mesh);
    const noiseBytes = new Uint8Array(32);
    for (let z = 0; z < 2; z++)
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++)
          noiseBytes.set([x * 255, y * 255, z * 255, 255], ((z * 2 + y) * 2 + x) * 4);
    const noise = new T.Data3DTexture(noiseBytes, 2, 2, 2);
    noise.colorSpace = T.NoColorSpace;
    noise.minFilter = noise.magFilter = T.LinearFilter;
    noise.wrapS = noise.wrapT = noise.wrapR = T.RepeatWrapping;
    noise.needsUpdate = true;
    const textures = new Map([
        ["color", texture([0.2, 0.4, 0.1, 1])],
        ["normal", texture([128 / 255, 128 / 255, 0.4, 1])],
        ["ao", texture([1, 1, 1, 1])],
      ]),
      lookup = texture([0.2, 0.7, 0, 1]);
    const own = kind === "wrong-frame" ? new T.Matrix4() : placement.clone().invert();
    const view = applyNativeMapFoliage(
      root,
      {
        materials: { leaf: source },
        textures,
        lookup,
        noise,
        source: { model: "controlled", noise: "controlled" },
      },
      {
        sourceWorldFrame: createEnvironmentWorldFrame(own),
        windState: { direction: [1, 0, 0], strength: 0.5, timeSeconds: 2 },
      },
    );
    scene.add(new T.HemisphereLight(0xffffff, 0xffffff, Math.PI));
    const composite = new SmokeComposite();
    composite.render(renderer, scene, camera, [], false, undefined, (c) => {
      view.syncDepth(renderer);
      renderer.render(view.depthScene, c);
    });
    const bytes = new Uint8Array(64 * 64 * 4);
    renderer
      .getContext()
      .readPixels(
        0,
        0,
        64,
        64,
        renderer.getContext().RGBA,
        renderer.getContext().UNSIGNED_BYTE,
        bytes,
      );
    pictures.push(bytes);
    view.dispose();
    if (mesh instanceof T.InstancedMesh) mesh.dispose();
    mesh.customDepthMaterial?.dispose();
    mesh.customDistanceMaterial?.dispose();
    geometry.dispose();
    material.dispose();
    for (const t of textures.values()) t.dispose();
    lookup.dispose();
    noise.dispose();
  }
  const diff = (a: Uint8Array, b: Uint8Array) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);
  const result = {
    bakedDifference: diff(pictures[0], pictures[1]),
    wrongFrameDifference: diff(pictures[0], pictures[2]),
    instanceDifference: diff(pictures[0], pictures[3]),
    glError: renderer.getContext().getError(),
  };
  renderer.dispose();
  return result;
}
