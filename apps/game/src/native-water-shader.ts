import * as T from "three";
import { nativeWaterPrepare } from "./native-water-core";
export interface NativeWaterMaterial {
  shader: string;
  nativeResource: string;
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
  textures: Record<string, string>;
  resolvedMaterialInputs: Record<string, number | number[]>;
}
const literal = (value: number) => {
  if (!Number.isFinite(value)) throw new Error("Nonfinite native water material input");
  const result = Number.isInteger(value) ? `${value}.0` : `${value}`;
  return value < 0 ? `(${result})` : result;
};
const vectorTypes: Record<string, number> = {
  g_vWaveScale: 2,
  g_vMapUVMin: 2,
  g_vMapUVMax: 2,
  g_vFoamColor: 3,
  g_vWaterFogColor: 3,
  g_vWaterDecayColor: 3,
  g_vCausticsTint: 3,
  g_vDebrisTint: 3,
};
export function nativeWaterConstants(source: NativeWaterMaterial) {
  if (
    source.shader !== "csgo_water_fancy.vfx" ||
    source.IntParams.F_REFLECTION_TYPE !== 1 ||
    source.IntParams.F_REFRACTION !== 1 ||
    source.IntParams.F_CAUSTICS !== 1 ||
    source.IntParams.F_INTERACTION_EFFECTS !== 1 ||
    source.resolvedMaterialInputs.g_flRainStrength !== 0
  )
    throw new Error("Unsupported native water selection; expected the proved Nuke quality1 family");
  const values = {
    ...source.IntParams,
    ...source.FloatParams,
    ...source.VectorParams,
    ...source.resolvedMaterialInputs,
  };
  const names = new Set(
    [
      ...nativeWaterPrepare.matchAll(/\bg_[bfnv]\w+/g),
      ...waterLighting.matchAll(/\bg_[bfnv]\w+/g),
    ].map((match) => match[0]),
  );
  return [...names]
    .map((name) => {
      const value = values[name];
      if (value === undefined) throw new Error(`Native water input missing: ${name}`);
      const size = vectorTypes[name];
      if (size) {
        const components = Array.isArray(value) ? value.slice(0, size) : Array(size).fill(value);
        if (components.length !== size) throw new Error(`Invalid native water vector: ${name}`);
        return `const vec${size} ${name}=vec${size}(${components.map(literal).join(",")});`;
      }
      if (Array.isArray(value)) throw new Error(`Unexpected native water scalar: ${name}`);
      if (name.startsWith("g_n")) return `const uint ${name}=${value}u;`;
      if (name.startsWith("g_b")) return `const int ${name}=${value};`;
      return `const float ${name}=${literal(value)};`;
    })
    .join("\n");
}
export const waterUniformDeclarations = `
uniform sampler2D g_tSceneDepth,g_tRefractionMap,g_tWaterEffectsMap,g_tBlueNoise;
uniform sampler2D g_tDebris,g_tDebrisNormal,g_tFoam,g_tWavesNormalHeight;
uniform float waterTime;
uniform vec4 waterViewport;
uniform vec2 waterDepthCoefficients;
uniform vec3 waterCameraSource,waterUpSource,waterForwardSource,waterSunDirection,waterSunColor;
uniform mat4 waterSourceProjectionTranspose,waterSourceViewTranspose,waterInverseProjection,waterCameraWorld;
varying vec3 vWaterSourcePosition,vWaterSourceNormal;
vec3 waterBrowserToSource(vec3 p){return vec3(p.x,-p.z,p.y)/.0254;}
vec3 waterReceiver(vec2 uv,float depth){vec4 view=waterInverseProjection*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);return waterBrowserToSource((waterCameraWorld*vec4(view.xyz/view.w,1.0)).xyz);}
struct NativeWaterState{
 vec3 normal,strongNormal,view,geometricNormal,fogColor,foamColor,debrisColor,refracted,decay,original;
 float distance,specularPower,fog,foam,debris,debrisCoverage,debrisEdge,refractionWeight,combinedMask,receiverDebris,depth,thickness,alphaEdge,reflectionWeight;
};
NativeWaterState waterState;
vec3 waterRadiance=vec3(0.0),waterSpecular=vec3(0.0);
`;
/** Native opaque composition; quality1 probes/light uploads use the bounded map adapter. */
export const waterLighting = `
vec3 waterComposite(vec3 directLight,vec3 indirectLight){
 vec3 diffuse=(directLight+indirectLight)*mix(mix(waterState.fogColor*waterState.fog*g_flWaterFogShadowStrength,waterState.foamColor,waterState.foam),waterState.debrisColor*(.5+.5*waterState.debrisCoverage)*g_vDebrisTint,clamp(waterState.debris-waterState.debrisEdge,0.0,1.0));
 diffuse=mix(diffuse,waterState.refracted*waterState.decay,waterState.refractionWeight);
 diffuse=mix(diffuse,waterState.fogColor*4.0*indirectLight,(waterState.fog*clamp(1.0-waterState.combinedMask+waterState.debrisEdge,0.0,1.0))*(1.0-g_flWaterFogShadowStrength));
 diffuse+=waterSpecular*waterState.reflectionWeight;
 diffuse*=mix(vec3(1.0),indirectLight*.75,clamp(waterState.receiverDebris*4.0,0.0,1.0)*(1.0-waterState.fog));
 // Current proved paint-debris=0 makes native oil modulation inactive.
 diffuse=mix(diffuse,waterRadiance*g_flEnvironmentMapBrightness,clamp(waterState.reflectionWeight,0.0,1.0));
 float edge=clamp(g_flEdgeHardness*waterState.depth+clamp(waterState.foam,0.0,1.0)+waterState.alphaEdge-.5,0.0,1.0);
 vec3 shoreline=waterState.original*mix(1.0,.6,clamp(waterState.thickness*60.0,0.0,1.0)/(1.0+waterState.distance*.002));
 return mix(shoreline,diffuse,edge);
}
void RE_Direct_NativeWater(const in IncidentLight directLight,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){
 // The native map importer stores Source brightness*pi for Three's Lambert.
 // This native lobe receives original radiance, like SourceSurface's adapter.
 vec3 nativeLight=directLight.color*RECIPROCAL_PI;
 vec3 worldL=inverseTransformDirection(directLight.direction,viewMatrix);vec3 lightSource=vec3(worldL.x,-worldL.z,worldL.y);
 vec3 specNormal=normalize(mix(waterState.geometricNormal,waterState.strongNormal,g_flSpecularNormalMultiple*(1.0+waterState.distance*.0005)));
 float NoR=clamp(dot(-lightSource,reflect(waterState.view,specNormal)),0.0,1.0);
 float lobe=pow(NoR,waterState.specularPower)*.1+pow(NoR,waterState.specularPower*10.0);
 waterSpecular+=nativeLight*(lobe+max(0.0,lobe-(1.0-g_flSpecularBloomBoostThreshold))*g_flSpecularBloomBoostStrength)*mix(1.0,g_flDebrisReflectance*.05,waterState.debris);
 reflectedLight.directDiffuse+=max(dot(geometryNormal,directLight.direction),0.0)*nativeLight;
}
void RE_IndirectSpecular_NativeWater(const in vec3 radiance,const in vec3 irradiance,const in vec3 clearcoatRadiance,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){waterRadiance=radiance;}
void RE_IndirectDiffuse_NativeWater(const in vec3 irradiance,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){reflectedLight.indirectDiffuse+=irradiance*RECIPROCAL_PI;}
#undef RE_Direct
#define RE_Direct RE_Direct_NativeWater
#undef RE_IndirectSpecular
#define RE_IndirectSpecular RE_IndirectSpecular_NativeWater
#undef RE_IndirectDiffuse
#define RE_IndirectDiffuse RE_IndirectDiffuse_NativeWater
`;
export function applyNativeWaterShader(
  shader: T.WebGLProgramParametersWithUniforms,
  source: NativeWaterMaterial,
) {
  const constants = nativeWaterConstants(source);
  shader.vertexShader = `varying vec3 vWaterSourcePosition,vWaterSourceNormal;uniform vec3 waterCameraSource;\n${shader.vertexShader}`;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <project_vertex>",
    `
 vec3 waterP=(modelMatrix*vec4(transformed,1.0)).xyz;
 vec3 sourceP=vec3(waterP.x,-waterP.z,waterP.y)/.0254;
 vec3 worldN=mat3(modelMatrix)*normal;vec3 sourceN=normalize(vec3(worldN.x,-worldN.z,worldN.y));
 vec3 waterV=normalize(waterCameraSource-sourceP);vec2 waterSlope=-waterV.xy/waterV.z*.7;
 vec2 waterShift=length(waterSlope)>0.0?-normalize(waterSlope)*clamp(length(waterSlope),0.0,20.0):vec2(0.0);
 sourceP+=sourceN*${literal(source.FloatParams.g_flWaterPlaneOffset)};sourceP.xy+=waterShift*${literal(source.FloatParams.g_flWaterPlaneOffset)};
 vWaterSourcePosition=sourceP;vWaterSourceNormal=sourceN;
 vec3 displacedWorld=vec3(sourceP.x,sourceP.z,-sourceP.y)*.0254;
 vec4 mvPosition=viewMatrix*vec4(displacedWorld,1.0);gl_Position=projectionMatrix*mvPosition;
 `,
  );
  shader.fragmentShader = `${waterUniformDeclarations}\n${constants}\n${nativeWaterPrepare}\n${shader.fragmentShader}`;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_physical_pars_fragment>",
    `#include <lights_physical_pars_fragment>\n${waterLighting}`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_maps>",
    "waterPrepare();normal=normalize(mat3(viewMatrix)*vec3(waterState.normal.x,waterState.normal.z,-waterState.normal.y));",
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <roughnessmap_fragment>",
    `float roughnessFactor=${literal(Number(source.resolvedMaterialInputs.g_vRoughness))};`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_physical_fragment>",
    "#include <lights_physical_fragment>\nmaterial.roughness=roughnessFactor;",
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
    "vec3 outgoingLight=waterComposite(reflectedLight.directDiffuse,reflectedLight.indirectDiffuse);",
  );
}
