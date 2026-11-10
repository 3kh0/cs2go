import type { EnvironmentShaderParameters } from "./native-environment-parameters";
import * as T from "three";
import type { SourceEnvironmentMaterial } from "./native-map-environment";
const literal = (value: number) => {
  const raw = Number.isInteger(value) ? `${value}.0` : `${value}`;
  return value < 0 ? `(${raw})` : raw;
};
export const environmentWetnessShared = `
uniform float environmentTime;
float environmentWetReflectance,environmentWetScattering,environmentWetAmount,environmentPuddle;
vec3 environmentWetAdditionalNormal;
float environmentWetDiffuse(vec3 normal,vec3 direction){
 float NoL=max(0.0,dot(environmentWetAdditionalNormal,direction));
 if(NoL<=0.0)return 0.0;
 float strength=clamp(environmentWetScattering,0.0,1.0),normalLight=dot(normal,direction);
 float scatter=((.5+NoL*.5)+pow(1.0-clamp(normalLight,0.0,1.0),4.0))*clamp((normalLight+.2)*4.0,0.0,1.0)*clamp(mix(dot(mix(environmentWetAdditionalNormal,normal,10.0),direction),1.0,strength),0.0,1.0);
 return mix(NoL,scatter,strength);
}
`;
/** PS7912431–2617 wetness, using authored weather. The engine's live
 * texture slot is unknown: the manifest must explicitly qualify its chosen
 * reconstruction wave resource. Browser time/derivatives are approximations. */
export function environmentWetnessCode(
  source: SourceEnvironmentMaterial,
  parameters?: EnvironmentShaderParameters,
) {
  const f = (name: string, fallback: number) =>
    parameters?.float(source, name, fallback) ?? literal(source.FloatParams[name] ?? fallback);
  const weather = source.weather;
  if (!weather || !weather.waveResourceQualification || !source.textures.g_tEnvironmentWater)
    throw new Error(
      "Native wetness requires authored weather and an explicitly qualified wave resource",
    );
  for (const value of [
    weather.coverage,
    weather.drying,
    weather.rain,
    weather.ripples,
    weather.rippleDirection,
  ])
    if (!Number.isFinite(value)) throw new Error("Invalid native map weather");
  const sediment = new T.Color().setRGB(
    ...((source.VectorParams.g_vPuddleSedimentColor ?? [0.62, 0.56, 0.5]).slice(0, 3) as [
      number,
      number,
      number,
    ]),
    T.SRGBColorSpace,
  );
  return `
 environmentWetReflectance=${f("g_flReflectance", 0.04)};environmentWetScattering=0.0;environmentWetAdditionalNormal=environmentNormalOut;environmentWetAmount=0.0;environmentPuddle=0.0;
 if(vEnvironmentBlend.z!=0.0){
 vec3 wetPosition=environmentNativePosition(-vViewPosition);
 vec3 wetGeometric=environmentViewNormalToSource(environmentGeometric);
 vec3 wetOriginalNormal=environmentViewNormalToSource(environmentNormalOut);
 vec4 wave=environmentEnvironmentWaterRead(wetPosition.xy*.006);
 float up=pow(max(0.0,wetGeometric.z),${f("g_flHorizontalSurfaceTolerance", 32)});
 float coverage=min(min(vEnvironmentBlend.z,clamp(${parameters?.value("weather:coverage", [weather.coverage]) ?? literal(weather.coverage)},0.0,1.0)),1.0-2.0*clamp(${parameters?.value("weather:drying", [weather.drying]) ?? literal(weather.drying)}-.5,0.0,1.0));
 float delta=coverage-environmentWetHeight-.65+${f("g_fPuddleHeight", 0.5)};
 float extra=clamp(coverage-.75,0.0,1.0),level=coverage+4.0*extra*extra,fade=clamp(20.0*level,0.0,1.0);
 float puddle=clamp(delta/${f("g_fPuddleBlendSoftness", 0.08)}+.5,0.0,1.0)*up*fade;
 float wet=max(max(clamp(2.0*level-.5*mix(.5,wave.a,clamp(20.0*up,0.0,1.0))-.5*environmentWetHeight+.25,0.0,1.0)*${f("g_fWetnessStrength", 1)}*fade*(1.0-clamp(2.0*${parameters?.value("weather:drying", [weather.drying]) ?? literal(weather.drying)},0.0,1.0)),puddle),clamp((delta+${f("g_fWetEdgeSpread", 0.2)})/${f("g_fWetEdgeSoftness", 0.2)}+.5,0.0,1.0)*${f("g_fWetEdgeStrength", 0.5)});
 vec4 water=vec4(0.0,0.0,1.0,0.0);float rippleAA=0.0,rainSparkle=0.0;
 if(wet>.5){
 float rippleStrength=${f("g_fRippleStrength", 1)}*${parameters?.value("weather:ripples", [weather.ripples]) ?? literal(weather.ripples)};
 if(rippleStrength>0.0&&puddle>0.0){
 vec3 direction=normalize(vec3(-1.0,.2,0.0));float angle=${parameters?.value("weather:rippleDirection", [weather.rippleDirection]) ?? literal(weather.rippleDirection)}*6.2831854820251465,s=sin(angle),c=cos(angle);
 direction.xy=direction.xy*mat2(c,-s,s,c);
 vec3 across=-cross(direction,wetGeometric);
 float along=dot(wetPosition,direction),crossing=dot(wetPosition,across),dryPaint=1.0-vEnvironmentBlend.z;
 vec2 phase=vec2(along)+vec2(.1,-.1)*crossing+vec2(8.0,5.0)*wetPosition.z-vec2(dryPaint*dryPaint*80.0);
 vec2 uv1=vec2(phase.x,crossing)*vec2(.02,.011);
 vec4 wave1=environmentEnvironmentWaterRead(uv1+vec2(.2,0.0)*environmentTime);
 vec2 offset1=wave1.xy*2.0-1.0;float aa1=clamp(length(fwidth(uv1))*10.0,0.0,1.0);
 vec2 perturb1=offset1*vec2(.1,.05)*vEnvironmentBlend.z*mix(1.0,.3,aa1);
 vec2 uv2=vec2(phase.y,crossing)*vec2(.036,.0162)+offset1*.05;
 vec4 wave2=environmentEnvironmentWaterRead(uv2+vec2(.15,0.0)*environmentTime);
 float aa2=clamp(length(fwidth(uv2))*10.0,0.0,1.0);
 vec2 perturb2=(wave2.xy*2.0-1.0)*vec2(.052,.026)*vEnvironmentBlend.z*mix(1.0,.3,aa2);
 vec2 perturb=vec2(dot(direction.xy,perturb1),dot(across.xy,perturb1))+vec2(dot(direction.xy,perturb2),dot(across.xy,perturb2));
 water+=vec4(perturb,0.0,vEnvironmentBlend.z*(wave1.z+wave2.z))*up*rippleStrength;
 rippleAA=rippleStrength*.04*(aa1+aa2);
 }
 float rainStrength=${f("g_fRainStrength", 1)}*${parameters?.value("weather:rain", [weather.rain]) ?? literal(weather.rain)}*${parameters?.value("weather:rain", [weather.rain]) ?? literal(weather.rain)};
 if(rainStrength>0.0){
 vec2 rainUv=wetPosition.xy*.12;vec3 phases=vec3(environmentTime*6.5)+vec3(0.0,.3167,.6334),rain=vec3(0.0);
 const vec3 rotations=vec3(.9713,.7518,.3624),rotationsSine=vec3(.2377,.6594,.932),scales=vec3(.6,.6661,.7322);
 for(int i=0;i<3;i++){
 mat2 rotation=mat2(rotations[i],-rotationsSine[i],rotationsSine[i],rotations[i]);
 vec2 cell=rotation*rainUv*scales[i]+vec2(phases[i]*.02);
 vec2 radial=rotation*(fract(cell)*2.0-1.0);float radius=length(radial);
 float falloff=clamp(1.0-radius*mix(3.0,1.0,puddle),0.0,1.0),center=clamp(1.0-radius*6.0,0.0,1.0);
 float id=floor(fract(cell.x*.1)*10.0),phase=phases[i]+(id+floor(fract(cell.y*.1)*10.0)*(.2+id))*8.0;
 float strengthSquared=rainStrength*rainStrength;
 // At the exact cell center native radial/radius is undefined. This bounded
 // zero-direction guard is an explicit WebGL lowering, not native parity.
 vec2 radialDirection=radius>0.0?radial/radius:vec2(0.0);
 rain.xy+=(-radialDirection*cos(mix(1.0,falloff*40.0+environmentTime*65.0,puddle))*falloff*falloff*mix(2.0,.25,clamp(fwidth(falloff)*20.0,0.0,1.0)))*(clamp((sin((falloff*mix(1.0,4.0,puddle)+phase)*rainStrength)-(1.0-.2*strengthSquared*mix(.25,1.0,puddle)))*2.0,0.0,1.0)*falloff/strengthSquared)*mix(16.0,2.0,puddle);
 rain.z+=clamp((sin((center+phase+4.0+sin(environmentWetHeight*60.0)*.25)*rainStrength)-(1.0-strengthSquared*.02))*2.0,0.0,1.0)*center/strengthSquared*28.0;
 }
 water.xy+=rain.xy*up;rainSparkle=rain.z*up;
 }
 water.xyz=normalize(water.xyz);
 }
 float sediment=puddle*clamp(delta*puddle*${f("g_fPuddleSedimentOpacity", 0.25)}*12.0,0.0,1.0);
 vec3 wetNormal=normalize(mix(wetOriginalNormal,water.xyz,puddle));
 vec3 dark=mix(environmentColorOut,pow(environmentColorOut,vec3(1.3))*.8,clamp(pow(environmentColorOut,vec3(.25))*wet*environmentRoughness*8.0,0.0,1.0)*environmentWetDarkening);
 environmentColorOut=mix(dark*mix(1.0,environmentAO,puddle),vec3(${parameters?.value("wetSediment", sediment.toArray()) ?? sediment.toArray().map(literal).join(",")}),sediment)*(1.0+rainSparkle)+vec3(.1*rainSparkle);
 environmentRoughness=clamp(mix(environmentRoughness,${f("g_fPuddleRoughness", 0.02)},max(puddle,(1.0-environmentRoughness*environmentRoughness)*wet))+rippleAA+.5*length(fwidth(wetNormal)),0.0,1.0);
 environmentWetReflectance=mix(${f("g_flReflectance", 0.04)},.035,wet);
 environmentNormalOut=environmentSourceNormalToView(wetNormal);
 environmentWetAdditionalNormal=environmentSourceNormalToView(mix(wetOriginalNormal,water.xyz,sediment));
 environmentWetScattering=puddle*(.2+.15*water.w*water.w*water.w);
 environmentAO=mix(environmentAO,1.0,puddle);environmentWetAmount=wet;environmentPuddle=puddle;
 }
 `;
}
