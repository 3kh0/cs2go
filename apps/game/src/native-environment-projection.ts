import type { SourceEnvironmentMaterial } from "./native-map-environment";
const literal = (value: number) => {
  const raw = Number.isInteger(value) ? `${value}.0` : `${value}`;
  return value < 0 ? `(${raw})` : raw;
};
const vector = (values: readonly number[]) => `vec2(${values.slice(0, 2).map(literal).join(",")})`;
export function environmentUvSelection(
  source: SourceEnvironmentMaterial,
  layer: number,
  detail = false,
) {
  const base =
    source.IntParams[layer ? `g_nUVSet${layer}` : "g_nColorOverlayUVSet"] ?? (layer ? 1 : 2);
  const selected = detail ? (source.IntParams[`g_nDetailUVSet${layer}`] ?? -1) : base;
  return selected === -1 ? base : selected;
}
export function environmentProjectionScale(
  source: SourceEnvironmentMaterial,
  layer: number,
  detail = false,
) {
  const base = source.VectorParams[
    layer ? `g_vTexCoordScale${layer}` : "g_vOverlayTexCoordScale"
  ] ?? [1, 1];
  if (!detail) return vector(base);
  const scale = source.VectorParams[`g_vDetailTexCoordScale${layer}`] ?? [1, 1];
  return vector(
    (source.IntParams[`g_nDetailUVSet${layer}`] ?? -1) === -1
      ? scale.map((value, i) => value * base[i])
      : scale,
  );
}
export function environmentRead(
  source: SourceEnvironmentMaterial,
  layer: number,
  kind: string,
  uv: string,
  detail = false,
) {
  const name = layer ? `environment${kind}${layer}` : "environmentSharedColorOverlay";
  if (environmentUvSelection(source, layer, detail) !== 0) return `${name}Read(${uv})`;
  const scale = environmentProjectionScale(source, layer, detail);
  const read = (plane: string) =>
    `${name}GradRead(environmentProjected${plane}*${scale},environmentProjectedDx${plane}*${scale},environmentProjectedDy${plane}*${scale})`;
  return `(${read("A")}*environmentProjectionWeights.x+${kind === "Height" ? `${read("B")}*environmentProjectionWeights.y` : `(environmentProjectionWeights.y>0.0?${read("B")}*environmentProjectionWeights.y:vec4(0.0))`})`;
}
export function environmentProjectedNormal(
  source: SourceEnvironmentMaterial,
  layer: number,
  detail = false,
) {
  const name = `environment${detail ? "NormalDetail" : "Normal"}${layer}`;
  const scale = environmentProjectionScale(source, layer, detail);
  const sample = (plane: string) =>
    `${name}GradRead(environmentProjected${plane}*${scale},environmentProjectedDx${plane}*${scale},environmentProjectedDy${plane}*${scale}).rg`;
  return `normalize(environmentGeometric+environmentSourceNormalToView(environmentProjectionPerturb(${sample("A")},environmentProjectionA)*environmentProjectionWeights.x+(environmentProjectionWeights.y>0.0?environmentProjectionPerturb(${sample("B")},environmentProjectionB)*environmentProjectionWeights.y:vec3(0.0))))`;
}
/** Native PS79117–18,410–494; coordinates include the importer's final
 * Source→game rotation, not merely the original S2V export basis. */
export const environmentProjectionShared = `
uniform mat4 environmentWorldToNative;
uniform mat3 environmentWorldToNativeNormal,environmentNativeToWorldNormal;
uniform float environmentNativeUnitScale;
vec3 environmentWorldToSource(vec3 value){return vec3(value.x,-value.z,value.y);}
vec3 environmentSourceToWorld(vec3 value){return vec3(value.x,value.z,-value.y);}
vec3 environmentNativePosition(vec3 viewPosition){return environmentWorldToSource((environmentWorldToNative*vec4(cameraPosition+transpose(mat3(viewMatrix))*viewPosition,1.0)).xyz)/.0254;}
vec3 environmentViewNormalToSource(vec3 value){return environmentWorldToSource(environmentWorldToNativeNormal*transpose(mat3(viewMatrix))*value);}
vec3 environmentSourceNormalToView(vec3 value){return mat3(viewMatrix)*environmentNativeToWorldNormal*environmentSourceToWorld(value);}
vec3 environmentDecodePacked(vec2 value){vec2 xy=vec2(value.r+value.g-1.003921627998352,value.r-value.g);return normalize(vec3(xy,1.0-abs(xy.x)-abs(xy.y)));}
vec3 environmentProjectionPerturb(vec2 packedValue,ivec2 axes){
 vec3 decoded=environmentDecodePacked(packedValue);
 vec3 U=axes.x==1?vec3(0.0,1.0,0.0):vec3(-1.0,0.0,0.0);
 vec3 V=axes.y==1?vec3(0.0,-1.0,0.0):vec3(0.0,0.0,1.0);
 return U*decoded.x+V*decoded.y;
}
`;
export const environmentProjectionSetup = `
 vec3 environmentSourcePosition=environmentNativePosition(-vViewPosition);
 vec3 environmentSourceNormal=environmentViewNormalToSource(environmentGeometric);
 vec3 environmentAbsNormal=abs(environmentSourceNormal);
 ivec3 environmentMajor=environmentAbsNormal.x>environmentAbsNormal.y&&environmentAbsNormal.x>environmentAbsNormal.z?ivec3(0,1,2):environmentAbsNormal.y>environmentAbsNormal.z?ivec3(1,2,0):ivec3(2,0,1);
 ivec3 environmentMinor=environmentAbsNormal.x<environmentAbsNormal.y&&environmentAbsNormal.x<environmentAbsNormal.z?ivec3(0,1,2):environmentAbsNormal.y<environmentAbsNormal.z?ivec3(1,2,0):ivec3(2,0,1);
 ivec3 environmentMiddle=ivec3(3)-environmentMinor-environmentMajor;
 // Native exact three-way ties produce index -1. This explicit bounded
 // fallback is a WebGL safety choice for otherwise undefined native indexing.
 if(any(lessThan(environmentMiddle,ivec3(0))))environmentMiddle=ivec3(1,2,0);
 ivec2 environmentProjectionA=environmentMajor.x==1?environmentMajor.zy:environmentMajor.yz;
 ivec2 environmentProjectionB=environmentMiddle.x==1?environmentMiddle.zy:environmentMiddle.yz;
 vec2 environmentProjectionWeights=clamp((vec2(environmentAbsNormal[environmentMajor.x],environmentAbsNormal[environmentMiddle.x])-.5773000121116638)*2.365744113922119,0.0,1.0);
 float environmentProjectionSum=environmentProjectionWeights.x+environmentProjectionWeights.y;
 environmentProjectionWeights=environmentProjectionSum>0.0?environmentProjectionWeights/environmentProjectionSum:vec2(1.0,0.0);
 vec3 environmentQ=environmentSourcePosition*vec3(-1.0,1.0,-1.0)/64.0;
 vec3 environmentQx=dFdx(environmentQ),environmentQy=dFdy(environmentQ);
 vec2 environmentProjectedA=vec2(environmentQ[environmentProjectionA.x],environmentQ[environmentProjectionA.y]);
 vec2 environmentProjectedB=vec2(environmentQ[environmentProjectionB.x],environmentQ[environmentProjectionB.y]);
 vec2 environmentProjectedDxA=vec2(environmentQx[environmentProjectionA.x],environmentQx[environmentProjectionA.y]);
 vec2 environmentProjectedDyA=vec2(environmentQy[environmentProjectionA.x],environmentQy[environmentProjectionA.y]);
 vec2 environmentProjectedDxB=vec2(environmentQx[environmentProjectionB.x],environmentQx[environmentProjectionB.y]);
 vec2 environmentProjectedDyB=vec2(environmentQy[environmentProjectionB.x],environmentQy[environmentProjectionB.y]);
`;
