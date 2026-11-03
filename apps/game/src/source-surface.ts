import * as T from "three";
import { fetchGzipped } from "./gltf";

export interface SourceSurface {
  directSpecular: boolean;
  indirectSpecular: boolean;
  nativeAO?: boolean;
  metalness?: number;
}

let pending: Promise<T.DataTexture> | undefined;
export function loadSourceSurfaceLookup() {
  pending ??= fetchGzipped("/models/maps/lighting/brdf-ggx.bin.gz").then((bytes) => {
    if (bytes.byteLength !== 64 * 64 * 4) throw new Error("Invalid native GGX lookup");
    const texture = new T.DataTexture(new Uint16Array(bytes), 64, 64, T.RGFormat, T.HalfFloatType);
    texture.colorSpace = T.NoColorSpace;
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  });
  return pending;
}

// Adapted from VRF 5564866 pbr/envmap/texturing.slang, CS2 lightmap 8.2.
// MIT notice: packages/assets/public/models/maps/licenses/ValveResourceFormat-MIT.txt.
export function applySourceSurface(
  shader: T.WebGLProgramParametersWithUniforms,
  source: SourceSurface,
  lookup?: T.DataTexture,
) {
  if (source.nativeAO)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <aomap_fragment>",
      `#ifdef USE_AOMAP
      float ambientOcclusion = (texture2D(aoMap, vAoMapUv).r - 1.0) * aoMapIntensity + 1.0;
      reflectedLight.indirectDiffuse *= ambientOcclusion;
      reflectedLight.directSpecular *= ambientOcclusion;
      reflectedLight.indirectSpecular *= ambientOcclusion;
      #endif`,
    );
  if (source.indirectSpecular) {
    if (!lookup) throw new Error("Native surface BRDF lookup missing");
    shader.uniforms.sourceSurfaceLookup = { value: lookup };
    shader.fragmentShader = "uniform sampler2D sourceSurfaceLookup;\n" + shader.fragmentShader;
  }
  if (source.directSpecular || source.indirectSpecular)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_physical_fragment>",
      `#include <lights_physical_fragment>
      vec3 sourceNormalDx = dFdx(nonPerturbedNormal), sourceNormalDy = dFdy(nonPerturbedNormal);
      float sourceGeometricRoughness = pow(saturate(max(dot(sourceNormalDx, sourceNormalDx), dot(sourceNormalDy, sourceNormalDy))), 0.333);
      material.roughness = max(roughnessFactor, sourceGeometricRoughness);`,
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_physical_pars_fragment>",
    `#include <lights_physical_pars_fragment>
    ${
      source.indirectSpecular
        ? `
    vec3 sourceSurfaceScattering(const in PhysicalMaterial material, vec3 normal, vec3 viewDir) {
      float NoV = saturate(dot(normal, viewDir));
      vec2 coords = vec2(material.roughness, sqrt(1.0-NoV))*(63.0/64.0)+vec2(1.0/128.0);
      vec2 lut = texture2D(sourceSurfaceLookup, coords).rg;
      vec3 specular = material.specularColorBlended;
      vec3 singleScatter = mix(vec3(lut.r), vec3(lut.g), specular);
      float missing = 1.0-lut.g;
      vec3 averageFresnel = specular+(vec3(1.0)-specular)*(1.0/21.0);
      vec3 multiScatter = singleScatter*averageFresnel/(vec3(1.0)-averageFresnel*missing)*missing;
      return singleScatter+multiScatter;
    }
    `
        : ""
    }
    void RE_Direct_SourceSurface(const in IncidentLight directLight, const in vec3 geometryPosition,
      const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal,
      const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
      ${
        source.directSpecular
          ? `float NoL = saturate(dot(geometryNormal, directLight.direction));
      float NoV = saturate(dot(geometryNormal, geometryViewDir));
      vec3 H = normalize(geometryViewDir+directLight.direction);
      float NoH = saturate(dot(geometryNormal, H));
      float LoH = saturate(dot(directLight.direction, H));
      float roughness = material.roughness;
      float alpha = max(roughness*roughness, 1e-4);
      float a = NoH*alpha;
      float k = min(alpha/(1.0-NoH*NoH+a*a), 453.5);
      float visRoughness = (roughness+1.0)*(roughness+1.0)/8.0;
      float visL = NoL*(1.0-visRoughness)+visRoughness;
      float visV = NoV*(1.0-visRoughness)+visRoughness;
      float visibility = 1.0/(4.0*max(visL*visV, 0.0001));
      vec3 F0 = material.specularColorBlended;
      vec3 fresnel = mix(F0, vec3(1.0), pow(1.0-LoH, 5.0));
      float rSum = roughness*2.0;
      float boost = 0.125*rSum*rSum*rSum*rSum*NoV;
      vec3 energyCompensation = vec3(1.0)+F0*boost;
      reflectedLight.directSpecular += directLight.color*RECIPROCAL_PI*NoL*(k*k*visibility)*fresnel*energyCompensation;`
          : ""
      }
      // Source ResolveDiffuseSpecular supplies albedo*(1-metalness), without
      // Three's glTF fresnel_mix. Our light colors carry the compensating pi.
      reflectedLight.directDiffuse +=
        saturate(dot(geometryNormal, directLight.direction)) * directLight.color * BRDF_Lambert(material.diffuseContribution);
    }
    void RE_IndirectDiffuse_SourceSurface(const in vec3 irradiance, const in vec3 geometryPosition,
      const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal,
      const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
      reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(material.diffuseContribution)
        ${source.indirectSpecular ? "*(vec3(1.0)-sourceSurfaceScattering(material, geometryNormal, geometryViewDir))" : ""};
    }
    ${
      source.indirectSpecular
        ? `
    void RE_IndirectSpecular_SourceSurface(const in vec3 radiance, const in vec3 irradiance,
      const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal,
      const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal,
      const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
      // 8.2 multiscatter reflects the environment, rather than diffuse irradiance.
      reflectedLight.indirectSpecular += radiance*sourceSurfaceScattering(material, geometryNormal, geometryViewDir);
    }
    `
        : ""
    }
    #undef RE_Direct
    #define RE_Direct RE_Direct_SourceSurface
    #undef RE_IndirectDiffuse
    #define RE_IndirectDiffuse RE_IndirectDiffuse_SourceSurface
    #undef RE_IndirectSpecular
    ${source.indirectSpecular ? "#define RE_IndirectSpecular RE_IndirectSpecular_SourceSurface" : ""}
    `,
  );
}
