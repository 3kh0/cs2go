import { EnvironmentShaderParameters } from "./native-environment-parameters";
import * as T from "three";
import type { SourceEnvironmentMaterial } from "./native-map-environment";
import { environmentColorMatrix } from "./native-map-environment";
import {
  bindEnvironmentTextures,
  type EnvironmentTextureBanks,
} from "./native-environment-textures";
import {
  environmentRead,
  environmentProjectedNormal,
  environmentUvSelection,
  environmentProjectionShared,
  environmentProjectionSetup,
} from "./native-environment-projection";
import { environmentWetnessCode, environmentWetnessShared } from "./native-environment-wetness";
import {
  createEnvironmentWorldFrame,
  type EnvironmentWorldFrame,
} from "./native-environment-frame";
import { environmentAlphaShared, environmentAlphaTest } from "./native-environment-alpha";
import { applySourceSurface } from "./source-surface";

// Exact generated templates are interned once; uniform values and resource IDs
// never enter the key. Keep the source as the identity to avoid hash collisions.
const programTemplates = new Map<string, string>();
export function modernEnvironmentProgramKey(
  shader: Pick<T.WebGLProgramParametersWithUniforms, "vertexShader" | "fragmentShader">,
) {
  const template = shader.vertexShader + "\0" + shader.fragmentShader;
  let key = programTemplates.get(template);
  if (!key) {
    key = `native-modern-environment:${programTemplates.size}`;
    programTemplates.set(template, key);
  }
  return key;
}

const n = (value: number) => {
  const raw = Number.isInteger(value) ? `${value}.0` : `${value}`;
  return value < 0 ? `(${raw})` : raw;
};
const v = (values: readonly number[], size = values.length) =>
  `vec${size}(${values.slice(0, size).map(n).join(",")})`;
const f = (s: SourceEnvironmentMaterial, key: string, fallback: number) =>
  s.FloatParams[key] ?? fallback;
const vec = (s: SourceEnvironmentMaterial, key: string, fallback: number[]) =>
  s.VectorParams[key] ?? fallback;
export function usesModernEnvironment(source: SourceEnvironmentMaterial) {
  return (
    !!source.nativeTextureDimensions ||
    !!(source.constants && Object.keys(source.constants).length) ||
    [1, 2, 3].some(
      (layer) =>
        source.IntParams[`g_nUVSet${layer}`] === 0 ||
        (!!source.IntParams.F_DETAIL_NORMAL && source.IntParams[`g_nDetailUVSet${layer}`] === 0),
    ) ||
    source.IntParams.g_nColorOverlayUVSet === 0 ||
    [
      "F_USE_NEW_BLENDING",
      "F_ENABLE_LAYER_3",
      "F_DETAIL_NORMAL",
      "F_BORDER_ROUGHNESS_2",
      "F_BORDER_ROUGHNESS_3",
      "F_BLEND_BY_FACING_DIRECTION_2",
      "F_BLEND_BY_FACING_DIRECTION_3",
      "F_BORDER_BLEND_MODE_2",
      "F_BORDER_BLEND_MODE_3",
      "F_SECONDARY_UV",
      "F_ALPHA_TEST",
      "F_WETNESS",
    ].some((key) => !!source.IntParams[key])
  );
}
const groupActive = (s: SourceEnvironmentMaterial, layer: number) =>
  layer === 1 ||
  ["NormalCombine", "NormalReplace", "RoughnessCombine", "RoughnessReplace"].some(
    (key) => f(s, `g_fl${key}${layer}`, key.endsWith("Replace") ? 1 : 0) !== 0,
  );
export function modernEnvironmentSamplers(source: SourceEnvironmentMaterial, layers: number) {
  const result: string[] = [];
  for (let layer = 1; layer <= layers; layer++) {
    result.push(`g_tColor${layer}`, `g_tHeight${layer}`);
    if (groupActive(source, layer)) {
      result.push(`g_tNormal${layer}`);
      if (
        source.IntParams.F_DETAIL_NORMAL &&
        f(source, `g_fDetailTextureNormalContrast${layer}`, 1) !== 0
      )
        result.push(`g_tNormalDetail${layer}`);
    }
  }
  if (source.IntParams.F_SHARED_COLOR_OVERLAY) result.push("g_tSharedColorOverlay");
  if (source.IntParams.F_WETNESS) result.push("g_tEnvironmentWater");
  return result;
}

/** Equations from native ps_s791_d4 / ps_s258_d4, build26445667. Only the
 * selected bytecode/material branches are source-established. textureQueryLod
 * and fine derivatives are qualified WebGL2 derivative estimates. */
const shared = `
uniform vec3 environmentModelTint;
varying vec2 vEnvironmentUv1,vEnvironmentUv2,vEnvironmentUv3,vEnvironmentOverlayUv;
varying vec2 vEnvironmentDetailUv1,vEnvironmentDetailUv2,vEnvironmentDetailUv3;
centroid varying vec4 vEnvironmentPaint;
varying vec4 vEnvironmentBlend;
varying float vEnvironmentHandedness;
centroid varying vec3 vEnvironmentCentroidNormal;
uniform mat4 environmentAdjust1,environmentTintAdjust1,environmentAdjust2,environmentTintAdjust2,environmentAdjust3,environmentTintAdjust3;
vec3 environmentGamma(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),c));}
vec2 environmentRotate(vec2 uv,float degrees,vec2 scale,vec2 offset,vec2 center){
 float angle=radians(degrees),s=sin(angle),c=cos(angle);
 return mat2(c*scale.x,s*scale.x,-s*scale.y,c*scale.y)*uv+center+offset-mat2(c,s,-s,c)*center;
}
float environmentLod(vec2 uv,vec2 dimensions){vec2 x=dFdx(uv)*dimensions,y=dFdy(uv)*dimensions;return max(0.0,.5*log2(max(max(dot(x,x),dot(y,y)),1e-12)));}
float environmentBand(float difference,float paint,float height,float softness,float mask){
 float quarter=softness*.25,denom=.02+quarter;
 float weight=clamp(.5+difference/(2.0*softness),0.0,1.0);
 weight=mix(weight,1.0,clamp((clamp(paint+.1*difference+.2,0.0,1.0)-(.98-quarter))/denom,0.0,1.0));
 weight=mix(weight,0.0,clamp((denom-clamp(paint+.05*difference-.05,0.0,1.0))/denom,0.0,1.0));
 return clamp(weight*mix(.5,height,mask)*2.0,0.0,1.0);
}
vec3 environmentPackedNormal(vec2 encoded,float degrees,vec3 N,vec3 T,vec3 B){
 vec2 hemi=vec2(encoded.r+encoded.g-1.003921627998352,encoded.r-encoded.g);
 vec3 decoded=normalize(vec3(hemi,1.0-abs(hemi.x)-abs(hemi.y)));
 float angle=radians(degrees),s=sin(angle),c=cos(angle);
 vec2 xy=mat2(c,s,-s,c)*decoded.xy;
 float denominator=max(abs(decoded.z),max(abs(xy.x),abs(xy.y))/128.0);
 return normalize(N+T*xy.x/denominator-B*xy.y/denominator);
}
vec3 environmentColorize(vec3 color,vec3 tint,float mask,float band){
 vec3 direction=normalize(max(tint,vec3(.001)));float lum=dot(color,vec3(.2125,.7154,.0721));
 vec3 target=direction*min(lum/dot(direction,vec3(.2125,.7154,.0721)),3.0*lum*max(tint.r,max(tint.g,tint.b)));
 return mix(color,clamp(mix(color,target,mask),0.0,1.0),band);
}
`;
function uvCode(
  s: SourceEnvironmentMaterial,
  layer: number,
  detail = false,
  parameters: EnvironmentShaderParameters,
) {
  const suffix = layer || "",
    prefix = detail ? "DetailTexCoord" : layer ? "TexCoord" : "OverlayTexCoord";
  const selected = detail
    ? (s.IntParams[`g_nDetailUVSet${layer}`] ?? -1)
    : (s.IntParams[layer ? `g_nUVSet${layer}` : "g_nColorOverlayUVSet"] ?? (layer ? 1 : 2));
  const effective = selected === -1 ? (s.IntParams[`g_nUVSet${layer}`] ?? 1) : selected;
  if (effective === 0) return "sourceEnvironmentUv";
  return `environmentRotate(${effective === 2 ? "sourceEnvironmentAlternateUv" : "sourceEnvironmentUv"},${parameters.float(s, `g_fl${prefix}Rotation${suffix}`, 0)},${parameters.vector(s, `g_v${prefix}Scale${suffix}`, [1, 1], 2)},${parameters.vector(s, `g_v${prefix}Offset${suffix}`, [0, 0], 2)},${parameters.vector(s, `g_v${prefix}Center${suffix}`, [0.5, 0.5], 2)})`;
}
function tintLayer(
  s: SourceEnvironmentMaterial,
  layer: number,
  _layers: number,
  parameters: EnvironmentShaderParameters,
) {
  const F = (key: string, d: number) => parameters.float(s, key + layer, d);
  return `
 vec4 color${layer}=${environmentSurfaceRead(s, layer, "Color", parameters)};
 vec4 height${layer}=${environmentRead(s, layer, "Height", `vEnvironmentUv${layer}`, false, parameters)};
 float tintMask${layer}=clamp(((height${layer}.g-.5)*${F("g_fTintMaskContrast", 1)}+.5)*${F("g_fTintMaskBrightness", 1)},0.0,1.0);
 height${layer}.a*=${n((s.IntParams[`g_bMetalness${layer}`] ?? 1) ? 1 : 0)};
 vec3 adjusted${layer}=${(s.IntParams[`g_nColorCorrectionMode${layer}`] ?? 0) === 1 ? `(environmentAdjust${layer}*vec4(color${layer}.rgb,1.0)).rgb` : `color${layer}.rgb`};
 vec3 base${layer}=mix(adjusted${layer},(environmentTintAdjust${layer}*vec4(color${layer}.rgb,1.0)).rgb,tintMask${layer});
 vec3 modelDirection${layer}=normalize(max(environmentModelTint,vec3(.001)));
 float lum${layer}=dot(base${layer},vec3(.2125,.7154,.0721));
 vec3 target${layer}=modelDirection${layer}*min(lum${layer}/dot(modelDirection${layer},vec3(.2125,.7154,.0721)),3.0*lum${layer}*max(environmentModelTint.r,max(environmentModelTint.g,environmentModelTint.b)));
 color${layer}.rgb=clamp(mix(base${layer},target${layer},${parameters.float(s, "g_flModelTintAmount", 1)}*(1.0-min(environmentModelTint.r,min(environmentModelTint.g,environmentModelTint.b)))*tintMask${layer}*${n((s.IntParams[`g_bModelTint${layer}`] ?? 1) ? 1 : 0)}),0.0,1.0);
 vec3 overlayColor${layer}=color${layer}.rgb;

 float ao${layer}=clamp(mix(${parameters.vector(s, `g_vAmbientOcclusionLevels${layer}`, [0, 0.5, 1], 3)}.x,${parameters.vector(s, `g_vAmbientOcclusionLevels${layer}`, [0, 0.5, 1], 3)}.z,pow(max(${s.IntParams.F_ALPHA_TEST ? `height${layer}.b` : `color${layer}.a`},0.0),${parameters.vector(s, `g_vAmbientOcclusionLevels${layer}`, [0, 0.5, 1], 3)}.y)),0.0,1.0);
 `;
}
/** Native PS791:962–968 captures UV derivatives before the weight branch;
 * Color/Normal reads at1139/1149 use those explicit gradients. Implicit reads
 * inside the spatially varying layer branch have undefined derivatives. */
function environmentSurfaceRead(
  source: SourceEnvironmentMaterial,
  layer: number,
  kind: string,
  parameters: EnvironmentShaderParameters,
) {
  if (environmentUvSelection(source, layer) === 0)
    return environmentRead(source, layer, kind, `vEnvironmentUv${layer}`, false, parameters);
  const gradient = `environmentSurfaceGradient${layer}`;
  return `environment${kind}${layer}GradRead(vEnvironmentUv${layer}+vec2(length(${gradient})*1e-10),${gradient}.xy,${gradient}.zw)`;
}
function normalLayer(
  s: SourceEnvironmentMaterial,
  layer: number,
  parameters: EnvironmentShaderParameters,
) {
  if (!groupActive(s, layer)) return `vec3 N${layer}=environmentGeometric;float R${layer}=1.0;`;
  const uvSet = s.IntParams[`g_nUVSet${layer}`] ?? 1;
  const detailSelect = s.IntParams[`g_nDetailUVSet${layer}`] ?? -1;
  const detailEffective = detailSelect === -1 ? uvSet : detailSelect;
  return `
 vec4 normalSample${layer}=${environmentSurfaceRead(s, layer, "Normal", parameters)};
 vec3 N${layer}=normalize(mix(environmentGeometric,${uvSet === 0 ? environmentProjectedNormal(s, layer, false, parameters) : `environmentPackedNormal(normalSample${layer}.rg,${parameters.float(s, `g_flTexCoordRotation${layer}`, 0)},${uvSet === 2 ? "environmentUvN,environmentUvT,environmentUvB" : "environmentFrameN,environmentFrameT,environmentFrameB"})`},${parameters.float(s, `g_fTextureNormalContrast${layer}`, 1)}));
 float R${layer}=clamp(((normalSample${layer}.b-.5)*${parameters.float(s, `g_fTextureRoughnessContrast${layer}`, 1)}+.5)*${parameters.float(s, `g_fTextureRoughnessBrightness${layer}`, 1)},0.0,1.0);
 ${
   s.IntParams.F_DETAIL_NORMAL && f(s, `g_fDetailTextureNormalContrast${layer}`, 1) !== 0
     ? `
 vec2 detailUv${layer}=vEnvironmentDetailUv${layer}${detailSelect === -1 ? `*${parameters.vector(s, `g_vTexCoordScale${layer}`, [1, 1], 2)}` : ""};
 vec3 detailN${layer}=normalize(mix(environmentGeometric,${detailEffective === 0 ? environmentProjectedNormal(s, layer, true, parameters) : `environmentPackedNormal(environmentNormalDetail${layer}Read(detailUv${layer}).rg,${parameters.float(s, `g_flDetailTexCoordRotation${layer}`, 0)},${detailEffective === 2 ? "environmentUvN,environmentUvT,environmentUvB" : "environmentFrameN,environmentFrameT,environmentFrameB"})`},${parameters.float(s, `g_fDetailTextureNormalContrast${layer}`, 1)}));
 N${layer}=normalize(N${layer}+detailN${layer}-environmentGeometric);`
     : ""
 }
 `;
}
function borderColor(
  s: SourceEnvironmentMaterial,
  layer: number,
  color: string,
  factor: string,
  band: string,
  tintMask: string,
  parameters: EnvironmentShaderParameters,
) {
  const tint = new T.Color().setRGB(
    ...(vec(s, `g_vBorderTint${layer}`, [1, 1, 1]).slice(0, 3) as [number, number, number]),
    T.SRGBColorSpace,
  );
  const TINT = parameters.value(`borderTint:${layer}`, tint.toArray()),
    mode = s.IntParams[`F_BORDER_BLEND_MODE_${layer}`] ?? 0;
  if (mode === 1) return `${color}=mix(${color},${TINT},${factor});`;
  if (mode === 2) return `${color}*=mix(vec3(1.0),${TINT}*2.0,${factor});`;
  if (mode === 3) return `${color}=environmentColorize(${color},${TINT},${tintMask},${band});`;
  return `${color}*=mix(vec3(1.0),${TINT},${factor});`;
}
function facingDirection(
  source: SourceEnvironmentMaterial,
  layer: number,
  parameters: EnvironmentShaderParameters,
) {
  const direction = vec(source, `g_vFacingDirection${layer}`, [0, 0, 1]).slice(0, 3);
  if (direction[2] === 0) direction[2] = 0.0001;
  const native = new T.Vector3().fromArray(direction).normalize();
  return `environmentSourceNormalToView(${parameters.value(`facingDirection:${layer}`, native.toArray())})`;
}
function stageCode(
  s: SourceEnvironmentMaterial,
  layer: number,
  modern: boolean,
  parameters: EnvironmentShaderParameters,
) {
  const F = (key: string, d: number) => parameters.float(s, key + layer, d);
  const effects = !!(
    s.IntParams[`F_BLEND_EFFECTS_${layer}`] ||
    (layer === 2 && s.IntParams.F_BLEND_EFFECTS)
  );
  const borderAmount = parameters.vector(s, `g_vBorderLayerAmount${layer}`, [1, 0], 2);
  const maskTint = s.IntParams[`g_bBorderTintMask${layer}`] ?? 0;
  const belowTint = layer === 2 ? "tintMask1" : "mix(tintMask1,tintMask2,environmentWeight2)";
  let weights: string;
  if (modern) {
    weights = `
 float signed${layer}=2.0*paint${layer}-1.0;
 float difference${layer}=h${layer}+signed${layer}${layer === 3 ? "+max(environmentSigned2,0.0)" : ""}-mix(${layer === 3 ? "environmentCarry2" : "0.0"},${layer === 3 ? "environmentUnder2" : "h1"},${F("g_flUnderlyingHeightMapInfluence", 1)});
 float soft${layer}=max(min(vEnvironmentBlend.w+${F("g_flBlendSoftness", 0.01)},1.0),.0001)+${layer === 2 ? "q1+q1+q2" : "q1+q2+q3"};
 environmentWeight${layer}=environmentBand(difference${layer},paint${layer},height${layer}.r,soft${layer},${F("g_flMaskWithHeight", 0)});
 ${layer === 2 ? `environmentSigned2=signed2;if(environmentWeight2>.05){environmentCarry2=signed2*environmentWeight2;environmentUnder2=mix(h1,max(h1,h2+signed2),environmentWeight2);}` : ""}
 `;
  } else {
    weights = `
 float environmentTSoft=max(min(vEnvironmentBlend.w+${F("g_flBlendSoftness", 0.01)},1.0),.0001)+q1;
 float soft2=environmentTSoft+q1+q2;
 float legacyZ1=${parameters.float(s, "g_flHeightMapZeroPoint1", 0.5)}+.5*q1,legacyZ2=${F("g_flHeightMapZeroPoint", 0.5)}+.5*(q1+q2);
 float legacyA=${parameters.float(s, "g_flHeightMapScale1", 1)}+environmentTSoft,legacyB=${F("g_flHeightMapScale", 1)}+soft2;
 float legacyL=legacyB-2.0*soft2;if(legacyL==0.0)legacyL=.0001;
 float legacyE1=height1.r-legacyZ1,legacyE2=height2.r-legacyZ2;
 float legacyT=mix(-legacyZ1*legacyA-(1.0-legacyZ2)*legacyB-soft2,(1.0-legacyZ1)*legacyA+legacyZ2*legacyB,paint2);
 float legacyH1=legacyE1*legacyA,legacyH2=legacyE2*legacyL+legacyT;
 vec2 legacyU=max(vec2(legacyH1,legacyH2)-max(legacyH1,legacyH2)+soft2,0.0);
 environmentWeight2=clamp(legacyU.y/(legacyU.x+.0001+legacyU.y)*mix(.5,height2.r,${F("g_flMaskWithHeight", 0)})*2.0,0.0,1.0);
 `;
  }
  const surface = tintLayer(s, layer, 3, parameters)
    .replace(
      ` vec4 height${layer}=${environmentRead(s, layer, "Height", `vEnvironmentUv${layer}`, false, parameters)};`,
      "",
    )
    .replace(` float tintMask${layer}=`, ` tintMask${layer}=`)
    .replace(` vec4 color${layer}=`, ` color${layer}=`)
    .replace(` vec3 overlayColor${layer}=`, ` overlayColor${layer}=`)
    .replace(` float ao${layer}=`, ` ao${layer}=`);
  let border = "";
  if (effects) {
    if (modern) {
      border = `
 float edge${layer}=clamp(5.0*paint${layer},0.0,1.0)*clamp(5.0*(1.0-paint${layer}),0.0,1.0);
 float underScale${layer}=${layer === 2 ? parameters.float(s, "g_flHeightMapScale1", 1) : `mix(${parameters.float(s, "g_flHeightMapScale1", 1)},${parameters.float(s, "g_flHeightMapScale2", 1)},environmentWeight2)`};
 float borderScale${layer}=.5+.5*max(abs(underScale${layer}),abs(${F("g_flHeightMapScale", 1)}));
 vec2 amount${layer}=clamp(${borderAmount}*mix(.5,height${layer}.r,${F("g_flMaskWithHeight", 0)})*2.0,0.0,1.0);
 float border${layer}=0.0;
 ${
   f(s, `g_flBorderSpread${layer}`, 0) > 0
     ? `
 float width${layer}=${F("g_flBorderSpread", 0)}*borderScale${layer}*edge${layer};
 float borderSoft${layer}=soft${layer}+${F("g_flBorderSoftness", 0.1)};
 border${layer}=(1.0-smoothstep(width${layer}-borderSoft${layer},width${layer}+borderSoft${layer},abs(difference${layer}+${F("g_flBorderOffset", 0)})))*(1.0-clamp(borderSoft${layer}/${F("g_flBorderSpread", 0)}*.01,0.0,1.0))*clamp(edge${layer}*mix(4.0,1.0,clamp(borderSoft${layer}*.5,0.0,1.0)),0.0,1.0)*mix(amount${layer}.x,amount${layer}.y,environmentWeight${layer});`
     : ""
 }
 float borderTintMask${layer}=${maskTint ? `mix(${belowTint},tintMask${layer},environmentWeight${layer})` : "1.0"};
 float borderFactor${layer}=border${layer}*borderTintMask${layer};
 ${borderColor(s, layer, "environmentColorOut", `borderFactor${layer}`, `border${layer}`, `borderTintMask${layer}`, parameters)}
 ${borderColor(s, layer, `color${layer}.rgb`, `borderFactor${layer}`, `border${layer}`, `borderTintMask${layer}`, parameters)}
 ${s.IntParams[`F_BORDER_ROUGHNESS_${layer}`] ? `environmentRoughness=mix(environmentRoughness,${F("g_fBorderRoughness", 0.5)},borderFactor${layer});R${layer}=mix(R${layer},${F("g_fBorderRoughness", 0.5)},borderFactor${layer});` : ""}
 `;
    } else {
      border = `
 float edge2=clamp(10.0*paint2,0.0,1.0)*clamp(10.0*(1.0-paint2),0.0,1.0);
 float borderA2=legacyE1*(legacyA+${F("g_flBorderSoftness", 0.1)});
 float borderC2=legacyE2*(legacyL-${F("g_flBorderSoftness", 0.1)})+legacyT-${F("g_flBorderSoftness", 0.1)};
 vec2 borderQ2=vec2(borderA2,borderC2+(${F("g_flBorderSpread", 0)}+${F("g_flBorderOffset", 0)})*edge2);
 vec2 borderR2=vec2(borderA2+(${F("g_flBorderSpread", 0)}-${F("g_flBorderOffset", 0)})*edge2,borderC2);
 borderQ2=max(borderQ2-max(borderQ2.x,borderQ2.y)+soft2+${F("g_flBorderSoftness", 0.1)},0.0);
 borderR2=max(borderR2-max(borderR2.x,borderR2.y)+soft2+${F("g_flBorderSoftness", 0.1)},0.0);
 float border2=borderQ2.y/(borderQ2.x+.001+borderQ2.y)*(borderR2.x+.001)/(borderR2.x+.001+borderR2.y);
 float borderTintMask2=${maskTint ? "mix(tintMask1,tintMask2,environmentWeight2)" : "1.0"};
 vec2 borderFactor2=border2*borderTintMask2*clamp(${borderAmount}*mix(.5,height2.r,${F("g_flMaskWithHeight", 0)})*2.0,0.0,1.0);
 ${borderColor(s, 2, "environmentColorOut", "borderFactor2.x", "border2*clamp(" + borderAmount + ".x*mix(.5,height2.r," + F("g_flMaskWithHeight", 0) + ")*2.0,0.0,1.0)", "borderTintMask2", parameters)}
 ${borderColor(s, 2, "color2.rgb", "borderFactor2.y", "border2*clamp(" + borderAmount + ".y*mix(.5,height2.r," + F("g_flMaskWithHeight", 0) + ")*2.0,0.0,1.0)", "borderTintMask2", parameters)}
 ${s.IntParams.F_BORDER_ROUGHNESS_2 ? `environmentRoughness=mix(environmentRoughness,${F("g_fBorderRoughness", 0.5)},borderFactor2.x);R2=mix(R2,${F("g_fBorderRoughness", 0.5)},borderFactor2.y);` : ""}
 `;
    }
  }
  let bevel = "";
  if (effects && f(s, `g_flBevelStrength${layer}`, 0) !== 0) {
    if (modern) {
      bevel = `
 if(edge${layer}!=0.0&&${F("g_flBevelSpread", 0.1)}!=0.0){
 float bevelWidth${layer}=${F("g_flBevelSpread", 0.1)}*borderScale${layer}*edge${layer};
 float bevelSoft${layer}=(soft${layer}+${F("g_flBevelSoftness", 0.1)})*edge${layer};
 float bevelDifference${layer}=difference${layer}+${F("g_flBevelOffset", 0)};
 float bevelInput${layer}=clamp(bevelDifference${layer}/(bevelWidth${layer}+bevelSoft${layer})*.5+.5,0.0,1.0);
 float bevelPower${layer}=1.0+pow(abs(${F("g_flBevelCurve", 0)}),2.0)*10.0;
 float bevelProfile${layer}=${f(s, `g_flBevelCurve${layer}`, 0) > 0 ? `pow(bevelInput${layer},bevelPower${layer})` : `1.0-pow(1.0-bevelInput${layer},bevelPower${layer})`};
 vec3 bevelPosition${layer}=-vViewPosition+environmentGeometric*(bevelProfile${layer}*.0254*environmentNativeUnitScale);
 vec3 bevelCross${layer}=cross(dFdx(bevelPosition${layer}),dFdy(bevelPosition${layer}));
 if(dot(bevelCross${layer},environmentGeometric)<0.0)bevelCross${layer}=-bevelCross${layer};
 float bevelFactor${layer}=(1.0-smoothstep(bevelWidth${layer}-bevelSoft${layer},bevelWidth${layer}+bevelSoft${layer},abs(bevelDifference${layer})))*(1.0-clamp(bevelSoft${layer}/${F("g_flBevelSpread", 0.1)}*.01,0.0,1.0))*mix(${parameters.vector(s, `g_vBevelLayerAmount${layer}`, [1, 0], 2)}.x,${parameters.vector(s, `g_vBevelLayerAmount${layer}`, [1, 0], 2)}.y,environmentWeight${layer})*${F("g_flBevelStrength", 0)}*100.0;
 if(length(bevelCross${layer})>0.0){vec3 bevelNormal${layer}=normalize(mix(environmentGeometric,normalize(bevelCross${layer}),bevelFactor${layer}));environmentNormalOut=normalize(environmentNormalOut+bevelNormal${layer}-environmentGeometric);}
 }
 `;
    } else {
      bevel = `
 float bevelA2=legacyE1*(legacyA+${F("g_flBevelSoftness", 0.1)});
 float bevelC2=legacyE2*(legacyL-${F("g_flBevelSoftness", 0.1)})+legacyT+${F("g_flBevelSpread", 0.1)};
 vec2 bevelQ2=max(vec2(bevelA2,bevelC2)-max(bevelA2,bevelC2)+soft2+${F("g_flBevelSoftness", 0.1)},0.0);
 float bevelX2=bevelQ2.y/(bevelQ2.x+.001+bevelQ2.y),bevelPower2=max(.2,2.0*${F("g_flBevelCurve", 1)});
 float bevelPositive2=pow(smoothstep(0.0,.5,bevelX2),bevelPower2),bevelNegative2=pow(1.0-smoothstep(.5,1.0,bevelX2),bevelPower2);
 vec3 bevelPosition2=-vViewPosition+environmentGeometric*((bevelPositive2+1.0-bevelNegative2)*${F("g_flBevelStrength", 0)}*2.54*environmentNativeUnitScale);
 vec3 bevelCross2=cross(dFdx(bevelPosition2),dFdy(bevelPosition2));if(dot(bevelCross2,environmentGeometric)<0.0)bevelCross2=-bevelCross2;
 float bevelFactor2=bevelPositive2*bevelNegative2*smoothstep(0.0,${F("g_flBevelSoftness", 0.1)},paint2)*edge2*mix(1.0,${parameters.vector(s, "g_vBevelLayerAmount2", [1, 0], 2)}.x,environmentWeight2)*mix(${parameters.vector(s, "g_vBevelLayerAmount2", [1, 0], 2)}.y,1.0,environmentWeight2);
 if(length(bevelCross2)>0.0)environmentNormalOut=normalize(environmentNormalOut+normalize(mix(environmentGeometric,normalize(bevelCross2),bevelFactor2))-environmentGeometric);
 `;
    }
  }
  const normalReplace = modern ? "1.0" : `clamp(legacyH2+legacyZ2-legacyH1,0.0,1.0)`;
  return `
 if(environmentPaint${layer}>0.0){
 float paint${layer}=environmentPaint${layer};
 ${s.IntParams[`F_BLEND_BY_FACING_DIRECTION_${layer}`] ? `paint${layer}*=clamp(((dot(${facingDirection(s, layer, parameters)},mix(environmentGeometric,environmentNormalOut,${F("g_vFacingDirectionMaskNormalMapStrength", 1)}))-1.0+2.0*${F("g_flFacingDirectionMaskSpread", 0.5)})/(2.0*${F("g_vFacingDirectionMaskSoftness", 0.1)}))+.5,0.0,1.0);` : ""}
 q${layer}=pow(environmentLod(vEnvironmentUv${layer},environmentHeight${layer}Size()),2.0)*(.0125+fwidth(height${layer}.r*${F("g_flHeightMapScale", 1)}))*.02*${parameters.float(s, "g_flBlendSoftnessDistanceModifierStrength", 1)}*environmentBlendDistance.${layer === 2 ? "y" : "z"};
 ${weights}
 vec4 color${layer}=vec4(0.0);vec3 overlayColor${layer}=vec3(0.0);float ao${layer}=1.0;vec3 N${layer}=environmentGeometric;float R${layer}=1.0;
 if(environmentWeight${layer}>.05){
 ${surface}
 ${normalLayer(s, layer, parameters).replace(`vec3 N${layer}=`, `N${layer}=`).replace(`float R${layer}=`, `R${layer}=`)}
 }
 ${border}
 ${bevel}
 if(environmentWeight${layer}>.05){
 environmentColorOut=mix(environmentColorOut*mix(vec3(1.0),2.0*environmentGamma(clamp(overlayColor${layer},0.0,1.0)),environmentWeight${layer}*${F("g_flColorOverlay", 0)}),color${layer}.rgb,environmentWeight${layer}*${F("g_flColorReplace", 1)});
 environmentAO=mix(environmentAO*mix(1.0,ao${layer},environmentWeight${layer}*${F("g_flAOCombine", 0)}),ao${layer},environmentWeight${layer}*${F("g_flAOReplace", 1)});
 ${
   groupActive(s, layer)
     ? `
 environmentRoughness=mix(environmentRoughness*(1.0+2.0*(R${layer}-environmentRoughness)*environmentWeight${layer}*${F("g_flRoughnessCombine", 0)}),R${layer},environmentWeight${layer}*${F("g_flRoughnessReplace", 1)});
 environmentNormalOut=mix(mix(environmentNormalOut,normalize(environmentNormalOut+N${layer}-environmentGeometric),environmentWeight${layer}*${F("g_flNormalCombine", 0)}),N${layer},environmentWeight${layer}*${normalReplace}*${F("g_flNormalReplace", 1)});
 `
     : ""
 }
 environmentMetalness=mix(environmentMetalness*mix(1.0,2.0*height${layer}.a,environmentWeight${layer}*${F("g_flMetalnessCombine", 0)}),height${layer}.a,environmentWeight${layer}*${F("g_flMetalnessReplace", 1)});
 environmentOpacity=mix(environmentOpacity,color${layer}.a,environmentWeight${layer});
 ${s.IntParams.F_WETNESS ? `environmentWetHeight=mix(environmentWetHeight,h${layer}*${parameters.float(s, "g_flWetnessUnderlyingHeightMapInfluence", 1)}+.5,environmentWeight${layer});` : ""}
 }
 }
 `;
}

export function applyModernEnvironmentShader(
  shader: T.WebGLProgramParametersWithUniforms,
  source: SourceEnvironmentMaterial,
  textures: ReadonlyMap<string, T.Texture>,
  banks: EnvironmentTextureBanks | undefined,
  modelTint: T.Color,
  lookup: T.DataTexture,
  time: T.IUniform<number> = { value: 0 },
  frame: EnvironmentWorldFrame = createEnvironmentWorldFrame(),
) {
  const layers = source.IntParams.F_ENABLE_LAYER_3
    ? 3
    : source.shader === "csgo_environment_blend.vfx"
      ? 2
      : 1;
  const modern = !!source.IntParams.F_USE_NEW_BLENDING;
  const parameters = new EnvironmentShaderParameters();
  const binding = bindEnvironmentTextures(
    source,
    modernEnvironmentSamplers(source, layers),
    textures,
    banks,
    shader,
    parameters,
  );
  shader.uniforms.environmentModelTint = { value: modelTint };
  shader.uniforms.environmentWorldToNative = { value: frame.worldToNative };
  shader.uniforms.environmentWorldToNativeNormal = { value: frame.worldToNativeNormal };
  shader.uniforms.environmentNativeToWorldNormal = { value: frame.nativeToWorldNormal };
  shader.uniforms.environmentNativeUnitScale = { value: frame.unitScale };
  if (source.IntParams.F_WETNESS) shader.uniforms.environmentTime = time;
  for (let layer = 1; layer <= layers; layer++) {
    const csb = ["Contrast", "Saturation", "Brightness"].map((key) =>
      f(source, `g_fTextureColor${key}${layer}`, 1),
    );
    const pivot = source.textureReflectivity[`g_tColor${layer}`];
    shader.uniforms[`environmentAdjust${layer}`] = { value: environmentColorMatrix(csb, pivot) };
    shader.uniforms[`environmentTintAdjust${layer}`] = {
      value: environmentColorMatrix(
        csb,
        pivot,
        vec(source, `g_vTextureColorTint${layer}`, [1, 1, 1]),
      ),
    };
  }
  const declarations = shared.slice(0, shared.indexOf("vec3 environmentGamma"));
  const rotate = shared.slice(
    shared.indexOf("vec2 environmentRotate"),
    shared.indexOf("float environmentLod"),
  );
  shader.vertexShader = `attribute vec2 sourceEnvironmentUv,sourceEnvironmentAlternateUv;attribute vec4 sourceEnvironmentPaint,sourceEnvironmentBlend;\n${declarations}\n${rotate}\n${shader.vertexShader}`;
  const tint = new T.Color().setRGB(
    ...(vec(source, "g_vColorTint", [1, 1, 1]).slice(0, 3) as [number, number, number]),
    T.SRGBColorSpace,
  );
  const assignments = Array.from({ length: 3 }, (_, i) => {
    const layer = i + 1;
    return `vEnvironmentUv${layer}=${layer <= layers ? uvCode(source, layer, false, parameters) : "vEnvironmentUv1"};vEnvironmentDetailUv${layer}=${layer <= layers ? uvCode(source, layer, true, parameters) : "vEnvironmentUv1"};`;
  }).join("\n");
  // Position/world-position and tangent chunks already compose instanceMatrix.
  // ENV also retains an unnormalized centroid normal, so both normal paths
  // need the inverse-transpose instance frame. Ordinary meshes stay unchanged.
  shader.vertexShader = shader.vertexShader.replace(
    "#include <defaultnormal_vertex>",
    `#include <defaultnormal_vertex>
#ifdef USE_INSTANCING
 transformedNormal=normalMatrix*transpose(inverse(mat3(instanceMatrix)))*objectNormal;
 #ifdef FLIP_SIDED
 transformedNormal=-transformedNormal;
 #endif
#endif`,
  );
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
 ${assignments}
 vEnvironmentOverlayUv=${source.IntParams.F_SHARED_COLOR_OVERLAY ? uvCode(source, 0, false, parameters) : "vEnvironmentUv1"};
 vEnvironmentBlend=sourceEnvironmentBlend;
 vEnvironmentPaint=vec4(${parameters.value("paintTint", tint.toArray())}*mix(vec3(1.0),sourceEnvironmentPaint.rgb,sourceEnvironmentPaint.a),1.0);
 vEnvironmentHandedness=tangent.w;
 vEnvironmentCentroidNormal=normalMatrix*objectNormal;
 #ifdef USE_INSTANCING
 vEnvironmentCentroidNormal=normalMatrix*transpose(inverse(mat3(instanceMatrix)))*objectNormal;
 #endif
 `,
  );
  let lastUv = "vEnvironmentUv1";
  for (let layer = 1; layer <= layers; layer++)
    if (source.IntParams[`g_nUVSet${layer}`] === 2) lastUv = `vEnvironmentUv${layer}`;
  if (source.IntParams.F_DETAIL_NORMAL)
    for (let layer = 1; layer <= layers; layer++)
      if (source.IntParams[`g_nDetailUVSet${layer}`] === 2) lastUv = `vEnvironmentDetailUv${layer}`;
  const heights = Array.from({ length: layers - 1 }, (_, i) => {
    const layer = i + 2;
    return `vec4 height${layer}=${environmentRead(source, layer, "Height", `vEnvironmentUv${layer}`, false, parameters)};float tintMask${layer}=0.0;float h${layer}=(height${layer}.r-${parameters.float(source, `g_flHeightMapZeroPoint${layer}`, 0.5)})*${parameters.float(source, `g_flHeightMapScale${layer}`, 1)};`;
  }).join("\n");
  const overlay = source.IntParams.F_SHARED_COLOR_OVERLAY
    ? `

 vec3 overlayStrengths=${parameters.vector(source, "g_vColorOverlayLayerStrengths", [1, 1, 1], 3)},overlayMasks=${parameters.vector(source, "g_vColorOverlayTintMaskStrengths", [0, 0, 0], 3)};
 vec3 overlayTintMasks=vec3(tintMask1,${layers > 1 ? "tintMask2" : "0.0"},${layers > 2 ? "tintMask3" : "0.0"});
 vec3 overlayMask=mix(vec3(1.0)-overlayTintMasks,overlayTintMasks,step(vec3(0.0),overlayMasks));
 float overlayStrength=dot(environmentCoverage*overlayStrengths,mix(vec3(1.0),overlayMask,abs(overlayMasks)));
 if(overlayStrength>0.0){
 vec3 overlay=2.0*${environmentRead(source, 0, "SharedColorOverlay", "vEnvironmentOverlayUv", false, parameters)}.rgb-1.0;
 float bright=${parameters.float(source, "g_flOverlayBrightnessContrast", 1)},dark=${parameters.float(source, "g_flOverlayDarknessContrast", 1)};
 vec3 overlayFactor=max(vec3(0.0),vec3(1.0)+(vec3(1.0)-pow(vec3(1.0)-max(vec3(0.0),overlay),vec3(bright)))*bright+(pow(vec3(1.0)+min(vec3(0.0),overlay),vec3(dark))-vec3(1.0))*dark);
 environmentColorOut*=mix(vec3(1.0),overlayFactor,overlayStrength);
 }
 `
    : "";
  const maskModes = Array.from({ length: 3 }, (_, i) =>
    (source.IntParams[`g_nVertexColorMode${i + 1}`] ?? 0) === 0 ? 0 : 1,
  );
  const enableModes = Array.from({ length: 3 }, (_, i) =>
    i < layers && (source.IntParams[`g_nVertexColorMode${i + 1}`] ?? 0) !== 2 ? 1 : 0,
  );
  const biplanar =
    Array.from(
      { length: layers },
      (_, i) =>
        environmentUvSelection(source, i + 1) === 0 ||
        (!!source.IntParams.F_DETAIL_NORMAL && environmentUvSelection(source, i + 1, true) === 0),
    ).some(Boolean) ||
    (!!source.IntParams.F_SHARED_COLOR_OVERLAY && environmentUvSelection(source, 0) === 0);
  const surfaceGradients = Array.from({ length: layers }, (_, i) => {
    const layer = i + 1;
    return environmentUvSelection(source, layer) === 0
      ? ""
      : `vec4 environmentSurfaceGradient${layer}=vec4(dFdx(vEnvironmentUv${layer}),dFdy(vEnvironmentUv${layer}));`;
  }).join("\n");
  const composition = `
 ${surfaceGradients}
 vec3 environmentFrameN=vNormal/length(vNormal),environmentFrameT=vTangent/length(vNormal);
 vec3 environmentFrameB=cross(vNormal,vTangent)*vEnvironmentHandedness/length(vNormal);
 vec3 environmentGeometric=dot(vNormal,vNormal)>=1.01?normalize(vEnvironmentCentroidNormal):normalize(vNormal);
 ${source.IntParams.F_DONT_FLIP_BACKFACE_NORMALS ? "" : `environmentFrameN*=faceDirection;environmentGeometric*=faceDirection;`}
 vec3 environmentPx=dFdx(-vViewPosition),environmentPy=dFdy(-vViewPosition);
 vec2 environmentUx=dFdx(${lastUv}),environmentUy=dFdy(${lastUv});
 float environmentDet=environmentUx.x*environmentUy.y-environmentUx.y*environmentUy.x;
 float environmentSign=environmentDet<0.0?-1.0:1.0;
 vec3 environmentUvN=environmentFrameN;
 vec3 environmentUvT=(environmentPx-environmentUvN*dot(environmentPx,environmentUvN))*(environmentUy.y*environmentSign)+(environmentPy-environmentUvN*dot(environmentPy,environmentUvN))*(-environmentUx.y*environmentSign);
 if(abs(environmentDet)>0.0)environmentUvT=normalize(environmentUvT);
 vec3 environmentUvB=cross(environmentUvN,environmentUvT)*environmentSign*(dot(environmentPy,cross(environmentUvN,environmentPx))<0.0?-1.0:1.0);
 ${biplanar ? environmentProjectionSetup : ""}
 ${tintLayer(source, 1, layers, parameters)}
 ${normalLayer(source, 1, parameters)}
 ${heights}
 vec3 environmentColorOut=color1.rgb,environmentNormalOut=N1;
 float environmentAO=ao1,environmentRoughness=R1,environmentMetalness=height1.a,environmentOpacity=color1.a;
 float environmentWeight2=0.0,environmentWeight3=0.0;
 float environmentPaint2=clamp(vEnvironmentBlend.x*1.1-.05,0.0,1.0),environmentPaint3=clamp(vEnvironmentBlend.y*1.1-.05,0.0,1.0);
 vec3 environmentBlendDistance=normalize(vec3(clamp(1.0-environmentPaint2-environmentPaint3,0.0,1.0),environmentPaint2,environmentPaint3));
 float h1=(height1.r-${parameters.float(source, "g_flHeightMapZeroPoint1", 0.5)})*${parameters.float(source, "g_flHeightMapScale1", 1)};
 float q1=pow(environmentLod(vEnvironmentUv1,environmentHeight1Size()),2.0)*(.0125+fwidth(height1.r*${parameters.float(source, "g_flHeightMapScale1", 1)}))*.02*${parameters.float(source, "g_flBlendSoftnessDistanceModifierStrength", 1)}*environmentBlendDistance.x;
 float q2=0.0,q3=0.0,environmentCarry2=0.0,environmentUnder2=h1,environmentSigned2=0.0;
 ${source.IntParams.F_WETNESS ? `float environmentWetHeight=h1*${parameters.float(source, "g_flWetnessUnderlyingHeightMapInfluence", 1)}+.5;` : ""}
 ${layers > 1 ? stageCode(source, 2, modern, parameters) : ""}
 ${layers > 2 ? stageCode(source, 3, modern, parameters) : ""}
 vec3 environmentCoverage=vec3(clamp(1.0-environmentWeight2*(1.0-environmentWeight3)-environmentWeight3,0.0,1.0),environmentWeight2*(1.0-environmentWeight3),environmentWeight3);
 ${overlay}
 float vertexMask=clamp(dot(environmentCoverage,vec3(tintMask1,${layers > 1 ? "tintMask2" : "0.0"},${layers > 2 ? "tintMask3" : "0.0"}))+dot(environmentCoverage,${v(maskModes, 3)}),0.0,1.0);
 float vertexAmount=clamp(vertexMask*dot(environmentCoverage.xy,${v(enableModes.slice(0, 2), 2)})+environmentCoverage.z*${n(enableModes[2])},0.0,1.0);
 environmentColorOut*=mix(vec3(1.0),vEnvironmentPaint.rgb,vertexAmount);
 ${source.IntParams.F_WETNESS ? `float environmentWetDarkening=mix(${parameters.float(source, "g_flWetnessDarkeningStrength1", 1)},${parameters.float(source, "g_flWetnessDarkeningStrength2", 1)},environmentCoverage.y*${parameters.float(source, "g_flColorReplace2", 1)});${layers === 3 ? `environmentWetDarkening=mix(environmentWetDarkening,${parameters.float(source, "g_flWetnessDarkeningStrength3", 1)},environmentCoverage.z*${parameters.float(source, "g_flColorReplace3", 1)});` : ""}${environmentWetnessCode(source, parameters)}` : ""}
 diffuseColor.rgb=environmentColorOut;
 ${source.IntParams.F_ALPHA_TEST ? `${environmentAlphaTest(source, "vEnvironmentUv1")}diffuseColor.a=1.0;` : ""}
 normal=environmentNormalOut;roughnessFactor=environmentRoughness;metalnessFactor=environmentMetalness;
 vec3 mapN=normalize(transpose(tbn)*normal);
 `;
  shader.fragmentShader = `${shared}\n${environmentProjectionShared}\n${source.IntParams.F_WETNESS ? environmentWetnessShared : ""}\n${source.IntParams.F_ALPHA_TEST ? environmentAlphaShared : ""}\n${binding.code}\n${shader.fragmentShader}`;
  // Normal frames are defined only after normal_fragment_begin; compute every
  // sequential channel here, before lighting consumes diffuse/roughness/metal.
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <map_fragment>", "")
    .replace("#include <color_fragment>", "")
    .replace("#include <normal_fragment_maps>", composition)
    .replace(
      "#include <aomap_fragment>",
      `reflectedLight.directDiffuse*=mix(1.0,environmentAO,${parameters.float(source, "g_flAmbientOcclusionDirectDiffuse", 1)});reflectedLight.indirectDiffuse*=environmentAO;reflectedLight.directSpecular*=mix(1.0,environmentAO,${parameters.float(source, "g_flAmbientOcclusionDirectSpecular", 1)});reflectedLight.indirectSpecular*=environmentAO;`,
    );
  applySourceSurface(shader, { directSpecular: true, indirectSpecular: true }, lookup);
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_physical_fragment>",
    `#include <lights_physical_fragment>\nmaterial.specularColor=vec3(${source.IntParams.F_WETNESS ? "environmentWetReflectance" : parameters.float(source, "g_flReflectance", 0.04)});material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);`,
  );
  if (source.IntParams.F_WETNESS)
    shader.fragmentShader = shader.fragmentShader.replace(
      "saturate(dot(geometryNormal, directLight.direction)) * directLight.color * BRDF_Lambert(material.diffuseContribution)",
      "environmentWetDiffuse(geometryNormal,directLight.direction) * directLight.color * BRDF_Lambert(material.diffuseContribution)",
    );
  const declaration = parameters.bind(shader);
  shader.vertexShader = declaration + "\n" + shader.vertexShader;
  shader.fragmentShader = declaration + "\n" + shader.fragmentShader;
  return { ...binding, uniformVectors: parameters.vectorCount };
}
