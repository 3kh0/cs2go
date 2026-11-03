import * as T from "three";
import { loadSourceMaterialBundle } from "../src/source-layers";
import { applyTextureQuality, registerSurfaceTextures } from "../src/presentation-settings";

export async function renderSourceOcclusion() {
  const renderer = new T.WebGLRenderer();
  renderer.setSize(256, 128);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const has = renderer.extensions.has.bind(renderer.extensions);
  const nativeSupported = has("EXT_texture_compression_rgtc");
  const native = await loadSourceMaterialBundle(renderer, "/models/maps/lighting/occlusion/");
  renderer.extensions.has = (name) => (name === "EXT_texture_compression_rgtc" ? false : has(name));
  const fallback = await loadSourceMaterialBundle(renderer, "/models/maps/lighting/occlusion/");
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;
  const scene = new T.Scene(),
    geometry = new T.PlaneGeometry(2, 2),
    lod = { value: 0 };
  const textures = [
    native.textures.get("street_lantern_02_color")!,
    fallback.textures.get("street_lantern_02_color")!,
  ];
  const material = new T.MeshBasicMaterial({ map: textures[0] });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.sourceAOLod = lod;
    shader.fragmentShader = "uniform float sourceAOLod;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "diffuseColor.rgb = vec3(textureLod(map, vMapUv, sourceAOLod).r);",
    );
  };
  const mesh = new T.Mesh(geometry, material);
  scene.add(mesh);
  const render = (texture: T.Texture, level: number) => {
    material.map = texture;
    lod.value = level;
    renderer.render(scene, camera);
    const bytes = new Uint8Array(256 * 128 * 4),
      gl = renderer.getContext();
    gl.readPixels(0, 0, 256, 128, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return bytes;
  };
  const levels = [];
  for (let i = 0; i < 6; i++) {
    const a = render(textures[0], i),
      b = render(textures[1], i);
    let maxDifference = 0,
      min = 255,
      max = 0;
    for (let pixel = 0; pixel < a.length; pixel += 4) {
      maxDifference = Math.max(maxDifference, Math.abs(a[pixel] - b[pixel]));
      min = Math.min(min, b[pixel]);
      max = Math.max(max, b[pixel]);
    }
    levels.push({ maxDifference, min, max });
  }
  const quality = [];
  for (const texture of textures) {
    material.map = texture;
    registerSurfaceTextures(material, [texture]);
    const sizes = () => {
      const image = texture.image as { width: number; height: number };
      return [image.width, image.height, texture.mipmaps.length];
    };
    const original = sizes();
    applyTextureQuality([mesh], "low", 8);
    const low = sizes();
    const lowPixel = render(texture, 0)[0];
    applyTextureQuality([mesh], "high", 8);
    const restored = sizes();
    quality.push({ original, low, restored, lowPixel });
  }
  const result = {
    nativeSupported,
    compressed: textures[0] instanceof T.CompressedTexture,
    levels,
    quality,
  };
  for (const texture of textures) texture.dispose();
  material.dispose();
  geometry.dispose();
  renderer.dispose();
  return result;
}
