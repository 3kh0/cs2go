import * as T from "three";
import { applySourceFoliage } from "../src/source-foliage";
import { applySourceMapLighting } from "../src/source-map-lighting";

export function renderSourceFoliage() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(128, 128);
  renderer.setClearColor(0x000000);
  const scene = new T.Scene();
  const pixels = new Uint8Array(64 * 4);
  for (let i = 0; i < 64; i++) pixels.set([255, 255, 255, Math.round((i / 63) * 255)], i * 4);
  const texture = new T.DataTexture(pixels, 64, 1);
  texture.needsUpdate = true;
  const material = new T.MeshStandardMaterial({
    map: texture,
    alphaTest: 0.5,
    emissive: 0xffffff,
    side: T.DoubleSide,
  });
  material.onBeforeCompile = (shader) =>
    applySourceFoliage(shader, {
      nonDirectional: true,
      alphaCoverage: {
        reference: 0.5,
        grazingAngleMask: 1,
        boostStrength: 3,
        boostDistanceMeters: 508,
      },
    });
  const geometry = new T.PlaneGeometry(4, 4);
  const mesh = new T.Mesh(geometry, material);
  scene.add(mesh);
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 1000);
  const render = (distance: number, angle: number) => {
    camera.position.z = distance;
    camera.zoom = distance / 10;
    camera.updateProjectionMatrix();
    mesh.rotation.y = angle;
    mesh.scale.x = 1 / Math.cos(angle);
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const row = new Uint8Array(128 * 4);
    gl.readPixels(0, 64, 128, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
    return Array.from({ length: 128 }, (_, i) => row[i * 4]).filter((red) => red > 200).length;
  };
  const result = { near: render(10, 0), far: render(400, 0), grazing: render(10, Math.PI / 3) };
  geometry.dispose();
  material.dispose();
  texture.dispose();
  renderer.dispose();
  return result;
}

export function renderSourceTransmission() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(64, 64);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 5;
  const constant = (rgba: number[]) => {
    const texture = new T.DataTexture(new Uint8Array(rgba), 1, 1);
    texture.needsUpdate = true;
    return texture;
  };
  const black = constant([0, 0, 0, 255]);
  const green = constant([0, 255, 0, 255]);
  const white = constant([255, 255, 255, 255]);
  const geometry = new T.PlaneGeometry(3, 3);
  const count = geometry.getAttribute("position").count;
  const packed = (rgba: number[]) => {
    const bytes = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) bytes.set(rgba, i * 4);
    return new T.BufferAttribute(bytes, 4, true);
  };
  geometry.setAttribute("color_1", packed([0, 0, 0, 0]));
  const frontProbe = packed([0, 0, 0, 255]);
  const backProbe = packed([0, 0, 0, 255]);
  geometry.setAttribute("color_2", frontProbe);
  geometry.setAttribute("color_3", backProbe);
  const albedoGeometry = geometry.clone();
  const noFlipGeometry = geometry.clone();
  const material = new T.MeshStandardMaterial({
    name: "test-leaf",
    color: 0xff0000,
    map: white,
    side: T.DoubleSide,
  });
  const mesh = new T.Mesh(geometry, material);
  scene.add(mesh);
  applySourceMapLighting(mesh, {
    irradiance: black,
    shadows: black,
    directional: undefined,
    native: false,
    materialLighting: {
      materials: [
        {
          name: "test-leaf",
          foliage: { nonDirectional: true, transmission: { useAlbedo: false, texture: "green" } },
        },
      ],
    },
    transmissionTextures: new Map([["green", green]]),
  });
  const sun = new T.DirectionalLight(0xffffff, Math.PI);
  sun.position.set(0, 0, -10);
  scene.add(sun);
  const render = () => {
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return [...pixel];
  };
  const throughLeaf = render();
  const albedoMaterial = new T.MeshStandardMaterial({
    name: "albedo-leaf",
    color: 0xff0000,
    map: white,
    side: T.DoubleSide,
  });
  const albedoMesh = new T.Mesh(albedoGeometry, albedoMaterial);
  applySourceMapLighting(albedoMesh, {
    irradiance: black,
    shadows: black,
    directional: undefined,
    native: false,
    materialLighting: {
      materials: [
        {
          name: "albedo-leaf",
          foliage: { nonDirectional: true, transmission: { useAlbedo: true } },
        },
      ],
    },
    transmissionTextures: new Map(),
  });
  scene.add(albedoMesh);
  mesh.visible = false;
  const throughAlbedo = render();
  albedoMesh.visible = false;
  mesh.visible = true;
  sun.position.z = 10;
  const frontLit = render();
  sun.position.z = -10;
  for (let i = 0; i < count; i++) frontProbe.array[i * 4 + 3] = 0;
  frontProbe.needsUpdate = true;
  const blocked = render();
  sun.intensity = 0;
  for (let i = 0; i < count; i++) backProbe.array[i * 4 + 1] = 64;
  backProbe.needsUpdate = true;
  const oppositeProbe = render();
  material.aoMap = black;
  material.needsUpdate = true;
  const oppositeProbeWithAO = render();
  mesh.rotation.y = Math.PI;
  const backFace = render();
  mesh.visible = false;
  noFlipGeometry.setAttribute("color_2", packed([64, 0, 0, 255]));
  noFlipGeometry.setAttribute("color_3", packed([0, 64, 0, 255]));
  const noFlipMaterial = new T.MeshStandardMaterial({ name: "no-flip-leaf", side: T.DoubleSide });
  const noFlipMesh = new T.Mesh(noFlipGeometry, noFlipMaterial);
  applySourceMapLighting(noFlipMesh, {
    irradiance: black,
    shadows: black,
    directional: undefined,
    native: false,
    materialLighting: {
      materials: [
        { name: "no-flip-leaf", foliage: { nonDirectional: true, dontFlipBackfaceNormals: true } },
      ],
    },
    transmissionTextures: new Map(),
  });
  scene.add(noFlipMesh);
  const noFlipFront = render();
  noFlipMesh.rotation.y = Math.PI;
  const noFlipBack = render();
  geometry.dispose();
  albedoGeometry.dispose();
  albedoMaterial.dispose();
  material.dispose();
  noFlipGeometry.dispose();
  noFlipMaterial.dispose();
  for (const texture of [black, green, white]) texture.dispose();
  renderer.dispose();
  return {
    throughLeaf,
    throughAlbedo,
    frontLit,
    blocked,
    oppositeProbe,
    oppositeProbeWithAO,
    backFace,
    noFlipFront,
    noFlipBack,
  };
}

// Read the actual GPU normal in world space, including normal maps and both
// tangent paths, from either side of the same unrotated leaf.
export function renderSourceFoliageNormals() {
  const renderer = new T.WebGLRenderer();
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 10);
  const scene = new T.Scene();
  const texture = new T.DataTexture(new Uint8Array([204, 128, 230, 255]), 1, 1);
  texture.needsUpdate = true;
  const results = [];
  for (const explicit of [false, true]) {
    const geometry = new T.PlaneGeometry(2, 2);
    if (explicit) geometry.computeTangents();
    for (const dontFlip of [false, true]) {
      const material = new T.MeshStandardMaterial({ normalMap: texture, side: T.DoubleSide });
      material.onBeforeCompile = (shader) => {
        applySourceFoliage(shader, { nonDirectional: true, dontFlipBackfaceNormals: dontFlip });
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          "outgoingLight = inverseTransformDirection(normal, viewMatrix) * 0.5 + 0.5;\n#include <opaque_fragment>",
        );
      };
      material.customProgramCacheKey = () => `normal-${dontFlip}`;
      const mesh = new T.Mesh(geometry, material);
      scene.add(mesh);
      for (const back of [false, true]) {
        camera.position.z = back ? -5 : 5;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        const gl = renderer.getContext(),
          pixel = new Uint8Array(4);
        gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        results.push({ explicit, dontFlip, back, pixel: [...pixel].slice(0, 3) });
      }
      scene.remove(mesh);
      material.dispose();
    }
    geometry.dispose();
  }
  texture.dispose();
  renderer.dispose();
  return results;
}

export async function renderSourceFoliageGradient() {
  const { applySourceSurface, loadSourceSurfaceLookup } = await import("../src/source-surface");
  const lookup = await loadSourceSurfaceLookup();
  const renderer = new T.WebGLRenderer();
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.z = 5;
  const scene = new T.Scene();
  const sun = new T.DirectionalLight(0xffffff, Math.PI);
  sun.position.set(0, 0, 5);
  scene.add(sun);
  const results = [];
  for (const metalness of [0, 1]) {
    for (const height of [0, 0.5, 1]) {
      const geometry = new T.PlaneGeometry(2, 2);
      const count = geometry.getAttribute("position").count;
      const values = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) values.set([height, 0.2, 0.7, 0.1], i * 4);
      geometry.setAttribute("color", new T.BufferAttribute(values, 4));
      const material = new T.MeshStandardMaterial({
        color: new T.Color().setRGB(0.25, 0.25, 0.25),
        vertexColors: true,
        metalness,
        roughness: 1,
      });
      material.onBeforeCompile = (shader) => {
        applySourceSurface(
          shader,
          { directSpecular: metalness === 1, indirectSpecular: true },
          lookup,
        );
        applySourceFoliage(shader, {
          nonDirectional: true,
          heightGradient: { amount: 0.33, power: 1.5 },
        });
      };
      material.customProgramCacheKey = () => `gradient-${metalness}`;
      const mesh = new T.Mesh(geometry, material);
      scene.add(mesh);
      renderer.render(scene, camera);
      const gl = renderer.getContext(),
        pixel = new Uint8Array(4);
      gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      results.push({ metalness, height, pixel: [...pixel] });
      scene.remove(mesh);
      material.dispose();
      geometry.dispose();
    }
  }
  renderer.dispose();
  return results;
}
