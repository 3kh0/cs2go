import * as T from "three";
import { applySourceEnvironment, type SourceEnvironment } from "../src/source-environment";
import { applySourceSurface, loadSourceSurfaceLookup } from "../src/source-surface";

export async function renderSourceEnvironment() {
  const metadata = await fetch("/models/maps/material-lighting.json").then((r) => r.json());
  const source = metadata.materials.find((m: { environment?: SourceEnvironment }) => m.environment)
    .environment as SourceEnvironment;
  const lookup = await loadSourceSurfaceLookup();
  const renderer = new T.WebGLRenderer();
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;
  const scene = new T.Scene();
  const sun = new T.DirectionalLight(0xffffff, Math.PI);
  sun.position.set(0, 0, 5);
  scene.add(sun, new T.AmbientLight(0xffffff, Math.PI));
  const geometry = new T.PlaneGeometry(2, 2);
  const textures: T.Texture[] = [];
  const materials: T.Material[] = [];
  const constant = (rgba: number[]) => {
    const texture = new T.DataTexture(new Uint8Array(rgba), 1, 1);
    texture.needsUpdate = true;
    textures.push(texture);
    return texture;
  };
  const sample = (
    mask: number,
    ao: number,
    metal: number,
    mode: string,
    packedNormal = [128, 128, 204, 255],
  ) => {
    const material = new T.MeshStandardMaterial({
      map: constant([128, 96, 64, ao]),
      normalMap: constant(packedNormal),
    });
    material.color.setRGB(...(source.modelTint as [number, number, number]));
    const height = constant([17, mask, 11, metal]);
    material.onBeforeCompile = (shader) => {
      applySourceSurface(shader, { directSpecular: true, indirectSpecular: true }, lookup);
      applySourceEnvironment(shader, source, height);
      const output =
        mode === "albedo"
          ? "diffuseColor.rgb"
          : mode === "channels"
            ? "vec3(roughnessFactor, metalnessFactor, ambientOcclusion)"
            : mode === "normal"
              ? "normal * 0.5 + 0.5"
              : undefined;
      if (output)
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `outgoingLight = ${output};\n#include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = () => `environment-${mode}`;
    materials.push(material);
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      rgba = new Uint8Array(4);
    gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    scene.remove(mesh);
    return [...rgba];
  };
  const masks = [0, 100, 104, 112, 255].map((mask) => ({
    mask,
    pixel: sample(mask, 91, 177, "albedo"),
  }));
  const channels = sample(255, 91, 177, "channels");
  const normal = sample(255, 91, 177, "normal", [180, 100, 204, 255]);
  const clear = sample(255, 255, 0, "lit");
  const occluded = sample(255, 0, 0, "lit");
  const partial = sample(255, 128, 0, "lit");
  const metalOccluded = sample(255, 0, 255, "lit");
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  geometry.dispose();
  renderer.dispose();
  return { source, masks, channels, normal, clear, occluded, partial, metalOccluded };
}

export async function inspectEnvironmentBundles() {
  const { loadSourceMaterialBundle } = await import("../src/source-layers");
  const { applyTextureQuality, registerSurfaceTextures } =
    await import("../src/presentation-settings");
  const renderer = new T.WebGLRenderer();
  const has = renderer.extensions.has.bind(renderer.extensions);
  const results = [];
  for (const fallback of [false, true]) {
    renderer.extensions.has = (name) =>
      name === "EXT_texture_compression_bptc" && fallback ? false : has(name);
    const bundle = await loadSourceMaterialBundle(renderer, "/models/maps/lighting/environment/");
    const material = new T.MeshStandardMaterial({
      map: bundle.textures.get("color"),
      normalMap: bundle.textures.get("normal"),
    });
    registerSurfaceTextures(material, [...bundle.textures.values()]);
    const geometry = new T.PlaneGeometry();
    const mesh = new T.Mesh(geometry, material);
    const sizes = () =>
      [...bundle.textures.values()].map((texture) => {
        const image = texture.image as { width: number; height: number };
        return [image.width, image.height];
      });
    const original = sizes();
    applyTextureQuality([mesh], "low", 8);
    const low = sizes();
    applyTextureQuality([mesh], "high", 8);
    results.push({
      fallback,
      original,
      low,
      restored: sizes(),
      compressed: [...bundle.textures.values()].map(
        (texture) => texture instanceof T.CompressedTexture,
      ),
      colorSpaces: Object.fromEntries(
        [...bundle.textures].map(([key, texture]) => [key, texture.colorSpace]),
      ),
    });
    for (const texture of bundle.textures.values()) texture.dispose();
    material.dispose();
    geometry.dispose();
  }
  renderer.dispose();
  return results;
}
