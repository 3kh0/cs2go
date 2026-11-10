import * as T from "three";
import type { SourceFoliageWindState } from "./source-foliage-wind";
export interface SourceFoliageNoiseLayer {
  strength: number;
  scale: readonly number[];
  speed: readonly number[];
  falloff: number;
}
/** Literal installed build26445667 VS16/d9 and constrained VS18/d1 mode2
 * operations. Wind/time are explicit caller inputs; their live engine uploads
 * are not inferred from authored controllers. Noise2 samples the original point. */
export function createSourceFoliageAdvancedWind(
  layers: readonly [SourceFoliageNoiseLayer, SourceFoliageNoiseLayer],
  useEnvironmentWind: boolean,
  state: SourceFoliageWindState,
  noise: T.Data3DTexture,
) {
  for (const layer of layers)
    if (
      layer.scale.length < 3 ||
      layer.speed.length < 3 ||
      [layer.strength, layer.falloff, ...layer.scale, ...layer.speed].some(
        (x) => !Number.isFinite(x),
      )
    )
      throw new Error("Invalid native foliage mode2 field");
  if (
    [...state.direction, state.strength, state.timeSeconds].some((x) => !Number.isFinite(x)) ||
    !(noise instanceof T.Data3DTexture) ||
    noise.colorSpace !== T.NoColorSpace
  )
    throw new Error("Invalid native foliage mode2 engine/noise input");
  const time = { value: state.timeSeconds };
  return {
    uniforms: {
      sourceFoliageNoise: { value: noise },
      sourceFoliageWindDirection: { value: new T.Vector3(...state.direction) },
      sourceFoliageWindStrength: { value: state.strength },
      sourceFoliageTime: time,
      sourceFoliageNoise1: { value: new T.Vector2(layers[0].strength, layers[0].falloff) },
      sourceFoliageNoise2: { value: new T.Vector2(layers[1].strength, layers[1].falloff) },
      sourceFoliageNoise1Scale: { value: new T.Vector3(...layers[0].scale.slice(0, 3)) },
      sourceFoliageNoise2Scale: { value: new T.Vector3(...layers[1].scale.slice(0, 3)) },
      sourceFoliageNoise1Speed: { value: new T.Vector3(...layers[0].speed.slice(0, 3)) },
      sourceFoliageNoise2Speed: { value: new T.Vector3(...layers[1].speed.slice(0, 3)) },
      sourceFoliageUseWind: { value: useEnvironmentWind },
    },
    update(seconds: number) {
      if (!Number.isFinite(seconds)) throw new Error("Invalid foliage mode2 clock");
      time.value = seconds;
    },
    glsl: /*glsl*/ `
uniform highp sampler3D sourceFoliageNoise;uniform vec3 sourceFoliageWindDirection;uniform float sourceFoliageWindStrength,sourceFoliageTime;uniform bool sourceFoliageUseWind;
uniform vec2 sourceFoliageNoise1,sourceFoliageNoise2;uniform vec3 sourceFoliageNoise1Scale,sourceFoliageNoise2Scale,sourceFoliageNoise1Speed,sourceFoliageNoise2Speed;
vec3 sourceFoliageAdvancedField(vec3 p,float mask,vec2 parameters,vec3 scale,vec3 speed){vec3 n=(textureLod(sourceFoliageNoise,p*(.001*scale)+speed*sourceFoliageTime,0.).rgb-.5)*2.;vec3 d=n*parameters.x*pow(mask,parameters.y);if(sourceFoliageUseWind)d*=mix(.33,1.,dot(n,sourceFoliageWindDirection))*sourceFoliageWindStrength;return d;}
vec3 sourceFoliageSwayPoint(vec3 p,vec4 controls){controls=clamp(controls,vec4(.001),vec4(1));return p+sourceFoliageAdvancedField(p,controls.r,sourceFoliageNoise1,sourceFoliageNoise1Scale,sourceFoliageNoise1Speed)+sourceFoliageAdvancedField(p,controls.b,sourceFoliageNoise2,sourceFoliageNoise2Scale,sourceFoliageNoise2Speed);}
void sourceFoliageSwayFrame(vec3 p,vec3 n,vec3 t,vec4 controls,out vec3 animatedP,out vec3 animatedN,out vec3 animatedT){animatedP=sourceFoliageSwayPoint(p,controls);animatedT=sourceFoliageSwayPoint(p+t,controls)-animatedP;animatedN=cross(animatedT,sourceFoliageSwayPoint(p+cross(n,t),controls)-animatedP);}
`,
  };
}
