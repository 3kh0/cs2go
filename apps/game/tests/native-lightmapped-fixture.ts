import * as T from "three";
import { applyNativeMapLightmapped, loadNativeMapLightmapped } from "../src/native-map-lightmapped";
import { loadGzipped } from "../src/gltf";
const base = "/Users/sh/Documents/GitHub/cs2go/";
function tex(values: number[]) {
  const t = new T.DataTexture(new Float32Array(values), 1, 1, T.RGBAFormat, T.FloatType);
  t.minFilter = t.magFilter = T.NearestFilter;
  t.needsUpdate = true;
  return t;
}
export async function parkingProof() {
  const renderer = new T.WebGLRenderer({ antialias: false, premultipliedAlpha: false });
  renderer.setSize(320, 200);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const bundle = await loadNativeMapLightmapped(
      renderer,
      `/@fs/${base}artifacts/new-maps/staged/nuke/nuke-lightmapped/source.json`,
    ),
    template = Object.values(bundle.materials)[0],
    results = [];
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  for (const mode of ["color", "normal", "ao", "blend"]) {
    const s = structuredClone(template);
    s.exportedName = "diagnostic";
    s.exportedVariants = [
      {
        packedMaterialIndex: 0,
        baseColorFactor: [1, 1, 1, 0.5],
        nativeCombinedVSFactor: [0.2, 0.4, 0.6, 0.5],
      },
    ];
    s.textures = { g_tColor: "c", g_tLayer1NormalRoughness: "n", g_tLayer1AmbientOcclusion: "a" };
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.computeTangents();
    const m = new T.MeshStandardMaterial();
    m.name = "diagnostic";
    m.opacity = 0.5;
    m.userData.nativeGltfMaterialIndex = 0;
    const scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 3;
    scene.add(new T.Mesh(geometry, m));
    const textures = new Map([
      ["c", tex([0.3, 0.6, 0.2, 0.8])],
      ["n", tex([0.8, 0.2, 0.25, 0.9])],
      ["a", tex([0.25, 0.7, 0.9, 0.1])],
    ]);
    applyNativeMapLightmapped(scene, { materials: { s }, textures, lookup: bundle.lookup });
    if (mode !== "blend") m.blending = T.NoBlending;
    const before = m.onBeforeCompile.bind(m);
    m.onBeforeCompile = (shader, r) => {
      before(shader, r);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        mode === "normal"
          ? "gl_FragColor=vec4(normal*.5+.5,roughnessFactor);"
          : mode === "ao"
            ? "gl_FragColor=vec4(vec3(ambientOcclusion),1.);"
            : "gl_FragColor=vec4(diffuseColor.rgb,diffuseColor.a);",
      );
    };
    renderer.setRenderTarget(target);
    renderer.setClearColor(new T.Color().setRGB(0.1, 0.2, 0.3), 0.7);
    renderer.clear();
    renderer.render(scene, camera);
    const p = new Uint16Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, p);
    results.push({
      mode,
      pixel: [...p].map((v) => T.DataUtils.fromHalfFloat(v)),
      error: renderer.getContext().getError(),
    });
    geometry.dispose();
    m.dispose();
    for (const t of new Set(textures.values())) t.dispose();
  }
  const actual = [];
  for (const domain of ["authored", "exporter"]) {
    const asset = await loadGzipped(
        `/@fs/${base}apps/game/artifacts/new-maps/nuke-parking-subset.glb`,
      ),
      scene = new T.Scene(),
      model = asset.scene;
    scene.add(model);
    const camera = new T.PerspectiveCamera(73.73979529168804, 1.6, 0.01, 1000);
    camera.position.set(-1808 * 0.0254, -336.634033 * 0.0254, 1025 * 0.0254);
    camera.rotation.set(0, ((-30.999985 - 90) * Math.PI) / 180, 0, "YXZ");
    const copy = { ...bundle, materials: structuredClone(bundle.materials) };
    if (domain === "exporter")
      for (const s of Object.values(copy.materials))
        for (const v of s.exportedVariants) v.nativeCombinedVSFactor = [...v.baseColorFactor];
    applyNativeMapLightmapped(model, copy);
    scene.add(new T.HemisphereLight(0xffffff, 0xffffff, Math.PI));
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x191919, 1);
    renderer.clear();
    renderer.render(scene, camera);
    actual.push({
      domain,
      error: renderer.getContext().getError(),
      image: renderer.domElement.toDataURL(),
    });
    model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
  }
  for (const t of new Set(bundle.textures.values())) t.dispose();
  target.dispose();
  renderer.dispose();
  return { results, actual };
}
