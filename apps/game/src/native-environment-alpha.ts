import * as T from "three";
import type { SourceEnvironmentMaterial } from "./native-map-environment";
import {
  bindEnvironmentTextures,
  type EnvironmentTextureBanks,
} from "./native-environment-textures";
import {
  environmentRead,
  environmentUvSelection,
  environmentProjectionShared,
  environmentProjectionSetup,
} from "./native-environment-projection";
import {
  createEnvironmentWorldFrame,
  type EnvironmentWorldFrame,
} from "./native-environment-frame";
import type { SourceDepthHook } from "./source-depth";
const literal = (value: number) => {
  const raw = Number.isInteger(value) ? `${value}.0` : `${value}`;
  return value < 0 ? `(${raw})` : raw;
};
const vector = (values: readonly number[]) => `vec2(${values.slice(0, 2).map(literal).join(",")})`;
/** Selected native ENV PS36 depth equation, not its unknown engine AA flag.
 * Runtime deliberately uses the single-sample/AA-off branch in every browser
 * color/depth/shadow pass. Native A2C and Equal-depth pass arrangement are not
 * reproduced by this one-pass WebGL lowering. */
export const environmentAlphaShared = `
float environmentAlphaCoverage(float alpha,vec2 uv,float cutoff,float strength,bool aa){
 if(aa){float edge=clamp(.5+(alpha-cutoff)/max(fwidth(alpha),.000001),0.0,1.0);float footprint=clamp(4.0*length(fwidth(uv)),0.0,1.0);return mix(edge,alpha,mix(1.0,footprint,strength));}
 return alpha-cutoff;
}
`;
export function environmentAlphaSample(source: SourceEnvironmentMaterial, uv: string) {
  if (environmentUvSelection(source, 1) === 0) return environmentRead(source, 1, "Color", uv);
  return `environmentColor1GradRead(${uv}+vec2(length(vec4(dFdx(${uv}),dFdy(${uv})))*1e-10),dFdx(${uv}),dFdy(${uv}))`;
}
export function environmentAlphaTest(source: SourceEnvironmentMaterial, uv: string) {
  return `float environmentCoverageAlpha=environmentAlphaCoverage(${environmentAlphaSample(source, uv)}.a,${uv},${literal(source.FloatParams.g_flAlphaTestReference ?? 0.5)},${literal(source.FloatParams.g_flAntiAliasedEdgeStrength ?? 1)},false);if(environmentCoverageAlpha-.001<0.0)discard;`;
}
export function validateEnvironmentAlpha(source: SourceEnvironmentMaterial) {
  if (!source.IntParams.F_ALPHA_TEST) return;
  if (
    source.IntParams.g_nScaleTexCoordUByModelScaleAxis ||
    source.IntParams.g_nScaleTexCoordVByModelScaleAxis
  )
    throw new Error(
      "Native alpha model-scale UV requires unresolved engine gate and retained instance scale",
    );
}
export function createEnvironmentDepthHook(
  source: SourceEnvironmentMaterial,
  textures: ReadonlyMap<string, T.Texture>,
  banks: EnvironmentTextureBanks | undefined,
  frame: EnvironmentWorldFrame = createEnvironmentWorldFrame(),
): SourceDepthHook {
  validateEnvironmentAlpha(source);
  const layout = bindEnvironmentTextures(source, ["g_tColor1"], textures, banks, {
    uniforms: {},
  } as T.WebGLProgramParametersWithUniforms);
  const select = environmentUvSelection(source, 1),
    raw = select === 2 ? "sourceEnvironmentAlternateUv" : "sourceEnvironmentUv";
  const scale = source.VectorParams.g_vTexCoordScale1 ?? [1, 1],
    offset = source.VectorParams.g_vTexCoordOffset1 ?? [0, 0],
    center = source.VectorParams.g_vTexCoordCenter1 ?? [0.5, 0.5],
    rotation = source.FloatParams.g_flTexCoordRotation1 ?? 0;
  const uv =
    select === 0
      ? raw
      : `environmentDepthRotate(${raw},${literal(rotation)},${vector(scale)},${vector(offset)},${vector(center)})`;
  return {
    cacheKey: JSON.stringify([
      source.shader,
      source.IntParams,
      source.FloatParams,
      source.VectorParams,
      layout.signature,
    ]),
    apply(shader) {
      const binding = bindEnvironmentTextures(source, ["g_tColor1"], textures, banks, shader);
      shader.uniforms.environmentWorldToNative = { value: frame.worldToNative };
      shader.uniforms.environmentWorldToNativeNormal = { value: frame.worldToNativeNormal };
      shader.uniforms.environmentNativeToWorldNormal = { value: frame.nativeToWorldNormal };
      shader.uniforms.environmentNativeUnitScale = { value: frame.unitScale };
      shader.vertexShader = `attribute vec2 sourceEnvironmentUv,sourceEnvironmentAlternateUv;varying vec2 vEnvironmentDepthUv;varying vec3 vViewPosition,vEnvironmentDepthNormal;centroid varying vec3 vEnvironmentDepthCentroidNormal;
vec2 environmentDepthRotate(vec2 uv,float degrees,vec2 scale,vec2 offset,vec2 center){float a=radians(degrees),s=sin(a),c=cos(a);return mat2(c*scale.x,s*scale.x,-s*scale.y,c*scale.y)*uv+center+offset-mat2(c,s,-s,c)*center;}
${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
 vEnvironmentDepthUv=${uv};vViewPosition=-mvPosition.xyz;vEnvironmentDepthNormal=normalize(mat3(viewMatrix)*mat3(modelMatrix)*normal);vEnvironmentDepthCentroidNormal=vEnvironmentDepthNormal;`,
      );
      shader.fragmentShader = `varying vec2 vEnvironmentDepthUv;varying vec3 vViewPosition,vEnvironmentDepthNormal;centroid varying vec3 vEnvironmentDepthCentroidNormal;\n${environmentProjectionShared}\n${binding.code}\n${environmentAlphaShared}\n${shader.fragmentShader}`;
      const geometric =
        select === 0
          ? `vec3 environmentGeometric=normalize(dot(vEnvironmentDepthNormal,vEnvironmentDepthNormal)>=1.01?vEnvironmentDepthCentroidNormal:vEnvironmentDepthNormal);${source.IntParams.F_RENDER_BACKFACES && !source.IntParams.F_DONT_FLIP_BACKFACE_NORMALS ? "environmentGeometric*=gl_FrontFacing?1.0:-1.0;" : ""}${environmentProjectionSetup}`
          : "";
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <map_fragment>", "")
        .replace("#include <alphamap_fragment>", "")
        .replace(
          "#include <alphatest_fragment>",
          `${geometric}\n${environmentAlphaTest(source, "vEnvironmentDepthUv")}`,
        )
        .replace("#include <alphahash_fragment>", "");
    },
  };
}
