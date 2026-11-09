import * as T from "three";
import { loadNativeMap } from "../src/dust2";
import { activateNativeMapGrade } from "../src/native-map-color";
import { enableTextureTranscoding } from "../src/gltf";

/** Authored screenshot point_camera entities, all FOV90/aspect1/fogEnable=false.
 * Native origins/angles: artifacts/mirage-import/entities.txt entities2034/2036/2037.
 */
const views = [
  { name: "a-native-camera", eye: [-333, -1910, -136], angles: [-16, 249] },
  { name: "b-native-camera", eye: [-2115, -90, -111], angles: [-4, 63] },
  { name: "mid-native-camera", eye: [-1220, -630, -101], angles: [0, 0] },
];

export async function renderMirageMapFixture() {
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1200, 1200);
  renderer.toneMapping = T.CustomToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  enableTextureTranscoding(renderer);
  document.body.replaceChildren(renderer.domElement);
  const scene = new T.Scene();
  const world = await loadNativeMap(scene, renderer, "mirage");
  activateNativeMapGrade(world.grade);
  world.root.visible = true;
  scene.environment = world.sky;
  scene.environmentIntensity = world.config.environmentIntensity ?? 0.35;
  scene.environmentRotation.y = Math.PI;
  scene.background = world.skybox ? null : world.sky;
  scene.fog = null;
  const camera = new T.PerspectiveCamera(90, 1, 4 * 0.0254, 10000 * 0.0254);
  let meshes = 0,
    lightmappedMeshes = 0,
    floatingLightmapMeshes = 0;
  const materials = new Set<T.Material>();
  const atlasFormats = new Map<string, { format: number; bytes: number }>();
  world.scenery.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    meshes++;
    if (object.geometry.hasAttribute("nativeMapLightUv")) {
      lightmappedMeshes++;
      if (object.geometry.getAttribute("nativeMapLightUv").array instanceof Float32Array)
        floatingLightmapMeshes++;
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      materials.add(material);
  });
  for (const material of materials) {
    const compile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, device) => {
      compile(shader, device);
      for (const key of ["nativeMapIrradiance", "nativeMapDirectional"]) {
        const texture = shader.uniforms[key]?.value as T.CompressedTexture | undefined;
        if (texture?.isCompressedTexture)
          atlasFormats.set(key, {
            format: texture.format,
            bytes: texture.mipmaps[0]?.data.byteLength ?? 0,
          });
      }
    };
  }
  const captures = [];
  for (const view of views) {
    const [x, y, z] = view.eye;
    const [pitch, yaw] = view.angles.map(T.MathUtils.degToRad);
    camera.position.set(x * 0.0254, z * 0.0254, -y * 0.0254);
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
    camera.updateMatrixWorld(true);
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      pixels = new Uint8Array(1200 * 1200 * 4);
    gl.readPixels(0, 0, 1200, 1200, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let count = 0,
      luminance = 0,
      white = 0,
      black = 0;
    for (let i = 0; i < pixels.length; i += 4 * 17) {
      const l = pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
      count++;
      luminance += l;
      if (l > 250) white++;
      if (l < 3) black++;
    }
    captures.push({
      name: view.name,
      eye: view.eye,
      angles: view.angles,
      image: renderer.domElement.toDataURL("image/png"),
      meanLuminance: luminance / count,
      whiteFraction: white / count,
      blackFraction: black / count,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    });
  }
  const result = {
    captures,
    meshes,
    lightmappedMeshes,
    floatingLightmapMeshes,
    materials: materials.size,
    atlasFormats: Object.fromEntries(atlasFormats),
    glError: renderer.getContext().getError(),
    textures: renderer.info.memory.textures,
  };
  activateNativeMapGrade();
  renderer.dispose();
  return result;
}
