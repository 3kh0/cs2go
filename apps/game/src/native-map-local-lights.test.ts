import { expect, test } from "vitest";
import * as T from "three";
import { NativeMapLocalLights, applyNativeMapLocalLights } from "./native-map-local-lights";
import { applySourceSurface } from "./source-surface";
import { buildQualifiedVrfLocalBarn } from "./native-local-light-bridge";
const entity = {
  classname: "light_barn",
  directlight: 3,
  scales: [1, 1, 1],
  origin: [0, 0, 0],
  angles: [0, 0, 0],
  size_params: [1, 1, 1],
  range: 4,
  precomputedfieldsvalid: 1,
  precomputedobborigin: [0, 0, 0],
  precomputedobbextent: [10, 10, 10],
  precomputedobbangles: [0, 0, 0],
  color: [255, 255, 255],
  brightness_lumens: 1,
};
const light = () =>
  new NativeMapLocalLights({
    version: 1,
    qualification: "Qualified VRF test",
    lights: [
      {
        id: "fixture",
        qualification: "Independent mathematical fixture",
        record: buildQualifiedVrfLocalBarn(entity, { compiledShadowChannel: 2 }).record,
      },
    ],
    rejected: [],
  });
function material(mask: "atlas" | "probe" | "none") {
  const m = new T.MeshStandardMaterial();
  m.userData.nativeSourceFamily = "complex";
  if (mask !== "none") m.userData.nativeBakedVisibility = mask === "atlas" ? "atlas" : "probe";
  m.onBeforeCompile = (shader) => {
    applySourceSurface(
      shader,
      { directSpecular: true, indirectSpecular: false },
      new T.DataTexture(),
    );
    shader.fragmentShader =
      (mask === "atlas"
        ? "uniform sampler2D nativeMapShadows; varying vec2 vNativeMapLightUv;\n"
        : mask === "probe"
          ? "SourceGpuProbe nativePropProbe;\n"
          : "") + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <aomap_fragment>",
      "reflectedLight.directSpecular*=0.5;",
    );
  };
  return m;
}
function compile(m: T.Material) {
  const shader = {
    fragmentShader: T.ShaderLib.standard.fragmentShader,
    vertexShader: T.ShaderLib.standard.vertexShader,
    uniforms: {},
  } as T.WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader, {} as T.WebGLRenderer);
  return shader.fragmentShader;
}
test("qualified local contribution precedes existing material/AO hooks and retains native visibility", () => {
  for (const mask of ["atlas", "probe"] as const) {
    const m = material(mask);
    m.defines = { CUSTOM_NATIVE_FLAG: 1 };
    const root = new T.Mesh(new T.BoxGeometry(), m),
      data = light();
    expect(applyNativeMapLocalLights(root, data)).toEqual({ materials: 1, held: [] });
    const source = compile(m);
    expect(source).toContain(
      mask === "atlas"
        ? "texture2D(nativeMapShadows,vNativeMapLightUv)"
        : "nativePropProbe.occlusion",
    );
    expect(source.indexOf("reflectedLight.directSpecular+=")).toBeLessThan(
      source.indexOf("reflectedLight.directSpecular*=0.5;"),
    );
    expect(m.defines.CUSTOM_NATIVE_FLAG).toBe(1);
    expect(root.material).toBe(m);
    data.dispose();
  }
});
test("unknown response families and unavailable native baked visibility stay held", () => {
  const root = new T.Group(),
    unknown = new T.MeshStandardMaterial();
  unknown.name = "unadapted";
  root.add(new T.Mesh(new T.BoxGeometry(), unknown));
  const m = material("none");
  m.name = "no-probes";
  root.add(new T.Mesh(new T.BoxGeometry(), m));
  const data = light();
  expect(applyNativeMapLocalLights(root, data)).toEqual({
    materials: 0,
    held: ["unadapted", "no-probes"],
  });
  expect(compile(m)).not.toContain("NativeMapLocalLightBlock");
  data.dispose();
});

test("wetness and advanced transmission responses stay held until their local-light branches are lowered", () => {
  const root = new T.Group();
  for (const [name, metadata] of [
    ["wet", { nativeLocalLightResponse: "wetness" }],
    ["advanced", { nativeComplexDoNotCastShadows: false }],
  ] as const) {
    const m = material("atlas");
    m.name = name;
    Object.assign(m.userData, metadata);
    root.add(new T.Mesh(new T.BoxGeometry(), m));
  }
  const data = light();
  expect(applyNativeMapLocalLights(root, data)).toEqual({
    materials: 0,
    held: ["wet", "advanced"],
  });
  data.dispose();
});

test("native direct-specular-disabled materials retain local diffuse without local specular", () => {
  const m = material("atlas");
  m.userData.nativeLocalDirectSpecular = false;
  const root = new T.Mesh(new T.BoxGeometry(), m),
    data = light();
  expect(applyNativeMapLocalLights(root, data).materials).toBe(1);
  expect(compile(m)).toContain("if(false)reflectedLight.directSpecular+=");
  expect(m.customProgramCacheKey()).toContain(":false");
  data.dispose();
});

test("map light groups retain uint count bits and append after existing reflection ownership", () => {
  const m = material("atlas"),
    data = light(),
    reflection = new T.UniformsGroup().setName("NativeSourceReflectionField");
  const target = m as T.Material & { uniformsGroups?: T.UniformsGroup[] };
  target.uniformsGroups = [reflection];
  applyNativeMapLocalLights(new T.Mesh(new T.BoxGeometry(), m), data);
  expect(target.uniformsGroups).toEqual([reflection, data.group]);
  const values = data.group.uniforms[0] as T.Uniform<T.Vector4[]>;
  const uploaded = new Float32Array(values.value.flatMap((value) => value.toArray()));
  expect(uploaded.every(Number.isFinite)).toBe(true);
  expect(new Uint32Array(uploaded.buffer)[32]).toBe(1);
  expect(Array.from(new Uint32Array(uploaded.buffer).subarray(33, 36))).toEqual([0, 0, 0]);
  let releases = 0;
  data.group.addEventListener("dispose", () => releases++);
  m.dispose();
  expect(releases).toBe(0);
  data.dispose();
  data.dispose();
  expect(releases).toBe(1);
});

test("prepared held-only maps render without touching raw point-zero ownership", () => {
  const data = light();
  applyNativeMapLocalLights(new T.Group(), data);
  const renderer = {
    getContext: () => ({
      isContextLost: () => false,
      MAX_UNIFORM_BLOCK_SIZE: 1,
      getParameter: (key: number) => {
        if (key !== 1) throw new Error("Unexpected binding query");
        return 16384;
      },
    }),
  } as unknown as T.WebGLRenderer;
  expect(data.render(renderer, () => "drawn")).toBe("drawn");
  expect(data.render(renderer, () => "drawn-again")).toBe("drawn-again");
  data.dispose();
  expect(() => data.render(renderer, () => {})).toThrow("disposed");
});
