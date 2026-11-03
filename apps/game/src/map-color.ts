import * as T from "three";
import { fetchGzipped } from "./gltf";

// Dust II's pinned vpost: A=0, B=C=.0009, D=E=F=1, white point in stops.
// Cancel the common B*(C-1) term analytically to avoid subtracting nearly equal floats.
T.ShaderChunk.tonemapping_pars_fragment = T.ShaderChunk.tonemapping_pars_fragment.replace(
  "vec3 CustomToneMapping( vec3 color ) { return color; }",
  `vec3 CustomToneMapping(vec3 color) {
    const float whitePoint = exp2(1.648926);
    vec3 exposed = min(max(color, vec3(0.0)) * toneMappingExposure * 2.8, vec3(whitePoint));
    return exposed * (1.0 + 0.0009 * whitePoint) / (whitePoint * (vec3(1.0) + 0.0009 * exposed));
  }`,
);

const correction: { value: T.Data3DTexture | null } = { value: null };
const correctionReady = { value: 0 };
let pending: Promise<void> | undefined;
export function loadSourceColorCorrection() {
  pending ??= fetchGzipped("/models/maps/lighting/color-correction.bin.gz").then((data) => {
    if (data.byteLength !== 32 ** 3 * 4) throw new Error("Invalid Dust II color correction volume");
    const texture = new T.Data3DTexture(new Uint8Array(data), 32, 32, 32);
    texture.colorSpace = T.NoColorSpace;
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    correction.value = texture;
    correctionReady.value = 1;
  });
  return pending;
}

/** The native LUT follows the display encoding, without a full-frame postprocessing pass. */
export function applySourceColorCorrection(
  shader: T.WebGLProgramParametersWithUniforms,
  enabled = "1.0",
) {
  if (shader.uniforms.sourceColorCorrection) return;
  shader.uniforms.sourceColorCorrection = correction;
  shader.uniforms.sourceColorCorrectionReady = correctionReady;
  shader.fragmentShader =
    "uniform highp sampler3D sourceColorCorrection; uniform float sourceColorCorrectionReady;\n" +
    shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <colorspace_fragment>",
    `#include <colorspace_fragment>
    if (${enabled} > 0.5 && sourceColorCorrectionReady > 0.5) {
      vec3 sourceLutUv = clamp(gl_FragColor.rgb, 0.0, 1.0) * (31.0 / 32.0) + (0.5 / 32.0);
      gl_FragColor.rgb = texture(sourceColorCorrection, sourceLutUv).rgb;
    }`,
  );
}

export function gradeMapColors(root: T.Object3D) {
  const materials = new Set<T.Material>();
  root.traverse((object) => {
    if (object instanceof T.Mesh)
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
  });
  for (const material of materials) {
    const priorKey = material.customProgramCacheKey();
    const compile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer);
      applySourceColorCorrection(shader);
    };
    material.customProgramCacheKey = () => `${priorKey}:source2-dust2-color-v1`;
    material.needsUpdate = true;
  }
}
