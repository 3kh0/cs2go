import * as T from "three";
import { loadDust2 } from "../src/dust2";
import { enableTextureTranscoding } from "../src/gltf";
import { gradeMapColors } from "../src/map-color";
import { applyTextureQuality } from "../src/presentation-settings";

export async function renderMapLighting(
  forceFallback = false,
  referenceView = false,
  testSurfaceQuality = false,
  inspection?: { eye: number[]; angles: number[]; rayPixels: number[][] },
  reflectionUniformLimit?: number,
) {
  const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  if (reflectionUniformLimit !== undefined)
    renderer.capabilities.maxFragmentUniforms = reflectionUniformLimit;
  if (forceFallback) {
    const has = renderer.extensions.has.bind(renderer.extensions);
    renderer.extensions.has = (name: string) =>
      ![
        "EXT_texture_compression_bptc",
        "WEBGL_compressed_texture_s3tc",
        "WEBGL_compressed_texture_s3tc_srgb",
      ].includes(name) && has(name);
  }
  const width = referenceView || inspection ? 1600 : 800,
    height = referenceView || inspection ? 1200 : 600;
  renderer.setSize(width, height);
  renderer.toneMapping = T.CustomToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  enableTextureTranscoding(renderer);
  document.body.replaceChildren(renderer.domElement);
  const scene = new T.Scene();
  const dust = await loadDust2(scene, renderer);
  if (testSurfaceQuality)
    applyTextureQuality([dust.root], "high", renderer.capabilities.getMaxAnisotropy(), 8);
  let layerUniforms: T.WebGLProgramParametersWithUniforms["uniforms"] | undefined;
  if (testSurfaceQuality)
    dust.scenery.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      const material = object.material;
      if (Array.isArray(material) || material.name !== "hr_dust_brick_ground_02") return;
      const prior = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (
        shader: T.WebGLProgramParametersWithUniforms,
        renderer: T.WebGLRenderer,
      ) => {
        prior(shader, renderer);
        layerUniforms = shader.uniforms;
      };
    });
  gradeMapColors(dust.root);
  dust.root.visible = true;
  scene.environment = dust.sky;
  scene.background = dust.skybox ? null : dust.sky;
  scene.backgroundIntensity = 2 ** 0.765;
  scene.environmentIntensity = 0.35;
  scene.backgroundRotation.y = scene.environmentRotation.y = Math.PI;
  scene.fog = dust.skybox ? null : new T.Fog("#c7d6df", 100, 240);
  const camera = new T.PerspectiveCamera(90, 4 / 3, 0.05, 250);
  camera.position.set(14, 1.7, -22);
  camera.lookAt(30, 2.3, -29);
  if (referenceView) {
    camera.fov = 73.70210998790712;
    camera.position.set(16.334097770923396, 1.6485055937892408, -19.194158089681782);
    camera.up.set(0.008799981962807742, 0.9999438683047471, -0.005900894609529028);
    camera.lookAt(
      camera.position
        .clone()
        .add(new T.Vector3(0.827065155796909, -0.01059509254670812, -0.5620062028844177)),
    );
    camera.updateProjectionMatrix();
  }
  if (inspection) {
    const [pitch, yaw] = inspection.angles.map(T.MathUtils.degToRad);
    camera.fov = (2 * Math.atan(3 / 4) * 180) / Math.PI;
    camera.position.set(
      inspection.eye[0] * 0.0254,
      inspection.eye[2] * 0.0254,
      -inspection.eye[1] * 0.0254,
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
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
  // Cached sun geometry must not add another shadow pass to subsequent frames.
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const pixel = (x: number, y: number) => {
    const rgba = new Uint8Array(4);
    gl.readPixels(x, height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    return Array.from(rgba);
  };
  const sun = pixel(100, 430);
  const shade = pixel(560, 560);
  const image = renderer.domElement.toDataURL("image/png");
  const raySamples = inspection?.rayPixels.map(([x, y]) => {
    const ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2((x / width) * 2 - 1, 1 - (y / height) * 2), camera);
    const hit = ray.intersectObject(dust.scenery, true)[0];
    if (!hit || !(hit.object instanceof T.Mesh))
      throw new Error("Native masonry reference ray missed");
    const material = Array.isArray(hit.object.material)
      ? hit.object.material[hit.face?.materialIndex ?? 0]
      : hit.object.material;
    return {
      material: material.name,
      sourcePoint: [hit.point.x / 0.0254, -hit.point.z / 0.0254, hit.point.y / 0.0254],
      rgba: pixel(x, y),
    };
  });
  let surfaceQuality:
    | { high: number[]; low: number[]; restored: number[]; restoredImage: boolean }
    | undefined;
  if (testSurfaceQuality) {
    if (!layerUniforms) throw new Error("Native ground material did not compile");
    const textures = [
      "sourceLayerNormal1",
      "sourceLayerNormal2",
      "sourceLayerColor2",
      "sourceLayerMask",
    ].map((key) => layerUniforms![key].value as T.Texture<{ width: number }>);
    const widths = () => textures.map((texture) => texture.image.width);
    const high = widths();
    applyTextureQuality([dust.root], "low", renderer.capabilities.getMaxAnisotropy(), 1);
    renderer.render(scene, camera);
    const low = widths();
    applyTextureQuality([dust.root], "high", renderer.capabilities.getMaxAnisotropy(), 8);
    renderer.render(scene, camera);
    surfaceQuality = {
      high,
      low,
      restored: widths(),
      restoredImage: image === renderer.domElement.toDataURL("image/png"),
    };
  }
  const referenceCables: { expected: number[]; darkness: number }[] = [];
  if (referenceView) {
    const luma = (rgb: number[]) => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    // Native screenshot wire centers, independent of the bake's vertex positions.
    const columns = [
      [650, 279, 291, 308, 322],
      [750, 258, 270, 291, 308],
      [850, 227, 238, 264, 284],
      [950, 188, 198, 230, 252],
      [1050, 142, 153, 190, 213],
    ];
    for (const [x, ...ys] of columns)
      for (const y of ys) {
        const wire = Math.min(...[-1, 0, 1].map((dy) => luma(pixel(x, y + dy))));
        const sky = (luma(pixel(x, y - 5)) + luma(pixel(x, y + 5))) / 2;
        referenceCables.push({ expected: [x, y], darkness: sky - wire });
      }
  }
  let vertices = 0;
  let invalid = 0;
  let backProbeBytes = 0;
  let layerWeightBytes = 0;
  dust.scenery.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    vertices += object.geometry.getAttribute("position").count;
    const backProbe = object.geometry.getAttribute("sourceBackProbe");
    if (backProbe) backProbeBytes += backProbe.count * 4;
    const blend = object.geometry.getAttribute("sourceBlend");
    if (blend) layerWeightBytes += blend.count * 4;
    if (!object.geometry.hasAttribute("sourceUv") || !object.geometry.hasAttribute("sourceProbe"))
      invalid++;
  });
  return {
    referenceCables,
    raySamples,
    surfaceQuality,
    sun,
    shade,
    image,
    vertices,
    invalid,
    backProbeBytes,
    layerWeightBytes,
    textures: renderer.info.memory.textures,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };
}
