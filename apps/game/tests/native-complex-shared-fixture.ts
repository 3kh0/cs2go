import * as T from "three";
import { applyNativeMapComplex } from "../src/native-map-complex";
import { nativeComplexCommonSources } from "./native-complex-common-source-fixture";
export function renderSharedNativeComplex() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(32, 16);
  renderer.toneMapping = T.NoToneMapping;
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(32, 16, { type: T.FloatType }),
    scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const geometry = new T.PlaneGeometry(1, 2);
  geometry.computeTangents();
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.2, 0.7);
  const textures = new Map<string, T.Texture>();
  const texture = (id: string, value: number[]) => {
    const t = new T.DataTexture(new Float32Array(value), 1, 1, T.RGBAFormat, T.FloatType);
    t.needsUpdate = true;
    textures.set(id, t);
    return id;
  };
  const sources: Record<string, (typeof nativeComplexCommonSources)[string]> = {},
    materials: T.MeshStandardMaterial[] = [];
  const inputs = [
    {
      color: [0.2, 0.4, 0.6, 0.7],
      detail: [0.7, 0.3, 0.6, 1],
      factor: [0.3, 0.6, 0.9],
      blend: 0.5,
      reflectance: 0.04,
      metal: 0,
      xform: [0.35, 0, 0, 0.5],
      offset: [0.325, 0.25, 0, 0],
    },
    {
      color: [0.8, 0.1, 0.2, 0.3],
      detail: [0.2, 0.8, 0.4, 1],
      factor: [0.8, 0.2, 0.5],
      blend: 0.8,
      reflectance: 0.13,
      metal: 0.25,
      xform: [1.1, 0.1, -0.2, 0.9],
      offset: [-0.05, 0.12, 0, 0],
    },
  ];
  for (const [i, input] of inputs.entries()) {
    const name = `material${i}`,
      source = structuredClone(nativeComplexCommonSources.detail1);
    source.nativeResource = `different-native-resource-${i}`;
    source.textures = {
      g_tColor: texture(`${name}color`, input.color),
      g_tNormal: texture(`${name}normal`, [128 / 255, 128 / 255, 0.3, 1]),
      g_tAmbientOcclusion: texture(`${name}ao`, [1, 1, 1, 1]),
      g_tDetail: texture(`${name}detail`, input.detail),
    };
    Object.assign(source.resolvedMaterialInputs, {
      g_flDetailBlendFactor: [input.blend],
      g_flReflectance: [input.reflectance],
      g_flMetalness: [input.metal],
      g_vDetailTexCoordXform: input.xform,
      g_vDetailTexCoordOffset: input.offset,
    });
    sources[name] = source;
    const material = new T.MeshStandardMaterial();
    material.name = name;
    material.color.fromArray(input.factor);
    materials.push(material);
    const mesh = new T.Mesh(geometry, material);
    mesh.position.x = i ? 0.5 : -0.5;
    scene.add(mesh);
  }
  const lookup = new T.DataTexture();
  applyNativeMapComplex(scene, { materials: sources, textures, lookup });
  for (const material of materials) {
    const before = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, r) => {
      before(shader, r);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "gl_FragColor=vec4(diffuseColor.r,material.specularColor.g,vNativeComplexDetailUv.x,1.0);",
      );
    };
  }
  const results = [];
  for (const reversed of [false, true]) {
    scene.children[0].renderOrder = reversed ? 2 : 0;
    scene.children[1].renderOrder = reversed ? 0 : 2;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixels = [];
    for (const x of [8, 24]) {
      const p = new Float32Array(4);
      renderer.readRenderTargetPixels(target, x, 8, 1, 1, p);
      pixels.push([...p]);
    }
    results.push({ reversed, pixels, error: renderer.getContext().getError() });
  }
  const expected = inputs.map((input) => {
    const c = input.color
      .slice(0, 3)
      .map(
        (value, i) =>
          value * input.factor[i] * (1 + ((input.detail[i] * 508) / 255 - 1) * input.blend),
      );
    return [
      c[0],
      input.reflectance * (1 - input.metal) + c[1] * input.metal,
      0.2 * input.xform[0] + 0.7 * input.xform[1] + input.offset[0],
      1,
    ];
  });
  const programs = renderer.info.programs?.length ?? 0,
    keys = materials.map((m) => m.customProgramCacheKey());
  target.dispose();
  geometry.dispose();
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
  lookup.dispose();
  renderer.dispose();
  return { results, expected, programs, keysEqual: keys[0] === keys[1] };
}
