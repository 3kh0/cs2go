import * as T from "three";
import { loadGzipped } from "../src/gltf";
import { applyNativeMapFoliage, type NativeFoliageMaterial } from "../src/native-map-foliage";

/** Actual Cache LOD vertices at their authored world coordinates. Controlled
 * texels isolate coincident projection from native lighting/appearance. */
export async function renderNativeFoliageProjectionFixture() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  const width = 1280,
    height = 800;
  renderer.setSize(width, height);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.setClearColor(0, 0);
  const [asset, manifest] = await Promise.all([
    loadGzipped("/models/maps/cache-native-lod/main-foliage/world.glb.gz"),
    fetch("/models/maps/cache-native-lod/main-foliage/source.json").then((r) => r.json()),
  ]);
  let original: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial> | undefined;
  asset.scene.traverse((object) => {
    if (
      object instanceof T.Mesh &&
      object.material instanceof T.MeshStandardMaterial &&
      object.material.name === "tree_poplar_branch"
    )
      original = object;
  });
  if (!original) throw new Error("Actual Cache branch geometry missing");
  const geometry = original.geometry.clone(),
    position = geometry.getAttribute("position"),
    indices: number[] = [],
    index = geometry.index;
  if (!index) throw new Error("Actual Cache branch index stream missing");
  const inside = (i: number) =>
    position.getX(i) >= -20 &&
    position.getX(i) <= -7 &&
    position.getY(i) >= 42 &&
    position.getY(i) <= 65 &&
    position.getZ(i) >= -60 &&
    position.getZ(i) <= -46;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i),
      b = index.getX(i + 1),
      c = index.getX(i + 2);
    if (inside(a) || inside(b) || inside(c)) indices.push(a, b, c);
  }
  geometry.setIndex(indices);
  const source = structuredClone(manifest.materials.tree_poplar_branch) as NativeFoliageMaterial;
  source.textures = {
    g_tColor: "color",
    g_tNormal: "normal",
    g_tAmbientOcclusion: "ao",
    g_tTransmissiveColor: "transmission",
  };
  const pixel = (values: number[], w = 1) => {
    const t = new T.DataTexture(new Float32Array(values), w, 1, T.RGBAFormat, T.FloatType);
    t.minFilter = t.magFilter = T.NearestFilter;
    t.needsUpdate = true;
    return t;
  };
  const textures = new Map([
      ["color", pixel([0.2, 0.4, 0.1, 0, 0.2, 0.4, 0.1, 1], 2)],
      ["normal", pixel([128 / 255, 128 / 255, 0.4, 1])],
      ["ao", pixel([0.5, 0.5, 0.5, 1])],
      ["transmission", pixel([0.2, 0.4, 0.1, 1])],
    ]),
    lookup = pixel([0.2, 0.7, 0, 1]),
    noise = new T.Data3DTexture(new Uint8Array(32).fill(180), 2, 2, 2);
  noise.minFilter = noise.magFilter = T.LinearFilter;
  noise.wrapS = noise.wrapT = noise.wrapR = T.RepeatWrapping;
  noise.needsUpdate = true;
  const material = original.material.clone();
  material.name = "tree_poplar_branch";
  const root = new T.Mesh(geometry, material),
    scene = new T.Scene();
  scene.add(root, new T.HemisphereLight(0xffffff, 0x444444, 0.4));
  const light = new T.DirectionalLight(0xffffff, 0.5);
  light.position.set(2, 3, 4);
  scene.add(light);
  const view = applyNativeMapFoliage(
    root,
    {
      materials: { tree_poplar_branch: source },
      textures,
      lookup,
      noise,
      source: {
        model: "actual Cache native LOD branch subset",
        noise: "controlled projection input",
      },
    },
    { windState: { direction: [1, 0, 0], strength: 0.35, timeSeconds: 0 } },
  );
  // Runtime uniform preserves the complete native color vertex/normal graph.
  const previous = material.onBeforeCompile.bind(material),
    key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, r) => {
    previous(shader, r);
    shader.uniforms.projectionFixtureId = { value: 1 };
    shader.fragmentShader = "uniform int projectionFixtureId;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      /}\s*$/,
      "if(projectionFixtureId==1)gl_FragColor.rgb=vec3(1);\n}",
    );
  };
  material.customProgramCacheKey = () => key + ":projection-coverage-regression";
  const camera = new T.PerspectiveCamera(73.73979529168804, width / height, 0.05, 250),
    pitch = T.MathUtils.degToRad(-0.259888),
    yaw = T.MathUtils.degToRad(137.529938);
  camera.position.set(
    178.67413861577205 * 0.0254,
    1928.7593516203135 * 0.0254,
    -1310.9640242616156 * 0.0254,
  );
  camera.lookAt(
    camera.position
      .clone()
      .add(
        new T.Vector3(
          Math.cos(pitch) * Math.cos(yaw),
          -Math.sin(pitch),
          -Math.cos(pitch) * Math.sin(yaw),
        ),
      ),
  );
  const target = new T.WebGLRenderTarget(width, height, { samples: 4 }),
    observerMaterial = new T.ShaderMaterial({
      depthTest: true,
      depthWrite: false,
      depthFunc: T.GreaterDepth,
      blending: T.NoBlending,
      vertexShader: "void main(){gl_Position=vec4(position.xy,1,1);}",
      fragmentShader: "void main(){gl_FragColor=vec4(1);}",
    }),
    observerGeometry = new T.BufferGeometry().setAttribute(
      "position",
      new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    ),
    observerScene = new T.Scene(),
    observer = new T.Mesh(observerGeometry, observerMaterial);
  observer.frustumCulled = false;
  observerScene.add(observer);
  const read = (time: number, prepass: boolean) => {
    renderer.setRenderTarget(target);
    renderer.clear();
    view.update(time, { direction: [1, 0, 0], strength: 0.35, timeSeconds: time });
    view.syncDepth(renderer);
    renderer.autoClear = false;
    renderer.render(view.depthScene, camera);
    renderer.render(prepass ? observerScene : scene, prepass ? new T.Camera() : camera);
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    return pixels;
  };
  try {
    const results = [0, 2].map((time) => {
      const color = read(time, false),
        depth = read(time, true);
      let occupied = 0,
        lost = 0,
        outside = 0;
      for (let i = 0; i < color.length; i += 4) {
        occupied += depth[i];
        lost += Math.max(0, depth[i] - color[i]);
        outside += Math.max(0, color[i] - depth[i]);
      }
      return { time, occupied, lost, outside };
    });
    const gl = renderer.getContext(),
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      programsLinked: (renderer.info.programs ?? []).every((p) =>
        gl.getProgramParameter(p.program as WebGLProgram, gl.LINK_STATUS),
      ),
      results,
      triangles: indices.length / 3,
      samples: target.samples,
      glError: gl.getError(),
      contextLost: gl.isContextLost(),
    };
  } finally {
    view.dispose();
    geometry.dispose();
    target.dispose();
    observerMaterial.dispose();
    observerGeometry.dispose();
    lookup.dispose();
    noise.dispose();
    for (const texture of textures.values()) texture.dispose();
    asset.scene.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry.dispose();
      for (const m of Array.isArray(object.material) ? object.material : [object.material])
        m.dispose();
    });
    renderer.dispose();
  }
}
