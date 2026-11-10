import * as T from "three";
import { applyNativeMapComplex } from "../src/native-map-complex";
import { nativeComplexSource } from "./native-complex-source-fixture";
function texture(values: number[], width = 1) {
  const t = new T.DataTexture(new Float32Array(values), width, 1, T.RGBAFormat, T.FloatType);
  t.minFilter = t.magFilter = T.NearestFilter;
  t.needsUpdate = true;
  return t;
}
/** Controlled native CPU replay vectors; actual shader uses the shared quality1
 * surface implementation, with source packed normals and detail color inputs. */
export function renderNativeComplex() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const results = [];
  for (const mode of ["overlay", "normal", "pivot", "specular0", "specular03", "specular1"]) {
    const scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 3;
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.computeTangents();
    if (mode === "pivot") {
      const uv = geometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0, 0);
    }
    const material = new T.MeshStandardMaterial({ color: 0xffffff });
    material.name = "concrete";
    const base = 0.217637640824031,
      normal = mode === "normal" ? [0.8, 0.2, 0.25, 1] : [128 / 255, 128 / 255, 0.25, 1];
    const ao = mode === "specular0" ? 0 : mode === "specular03" ? 0.3 : 1;
    const detail =
      mode === "pivot"
        ? texture(Array.from({ length: 8 }, (_, i) => [i / 10, i / 10, i / 10, 1]).flat(), 8)
        : texture([0.8, 0.8, 0.8, 1]);
    const textures = new Map([
      ["g_tColor", texture([base, base, base, 1])],
      ["g_tNormal", texture(normal)],
      ["g_tAmbientOcclusion", texture([ao, ao, ao, 1])],
      ["g_tDetail", detail],
    ]);
    const lookup = texture([0.2, 0.7, 0, 1]);
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    applyNativeMapComplex(scene, {
      materials: { concrete: nativeComplexSource },
      textures,
      lookup,
    });
    const before = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      before(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        mode === "normal"
          ? "gl_FragColor=vec4(normal*.5+.5,roughnessFactor);"
          : mode.startsWith("specular")
            ? "gl_FragColor=vec4(reflectedLight.directSpecular,1.0);"
            : "gl_FragColor=vec4(diffuseColor.rgb,1.0);",
      );
    };
    if (mode.startsWith("specular")) {
      const light = new T.DirectionalLight(0xffffff, Math.PI);
      light.position.z = 3;
      scene.add(light);
    }
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const bytes = new Uint16Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, bytes);
    results.push({
      mode,
      pixel: [...bytes].map((v) => T.DataUtils.fromHalfFloat(v)),
      error: renderer.getContext().getError(),
    });
    geometry.dispose();
    material.dispose();
    lookup.dispose();
    textures.forEach((t) => t.dispose());
  }
  target.dispose();
  renderer.dispose();
  return results;
}
