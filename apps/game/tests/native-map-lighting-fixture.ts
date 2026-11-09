import * as T from "three";
import { applyNativeMapLighting } from "../src/native-map-lighting";

export function renderNativeMapAtlasFixture(withDirectional = false) {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(128, 128);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  document.body.replaceChildren(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const geometry = new T.PlaneGeometry(2, 2);
  geometry.setAttribute("uv1", geometry.getAttribute("uv"));
  const material = new T.MeshStandardMaterial({
    color: new T.Color().setRGB(0.5, 0.5, 0.5),
    roughness: 1,
  });
  const mesh = new T.Mesh(geometry, material);
  const prop = new T.Mesh(new T.PlaneGeometry(1, 1), material);
  prop.visible = false;
  scene.add(mesh, prop);
  const irradiance = new T.DataTexture(
    new Float32Array([0.125, 0.25, 0.375, 1]),
    1,
    1,
    T.RGBAFormat,
    T.FloatType,
  );
  const shadowBytes = new Uint8Array([0, 0, 0, 255]);
  const shadows = new T.DataTexture(shadowBytes, 1, 1);
  irradiance.needsUpdate = shadows.needsUpdate = true;
  const directional = withDirectional
    ? new T.DataTexture(new Float32Array([0.5, 0.5, 0.4, 1]), 1, 1, T.RGBAFormat, T.FloatType)
    : undefined;
  if (directional) directional.needsUpdate = true;
  const applied = applyNativeMapLighting(scene, { irradiance, shadows, directional });
  const patched = mesh.material;
  const pixel = () => {
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      bytes = new Uint8Array(4);
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return Array.from(bytes).slice(0, 3);
  };
  // This equation is independent of the injected shader: albedo * native diffuse radiance.
  const diffuseExpected = [0.125, 0.25, 0.375].map((value) => Math.round(value * 0.5 * 255));
  const diffuse = pixel();
  const ambient = new T.AmbientLight(0xffffff, 50);
  scene.add(ambient);
  const withoutAmbientDoubleCount = pixel();
  scene.remove(ambient);
  (irradiance.image.data as Float32Array).fill(0);
  irradiance.needsUpdate = true;
  const sun = new T.DirectionalLight(0xffffff, Math.PI / 2);
  sun.position.z = 3;
  scene.add(sun);
  const directClear = pixel();
  shadowBytes[0] = 192;
  shadows.needsUpdate = true;
  const directShadow = pixel();
  mesh.material = material;
  sun.intensity *= 1 - 192 / 255;
  const referenceShadow = pixel();
  // Metal has no diffuse contribution: its GGX highlight must match plain Three PBR.
  material.metalness = patched.metalness = 1;
  material.roughness = patched.roughness = 0.4;
  const referenceSpecular = pixel();
  mesh.material = patched;
  sun.intensity /= 1 - 192 / 255;
  const directSpecular = pixel();
  sun.intensity = 0;
  const generator = new T.PMREMGenerator(renderer);
  const environmentScene = new T.Scene();
  environmentScene.background = new T.Color().setRGB(0.1, 0.3, 0.7);
  const environment = generator.fromScene(environmentScene);
  scene.environment = environment.texture;
  const indirectSpecular = pixel();
  mesh.material = material;
  const referenceIndirectSpecular = pixel();
  mesh.material = patched;
  renderer.render(scene, camera);
  const image = renderer.domElement.toDataURL();
  const result = {
    diffuse,
    diffuseExpected,
    withoutAmbientDoubleCount,
    directClear,
    directShadow,
    referenceShadow,
    directSpecular,
    referenceSpecular,
    indirectSpecular,
    referenceIndirectSpecular,
    meshes: applied.lightmappedMeshes,
    isolated: prop.material === material && patched !== material,
    image,
  };
  environment.dispose();
  generator.dispose();
  directional?.dispose();
  irradiance.dispose();
  shadows.dispose();
  for (const clone of applied.materials.values()) clone.dispose();
  geometry.dispose();
  prop.geometry.dispose();
  material.dispose();
  renderer.dispose();
  return result;
}

export async function loadMirageMapAtlasFixture(forceFallback = false) {
  const { loadNativeMapLighting } = await import("../src/native-map-lighting");
  const renderer = new T.WebGLRenderer();
  renderer.setSize(1, 1);
  if (forceFallback) {
    const supported = renderer.extensions.has.bind(renderer.extensions);
    renderer.extensions.has = (name: string) =>
      !["EXT_texture_compression_bptc", "WEBGL_compressed_texture_s3tc"].includes(name) &&
      supported(name);
  }
  const config = await fetch("/models/maps/mirage-config.json").then((response) => response.json());
  const data = await loadNativeMapLighting(config.lighting, renderer);
  for (const texture of [data.irradiance, data.shadows, data.directional])
    if (texture) renderer.initTexture(texture);
  const atlasImage = data.irradiance.image as { width: number; height: number };
  const result = {
    irradianceFormat: data.irradiance.format,
    irradianceType: data.irradiance.type,
    directionalFormat: data.directional?.format,
    irradianceSize: [atlasImage.width, atlasImage.height],
    glError: renderer.getContext().getError(),
    halfFloat: T.HalfFloatType,
    bc6h: T.RGB_BPTC_UNSIGNED_Format,
    bc1: T.RGB_S3TC_DXT1_Format,
  };
  data.irradiance.dispose();
  data.shadows.dispose();
  data.directional?.dispose();
  renderer.dispose();
  return result;
}
