import * as T from "three";
import type { loadNativeMapEnvironment } from "./native-map-environment";
import { applyModernEnvironmentShader, usesModernEnvironment } from "./native-modern-environment";
import type { SourceReflections } from "./source-reflections";
import type { SourceGpuProbes } from "./source-gpu-probes";
import type { NativeMapFog } from "./native-map-fog";

type EnvironmentBundle = Awaited<ReturnType<typeof loadNativeMapEnvironment>>;
export interface EnvironmentBudgetResources {
  reflections?: SourceReflections;
  probes?: SourceGpuProbes;
  fog?: NativeMapFog;
  /** A static draw uses an atlas OR LPVs. Three atlas channels reserve the
   * larger branch for scenes containing both kinds of mesh. */
  lightingSamplers?: 2 | 3;
}

/** Check the final resolved graph, including fog and whether native cube arrays
 * actually combined on this GPU. Never truncate probes or replace native data
 * to fit. Uniform bounds include the existing 128-vector framework/reflection
 * reserve plus the additional declarations introduced by modern ENV. */
export function assertNativeEnvironmentBudget(
  renderer: T.WebGLRenderer,
  bundle: EnvironmentBundle,
  resources: EnvironmentBudgetResources = {},
) {
  const reflections = resources.reflections;
  if (
    reflections &&
    (!reflections.textures.length || (!reflections.combined && reflections.textures.length > 2))
  )
    throw new Error("Unsupported native environment reflection array layout");
  const reflectionSamplers = reflections ? (reflections.combined ? 1 : 2) : 0;
  const fogSamplers = resources.fog?.cube ? 1 : 0;
  // Atlas/LPV + native BRDF + two sun shadows + final grade, excluding the
  // material's own samplers and the separately resolved reflection/fog arrays.
  const reservedSamplers =
    (resources.lightingSamplers ?? 3) + 1 + 2 + 1 + reflectionSamplers + fogSamplers;
  const probes = resources.probes;
  const probeVectors = probes
    ? probes.packedFrames
      ? (probes.packedFrames.values.length + probes.packedFrames.rotations.length) / 4
      : probes.frames.reduce((sum, frame) => sum + frame.length / 3, 0)
    : 0;
  // The native affine extension adds two mat4s to each of the renderer's
  // eight reflection-window records. It does not depend on map volume count.
  const affineVectors = reflections?.volumes.some((volume) => volume.worldToLocal)
    ? 8 * (4 + 4)
    : 0;
  const rows = [];
  for (const source of Object.values(bundle.materials)) {
    if (!usesModernEnvironment(source)) continue;
    if (!bundle.lookup) throw new Error("Native environment BRDF lookup unavailable");
    const shader = {
      vertexShader: T.ShaderLib.standard.vertexShader,
      fragmentShader: T.ShaderLib.standard.fragmentShader,
      uniforms: {},
    } as T.WebGLProgramParametersWithUniforms;
    const layout = applyModernEnvironmentShader(
      shader,
      source,
      bundle.textures,
      bundle.banks,
      new T.Color(1, 1, 1),
      bundle.lookup,
      bundle.time,
      bundle.sourceWorldFrame,
    );
    const layers = source.IntParams.F_ENABLE_LAYER_3
      ? 3
      : source.shader === "csgo_environment_blend.vfx"
        ? 2
        : 1;
    // Explicit additional declarations: world frame mat4 + two mat3s + unit
    // scale (11), model tint (1), grade controls (4), fog fields (15), and the
    // third layer's two color-adjust mat4s (8). First/two-layer adjustment and
    // ordinary Three lighting/material fields use the existing reserve.
    const modernVectors = 11 + 1 + 4 + (resources.fog ? 15 : 0) + Math.max(0, layers - 2) * 8;
    const fragmentUniformVectors =
      probeVectors + 128 + affineVectors + modernVectors + layout.uniformVectors;
    const samplers = layout.samplers + reservedSamplers;
    if (samplers > renderer.capabilities.maxTextures)
      throw new Error(
        `Native environment resolved sampler budget exceeded: ${source.nativeResource} (${samplers}/${renderer.capabilities.maxTextures})`,
      );
    if (fragmentUniformVectors > renderer.capabilities.maxFragmentUniforms)
      throw new Error(
        `Native environment resolved uniform budget exceeded: ${source.nativeResource} (${fragmentUniformVectors}/${renderer.capabilities.maxFragmentUniforms})`,
      );
    rows.push({
      nativeResource: source.nativeResource,
      samplers,
      fragmentUniformVectors,
      parameterUniformVectors: layout.uniformVectors,
    });
  }
  return { reservedSamplers, probeVectors, affineVectors, materials: rows };
}
