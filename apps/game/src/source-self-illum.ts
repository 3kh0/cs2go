import * as T from "three";

export interface SourceSelfIllumination {
  brightness: number;
  scale: number;
  tint: [number, number, number];
  albedoFactor: number;
}

/** VRF GetSelfIllumination: the existing sRGB mask modulates HDR emission. */
export function applySourceSelfIllumination(
  material: T.MeshStandardMaterial,
  source: SourceSelfIllumination,
) {
  if (!material.emissiveMap || material.emissiveMap.colorSpace !== T.SRGBColorSpace)
    throw new Error("Native self-illumination requires its sRGB mask");
  material.emissive.setRGB(...source.tint, T.SRGBColorSpace);
  material.emissiveIntensity = 2 ** source.brightness * source.scale;
  const prior = material.onBeforeCompile.bind(material);
  const priorKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    prior(shader, renderer);
    shader.uniforms.sourceSelfIllumAlbedoFactor = { value: source.albedoFactor };
    shader.fragmentShader = "uniform float sourceSelfIllumAlbedoFactor;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      totalEmissiveRadiance *= mix(vec3(1.0), diffuseColor.rgb, sourceSelfIllumAlbedoFactor);`,
    );
  };
  material.customProgramCacheKey = () => priorKey + ":source-self-illum";
  material.needsUpdate = true;
}
