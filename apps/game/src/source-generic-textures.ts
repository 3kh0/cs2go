import * as T from "three";

export interface SourceGenericTextures {
  color: string;
  normal: string;
  normalStrength: number;
}

/** Retain the GLTF packing/UV channel while sharing the original native pixels. */
export function sourceTextureWithUV(texture: T.Texture, original: T.Texture) {
  const result = texture.clone();
  result.offset.copy(original.offset);
  result.repeat.copy(original.repeat);
  result.center.copy(original.center);
  result.rotation = original.rotation;
  result.channel = original.channel;
  return result;
}

// VRF 5564866 csgo_vertexlitgeneric.frag.slang and common/utils.slang (MIT).
// Preserve packed RG until after filtering; B is perceptual roughness, not gloss.
// Full notice: packages/assets/public/models/maps/licenses/ValveResourceFormat-MIT.txt.
export function applySourceGenericTextures(
  shader: T.WebGLProgramParametersWithUniforms,
  source: SourceGenericTextures,
) {
  shader.uniforms.sourceGenericNormalStrength = { value: source.normalStrength };
  shader.fragmentShader = "uniform float sourceGenericNormalStrength;\n" + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <roughnessmap_fragment>",
      `vec4 sourceGenericPackedNormal = texture2D(normalMap, vNormalMapUv);
      float roughnessFactor = sourceGenericPackedNormal.b;`,
    )
    .replace(
      "#include <normal_fragment_maps>",
      `vec2 sourceGenericHemi = vec2(sourceGenericPackedNormal.r + sourceGenericPackedNormal.g - 1.003922, sourceGenericPackedNormal.r - sourceGenericPackedNormal.g);
      vec3 mapN = normalize(vec3(sourceGenericHemi.x, -sourceGenericHemi.y, 1.0 - abs(sourceGenericHemi.x) - abs(sourceGenericHemi.y)));
      mapN = normalize(mix(vec3(0.0, 0.0, 1.0), mapN, sourceGenericNormalStrength));
      normal = normalize(tbn * mapN);`,
    );
}
