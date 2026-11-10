import * as T from "three";
import { applyNativeMapComplex } from "../src/native-map-complex";
import { nativeSiloSource } from "./native-complex-secondary-source-fixture";
export function renderNativeSiloUv() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  const results = [];
  const tex = (values: number[]) => {
    const t = new T.DataTexture(
      new Float32Array(values),
      values.length / 4,
      1,
      T.RGBAFormat,
      T.FloatType,
    );
    t.minFilter = t.magFilter = T.NearestFilter;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  };
  for (const mode of ["correct", "primary-as-secondary", "atlas-as-secondary", "missing-pivot"]) {
    const g = new T.PlaneGeometry(2, 2);
    g.computeTangents();
    const uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.17, 0.83);
    const atlas = uv.clone(),
      secondary = uv.clone();
    for (let i = 0; i < uv.count; i++) {
      atlas.setXY(i, 0.05, 0.99);
      secondary.setXY(
        i,
        ...((mode === "primary-as-secondary"
          ? [0.17, 0.83]
          : mode === "atlas-as-secondary"
            ? [0.05, 0.99]
            : [0.73, 0.21]) as [number, number]),
      );
    }
    g.setAttribute("uv1", atlas);
    g.setAttribute("uv2", secondary);
    const m = new T.MeshStandardMaterial();
    m.name = "silo";
    const scene = new T.Scene();
    scene.add(new T.Mesh(g, m));
    const c = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    c.position.z = 3;
    const textures = new Map(
      Object.values(nativeSiloSource.textures).map((k) => [
        k,
        tex(
          k === "g_tNormal"
            ? [128 / 255, 128 / 255, 0.4, 1]
            : k === "g_tAmbientOcclusion" || k === "g_tDetailMask"
              ? [0.2, 0.2, 0.2, 1, 0.4, 0.4, 0.4, 1, 0.8, 0.8, 0.8, 1, 0.9, 0.9, 0.9, 1]
              : [0.3, 0.4, 0.5, 1],
        ),
      ]),
    );
    const source = structuredClone(nativeSiloSource);
    if (mode === "missing-pivot")
      source.resolvedMaterialInputs.g_vDetailTexCoordOffset = [0, 0, 0, 0];
    const lookup = tex([0.2, 0.7, 0, 1]);
    const view = applyNativeMapComplex(scene, { materials: { silo: source }, textures, lookup });
    const before = m.onBeforeCompile.bind(m);
    m.onBeforeCompile = (s, r) => {
      before(s, r);
      s.fragmentShader = s.fragmentShader.replace(
        "#include <opaque_fragment>",
        "gl_FragColor=vec4(vNativeComplexDetailUv,nativeComplexWeight,texture2D(aoMap,vAoMapUv).r);",
      );
    };
    renderer.setRenderTarget(target);
    renderer.render(scene, c);
    const data = new Uint16Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, data);
    results.push({
      mode,
      pixel: [...data].map((v) => T.DataUtils.fromHalfFloat(v)),
      error: renderer.getContext().getError(),
    });
    view.dispose();
    g.dispose();
    m.dispose();
    textures.forEach((t) => t.dispose());
    lookup.dispose();
  }
  target.dispose();
  renderer.dispose();
  return results;
}
