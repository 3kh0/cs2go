import * as T from "three";
import { applyNativeMapComplex } from "../src/native-map-complex";
import { nativeComplexCommonSources } from "./native-complex-common-source-fixture";
export function renderNativeComplexCommon() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.toneMapping = T.NoToneMapping;
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType }),
    results = [];
  const samples: Record<string, number[]> = {
    g_tColor: [0.2, 0.4, 0.6, 0.7],
    g_tNormal: [0.8, 0.2, 0.35, 0.1],
    g_tAmbientOcclusion: [0.31, 0, 0, 1],
    g_tDetail: [0.7, 0.3, 0.6, 1],
    g_tNormalDetail: [0.6, 0.35, 0.9, 1],
    g_tTintMask: [0.37, 0, 0, 1],
  };
  const decode = (rg: number[]) => {
    const x = rg[0] + rg[1] - 256 / 255,
      y = rg[0] - rg[1],
      z = 1 - Math.abs(x) - Math.abs(y),
      l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l];
  };
  for (const [group, source] of Object.entries(nativeComplexCommonSources))
    for (const output of ["color", "normal", "f0"]) {
      const scene = new T.Scene(),
        camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 3;
      const geometry = new T.PlaneGeometry(2, 2);
      geometry.computeTangents();
      const material = new T.MeshStandardMaterial();
      material.color.setRGB(0.3, 0.6, 0.9);
      material.name = group;
      const textures = new Map<string, T.Texture>();
      for (const [id, values] of Object.entries(samples)) {
        const t = new T.DataTexture(new Float32Array(values), 1, 1, T.RGBAFormat, T.FloatType);
        t.needsUpdate = true;
        textures.set(id, t);
      }
      const lookup = textures.get("g_tColor") as T.DataTexture;
      scene.add(new T.Mesh(geometry, material));
      applyNativeMapComplex(scene, { materials: { [group]: source }, textures, lookup });
      const before = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, r) => {
        before(shader, r);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          output === "color"
            ? "gl_FragColor=vec4(diffuseColor.rgb,metalnessFactor);"
            : output === "normal"
              ? "gl_FragColor=vec4(normal,roughnessFactor);"
              : "gl_FragColor=vec4(material.specularColor,1.0);",
        );
      };
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const bytes = new Float32Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, bytes);
      const mask = source.IntParams.F_TINT_MASK ? 0.37 : 1,
        metal = source.IntParams.F_METALNESS_TEXTURE ? 0.7 : 0,
        mode = source.IntParams.F_DETAIL_TEXTURE ?? 0;
      const color = [0.2, 0.4, 0.6].map(
        (v, i) =>
          v *
          (1 + ([0.3, 0.6, 0.9][i] - 1) * mask) *
          (mode === 1
            ? 1 +
              ((samples.g_tDetail[i] * 508) / 255 - 1) * source.FloatParams.g_flDetailBlendFactor
            : 1),
      );
      let normal = decode(samples.g_tNormal);
      if (mode === 3) {
        const nd = decode(samples.g_tNormalDetail),
          d = [nd[0] * 0.218, nd[1] * 0.218, 0.782 + nd[2] * 0.218],
          q = normal.map((v) => v * d[2]),
          n = [q[0] + d[0] * q[2], q[1] + d[1] * q[2], q[2]],
          l = Math.hypot(...n);
        normal = n.map((v) => v / l);
      }
      normal[1] *= -1;
      const expected =
        output === "color"
          ? [...color, metal]
          : output === "normal"
            ? [...normal, 0.35]
            : [...color.map((v) => 0.04 * (1 - metal) + v * metal), 1];
      results.push({
        group,
        output,
        pixel: [...bytes],
        expected,
        error: renderer.getContext().getError(),
      });
      geometry.dispose();
      material.dispose();
      textures.forEach((t) => t.dispose());
    }
  target.dispose();
  renderer.dispose();
  return results;
}
