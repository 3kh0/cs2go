import { expect, test } from "vitest";
import * as T from "three";
import {
  applyNativeMapEnvironment,
  environmentColorMatrix,
  validateSourceEnvironment,
  type SourceEnvironmentMaterial,
} from "./native-map-environment";

function source(): SourceEnvironmentMaterial {
  return {
    shader: "csgo_environment_blend.vfx",
    nativeResource: "materials/concrete/vertigo_concretefloorc_blend.vmat",
    IntParams: {
      F_SHARED_COLOR_OVERLAY: 1,
      g_bMetalness1: 0,
      g_bMetalness2: 0,
      g_nColorCorrectionMode1: 1,
      g_nColorCorrectionMode2: 1,
      g_nColorOverlayTintMask: 4,
    },
    FloatParams: {
      g_flBlendSoftness2: 0.167,
      g_flHeightMapScale2: 0,
      g_flOverlayBrightnessContrast: 0.592,
      g_flOverlayTexCoordRotation: -38.639,
      g_fTextureColorBrightness1: 0.8,
      g_fTextureColorBrightness2: 0.5,
      g_fTextureColorContrast1: 1.307,
      g_fTextureColorContrast2: 1.101,
      g_fTextureRoughnessBrightness2: 0.08,
    },
    VectorParams: { g_vOverlayTexCoordScale: [0.3, 0.3, 0, 0] },
    textures: {
      g_tColor1: "color",
      g_tHeight1: "height1",
      g_tNormal1: "normal",
      g_tColor2: "color",
      g_tHeight2: "height2",
      g_tNormal2: "normal",
      g_tSharedColorOverlay: "overlay",
    },
    textureReflectivity: { g_tColor1: [0.2, 0.3, 0.4], g_tColor2: [0.2, 0.3, 0.4] },
  };
}

test("environment color correction follows source reflectivity pivots and luminance preserving tint", () => {
  // Independent row-vector evaluation of the pinned C# MatrixColorCorrect2
  // and MatrixColorTint2, not a brightness-only approximation.
  const sample = new T.Vector4(0.2, 0.4, 0.8, 1);
  const correction = environmentColorMatrix([1.2, 0.4, 0.9], [0.1, 0.3, 0.5]);
  sample
    .clone()
    .applyMatrix4(correction)
    .toArray()
    .forEach((value, index) => {
      expect(value).toBeCloseTo([0.2995170875, 0.3715170875, 0.5299170875, 1][index], 7);
    });
  const tinted = environmentColorMatrix([1.2, 0.4, 0.9], [0.1, 0.3, 0.5], [0.8, 0.2, 0.1]);
  sample
    .clone()
    .applyMatrix4(tinted)
    .toArray()
    .forEach((value, index) => {
      expect(value).toBeCloseTo([0.7505494632, 0.2345494632, 0.1668494632, 1][index], 7);
    });
  const neutral = environmentColorMatrix([1, 1, 1], [0.02, 0.1, 0.5]);
  sample
    .clone()
    .applyMatrix4(neutral)
    .toArray()
    .forEach((value, index) => {
      expect(value).toBeCloseTo(sample.toArray()[index], 10);
    });
});

test("native FLOAT4 tint padding cannot replace asphalt RGB with its AO alpha", () => {
  const pivot = [0.09636279, 0.09636471, 0.09635809];
  for (const rgb of [
    [1, 1, 1],
    [1, 0.960784, 0.898039],
    [0.8, 0.2, 0.1],
  ]) {
    const expected = environmentColorMatrix([1, 1, 1.2], pivot, rgb);
    for (const unused of [0, 1, -8, 40])
      expect(environmentColorMatrix([1, 1, 1.2], pivot, [...rgb, unused]).elements).toEqual(
        expected.elements,
      );
  }
  const asphalt = new T.Vector4(0.1, 0.1, 0.1, 0.94).applyMatrix4(
    environmentColorMatrix([1, 1, 1.2], pivot, [1, 1, 1, 0]),
  );
  asphalt
    .toArray()
    .forEach((value, index) => expect(value).toBeCloseTo([0.12, 0.12, 0.12, 0.94][index], 10));
});

test("environment variants retain native UV selection, blend controls, model tint and packed channels", () => {
  const native = source();
  const textures = new Map(Object.values(native.textures).map((key) => [key, new T.Texture()]));
  const lookup = new T.DataTexture();
  const geometry = new T.PlaneGeometry();
  const atlas = new T.Float32BufferAttribute(
    Array.from({ length: 8 }, () => 0.25),
    2,
  );
  const alternate = new T.Float32BufferAttribute(
    Array.from({ length: 8 }, () => 0.75),
    2,
  );
  const controls = new T.Float32BufferAttribute(
    Array.from({ length: 16 }, (_, i) => (i % 4 === 3 ? 0.2 : 0)),
    4,
  );
  geometry.setAttribute("uv1", atlas);
  geometry.setAttribute("uv2", alternate);
  geometry.setAttribute("color_1", controls);
  const one = new T.MeshStandardMaterial({
    color: new T.Color(0.46207696, 0.095307365, 0.05448018),
  });
  const two = new T.MeshStandardMaterial({ color: new T.Color(1, 0.5711248, 0.11697058) });
  one.name = two.name = "native blend";
  const before = [one.color.clone(), two.color.clone()];
  const root = new T.Group();
  root.add(new T.Mesh(geometry, one), new T.Mesh(geometry, two));
  applyNativeMapEnvironment(root, { materials: { [one.name]: native }, textures, lookup });
  expect(geometry.getAttribute("uv1")).toBe(atlas);
  expect(geometry.getAttribute("sourceEnvironmentUv")).toBe(geometry.getAttribute("uv"));
  expect(geometry.getAttribute("sourceEnvironmentAlternateUv")).toBe(alternate);
  expect(geometry.getAttribute("sourceEnvironmentBlend")).toBe(controls);
  for (const [index, material] of [one, two].entries()) {
    const shader = {
      uniforms: {},
      vertexShader: T.ShaderLib.standard.vertexShader,
      fragmentShader: T.ShaderLib.standard.fragmentShader,
    } as T.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as T.WebGLRenderer);
    expect(shader.uniforms.environmentModelTint.value).toEqual(before[index]);
    expect(material.color.toArray()).toEqual([1, 1, 1]);
    expect(shader.vertexShader).toContain("vEnvironmentUv1=environmentRotate(sourceEnvironmentUv,");
    expect(shader.vertexShader).toContain(
      "vEnvironmentOverlayUv=environmentRotate(sourceEnvironmentAlternateUv,",
    );
    expect(shader.fragmentShader).toContain("float metalnessFactor=environmentHeight.a;");
    expect(shader.fragmentShader).toContain("float roughnessFactor=environmentNormal.b;");
    expect(shader.uniforms.environmentColor1.value).toBe(textures.get("color"));
    expect(shader.uniforms.environmentHeight2.value).toBe(textures.get("height2"));
    expect(shader.uniforms.environmentColor2).toBeUndefined();
    expect(shader.uniforms.environmentNormal2).toBeUndefined();
    expect(shader.fragmentShader).toContain("#define environmentColor2 environmentColor1");
    expect(shader.fragmentShader).toContain("#define environmentNormal2 environmentNormal1");
    expect(shader.fragmentShader).toContain("texture2D(environmentColor2,vEnvironmentUv2)");
    expect(material.aoMap).toBeNull();
    material.dispose();
  }
  expect(one.customProgramCacheKey()).toBe(two.customProgramCacheKey());
  geometry.dispose();
  textures.forEach((texture) => texture.dispose());
  lookup.dispose();
});

test("legacy environment shares only identical callback sources while retaining prior hooks and sampler aliases", () => {
  const materials: T.MeshStandardMaterial[] = [];
  const texture = new T.Texture(),
    lookup = new T.DataTexture(),
    geometry = new T.PlaneGeometry();
  geometry.setAttribute("uv2", geometry.getAttribute("uv"));
  geometry.setAttribute("color_1", new T.Float32BufferAttribute(Array(16).fill(0), 4));
  const bind = (native: SourceEnvironmentMaterial, prior = "prior-program") => {
    const material = new T.MeshStandardMaterial();
    material.name = "native blend";
    material.customProgramCacheKey = () => prior;
    applyNativeMapEnvironment(new T.Mesh(geometry, material), {
      materials: { [material.name]: native },
      textures: new Map(Object.values(native.textures).map((id) => [id, texture])),
      lookup,
    });
    materials.push(material);
    return material.customProgramCacheKey();
  };
  const original = source(),
    resourceVariant = structuredClone(original);
  resourceVariant.nativeResource = "materials/another-native-resource.vmat";
  resourceVariant.FloatParams.g_fTextureColorBrightness1 = 1.7;
  resourceVariant.VectorParams.g_vTextureColorTint1 = [0.7, 0.2, 0.1, 0];
  resourceVariant.textures = Object.fromEntries(
    Object.entries(resourceVariant.textures).map(([name, id]) => [name, `another-${id}`]),
  );
  const key = bind(original);
  expect(bind(resourceVariant)).toBe(key);
  expect(bind(original, "different-prior-program")).not.toBe(key);
  const differentAlias = structuredClone(original);
  differentAlias.textures.g_tColor2 = "independent-second-color";
  expect(bind(differentAlias)).not.toBe(key);
  const differentShader = structuredClone(original);
  differentShader.IntParams.F_SHARED_COLOR_OVERLAY = 0;
  expect(bind(differentShader)).not.toBe(key);
  materials.forEach((material) => material.dispose());
  geometry.dispose();
  texture.dispose();
  lookup.dispose();
});

test("unsupported native environment features and missing alternate UVs fail explicitly", () => {
  const native = source();
  for (const flag of ["F_UNRECOVERED_NATIVE_FEATURE"])
    expect(() =>
      validateSourceEnvironment({ ...native, IntParams: { ...native.IntParams, [flag]: 1 } }),
    ).toThrow("Unsupported native environment feature");
  expect(() =>
    validateSourceEnvironment({ ...native, IntParams: { ...native.IntParams, g_nUVSet1: 9 } }),
  ).toThrow("biplanar UVs");
  const root = new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial());
  root.material.name = "native blend";
  expect(() =>
    applyNativeMapEnvironment(root, {
      materials: { [root.material.name]: native },
      textures: new Map(),
      lookup: new T.DataTexture(),
    }),
  ).toThrow("alternate UV missing");
  root.geometry.dispose();
  root.material.dispose();
});

test("wet-enabled materials cannot bypass required map weather or wave provenance even at authored strength zero", () => {
  const native = source();
  native.IntParams.F_WETNESS = 1;
  native.FloatParams.g_fWetnessStrength = 0;
  expect(() => validateSourceEnvironment(native)).toThrow("authored weather");
  native.textures.g_tEnvironmentWater = "qualified-wave";
  native.weather = {
    coverage: 1,
    drying: 0,
    rain: 1,
    ripples: 1,
    rippleDirection: 0,
    waveResourceQualification:
      "Pinned viewer reserved reconstruction resource; native descriptor identity unobserved",
  };
  expect(validateSourceEnvironment(native).layers).toBe(2);
  native.weather.coverage = Number.NaN;
  expect(() => validateSourceEnvironment(native)).toThrow("Invalid native map weather");
});

test("actual biplanar selectors and preserved tools-only model-scale fields retain ordinary gameplay color semantics", () => {
  const native = source();
  native.IntParams.g_nUVSet2 = 0;
  native.IntParams.g_nScaleTexCoordUByModelScaleAxis = 3;
  expect(validateSourceEnvironment(native)).toEqual({ layers: 2, overlay: true });
  native.IntParams.F_ENABLE_LAYER_3 = 1;
  expect(() => validateSourceEnvironment(native)).toThrow("legacy three-layer");
  native.IntParams.F_USE_NEW_BLENDING = 1;
  expect(() => validateSourceEnvironment(native)).toThrow("g_tColor3");
});

test("alpha depth refuses unresolved instance-scale gate instead of applying tools UV guesses", () => {
  const native = source();
  native.IntParams.F_ALPHA_TEST = 1;
  native.IntParams.g_nScaleTexCoordUByModelScaleAxis = 2;
  expect(() => validateSourceEnvironment(native)).toThrow("unresolved engine gate");
});

test("native branched layers retain gradients captured before divergent weight evaluation", async () => {
  const { applyModernEnvironmentShader } = await import("./native-modern-environment");
  const native = source(),
    texture = new T.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1),
    lookup = new T.DataTexture();
  native.IntParams.F_SHARED_COLOR_OVERLAY = 0;
  const shader = {
    uniforms: {},
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  } as T.WebGLProgramParametersWithUniforms;
  applyModernEnvironmentShader(
    shader,
    native,
    new Map(Object.values(native.textures).map((id) => [id, texture])),
    undefined,
    new T.Color(1, 1, 1),
    lookup,
  );
  const branch = shader.fragmentShader.indexOf("if(environmentPaint2>0.0)");
  expect(branch).toBeGreaterThan(0);
  expect(shader.fragmentShader.indexOf("vec4 environmentSurfaceGradient2=")).toBeLessThan(branch);
  // Selected native PS791:962–968,1139/1149 samples the incoming color and
  // normal with the SAME captured gradient even when adjacent weights diverge.
  for (const role of ["Color", "Normal"])
    expect(shader.fragmentShader).toContain(
      `environment${role}2GradRead(vEnvironmentUv2+vec2(length(environmentSurfaceGradient2)*1e-10),environmentSurfaceGradient2.xy,environmentSurfaceGradient2.zw)`,
    );
  expect(shader.fragmentShader).not.toContain("environmentNormal2Read(vEnvironmentUv2)");
  texture.dispose();
  lookup.dispose();
});

test("ENV instance admission stays bounded to audited Cache debris UV contracts", () => {
  const probe = (change: (s: SourceEnvironmentMaterial) => void) => {
    const native = source();
    native.shader = "csgo_environment.vfx";
    native.nativeResource = "materials/de_cache/debris/ch2_debris_001_detail_a.vmat";
    native.nativeTextureDimensions = { g_tColor1: [1024, 1024], g_tHeight1: [1024, 1024] };
    native.IntParams = { F_MATERIAL_REFERENCE: 1, g_nUVSet1: 1 };
    native.FloatParams = {};
    native.VectorParams = {};
    change(native);
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.computeTangents();
    geometry.setAttribute("uv2", geometry.getAttribute("uv").clone());
    const material = new T.MeshStandardMaterial();
    material.name = "debris";
    const texture = new T.DataTexture();
    const textures = new Map(Object.values(native.textures).map((name) => [name, texture]));
    applyNativeMapEnvironment(new T.Mesh(geometry, material), {
      materials: { debris: native },
      textures,
      lookup: texture,
      normalFrame: texture,
    });
    const admitted = material.userData.nativeEnvironmentInstanceSafe;
    geometry.dispose();
    material.dispose();
    texture.dispose();
    return admitted;
  };
  expect(probe(() => {})).toBe(true);
  expect(
    probe((s) => {
      s.nativeResource = "materials/de_cache/debris/ch2_debris_001_detail_b.vmat_c";
    }),
  ).toBe(true);
  expect(
    probe((s) => {
      s.nativeResource = "materials/de_cache/debris/ch2_debris_001.vmat";
    }),
  ).toBe(false);
  expect(
    probe((s) => {
      s.IntParams.g_nUVSet1 = 2;
    }),
  ).toBe(false);
  expect(
    probe((s) => {
      s.IntParams.g_nScaleTexCoordUByModelScaleAxis = 1;
    }),
  ).toBe(false);
  expect(
    probe((s) => {
      s.VectorParams.g_vTexCoordScale1 = [2, 1];
    }),
  ).toBe(false);
  expect(
    probe((s) => {
      s.VectorParams.g_vTexCoordOffset1 = [0, 0.5];
    }),
  ).toBe(false);
});
