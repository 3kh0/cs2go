import type { SourceEnvironmentMaterial } from "./native-map-environment";

const literal = (value: number) => {
  const raw = Number.isInteger(value) ? `${value}.0` : `${value}`;
  return value < 0 ? `(${raw})` : raw;
};
/** Native Vulkan program s258/d4, Steam build26445667. The browser uses
 * derivative-based LOD because WebGL2 has no textureQueryLod, and view-space
 * derivatives rather than Source's camera-relative world coordinates. */
export function environmentEffects(source: SourceEnvironmentMaterial, unitScale = 1) {
  const f = (name: string, fallback: number) => literal(source.FloatParams[name] ?? fallback);
  const v = (name: string, fallback: number[]) =>
    `vec${fallback.length}(${(source.VectorParams[name] ?? fallback).slice(0, fallback.length).map(literal).join(",")})`;
  const borderMode = source.IntParams.F_BORDER_BLEND_MODE_2 ?? 0;
  if (
    borderMode !== 0 ||
    source.IntParams.F_USE_NEW_BLENDING ||
    source.IntParams.F_BORDER_ROUGHNESS_2
  )
    throw new Error("Native environment effect variant requires its own recovered shader");
  const shared = `
float environmentLod(sampler2D image, vec2 uv) {
  vec2 dimensions=vec2(textureSize(image,0));
  vec2 dx=dFdx(uv)*dimensions,dy=dFdy(uv)*dimensions;
  return max(0.0,0.5*log2(max(max(dot(dx,dx),dot(dy,dy)),1e-12)));
}
vec3 environmentDecodeNormal(vec2 packed) {
  vec2 hemi=vec2(packed.r+packed.g-1.003921628,packed.r-packed.g);
  return normalize(vec3(hemi.x,-hemi.y,1.0-abs(hemi.x)-abs(hemi.y)));
}
`;
  const weights = `
    vec2 environmentBlendControl=clamp(vEnvironmentBlend.xy*1.1-0.05,0.0,1.0);
    vec3 environmentBlendDistance=normalize(vec3(clamp(1.0-environmentBlendControl.x-environmentBlendControl.y,0.0,1.0),environmentBlendControl));
    float environmentLod1=environmentLod(environmentHeight1,vEnvironmentUv1);
    float environmentLod2=environmentLod(environmentHeight2,vEnvironmentUv2);
    float environmentD1=environmentLod1*environmentLod1*(0.0125+fwidth(height1.r*${f("g_flHeightMapScale1", 1)}))*0.02*${f("g_flBlendSoftnessDistanceModifierStrength", 1)}*environmentBlendDistance.x;
    float environmentD2=environmentD1+environmentLod2*environmentLod2*(0.0125+fwidth(height2.r*${f("g_flHeightMapScale2", 1)}))*0.02*${f("g_flBlendSoftnessDistanceModifierStrength", 1)}*environmentBlendDistance.y;
    float environmentTSoft=max(min(vEnvironmentBlend.w+${f("g_flBlendSoftness2", 0.01)},1.0),0.0001)+environmentD1;
    float environmentSoft=environmentTSoft+environmentD2;
    float environmentZ1=${f("g_flHeightMapZeroPoint1", 0.5)}+environmentD1*.5;
    float environmentZ2=${f("g_flHeightMapZeroPoint2", 0.5)}+environmentD2*.5;
    float environmentA=${f("g_flHeightMapScale1", 1)}+environmentTSoft;
    float environmentB=${f("g_flHeightMapScale2", 1)}+environmentSoft;
    float environmentL=environmentB-2.0*environmentSoft;
    if(environmentL==0.0)environmentL=0.0001;
    float environmentE1=height1.r-environmentZ1,environmentE2=height2.r-environmentZ2;
    float environmentBF=environmentBlendControl.x;
    float environmentT=mix(-environmentZ1*environmentA-(1.0-environmentZ2)*environmentB-environmentSoft,(1.0-environmentZ1)*environmentA+environmentZ2*environmentB,environmentBF);
    float environmentH1=environmentE1*environmentA,environmentH2=environmentE2*environmentL+environmentT;
    vec2 environmentU=max(vec2(environmentH1,environmentH2)-max(environmentH1,environmentH2)+environmentSoft,0.0);
    float environmentMask=mix(.5,height2.r,${f("g_flMaskWithHeight2", 0)});
    float environmentW2=clamp(environmentU.y/(environmentU.x+0.0001+environmentU.y)*environmentMask*2.0,0.0,1.0);
    float environmentCompositeWeight=environmentW2>.05?environmentW2:0.0;
    vec2 weights=vec2(1.0-environmentCompositeWeight,environmentCompositeWeight);
    float environmentEdge=clamp(10.0*environmentBF,0.0,1.0)*clamp(10.0*(1.0-environmentBF),0.0,1.0);
    float environmentBorderA=environmentE1*(environmentA+${f("g_flBorderSoftness2", 0.1)});
    float environmentBorderC=environmentE2*(environmentL-${f("g_flBorderSoftness2", 0.1)})+environmentT-${f("g_flBorderSoftness2", 0.1)};
    vec2 environmentQ0=vec2(environmentBorderA,environmentBorderC+(${f("g_flBorderSpread2", 0)}+${f("g_flBorderOffset2", 0)})*environmentEdge);
    vec2 environmentR0=vec2(environmentBorderA+(${f("g_flBorderSpread2", 0)}-${f("g_flBorderOffset2", 0)})*environmentEdge,environmentBorderC);
    vec2 environmentQ=max(environmentQ0-max(environmentQ0.x,environmentQ0.y)+environmentSoft+${f("g_flBorderSoftness2", 0.1)},0.0);
    vec2 environmentR=max(environmentR0-max(environmentR0.x,environmentR0.y)+environmentSoft+${f("g_flBorderSoftness2", 0.1)},0.0);
    float environmentBorder=environmentQ.y/(environmentQ.x+.001+environmentQ.y)*(environmentR.x+.001)/(environmentR.x+.001+environmentR.y);
    vec2 environmentBorderAmount=clamp(${v("g_vBorderLayerAmount2", [1, 1])}*environmentMask*2.0,0.0,1.0)*environmentBorder;
    ${source.IntParams.g_bBorderTintMask2 ? "environmentBorderAmount*=mix(tintMask1,tintMask2,environmentW2);" : ""}
    color1.rgb*=mix(vec3(1.0),${v("g_vBorderTint2", [1, 1, 1])},environmentBorderAmount.x);
    color2.rgb*=mix(vec3(1.0),${v("g_vBorderTint2", [1, 1, 1])},environmentBorderAmount.y);
  `;
  const normal = `
    vec3 environmentN=nonPerturbedNormal;
    vec3 environmentN1=normalize(tbn*environmentDecodeNormal(normal1.rg));
    vec3 environmentN2=normalize(mix(environmentN,normalize(tbn*environmentDecodeNormal(normal2.rg)),${f("g_fTextureNormalContrast2", 1)}));
    vec3 environmentBevelN=environmentN1;
    ${
      source.FloatParams.g_flBevelStrength2
        ? `
    float environmentBevelA=environmentE1*(environmentA+${f("g_flBevelSoftness2", 0.1)});
    float environmentBevelC=environmentE2*(environmentL-${f("g_flBevelSoftness2", 0.1)})+environmentT+${f("g_flBevelSpread2", 0.1)};
    vec2 environmentBevelQ=max(vec2(environmentBevelA,environmentBevelC)-max(environmentBevelA,environmentBevelC)+environmentSoft+${f("g_flBevelSoftness2", 0.1)},0.0);
    float environmentBevelX=environmentBevelQ.y/(environmentBevelQ.x+.001+environmentBevelQ.y);
    float environmentPower=max(.2,2.0*${f("g_flBevelCurve2", 1)});
    float environmentPositive=pow(smoothstep(0.0,.5,environmentBevelX),environmentPower);
    // Explicit lowering preserves the native reversed smoothstep's polynomial.
    float environmentNegative=pow(1.0-smoothstep(.5,1.0,environmentBevelX),environmentPower);
    vec3 environmentBevelP=-vViewPosition+environmentN*((environmentPositive+1.0-environmentNegative)*${f("g_flBevelStrength2", 0)}*2.54*${literal(unitScale)});
    // Native viewport uses upper-left Y; WebGL uses lower-left Y.
    vec3 environmentC=cross(dFdx(environmentBevelP),dFdy(environmentBevelP));
    float environmentW=environmentPositive*environmentNegative*smoothstep(0.0,${f("g_flBevelSoftness2", 0.1)},environmentBF)*environmentEdge*mix(1.0,${v("g_vBevelLayerAmount2", [1, 1])}.x,environmentW2)*mix(${v("g_vBevelLayerAmount2", [1, 1])}.y,1.0,environmentW2);
    if(length(environmentC)>0.0)environmentBevelN=normalize(mix(environmentN,(environmentN1+normalize(mix(environmentN,normalize(environmentC),environmentW)))*.5,2.0));
    `
        : ""
    }
    normal=environmentW2>.05?mix(environmentBevelN,environmentN2,environmentW2*clamp(environmentH2+environmentZ2-environmentH1,0.0,1.0)*${f("g_flNormalReplace2", 1)}):environmentBevelN;
    normal=normalize(normal);
    vec3 mapN=normalize(transpose(tbn)*normal);
  `;
  const ao = `
    vec3 environmentAo1=${v("g_vAmbientOcclusionLevels1", [0, 0.5, 1])};
    vec3 environmentAo2=${v("g_vAmbientOcclusionLevels2", [0, 0.5, 1])};
    float environmentBaseAO=clamp(mix(environmentAo1.x,environmentAo1.z,pow(max(color1.a,0.0),environmentAo1.y)),0.0,1.0);
    float environmentSecondAO=clamp(mix(environmentAo2.x,environmentAo2.z,pow(max(color2.a,0.0),environmentAo2.y)),0.0,1.0);
    float environmentAO=mix(environmentBaseAO*mix(1.0,environmentSecondAO,environmentCompositeWeight*${f("g_flAOCombine2", 0)}),environmentSecondAO,environmentCompositeWeight*${f("g_flAOReplace2", 1)});
  `;
  return { shared, weights, normal, ao };
}
