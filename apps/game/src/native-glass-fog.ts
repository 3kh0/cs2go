import * as T from "three";
import type { NativeMapFog } from "./native-map-fog";
import { sourceCubeSampling } from "./source-reflections";
const gameToSource = new T.Matrix4().set(
  1 / 0.0254,
  0,
  0,
  0,
  0,
  0,
  -1 / 0.0254,
  0,
  0,
  1 / 0.0254,
  0,
  0,
  0,
  0,
  0,
  1,
);
/** Glass PS16/PS1 attenuate remaining transmission and fog occupied RGB by
 * (1-dust). Unlike opaque PS they do not use the early distance/height cull. */
export function applyNativeGlassFog(
  shader: T.WebGLProgramParametersWithUniforms,
  fog: NativeMapFog | undefined,
  depth = false,
  worldToSource = gameToSource,
) {
  const p = fog?.parameters;
  if (!p) {
    shader.fragmentShader =
      "void nativeGlassFog(inout vec3 rgb,inout vec3 tau,float dust){}\n" + shader.fragmentShader;
    return;
  }
  Object.assign(shader.uniforms, {
    glassFogFrame: { value: worldToSource },
    glassFogGradient: { value: p.gradientBiasScale },
    glassFogExponents: { value: p.gradientExponents },
    glassFogColor: { value: p.gradientColorOpacity },
    glassFogCubeDistance: { value: p.cubeDistance },
    glassFogCubeHeight: { value: p.cubeHeight },
    glassFogCubeExposure: { value: p.cubeExposureOpacity },
    glassFogRotation: { value: p.cubeRotation },
  });
  const cube = !!fog.cube;
  if (cube && !depth) shader.uniforms.glassFogCubes0 = { value: fog.cube };
  const sampling =
    cube && !depth
      ? sourceCubeSampling
          .replaceAll("SOURCE_REFLECTION_CUBE_SIZE", "GLASS_FOG_CUBE_SIZE")
          .replaceAll("SOURCE_REFLECTION_ARRAY_SPLIT", "GLASS_FOG_ARRAY_SPLIT")
          .replaceAll("SOURCE_REFLECTION_SINGLE_ARRAY", "GLASS_FOG_SINGLE_ARRAY")
          .replaceAll("sourceReflectionCubes", "glassFogCubes")
          .replaceAll("sourceCube", "glassFogCube")
      : "";
  shader.fragmentShader =
    `varying vec3 vNativeGlassWorld;
#define GLASS_FOG_CUBE_SIZE ${fog.definition.cube?.texture.mips[0].width ?? 1}
#define GLASS_FOG_SINGLE_ARRAY
${sampling}
uniform mat4 glassFogFrame;uniform vec4 glassFogGradient,glassFogColor,glassFogCubeDistance,glassFogCubeHeight;
uniform vec2 glassFogExponents,glassFogCubeExposure;uniform mat3 glassFogRotation;
void nativeGlassFog(inout vec3 rgb,inout vec3 tau,float dust){
vec3 P=(glassFogFrame*vec4(vNativeGlassWorld,1)).xyz,D=(glassFogFrame*vec4(vNativeGlassWorld-cameraPosition,0)).xyz;
vec2 g=pow(clamp(glassFogGradient.xy+glassFogGradient.zw*vec2(length(D),P.z),0.0,1.0),glassFogExponents);
float fg=g.x*g.y*glassFogColor.a;tau*=1.0-fg;
${depth ? "" : "rgb=mix(rgb,glassFogColor.rgb,fg*(1.0-dust));"}
${
  cube
    ? `float density=clamp(pow(max(0.0,length(D)*glassFogCubeDistance.y+glassFogCubeDistance.x),glassFogCubeDistance.w),0.0,1.0)*clamp(pow(max(0.0,P.z*glassFogCubeHeight.y+glassFogCubeHeight.x),glassFogCubeHeight.z),0.0,1.0);
float fc=clamp(density,0.0,1.0)*glassFogCubeExposure.y;tau*=1.0-fc;
${depth ? "" : `float lod=glassFogCubeHeight.w*clamp(1.0-density*glassFogCubeDistance.z,0.0,1.0);vec3 c=glassFogCubeSample(glassFogRotation*normalize(D),0,lod)*glassFogCubeExposure.x;rgb=mix(rgb,c,fc*(1.0-dust));`}`
    : ""
}
}
` + shader.fragmentShader.replace("varying vec3 vNativeGlassWorld;", "");
}
