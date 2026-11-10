import * as T from "three";

export interface SourceFoliageSway {
  swayAmount: number;
  swaySpeed: number;
  swayNoiseScale: number;
  swayFalloff: number;
  flutterAmount: number;
  flutterSpeed: number;
  flutterNoiseScale: number;
  flutterFalloff: number;
}
export interface SourceFoliageWindState {
  /** Explicit resolved/captured Source-world direction and strength, no default. */
  direction: readonly [number, number, number];
  strength: number;
  timeSeconds: number;
}

/** VRF5564866 foliage_sway_vs primary reference (MIT). This source transport
 * takes resolved wind inputs explicitly; the reference renderer's fixed wind
 * is deliberately not a production default or evidence of private engine state.
 * Positions/tangent probes are in this foliage world's original Source inches. */
export const sourceFoliageSwayGLSL = /* glsl */ `
uniform highp sampler3D sourceFoliageNoise;
uniform vec4 sourceFoliageSwayParams;
uniform vec4 sourceFoliageFlutterParams;
uniform vec3 sourceFoliageWindDirection;
uniform float sourceFoliageWindStrength;
uniform float sourceFoliageTime;
vec3 sourceFoliageSwayPoint(vec3 p,vec4 controls) {
  controls=clamp(controls,vec4(.001),vec4(1.0));
  float height=2.0*controls.y-1.0;
  vec3 swayP=(p+vec3(height*100.0,0.0,height*50.0))*vec3(.00075,.00075,.00005)*sourceFoliageSwayParams.z
    +vec3(-.3,0.,-.03)*sourceFoliageSwayParams.y*sourceFoliageTime;
  float mask=clamp(pow(textureLod(sourceFoliageNoise,swayP*vec3(.4,.4,.125),0.).z,2.0)*1.5,0.,1.);
  vec3 swayNoise=(textureLod(sourceFoliageNoise,swayP,0.).xyz-vec3(.5))*2.;
  vec3 swayDir=vec3(swayNoise.xy,swayNoise.y*.5)*.5;
  vec3 sway=((swayDir*mask+sourceFoliageWindDirection)*pow(controls.x,sourceFoliageSwayParams.w)
    *sourceFoliageWindStrength*(150.*sourceFoliageSwayParams.x))*mask;
  vec3 flutterP=(p+vec3(height*10.,height*5.,height*5.))*vec3(.0025,.0025,.0005)*sourceFoliageFlutterParams.z
    +vec3(-.35,0.,.1)*sourceFoliageFlutterParams.y*sourceFoliageTime;
  vec3 flutterNoise=(textureLod(sourceFoliageNoise,flutterP,0.).xyz-vec3(.5))*2.;
  vec3 flutter=((flutterNoise*sourceFoliageWindDirection+flutterNoise*swayDir)
    *sourceFoliageWindStrength*(25.*sourceFoliageFlutterParams.x))*pow(controls.z,sourceFoliageFlutterParams.w);
  return p+sway+vec3(0.,0.,-length(sway.xy)*.314)+flutter+vec3(0.,0.,-length(flutter.xy)*.314);
}
void sourceFoliageSwayFrame(vec3 p,vec3 n,vec3 t,vec4 controls,out vec3 animatedP,out vec3 animatedN,out vec3 animatedT) {
  animatedP=sourceFoliageSwayPoint(p,controls);
  vec3 tangent=sourceFoliageSwayPoint(p+t,controls)-animatedP;
  vec3 bitangent=sourceFoliageSwayPoint(p+cross(n,t),controls)-animatedP;
  animatedN=normalize(cross(tangent,bitangent));
  animatedT=normalize(tangent);
}
`;

export function createSourceFoliageSway(
  parameters: SourceFoliageSway,
  state: SourceFoliageWindState,
  noise: T.Data3DTexture,
) {
  const values = [
    parameters.swayAmount,
    parameters.swaySpeed,
    parameters.swayNoiseScale,
    parameters.swayFalloff,
    parameters.flutterAmount,
    parameters.flutterSpeed,
    parameters.flutterNoiseScale,
    parameters.flutterFalloff,
    ...state.direction,
    state.strength,
    state.timeSeconds,
  ];
  if (state.direction.length !== 3 || values.some((value) => !Number.isFinite(value)))
    throw new Error("Unresolved native foliage wind input");
  if (
    !(noise instanceof T.Data3DTexture) ||
    noise.colorSpace !== T.NoColorSpace ||
    !noise.image.depth ||
    !noise.image.width ||
    !noise.image.height
  )
    throw new Error("Foliage wind requires the source-owned linear three-dimensional noise volume");
  const time = { value: state.timeSeconds };
  return {
    glsl: sourceFoliageSwayGLSL,
    uniforms: {
      sourceFoliageNoise: { value: noise },
      sourceFoliageSwayParams: {
        value: new T.Vector4(
          parameters.swayAmount,
          parameters.swaySpeed,
          parameters.swayNoiseScale,
          parameters.swayFalloff,
        ),
      },
      sourceFoliageFlutterParams: {
        value: new T.Vector4(
          parameters.flutterAmount,
          parameters.flutterSpeed,
          parameters.flutterNoiseScale,
          parameters.flutterFalloff,
        ),
      },
      sourceFoliageWindDirection: { value: new T.Vector3(...state.direction) },
      sourceFoliageWindStrength: { value: state.strength },
      sourceFoliageTime: time,
    },
    update(timeSeconds: number) {
      if (!Number.isFinite(timeSeconds)) throw new Error("Invalid foliage shader time");
      time.value = timeSeconds;
    },
  };
}
