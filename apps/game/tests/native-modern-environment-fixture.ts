import * as T from "three";
import {
  applyNativeMapEnvironment,
  type SourceEnvironmentMaterial,
} from "../src/native-map-environment";
import { createEnvironmentTextureBanks } from "../src/native-environment-textures";
import { createEnvironmentWorldFrame } from "../src/native-environment-frame";

function source(): SourceEnvironmentMaterial {
  return {
    shader: "csgo_environment_blend.vfx",
    nativeResource: "native-bytecode-equation-probe",
    IntParams: {
      F_USE_NEW_BLENDING: 1,
      F_ENABLE_LAYER_3: 1,
      F_DETAIL_NORMAL: 1,
      F_BLEND_EFFECTS_2: 1,
      F_BLEND_EFFECTS_3: 1,
      F_BORDER_BLEND_MODE_2: 1,
      F_BORDER_BLEND_MODE_3: 3,
      F_SHARED_COLOR_OVERLAY: 1,
      g_nUVSet1: 2,
      g_nUVSet2: 2,
      g_nUVSet3: 1,
      g_nDetailUVSet1: 1,
      g_nDetailUVSet2: -1,
      g_nDetailUVSet3: -1,
    },
    FloatParams: {
      g_flHeightMapScale2: 0.5,
      g_flHeightMapScale3: -0.5,
      g_flUnderlyingHeightMapInfluence3: -1.216,
      g_flBlendSoftness2: 0.222,
      g_flBlendSoftness3: 0.04,
      g_flNormalReplace2: 0,
      g_flRoughnessReplace2: 0,
      g_flAOReplace2: 0,
      g_flMetalnessReplace2: 0,
      g_flColorOverlay2: 0.289,
      g_flColorReplace2: 0.5,
      g_flBorderOffset2: -0.299,
      g_flBorderSoftness2: 0,
      g_flBorderSpread2: 0.004,
      g_flBorderOffset3: 0.044,
      g_flBorderSoftness3: 0.094,
      g_flBorderSpread3: 0.118,
    },
    VectorParams: {
      g_vBorderLayerAmount2: [0, 0.7],
      g_vBorderLayerAmount3: [0.884, 0.471],
      g_vBorderTint2: [1, 1, 1],
      g_vBorderTint3: [0.662745, 0.541176, 0.392157],
      g_vColorOverlayLayerStrengths: [1, 0.905, 0.8],
      g_vColorOverlayTintMaskStrengths: [1, 1, 1],
    },
    textures: {},
    textureReflectivity: {},
    constants: {},
    nativeTextureDimensions: {},
  };
}
/** Selected native PS791/PS258 equation branches, not a full map parity claim.
 * The six goldens were independently evaluated from retained native SPIR-V. */
export function renderModernEnvironment() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(8, 8);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const frame = new T.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  frame.needsUpdate = true;
  const lookup = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  lookup.needsUpdate = true;
  const results = [];
  const probes = [
    { difference: -0.9, paint: 0.07, height: 0.83, softness: 0.222, mask: 0, native: 0 },
    { difference: 0.03, paint: 0.47, height: 0.19, softness: 0.4, mask: 0.7, native: 0.304225 },
    { difference: 0.8, paint: 0.92, height: 0.7, softness: 0.04, mask: 0, native: 1 },
    { difference: -0.04, paint: 0.5, height: 0.25, softness: 0.0001, mask: 1, native: 0 },
    { difference: 0.9, paint: 0.2, height: 0.8, softness: 0.6, mask: 2, native: 1 },
    { difference: -0.1, paint: 1, height: 0.3, softness: 0.2, mask: 0, native: 1 },
  ];
  for (const [index, probe] of [
    ...probes,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ].entries()) {
    const native = source();
    const textures = new Map<string, T.Texture>();
    for (let layer = 1; layer <= 3; layer++)
      for (const [kind, rgba] of [
        ["Color", [0.2, 0.3, 0.4, 1]],
        ["Normal", [128 / 255, 128 / 255, 0.5, 1]],
        ["Height", [0.5, 0.5, 1, 0]],
        ["NormalDetail", [128 / 255, 128 / 255, 0.5, 1]],
      ] as const) {
        const name = `g_t${kind}${layer}`,
          id = `${kind}${layer}`;
        native.textures[name] = id;
        native.constants![name] = [...rgba];
        native.nativeTextureDimensions![name] = [1, 1];
        native.textureReflectivity[`g_tColor${layer}`] = [0.2, 0.3, 0.4];
        textures.set(id, frame);
      }
    native.textures.g_tSharedColorOverlay = "overlay";
    native.constants!.g_tSharedColorOverlay = [0.5, 0.5, 0.5, 1];
    textures.set("overlay", frame);
    const blend = probe ? [(probe.paint + 0.05) / 1.1, 0, 0, 0] : [0.55, 0.25, 0, 0.05];
    if (probe) {
      native.IntParams = { F_USE_NEW_BLENDING: 1 };
      native.FloatParams = {
        g_flHeightMapScale1: 0,
        g_flHeightMapScale2: 0,
        g_flBlendSoftness2: probe.softness,
        g_flMaskWithHeight2: probe.mask,
        g_flBlendSoftnessDistanceModifierStrength: 0,
      };
      // Set h2 directly via zero point/scale: H remains the independent native mask input.
      native.FloatParams.g_flHeightMapScale2 = 1;
      native.FloatParams.g_flHeightMapZeroPoint2 =
        probe.height + 2 * probe.paint - 1 - probe.difference;
      native.constants!.g_tHeight2 = [probe.height, 0.5, 1, 0];
    } else if (index === 7) {
      blend[0] = (0.05 + 0.05) / 1.1;
      native.constants!.g_tHeight1 = [0.01, 0.5, 1, 0];
      native.constants!.g_tHeight2 = [0.8, 0.5, 1, 0];
      native.IntParams = {
        F_BLEND_EFFECTS_2: 1,
        F_BORDER_ROUGHNESS_2: 1,
        F_SECONDARY_UV: 1,
        F_SHARED_COLOR_OVERLAY: 1,
      };
      native.FloatParams = {
        g_flHeightMapScale1: 2.558,
        g_flHeightMapScale2: 0.744,
        g_flBlendSoftness2: 0.1,
        g_fBorderRoughness2: 0.862,
        g_flBorderOffset2: 1,
        g_flBorderSoftness2: 0.34,
        g_flBorderSpread2: -0.01,
        g_flBevelStrength2: -0.05,
      };
      native.VectorParams = {
        g_vBorderTint2: [0.745098, 0.647059, 0.458824],
        g_vBorderLayerAmount2: [1, 0],
      };
    }
    if (index === 8) {
      native.IntParams = { F_USE_NEW_BLENDING: 1, F_BLEND_BY_FACING_DIRECTION_2: 1 };
      native.FloatParams = {
        g_flHeightMapScale1: 0,
        g_flHeightMapScale2: 0,
        g_flBlendSoftness2: 1,
        g_flBlendSoftnessDistanceModifierStrength: 0,
        g_vFacingDirectionMaskNormalMapStrength2: 0.555,
        g_vFacingDirectionMaskSoftness2: 1,
        g_flFacingDirectionMaskSpread2: 0.39,
      };
      native.VectorParams = { g_vFacingDirection2: [0, -1, 0] };
      blend[0] = (0.6 + 0.05) / 1.1;
      blend[1] = blend[3] = 0;
      native.constants!.g_tNormal1 = [
        (1.003921627998352 + 3 / 7) / 2,
        (1.003921627998352 + 3 / 7) / 2,
        0.5,
        1,
      ];
    }
    if (index >= 9) {
      native.IntParams = { F_USE_NEW_BLENDING: 1, F_WETNESS: 1 };
      native.FloatParams = {
        g_flHeightMapScale1: 0,
        g_flHeightMapScale2: 0,
        g_flBlendSoftness2: 0.1,
        g_fWetnessStrength: index === 9 ? 0 : 0.125,
        g_fRainStrength: 0,
        g_fRippleStrength: index === 9 ? 0.15 : 0.17,
        g_fPuddleHeight: index === 9 ? 0.33 : 0.5,
        g_fPuddleBlendSoftness: index === 9 ? 0.3161 : 0.2251,
        g_fWetEdgeStrength: index === 9 ? 1 : 0.498,
        g_fWetEdgeSpread: index === 9 ? 0 : 0.183,
        g_fWetEdgeSoftness: index === 9 ? 0.5651 : 0.2001,
        g_flHorizontalSurfaceTolerance: index === 9 ? 100 : 32,
      };
      native.weather = {
        coverage: 1,
        drying: 0,
        rain: 1,
        ripples: 1,
        rippleDirection: 0,
        waveResourceQualification:
          "Synthetic constant wave for native algebra/GPU probe, not a native resource binding",
      };
      native.textures.g_tEnvironmentWater = "water";
      native.constants!.g_tEnvironmentWater = [0.5, 0.5, 0, 0.5];
      textures.set("water", frame);
      blend[0] = blend[1] = blend[3] = 0;
      blend[2] = 1;
    }
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.setAttribute("uv2", geometry.getAttribute("uv").clone());
    geometry.setAttribute("color_1", new T.Float32BufferAttribute(Array(4).fill(blend).flat(), 4));
    if (index >= 9)
      geometry.setAttribute(
        "normal",
        new T.Float32BufferAttribute(Array(4).fill([0, 1, 0]).flat(), 3),
      );
    geometry.computeTangents();
    // Exercise native RGBA array banks with separate color resources/UV reads.
    if (!probe)
      for (let layer = 1; layer <= 3; layer++) {
        const key = `g_tColor${layer}`,
          id = native.textures[key];
        delete native.constants![key];
        const texture = new T.DataTexture(new Uint8Array([50 + layer * 10, 80, 100, 255]), 1, 1);
        texture.needsUpdate = true;
        textures.set(id, texture);
      }
    const banked = createEnvironmentTextureBanks(textures, 256);
    const material = new T.MeshStandardMaterial({ roughness: 1 });
    material.name = "probe";
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    applyNativeMapEnvironment(mesh, {
      materials: { probe: native },
      textures,
      lookup,
      normalFrame: frame,
      banks: banked.bindings,
    });
    const compile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, r) => {
      compile(shader, r);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        index >= 9
          ? `gl_FragColor=vec4(environmentWetAmount,environmentPuddle,environmentRoughness,1.0);`
          : `gl_FragColor=vec4(environmentWeight2,environmentWeight3,environmentRoughness,1.0);`,
      );
    };
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      bytes = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    results.push({
      kind: probe
        ? "native-band"
        : index === 6
          ? "cache-three-layer"
          : index === 7
            ? "inferno-negative-border"
            : index === 8
              ? "native-facing"
              : "native-strength-zero-puddle",
      actual: Array.from(bytes),
      expected: probe
        ? Math.round(probe.native * 255)
        : index === 8
          ? 128
          : index >= 9
            ? 255
            : undefined,
      expectedRoughness: index === 7 ? 150 : undefined,
      error: gl.getError(),
      banks: banked.arrays.length,
      programs: renderer.info.programs?.length,
    });
    scene.remove(mesh);
    geometry.dispose();
    material.dispose();
    for (const texture of new Set(textures.values())) if (texture !== frame) texture.dispose();
    banked.arrays.forEach((texture) => texture.dispose());
  }
  frame.dispose();
  lookup.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}

/** Absolute Source-world biplanar placement, including the main importer's
 * final rotation. Four real native64-unit tiles share one mesh/UV stream. */
export function renderEnvironmentProjection(placement = new T.Matrix4()) {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const frame = new T.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  frame.needsUpdate = true;
  const bytes = new Uint8Array(4 * 4 * 4);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) bytes.set([x * 60 + 30, y * 40 + 20, 50, 255], (y * 4 + x) * 4);
  const color = new T.DataTexture(bytes, 4, 4);
  color.minFilter = color.magFilter = T.NearestFilter;
  color.wrapS = color.wrapT = T.RepeatWrapping;
  color.needsUpdate = true;
  const native = source();
  native.shader = "csgo_environment.vfx";
  native.IntParams = { g_nUVSet1: 0, g_nVertexColorMode1: 2 };
  native.FloatParams = {};
  native.VectorParams = {};
  native.textures = { g_tColor1: "color", g_tHeight1: "height", g_tNormal1: "normal" };
  native.constants = { g_tHeight1: [0.5, 0.5, 1, 0], g_tNormal1: [128 / 255, 128 / 255, 0.5, 1] };
  native.nativeTextureDimensions = { g_tHeight1: [1, 1] };
  native.textureReflectivity = { g_tColor1: [0.2, 0.3, 0.4] };
  const textures = new Map([
    ["color", color],
    ["normal", frame],
    ["height", frame],
  ]);
  const frameContract = createEnvironmentWorldFrame(placement.clone().invert());
  const scale = frameContract.unitScale,
    rotation = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(placement));
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-scale, scale, scale, -scale, 0.1 * scale, 10 * scale),
    results = [];
  const placed = new T.Group();
  placed.matrixAutoUpdate = false;
  placed.matrix.copy(placement);
  scene.add(placed);
  for (const [index, sourceX] of [8, 24, 40, 56].entries()) {
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.computeTangents();
    const material = new T.MeshStandardMaterial();
    material.name = "nativeProjection";
    const mesh = new T.Mesh(geometry, material);
    mesh.position.x = sourceX * 0.0254;
    placed.add(mesh);
    camera.position.copy(new T.Vector3(mesh.position.x, 0, 3).applyMatrix4(placement));
    camera.up.copy(new T.Vector3(0, 1, 0).applyQuaternion(rotation));
    camera.lookAt(new T.Vector3(mesh.position.x, 0, 0).applyMatrix4(placement));
    applyNativeMapEnvironment(mesh, {
      materials: { nativeProjection: native },
      textures,
      lookup: frame,
      normalFrame: frame,
      sourceWorldFrame: frameContract,
    });
    const compile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, r) => {
      compile(shader, r);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "gl_FragColor=vec4(diffuseColor.rgb,1.0);",
      );
    };
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      actual = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, actual);
    results.push({
      sourceX,
      actual: Array.from(actual),
      expected: [(3 - index) * 60 + 30, 20, 50, 255],
      error: gl.getError(),
    });
    placed.remove(mesh);
    geometry.dispose();
    material.dispose();
  }
  color.dispose();
  frame.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}

/** Presentation settings must preserve array depth and select authored mips,
 * including restoring High after Low without regenerating/resampling data. */
export async function renderEnvironmentBankQuality() {
  const { applyTextureQuality, registerSurfaceTextures } =
    await import("../src/presentation-settings");
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(8, 8);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const make = (offset: number) => {
    const mips = [4, 2, 1].map((width, i) => {
      const data = new Uint8Array(width * width * 4);
      for (let j = 0; j < width * width; j++)
        data.set([40 * 2 ** i + offset, 40 * 2 ** i + offset, 40 * 2 ** i + offset, 255], j * 4);
      return { data, width, height: width };
    });
    const texture = new T.DataTexture(mips[0].data, 4, 4);
    texture.mipmaps = mips;
    texture.minFilter = T.NearestMipmapNearestFilter;
    texture.magFilter = T.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  };
  const a = make(0),
    b = make(20),
    frame = new T.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  frame.needsUpdate = true;
  const textures = new Map([
      ["a", a],
      ["b", b],
      ["height", frame],
      ["normal", frame],
    ]),
    banked = createEnvironmentTextureBanks(
      new Map([
        ["a", a],
        ["b", b],
      ]),
      256,
    );
  const native = source();
  native.shader = "csgo_environment.vfx";
  native.IntParams = { g_nVertexColorMode1: 2 };
  native.FloatParams = {};
  native.VectorParams = {};
  native.textures = { g_tColor1: "a", g_tHeight1: "height", g_tNormal1: "normal" };
  native.constants = { g_tHeight1: [0.5, 0.5, 1, 0], g_tNormal1: [128 / 255, 128 / 255, 0.5, 1] };
  native.nativeTextureDimensions = { g_tHeight1: [1, 1] };
  native.textureReflectivity = { g_tColor1: [0.2, 0.3, 0.4] };
  const geometry = new T.PlaneGeometry(2, 2);
  geometry.computeTangents();
  const material = new T.MeshStandardMaterial();
  material.name = "bankQuality";
  const mesh = new T.Mesh(geometry, material);
  applyNativeMapEnvironment(mesh, {
    materials: { bankQuality: native },
    textures,
    banks: banked.bindings,
    lookup: frame,
    normalFrame: frame,
  });
  const compile = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, r) => {
    compile(shader, r);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "gl_FragColor=vec4(diffuseColor.rgb,1.0);",
    );
  };
  const noLodData = new Uint8Array(256 * 256 * 4);
  const noLod = new T.DataTexture(noLodData, 256, 256);
  noLod.mipmaps = [{ data: noLodData, width: 256, height: 256 }];
  noLod.generateMipmaps = false;
  noLod.minFilter = T.LinearFilter;
  registerSurfaceTextures(material, [...banked.arrays, noLod]);
  const scene = new T.Scene();
  scene.add(mesh);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const results = [];
  for (const [quality, expected] of [
    ["high", 40],
    ["low", 160],
    ["high", 40],
  ] as const) {
    applyTextureQuality([mesh], quality, renderer.capabilities.getMaxAnisotropy(), 1);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      actual = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, actual);
    results.push({
      quality,
      expected,
      actual: Array.from(actual),
      depth: banked.arrays[0].image.depth,
      mips: banked.arrays[0].mipmaps.length,
      noLod: [noLod.image.width, noLod.image.height, noLod.mipmaps.length],
      error: gl.getError(),
    });
  }
  geometry.dispose();
  material.dispose();
  a.dispose();
  b.dispose();
  frame.dispose();
  banked.arrays.forEach((texture) => texture.dispose());
  noLod.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}

/** Actual plain Inferno VMAT and native texture payloads. Goldens come from
 * four decoded native texels around UV(.5,.5), averaged in linear sampling
 * space, then independent native packed-normal/AO equations. */
export async function renderPlainNativeEnvironment(
  directory = "/models/maps/inferno-environment/",
) {
  const { loadSourceMaterialBundle } = await import("../src/source-layers");
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const name = "inferno_shop_front_01";
  const bundle = await loadSourceMaterialBundle<SourceEnvironmentMaterial>(
    renderer,
    directory,
    (materials) => new Set(Object.values(materials[name].textures)),
  );
  const native = bundle.materials[name];
  const banked = createEnvironmentTextureBanks(bundle.textures, 256),
    frame = new T.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  frame.needsUpdate = true;
  const geometry = new T.PlaneGeometry(2, 2);
  geometry.computeTangents();
  geometry.setAttribute("uv", new T.Float32BufferAttribute(Array(4).fill([0.5, 0.5]).flat(), 2));
  const material = new T.MeshStandardMaterial();
  material.name = name;
  const mesh = new T.Mesh(geometry, material);
  applyNativeMapEnvironment(mesh, {
    ...bundle,
    banks: banked.bindings,
    lookup: frame,
    normalFrame: frame,
  });
  const debug = { value: 0 },
    compile = material.onBeforeCompile.bind(material),
    key = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${key}:native-plain-debug-${debug.value}`;
  material.onBeforeCompile = (shader, r) => {
    compile(shader, r);
    shader.uniforms.environmentDebugMode = debug;
    shader.fragmentShader = "uniform int environmentDebugMode;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "if(environmentDebugMode==0)gl_FragColor=vec4(diffuseColor.rgb,environmentAO);else gl_FragColor=vec4(normal*.5+.5,roughnessFactor);",
    );
  };
  const scene = new T.Scene();
  scene.add(mesh);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const results = [];
  for (const [mode, expected] of [
    [0, [70, 61, 46, 255]],
    [1, [92, 127, 250, 127]],
  ] as const) {
    debug.value = mode;
    material.needsUpdate = true;
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      actual = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, actual);
    results.push({
      nativeResource: native.nativeResource,
      mode,
      actual: Array.from(actual),
      expected,
      error: gl.getError(),
      banks: banked.arrays.length,
    });
  }
  geometry.dispose();
  material.dispose();
  frame.dispose();
  bundle.textures.forEach((texture) => texture.dispose());
  banked.arrays.forEach((texture) => texture.dispose());
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}

export function renderEnvironmentSkyProjection() {
  return [1, 16].map((scale) => {
    const origin = new T.Vector3(9, -3, 5),
      reference = new T.Vector3(30, 12, -7),
      rotation = new T.Quaternion().setFromEuler(new T.Euler(0.2, 0.6, -0.1));
    const placement = new T.Matrix4()
      .makeTranslation(reference.x, reference.y, reference.z)
      .multiply(new T.Matrix4().makeRotationFromQuaternion(rotation))
      .multiply(new T.Matrix4().makeScale(scale, scale, scale))
      .multiply(new T.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
    return { scale, results: renderEnvironmentProjection(placement) };
  });
}
