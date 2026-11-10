import * as T from "three";
import { applyParallaxShader, type SourceParallaxMaterial } from "../src/native-map-parallax";

export function renderNativeParallaxFixture() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(40, 1, 0.1, 20);
  camera.position.z = 3;
  const texture = (r: number, g = r, b = r, a = 255) => {
    const t = new T.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
    t.needsUpdate = true;
    return t;
  };
  const colors = { base: [0.2, 0.4, 0.6], one: [0.8, 0.2, 0.1], two: [0.1, 0.6, 0.3] };
  const textures = new Map([
    ["base", texture(...(colors.base.map((v) => Math.round(v * 255)) as [number, number, number]))],
    [
      "one",
      texture(...(colors.one.map((v) => Math.round(v * 255)) as [number, number, number]), 128),
    ],
    ["two", texture(...(colors.two.map((v) => Math.round(v * 255)) as [number, number, number]))],
    ["normal", texture(128, 128, 128)],
    ["mask", texture(0)],
    ["ao", texture(255)],
  ]);
  const lookup = texture(0),
    results = [];
  for (const mask of [0, 128, 255]) {
    const maskTexture = textures.get("mask")! as T.DataTexture;
    maskTexture.image.data![0] = mask;
    maskTexture.needsUpdate = true;
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.computeTangents();
    const material = new T.MeshStandardMaterial({
      map: textures.get("base"),
      normalMap: textures.get("normal"),
    });
    const source: SourceParallaxMaterial = {
      shader: "csgo_simple_3layer_parallax.vfx",
      nativeResource: "linear-reference.vmat",
      IntParams: {},
      FloatParams: { g_flLayer1EmissiveLevel: 0.25, g_flLayer2EmissiveLevel: 0.5 },
      VectorParams: {},
      constants: {
        g_tAmbientOcclusion: [1, 1, 1, 1],
        g_tLayer2Color: [...colors.two.map((v) => Math.round(v * 255) / 255), 1],
      },
      textures: {
        g_tColor: "base",
        g_tNormal: "normal",
        g_tLayer0Mask: "mask",
        g_tLayer1Color: "one",
        g_tLayer2Color: "two",
        g_tAmbientOcclusion: "ao",
      },
    };
    material.onBeforeCompile = (shader) => {
      applyParallaxShader(shader, source, textures, new Map(), new T.Color(1, 1, 1), lookup);
      // Expose native linear color+emission before lighting/exposure, independently
      // exercising the actual material sampler/blend/mask/emissive instructions.
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
        "vec3 outgoingLight = diffuseColor.rgb + totalEmissiveRadiance;",
      );
    };
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    renderer.render(scene, camera);
    const gl = renderer.getContext() as WebGL2RenderingContext,
      pixel = new Uint8Array(4);
    gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const alpha = 128 / 255,
      m = mask / 255;
    const expected = colors.base.map((base, c) => {
      const one = Math.round(colors.one[c] * 255) / 255,
        two = Math.round(colors.two[c] * 255) / 255;
      const color = (two * (1 - alpha) + one * alpha) * (1 - m) + base * m;
      const emission = (two * 0.5 * (1 - alpha) + one * 0.25 * alpha) * (1 - m);
      return Math.round(Math.min(1, color + emission) * 255);
    });
    results.push({
      mask,
      actual: Array.from(pixel).slice(0, 3),
      expected,
      error: gl.getError(),
      maxTextures: renderer.capabilities.maxTextures,
    });
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
  }
  textures.forEach((t) => t.dispose());
  lookup.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}

/** Native offset expression is in 1/1024 UV units, not world units. */
export function renderNativeParallaxAngleFixture() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(40, 1, 0.1, 20);
  const data = new Uint8Array(16 * 4);
  for (let x = 0; x < 16; x++) {
    data[x * 4] = x * 16;
    data[x * 4 + 3] = 255;
  }
  const gradient = new T.DataTexture(data, 16, 1);
  gradient.wrapS = T.RepeatWrapping;
  gradient.minFilter = gradient.magFilter = T.NearestFilter;
  gradient.needsUpdate = true;
  const constant = (r: number, g = r, b = r, a = 255) => {
    const t = new T.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
    t.needsUpdate = true;
    return t;
  };
  const textures = new Map([
    ["base", constant(0)],
    ["layer1", gradient],
    ["layer2", constant(0)],
    ["normal", constant(128, 128, 0)],
    ["mask", constant(0)],
    ["ao", constant(255)],
  ]);
  const lookup = constant(0),
    results = [];
  const geometry = new T.PlaneGeometry(4, 4);
  geometry.computeTangents();
  const material = new T.MeshStandardMaterial({
    map: textures.get("base"),
    normalMap: textures.get("normal"),
  });
  const source: SourceParallaxMaterial = {
    shader: "csgo_simple_3layer_parallax.vfx",
    nativeResource: "angle-reference.vmat",
    IntParams: {},
    FloatParams: { g_flLayer1Offset: -256 },
    VectorParams: {},
    textures: {
      g_tColor: "base",
      g_tNormal: "normal",
      g_tLayer0Mask: "mask",
      g_tLayer1Color: "layer1",
      g_tLayer2Color: "layer2",
      g_tAmbientOcclusion: "ao",
    },
  };
  material.onBeforeCompile = (shader) => {
    applyParallaxShader(shader, source, textures, new Map(), new T.Color(1, 1, 1), lookup);
    shader.fragmentShader = shader.fragmentShader.replace(
      "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
      "vec3 outgoingLight=diffuseColor.rgb;",
    );
  };
  const mesh = new T.Mesh(geometry, material);
  scene.add(mesh);
  for (const x of [-1, 0, 1]) {
    camera.position.set(x, 0, 3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    const gl = renderer.getContext() as WebGL2RenderingContext,
      pixel = new Uint8Array(4);
    gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(1 / 32, 1 / 32), camera);
    const hit = ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 0, 1), 0), new T.Vector3())!;
    const V = camera.position.clone().sub(hit).normalize();
    const uv = hit.x / 4 + 0.5;
    const shifted = uv + (V.x / V.z) * V.z ** 0.7 * (-256 / 1024);
    const column = Math.floor((((shifted % 1) + 1) % 1) * 16);
    results.push({ x, actual: pixel[0], expected: column * 16, uv, shifted, error: gl.getError() });
  }
  geometry.dispose();
  material.dispose();
  textures.forEach((t) => t.dispose());
  lookup.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}

export function renderNativeParallaxMipFixture() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const constant = (r: number, g = r, b = r, a = 255) => {
    const t = new T.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
    t.needsUpdate = true;
    return t;
  };
  const mips = Array.from({ length: 6 }, (_, level) => {
    const width = 32 >> level,
      data = new Uint8Array(width * width * 4);
    for (let i = 0; i < width * width; i++) data.set([20 + level * 30, 0, 0, 255], i * 4);
    return { width, height: width, data };
  });
  const layer = new T.DataTexture(mips[0].data, 32, 32);
  layer.mipmaps = mips;
  layer.generateMipmaps = false;
  layer.minFilter = T.LinearMipmapLinearFilter;
  layer.magFilter = T.LinearFilter;
  layer.needsUpdate = true;
  const textures = new Map([
    ["base", constant(0)],
    ["layer1", layer],
    ["layer2", constant(0)],
    ["normal", constant(128, 128, 128)],
    ["mask", constant(0)],
    ["ao", constant(255)],
  ]);
  const lookup = constant(0),
    results = [];
  for (const bias of [0, 1, 2]) {
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.computeTangents();
    const material = new T.MeshStandardMaterial({
      map: textures.get("base"),
      normalMap: textures.get("normal"),
    });
    const source: SourceParallaxMaterial = {
      shader: "csgo_simple_3layer_parallax.vfx",
      nativeResource: "mip-reference.vmat",
      IntParams: {},
      FloatParams: { g_flLayer1RoughnessBlurMin: bias, g_flLayer1RoughnessBlurMax: bias },
      VectorParams: {},
      textures: {
        g_tColor: "base",
        g_tNormal: "normal",
        g_tLayer0Mask: "mask",
        g_tLayer1Color: "layer1",
        g_tLayer2Color: "layer2",
        g_tAmbientOcclusion: "ao",
      },
    };
    material.onBeforeCompile = (shader) => {
      applyParallaxShader(shader, source, textures, new Map(), new T.Color(1, 1, 1), lookup);
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
        "vec3 outgoingLight=diffuseColor.rgb;",
      );
    };
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    renderer.render(scene, camera);
    const gl = renderer.getContext() as WebGL2RenderingContext,
      pixel = new Uint8Array(4);
    gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    results.push({ bias, actual: pixel[0], expected: 20 + bias * 30, error: gl.getError() });
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
  }
  textures.forEach((t) => t.dispose());
  lookup.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}

export async function renderNativeParallaxCubeFixture() {
  const { applyNativeMapLighting } = await import("../src/native-map-lighting");
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(16, 16);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(40, 1, 0.1, 10);
  camera.position.z = 3;
  const constant = (r: number, g = r, b = r, a = 255) => {
    const t = new T.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
    t.needsUpdate = true;
    return t;
  };
  const textures = new Map([
    ["base", constant(0)],
    ["one", constant(0, 0, 0, 0)],
    ["two", constant(51)],
    ["normal", constant(128, 128, 128)],
    ["mask", constant(0)],
    ["ao", constant(255)],
  ]);
  const palette = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
  ];
  const mips = [2, 1].map((size) => {
    const data = new Uint16Array(size * size * 4 * 6);
    for (let face = 0; face < 6; face++)
      for (let pixel = 0; pixel < size * size; pixel++)
        data.set(
          [...palette[face], 1].map((value) => T.DataUtils.toHalfFloat(value)),
          (face * size * size + pixel) * 4,
        );
    return { data, width: size, height: size };
  });
  const cube = new T.CompressedArrayTexture(mips, 2, 2, 6, T.RGB_BPTC_UNSIGNED_Format);
  Object.assign(cube, { type: T.HalfFloatType, format: T.RGBAFormat });
  cube.generateMipmaps = false;
  cube.minFilter = T.LinearMipmapLinearFilter;
  cube.magFilter = T.LinearFilter;
  cube.needsUpdate = true;
  const lookup = constant(0),
    geometry = new T.PlaneGeometry(2, 2);
  geometry.computeTangents();
  geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
  const material = new T.MeshStandardMaterial({
    map: textures.get("base"),
    normalMap: textures.get("normal"),
  });
  const source: SourceParallaxMaterial = {
    shader: "csgo_simple_3layer_parallax.vfx",
    nativeResource: "cube-reference.vmat",
    IntParams: { F_SECOND_LAYER_CUBEMAP: 1 },
    FloatParams: { g_flLayer2EmissiveLevel: 1 },
    VectorParams: {},
    textures: {
      g_tColor: "base",
      g_tNormal: "normal",
      g_tLayer0Mask: "mask",
      g_tLayer1Color: "one",
      g_tLayer2Color: "two",
      g_tAmbientOcclusion: "ao",
      g_tLayer2Cubemap: "cube",
    },
  };
  material.onBeforeCompile = (shader) =>
    applyParallaxShader(
      shader,
      source,
      textures,
      new Map([["cube", cube]]),
      new T.Color(1, 1, 1),
      lookup,
      2,
    );
  const mesh = new T.Mesh(geometry, material);
  scene.add(mesh);
  const irradiance = constant(64),
    shadows = constant(0),
    directional = constant(128, 128, 255);
  applyNativeMapLighting(scene, { irradiance, shadows, directional });
  renderer.render(scene, camera);
  const gl = renderer.getContext() as WebGL2RenderingContext,
    pixel = new Uint8Array(4);
  gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  const expected = [13, 13, 64],
    program = renderer.info.programs?.[0];
  const activeUniforms = program
    ? gl.getProgramParameter(program.program as WebGLProgram, gl.ACTIVE_UNIFORMS)
    : 0;
  let activeSamplers = 0;
  for (let i = 0; i < activeUniforms; i++) {
    const uniform = gl.getActiveUniform(program!.program as WebGLProgram, i);
    if (
      uniform &&
      [gl.SAMPLER_2D, gl.SAMPLER_2D_ARRAY, gl.SAMPLER_CUBE, gl.SAMPLER_2D_SHADOW].some(
        (type) => type === uniform.type,
      )
    )
      activeSamplers += uniform.size;
  }
  const result = {
    actual: Array.from(pixel).slice(0, 3),
    expected,
    error: gl.getError(),
    activeSamplers,
    maxTextures: renderer.capabilities.maxTextures,
  };
  geometry.dispose();
  material.dispose();
  if (mesh.material !== material) (mesh.material as T.Material).dispose();
  textures.forEach((t) => t.dispose());
  cube.dispose();
  lookup.dispose();
  irradiance.dispose();
  shadows.dispose();
  directional.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return result;
}
