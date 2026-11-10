import * as T from "three";
import {
  applyNativeMapEnvironment,
  type SourceEnvironmentMaterial,
} from "../src/native-map-environment";
import { createEnvironmentTextureBanks } from "../src/native-environment-textures";

/** Installed VCS binding expressions, independently evaluated before the
 * ordinary native AO/color equations. Float-transcendental final bits qualified. */
export function renderNativeEnvironmentBindings() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(2, 2);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(2, 2, { type: T.FloatType });
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const rows = [];
  const operands = new DataView(
    new Uint8Array([0x65, 0xaa, 0xb8, 0x3f, 0x17, 0xb7, 0xd1, 0x38]).buffer,
  );
  const coefficient = operands.getFloat32(0, true),
    floor = operands.getFloat32(4, true);
  for (const path of ["legacy", "effects", "modern"] as const) {
    for (const controls of [
      [0, 0.5, 1],
      [0.2, 0.09, 1.4],
      [0.8, 1, 0.3],
    ]) {
      const textures = new Map<string, T.Texture>();
      for (const [name, rgba] of [
        ["color", [255, 255, 255, 64]],
        ["height", [128, 0, 0, 0]],
        ["normal", [128, 128, 220, 255]],
      ] as const) {
        const texture = new T.DataTexture(new Uint8Array(rgba), 1, 1);
        texture.needsUpdate = true;
        textures.set(name, texture);
      }
      const source: SourceEnvironmentMaterial = {
        shader: path === "effects" ? "csgo_environment_blend.vfx" : "csgo_environment.vfx",
        nativeResource: "materials/binding-expression-control.vmat",
        IntParams: path === "effects" ? { F_BLEND_EFFECTS_2: 1 } : {},
        FloatParams: { g_flModelTintAmount: 0, g_flHeightMapScale2: 0, g_flBevelStrength2: 0 },
        VectorParams: {
          g_vAmbientOcclusionLevels1: controls,
          g_vAmbientOcclusionLevels2: controls,
          g_vBorderTint2: [0.796079, 0.2, 0.458824],
        },
        textures: Object.fromEntries(
          [1, 2].flatMap((layer) => [
            [`g_tColor${layer}`, "color"],
            [`g_tHeight${layer}`, "height"],
            [`g_tNormal${layer}`, "normal"],
          ]),
        ),
        textureReflectivity: { g_tColor1: [0.5, 0.5, 0.5], g_tColor2: [0.5, 0.5, 0.5] },
        ...(path === "modern"
          ? {
              nativeTextureDimensions: {
                g_tColor1: [1, 1],
                g_tHeight1: [1, 1],
                g_tNormal1: [1, 1],
              },
            }
          : {}),
      };
      const banks = createEnvironmentTextureBanks(textures, 256),
        lookup = new T.DataTexture();
      const geometry = new T.PlaneGeometry(2, 2);
      geometry.computeTangents();
      geometry.setAttribute(
        "color_1",
        new T.Float32BufferAttribute(Array(4).fill([0.5, 0, 0, 0.2]).flat(), 4),
      );
      const material = new T.MeshStandardMaterial();
      material.name = "control";
      const mesh = new T.Mesh(geometry, material),
        scene = new T.Scene();
      scene.add(mesh);
      applyNativeMapEnvironment(scene, {
        materials: { control: source },
        textures,
        lookup,
        banks: banks.bindings,
        normalFrame: lookup,
      });
      const prior = material.onBeforeCompile.bind(material),
        key = material.customProgramCacheKey();
      for (const output of path === "effects" ? ["ao", "border"] : ["ao"]) {
        material.onBeforeCompile = (shader, r) => {
          prior(shader, r);
          const bound =
            path === "modern"
              ? "vec3(0.0)"
              : path === "effects"
                ? "environmentAo1"
                : "environmentAoLevels";
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            output === "border"
              ? "gl_FragColor=vec4(color1.rgb,environmentBorderAmount.x);"
              : `gl_FragColor=vec4(environmentAO,${bound});`,
          );
        };
        material.customProgramCacheKey = () => `${key}:binding-proof:${output}`;
        material.needsUpdate = true;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        const actual = new Float32Array(4);
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, actual);
        const bound = [
          -controls[0],
          -coefficient * Math.log(Math.max(floor, 1 - controls[1])),
          2 - controls[2],
        ];
        const alpha = 64 / 255,
          expectedAO = T.MathUtils.clamp(
            bound[0] + (bound[2] - bound[0]) * Math.pow(alpha, bound[1]),
            0,
            1,
          );
        const wrongRawAO = T.MathUtils.clamp(
          controls[0] + (controls[2] - controls[0]) * Math.pow(alpha, controls[1]),
          0,
          1,
        );
        const tint = [0.796079, 0.2, 0.458824].map((c) =>
          c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
        );
        rows.push({
          path,
          output,
          controls,
          actual: [...actual],
          expected:
            output === "border"
              ? [...tint.map((c) => 1 + (c - 1) * actual[3]), actual[3]]
              : [expectedAO, ...(path === "modern" ? [0, 0, 0] : bound)],
          wrongRawAO,
          error: renderer.getContext().getError(),
        });
      }
      geometry.dispose();
      material.dispose();
      lookup.dispose();
      for (const texture of [...textures.values(), ...banks.arrays]) texture.dispose();
    }
  }
  target.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return rows;
}
