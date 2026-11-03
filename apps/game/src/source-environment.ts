import * as T from "three";

export interface SourceEnvironment {
  modelTint: number[];
  modelTintAmount: number;
  tintMask: number[];
  aoLevels: number[];
}

// Adapted from VRF 5564866 csgo_environment / surface_height_layers (MIT).
// Full notice: packages/assets/public/models/maps/licenses/ValveResourceFormat-MIT.txt.
// The audited tarp has neutral color correction, no paint, detail or wetness.
export function applySourceEnvironment(
  shader: T.WebGLProgramParametersWithUniforms,
  source: SourceEnvironment,
  height: T.Texture,
) {
  const tint = new T.Vector3().fromArray(source.modelTint);
  shader.uniforms.sourceEnvironmentHeight = { value: height };
  shader.uniforms.sourceEnvironmentTint = {
    value: new T.Vector4(
      tint.x,
      tint.y,
      tint.z,
      source.modelTintAmount * (1 - Math.min(tint.x, tint.y, tint.z)),
    ),
  };
  shader.uniforms.sourceEnvironmentMask = { value: new T.Vector2().fromArray(source.tintMask) };
  shader.uniforms.sourceEnvironmentAO = { value: new T.Vector3().fromArray(source.aoLevels) };
  shader.fragmentShader =
    `uniform sampler2D sourceEnvironmentHeight;
    uniform vec4 sourceEnvironmentTint;
    uniform vec2 sourceEnvironmentMask;
    uniform vec3 sourceEnvironmentAO;
    vec3 sourceColorizeTint(vec3 albedo, vec3 tint, float amount) {
      vec3 weights = vec3(0.2125, 0.7154, 0.0721);
      vec3 tintNorm = normalize(max(tint, vec3(0.001)));
      float luma = dot(albedo, weights);
      float tinted = min(luma / dot(tintNorm, weights), 3.0 * luma * max(max(tint.r, tint.g), tint.b));
      return clamp(mix(albedo, tintNorm * tinted, amount), 0.0, 1.0);
    }
    ` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `vec4 sourceEnvironmentColor = texture2D(map, vMapUv);
    vec4 sourceEnvironmentPackedHeight = texture2D(sourceEnvironmentHeight, vMapUv);
    vec4 sourceEnvironmentNormal = texture2D(normalMap, vNormalMapUv);
    float sourceEnvironmentTintMask = ((sourceEnvironmentPackedHeight.g - 0.5) * sourceEnvironmentMask.x + 0.5) * sourceEnvironmentMask.y;
    sourceEnvironmentTintMask = clamp(sourceEnvironmentTintMask, 0.0, 1.0);
    diffuseColor.rgb = sourceColorizeTint(sourceEnvironmentColor.rgb, sourceEnvironmentTint.rgb, sourceEnvironmentTint.a * sourceEnvironmentTintMask);`,
  );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <roughnessmap_fragment>",
      "float roughnessFactor = sourceEnvironmentNormal.b;",
    )
    .replace(
      "#include <metalnessmap_fragment>",
      "float metalnessFactor = sourceEnvironmentPackedHeight.a;",
    )
    .replace(
      "#include <normal_fragment_maps>",
      `vec2 sourceHemi = vec2(sourceEnvironmentNormal.r + sourceEnvironmentNormal.g - 1.003922, sourceEnvironmentNormal.r - sourceEnvironmentNormal.g);
    vec3 mapN = normalize(vec3(sourceHemi.x, -sourceHemi.y, 1.0 - abs(sourceHemi.x) - abs(sourceHemi.y)));
    normal = normalize(tbn * mapN);`,
    )
    .replace(
      "#include <aomap_fragment>",
      `float sourceEnvironmentExponent = -1.4427 * log(max(0.0001, 1.0 - sourceEnvironmentAO.y));
    float ambientOcclusion = clamp(mix(-sourceEnvironmentAO.x, 2.0 - sourceEnvironmentAO.z, pow(max(sourceEnvironmentColor.a, 0.0), sourceEnvironmentExponent)), 0.0, 1.0);
    reflectedLight.directDiffuse *= ambientOcclusion;
    reflectedLight.indirectDiffuse *= ambientOcclusion;
    reflectedLight.directSpecular *= ambientOcclusion;
    reflectedLight.indirectSpecular *= ambientOcclusion;`,
    );
}
