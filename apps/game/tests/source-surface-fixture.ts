import * as T from "three";
import {
  applySourceSurface,
  loadSourceSurfaceLookup,
  type SourceSurface,
} from "../src/source-surface";

export async function renderSourceSurfaces() {
  const lookup = await loadSourceSurfaceLookup();
  const metadata = await fetch("/models/maps/material-lighting.json").then((r) => r.json());
  const surfaces = metadata.materials
    .filter((entry: { surface?: SourceSurface }) => entry.surface)
    .map((entry: { name: string; surface: SourceSurface }) => entry);
  const find = (direct: boolean, indirect: boolean) =>
    surfaces.find(
      (entry: { surface: SourceSurface }) =>
        entry.surface.directSpecular === direct && entry.surface.indirectSpecular === indirect,
    ).surface as SourceSurface;
  const matte = find(false, false),
    reflective = find(false, true),
    glossy = find(true, true);
  const renderer = new T.WebGLRenderer();
  renderer.setSize(32, 32);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;
  const geometry = new T.PlaneGeometry(2, 2);
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial());
  scene.add(mesh);
  const sun = new T.DirectionalLight(0xffffff, Math.PI);
  sun.position.set(0, 0, 5);
  const ambient = new T.AmbientLight(0xffffff, 0);
  scene.add(sun, ambient);
  const materials: T.Material[] = [mesh.material];
  const encode = (linear: number) =>
    Math.round(
      Math.min(new T.Color().setRGB(linear, linear, linear).convertLinearToSRGB().r, 1) * 255,
    );
  const aoData = new Uint8Array([0, 0, 0, 255]);
  const ao = new T.DataTexture(aoData, 1, 1);
  ao.needsUpdate = true;
  const pixel = (
    surface: SourceSurface,
    metalness: number,
    roughness: number,
    occluded = false,
  ) => {
    const material = new T.MeshStandardMaterial({ metalness, roughness });
    if (occluded) {
      material.aoMap = ao;
      // Source scale=0 still reads raw AO, unlike Three's intensity=0.
      material.aoMapIntensity = 0;
    }
    material.color.setRGB(0.25, 0.25, 0.25);
    material.onBeforeCompile = (shader) => applySourceSurface(shader, surface, lookup);
    material.customProgramCacheKey = () =>
      `surface-${surface.directSpecular}-${surface.indirectSpecular}-${!!surface.nativeAO}`;
    mesh.material = material;
    materials.push(material);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      rgba = new Uint8Array(4);
    gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    return Array.from(rgba).slice(0, 3);
  };
  const diffuseDirect = pixel(matte, 0, 0.05);
  const diffuseDirectRough = pixel(matte, 0, 1);
  const native = surfaces.find(
    (entry: { surface: SourceSurface }) =>
      entry.surface.nativeAO && entry.surface.directSpecular && entry.surface.indirectSpecular,
  ).surface as SourceSurface;
  const nativeDirectAO = pixel(native, 0, 1, true);
  const nativeDirectClear = pixel(native, 0, 1);
  const nativeMetalAO = pixel(native, 1, 1, true);
  const metalDirectOff = pixel(reflective, 1, 0.1);
  const metalDirectOn = pixel(glossy, 1, 0.1);
  // Independent source equation at multiple non-clipped points distinguishes
  // 8.2 Schlick-Smith from Three's correlated Smith and checks pi normalization.
  const directSamples = [
    [0.6, 0.5],
    [1, 0.5],
    [0.4, 0.8],
  ].map(([roughness, NoL]) => {
    sun.position.set(Math.sqrt(1 - NoL * NoL), 0, NoL);
    const actual = pixel(glossy, 1, roughness);
    const NoH = Math.sqrt((1 + NoL) / 2),
      alpha = Math.max(roughness * roughness, 1e-4);
    const k = Math.min(alpha / (1 - NoH * NoH + (NoH * alpha) ** 2), 453.5);
    const v = (roughness + 1) ** 2 / 8;
    const visibility = 1 / (4 * Math.max(NoL * (1 - v) + v, 0.0001));
    const fresnel = 0.25 + 0.75 * (1 - NoH) ** 5;
    const compensation = 1 + 0.25 * 0.125 * (2 * roughness) ** 4;
    return { actual, expected: encode(NoL * k * k * visibility * fresnel * compensation) };
  });
  sun.intensity = 0;
  ambient.intensity = Math.PI;
  const diffuseIndirect = pixel(matte, 0, 0.05);
  const diffuseIndirectRough = pixel(matte, 0, 1);
  const nativeIndirectAO = pixel(native, 0, 1, true);
  mesh.rotation.y = Math.acos(0.1);
  const reflectiveDiffuse = pixel(reflective, 0, 0.5);
  // Check native table coordinates/channel layout and the diffuse energy split.
  const data = lookup.image.data as Uint16Array;
  const x = 0.5 * 63,
    y = Math.sqrt(0.9) * 63;
  const lut = [0, 1].map((channel) => {
    let value = 0;
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const xx = Math.floor(x) + dx,
          yy = Math.floor(y) + dy;
        const weight =
          (dx ? x - Math.floor(x) : 1 - x + Math.floor(x)) *
          (dy ? y - Math.floor(y) : 1 - y + Math.floor(y));
        value += T.DataUtils.fromHalfFloat(data[(yy * 64 + xx) * 2 + channel]) * weight;
      }
    return value;
  });
  const single = lut[0] * (1 - 0.04) + lut[1] * 0.04,
    missing = 1 - lut[1],
    average = 0.04 + 0.96 / 21;
  const multi = ((single * average) / (1 - average * missing)) * missing;
  const reflectiveDiffuseExpected = encode(0.25 * (1 - single - multi));
  mesh.rotation.y = 0;
  ambient.intensity = 0;
  const face = document.createElement("canvas");
  face.width = face.height = 16;
  const context = face.getContext("2d")!;
  context.fillStyle = "#0000ff";
  context.fillRect(0, 0, 16, 16);
  const environment = new T.CubeTexture(Array.from({ length: 6 }, () => face));
  environment.needsUpdate = true;
  scene.environment = environment;
  const metalIndirectOff = pixel(matte, 1, 0.1);
  const metalIndirectOn = pixel(reflective, 1, 0.1);
  const aoSamples = [];
  aoData[0] = 128;
  ao.needsUpdate = true;
  for (const roughness of [0.2, 0.8])
    for (const NoV of [1, 0.1]) {
      mesh.rotation.y = Math.acos(NoV);
      const clear = pixel(native, 1, roughness);
      const occluded = pixel(native, 1, roughness, true);
      const expected = clear.map((value) => {
        const linear = new T.Color()
          .setRGB(value / 255, value / 255, value / 255)
          .convertSRGBToLinear().r;
        return encode((linear * 128) / 255);
      });
      aoSamples.push({ roughness, NoV, occluded, expected });
    }
  const expected = Math.round(new T.Color().setRGB(0.25, 0.25, 0.25).convertLinearToSRGB().r * 255);
  const counts = {
    matte: surfaces.filter(
      (entry: { surface: SourceSurface }) =>
        !entry.surface.directSpecular && !entry.surface.indirectSpecular,
    ).length,
    reflective: surfaces.filter(
      (entry: { surface: SourceSurface }) =>
        !entry.surface.directSpecular && entry.surface.indirectSpecular,
    ).length,
    glossy: surfaces.filter((entry: { surface: SourceSurface }) => entry.surface.directSpecular)
      .length,
  };
  for (const material of materials) material.dispose();
  geometry.dispose();
  environment.dispose();
  ao.dispose();
  renderer.dispose();
  return {
    diffuseDirect,
    diffuseDirectRough,
    diffuseIndirect,
    diffuseIndirectRough,
    reflectiveDiffuse,
    reflectiveDiffuseExpected,
    directSamples,
    expected,
    metalDirectOff,
    metalDirectOn,
    metalIndirectOff,
    metalIndirectOn,
    counts,
    rawAOCount: surfaces.filter((entry: { surface: SourceSurface }) => entry.surface.nativeAO)
      .length,
    aoSamples,
    nativeDirectAO,
    nativeDirectClear,
    nativeMetalAO,
    nativeIndirectAO,
  };
}
