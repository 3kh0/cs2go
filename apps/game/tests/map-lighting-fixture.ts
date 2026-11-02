import * as T from "three";
import { loadDust2 } from "../src/dust2";
import { enableTextureTranscoding } from "../src/gltf";
import { gradeMapColors } from "../src/map-color";

export async function renderMapLighting(forceFallback = false, referenceView = false) {
  const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  if (forceFallback) {
    const has = renderer.extensions.has.bind(renderer.extensions);
    renderer.extensions.has = (name: string) =>
      !["EXT_texture_compression_bptc", "WEBGL_compressed_texture_s3tc"].includes(name) &&
      has(name);
  }
  const width = referenceView ? 1600 : 800,
    height = referenceView ? 1200 : 600;
  renderer.setSize(width, height);
  renderer.toneMapping = T.CustomToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  enableTextureTranscoding(renderer);
  document.body.replaceChildren(renderer.domElement);
  const scene = new T.Scene();
  const dust = await loadDust2(scene, renderer);
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
  dust.scenery.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    vertices += object.geometry.getAttribute("position").count;
    if (!object.geometry.hasAttribute("sourceUv") || !object.geometry.hasAttribute("sourceProbe"))
      invalid++;
  });
  return {
    referenceCables,
    sun,
    shade,
    image,
    vertices,
    invalid,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };
}
