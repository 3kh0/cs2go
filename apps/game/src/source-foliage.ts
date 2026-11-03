import * as T from "three";

export interface SourceFoliage {
  nonDirectional: boolean;
  dontFlipBackfaceNormals?: boolean;
  heightGradient?: { amount: number; power: number };
  transmission?: { useAlbedo: boolean; texture?: string };
  alphaCoverage?: {
    reference: number;
    grazingAngleMask: number;
    boostStrength: number;
    boostDistanceMeters: number;
  };
}

// Adapted from ValveResourceFormat csgo_foliage.frag.slang (MIT).
// Copyright (c) 2015 ValveResourceFormat Contributors; full notice:
// packages/assets/public/models/maps/licenses/ValveResourceFormat-MIT.txt.
// Native alpha coverage is evaluated before the ordinary alpha test.
// vViewPosition is in meters; the importer converts authored Source inches once.
export function applySourceFoliage(
  shader: T.WebGLProgramParametersWithUniforms,
  foliage: SourceFoliage,
) {
  // Native COLOR is a foliage control stream, not painted diffuse color.
  shader.vertexShader = shader.vertexShader.replace(
    "#include <color_vertex>",
    `#include <color_vertex>
    ${
      foliage.heightGradient
        ? `
    #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
    vSourceFoliageHeight = color.r;
    #else
    vSourceFoliageHeight = 1.0;
    #endif`
        : ""
    }
    #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
    vColor = vec4(1.0);
    #endif`,
  );
  if (foliage.heightGradient) {
    shader.vertexShader = "varying float vSourceFoliageHeight;\n" + shader.vertexShader;
    shader.fragmentShader =
      "varying float vSourceFoliageHeight; uniform vec2 sourceFoliageGradient;\n" +
      shader.fragmentShader;
    shader.uniforms.sourceFoliageGradient = {
      value: new T.Vector2(foliage.heightGradient.amount, foliage.heightGradient.power),
    };
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_physical_fragment>",
      `#include <lights_physical_fragment>
      material.diffuseContribution *= 1.0 + sourceFoliageGradient.x * pow(clamp(vSourceFoliageHeight, 0.001, 1.0), sourceFoliageGradient.y);`,
    );
  }
  // Native foliage flips only N. Derivative tangent reconstruction also changes
  // sign with screen winding; correct that only when N was kept unflipped.
  let normalChunk = T.ShaderChunk.normal_fragment_begin;
  if (foliage.dontFlipBackfaceNormals)
    normalChunk = normalChunk
      .replace("normal *= faceDirection;", "")
      .replace("tbn[0] *= faceDirection;", "#ifndef USE_TANGENT\ntbn[0] *= faceDirection;")
      .replace("tbn[1] *= faceDirection;", "tbn[1] *= faceDirection;\n#endif");
  else
    normalChunk = normalChunk
      .replace("tbn[0] *= faceDirection;", "")
      .replace("tbn[1] *= faceDirection;", "");
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_begin>",
    normalChunk,
  );
  const alpha = foliage.alphaCoverage;
  if (!alpha) return;
  shader.uniforms.sourceFoliageCoverage = {
    value: new T.Vector3(alpha.grazingAngleMask, alpha.boostStrength, alpha.boostDistanceMeters),
  };
  shader.fragmentShader = "uniform vec3 sourceFoliageCoverage;\n" + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <alphatest_fragment>",
    `vec3 sourceFoliageFace = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    float sourceFoliageDistance = length(vViewPosition);
    float sourceFoliageGrazing = pow(max(abs(dot(normalize(vViewPosition), sourceFoliageFace)), 1e-6), sourceFoliageCoverage.x);
    float sourceFoliageBoost = mix(1.0, sourceFoliageCoverage.y, clamp(sourceFoliageDistance / sourceFoliageCoverage.z, 0.0, 1.0));
    diffuseColor.a *= sourceFoliageGrazing * sourceFoliageBoost;
    #include <alphatest_fragment>`,
  );
}

// Native AddTransmissiveLight / CalculateIndirectLighting add transmitted color
// after ordinary diffuse/specular shading, without multiplying it by front AO.
export function applySourceFoliageTransmission(
  shader: T.WebGLProgramParametersWithUniforms,
  foliage: SourceFoliage,
  texture?: T.Texture,
) {
  if (!foliage.transmission) return;
  const separateTexture = !foliage.transmission.useAlbedo;
  if (separateTexture && !texture) throw new Error("Native foliage transmission texture missing");
  if (texture) {
    shader.uniforms.sourceTransmissionMap = { value: texture };
    shader.fragmentShader = "uniform sampler2D sourceTransmissionMap;\n" + shader.fragmentShader;
  }
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_fragment_begin>",
    `vec3 sourceTransmissionColor = ${separateTexture ? "texture2D(sourceTransmissionMap, vMapUv).rgb" : "diffuseColor.rgb"};
    vec3 sourceTransmittedLight = vec3(0.0);
    #include <lights_fragment_begin>`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <opaque_fragment>",
    "outgoingLight += sourceTransmittedLight;\n#include <opaque_fragment>",
  );
}
