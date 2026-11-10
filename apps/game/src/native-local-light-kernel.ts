/** Selected native complex PS5120/d4, build26445667, local-light loop672–920.
 * This contribution precedes live shadow-depth sampling. Cookie and runtime
 * shadow stages are separate. Entity→GPU transforms/units are not guessed. */
export interface NativeBakedLocalLight {
  /** GLSL column-major matrices in absolute Source-world coordinates. */
  projection: readonly number[];
  worldToBounds: readonly number[];
  positionRadius: readonly number[];
  depthFalloff: readonly number[];
  color: readonly number[];
  rotation: readonly number[];
  angularLine: readonly number[];
  barn: readonly number[];
  shadowWeights: readonly number[];
  minimumRoughness: number;
  cookieKind: 0 | 1;
  /** Browser logical array layer for a recovered planar native cookie. */
  cookieLayer?: number;
  cookieResource?: string;
  cookieTransform?: readonly number[];
}
export const NATIVE_LOCAL_LIGHT_RECORD_VECTORS = 16;
export const NATIVE_LOCAL_LIGHT_HEADER_VECTORS = 9;

/** Browser std140 transport of resolved inputs, not tool-label inference. */
export function packNativeLocalLights(
  records: readonly NativeBakedLocalLight[],
  worldToSource: readonly number[],
  sourceToWorld: readonly number[],
) {
  if (!records.length) throw new Error("Native local-light records are empty");
  const bytes = new ArrayBuffer(
    (NATIVE_LOCAL_LIGHT_HEADER_VECTORS + records.length * NATIVE_LOCAL_LIGHT_RECORD_VECTORS) * 16,
  );
  const floats = new Float32Array(bytes),
    words = new Uint32Array(bytes);
  const write = (offset: number, values: readonly number[], size: number, name: string) => {
    if (values.length !== size || values.some((value) => !Number.isFinite(Math.fround(value))))
      throw new Error(`Invalid resolved native local-light ${name}`);
    floats.set(values, offset);
  };
  write(0, worldToSource, 16, "world frame");
  write(16, sourceToWorld, 16, "inverse world frame");
  words[32] = records.length;
  records.forEach((record, index) => {
    if (record.cookieKind !== 0 && record.cookieKind !== 1)
      throw new Error("Unsupported native local-light cookie kind");
    if (
      record.cookieKind === 1 &&
      (!Number.isInteger(record.cookieLayer) || record.cookieLayer! < 0)
    )
      throw new Error("Invalid native planar cookie layer");
    const offset =
      (NATIVE_LOCAL_LIGHT_HEADER_VECTORS + index * NATIVE_LOCAL_LIGHT_RECORD_VECTORS) * 4;
    write(offset, record.projection, 16, "projection");
    write(offset + 16, record.worldToBounds, 16, "bounds");
    write(offset + 32, record.positionRadius, 4, "position/radius");
    write(offset + 36, record.depthFalloff, 4, "depth/range fades");
    write(
      offset + 40,
      [...record.color, record.cookieKind === 1 ? record.cookieLayer! + 1 : 0],
      4,
      "linear color/cookie",
    );
    write(offset + 44, record.rotation, 4, "rotation");
    write(offset + 48, record.angularLine, 3, "angular/line controls");
    write(
      offset + 52,
      record.cookieKind === 1 ? (record.cookieTransform ?? [0, 0, 1, 1]) : [...record.barn, 0],
      4,
      "barn/cookie controls",
    );
    write(offset + 56, record.shadowWeights, 4, "baked shadow weights");
    write(offset + 60, [record.minimumRoughness], 1, "roughness floor");
  });
  return words;
}

export const nativeLocalLightKernel = /* glsl */ `
struct NativeBakedLocalLight {
 mat4 projection; mat4 worldToBounds;
 vec4 positionRadius; vec4 depthFalloff; vec4 color; vec4 rotation;
 vec4 angularLine; vec4 barn; vec4 shadowWeights; vec4 roughness;
};
struct NativeLocalLightSample { vec3 color; vec3 direction; vec3 cookieUVW; float minimumRoughness; bool enabled; };
// Explicit lowering of native reversed-edge SmoothStep; GLSL's edge ordering
// restriction otherwise leaves rectangular barn falloff undefined on WebGL.
float nativeLocalStep(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
float nativeLocalUnitStep(float x){float t=clamp(x,0.,1.);return t*t*(3.-2.*t);}
NativeLocalLightSample nativeBakedLocalLight(NativeBakedLocalLight light,vec3 position,vec4 bakedShadow){
 NativeLocalLightSample result;result.color=vec3(0);result.direction=vec3(0);result.cookieUVW=vec3(0.,0.,-1.);result.minimumRoughness=0.;result.enabled=false;
 vec4 clip=light.projection*vec4(position,1.);vec3 p=clip.xyz/clip.w;
 if(!all(greaterThan(p,vec3(-1.,-1.,0.)))||!all(lessThan(p,vec3(1.)))||!all(lessThanEqual(abs((light.worldToBounds*vec4(position,1.)).xyz),vec3(1.))))return result;
 float y2=2.*light.rotation.y,z2=2.*light.rotation.z*light.rotation.z,x2=2.*light.rotation.x;
 float xy=x2*light.rotation.y,w2=2.*light.rotation.w,wz=w2*light.rotation.z;
 vec3 line=vec3(xy-wz,1.-x2*light.rotation.x-z2,y2*light.rotation.z+w2*light.rotation.x)*light.angularLine.z;
 float attenuation=light.depthFalloff.z>0.?nativeLocalUnitStep(p.z*light.depthFalloff.z):1.;
 if(light.depthFalloff.w>0.)attenuation*=nativeLocalUnitStep((1.-p.z)*light.depthFalloff.w);
 if(light.positionRadius.w!=0.){
  vec3 delta=light.positionRadius.xyz-position;float distanceSquared=dot(delta,delta),distance=sqrt(distanceSquared);
  vec3 closest=delta-line,segment=(delta+line)-closest;float projection=dot(-closest,segment);
  if(projection>0.)closest+=segment*min(1.,projection/dot(segment,segment));
  result.direction=delta/distance;
  vec3 axis=vec3(1.-y2*light.rotation.y-z2,xy+wz,x2*light.rotation.z-w2*light.rotation.y);
  attenuation*=light.positionRadius.w/max(distanceSquared,light.positionRadius.w);
  attenuation*=nativeLocalUnitStep(light.depthFalloff.x+light.depthFalloff.y*distance);
  attenuation*=clamp(light.angularLine.x+light.angularLine.y*dot(axis,normalize(closest)),0.,1.);
 }else result.direction=light.positionRadius.xyz;
 vec2 q=abs(p.xy);float shape;
 if(light.color.w>0.){shape=1.;result.cookieUVW=vec3((p.xy*vec2(.5,-.5)+vec2(.5))*light.barn.zw+light.barn.xy,light.color.w-1.);}
 else if(light.barn.z==0.)shape=nativeLocalStep(1.,light.barn.x,q.x)*nativeLocalStep(1.,light.barn.y,q.y);
 else{
  float exponent=2./light.barn.z,power=-.5*light.barn.z;
  float inner=light.barn.x*light.barn.y*pow(max(pow(light.barn.y*q.x,exponent)+pow(light.barn.x*q.y,exponent),1.1754943508222875e-38),power);
  float outer=pow(max(pow(q.x,exponent)+pow(q.y,exponent),1.1754943508222875e-38),power);
  shape=inner<outer?nativeLocalStep(outer,inner,1.):float(outer>1.);
 }
 result.color=light.color.rgb*(1.-dot(bakedShadow,light.shadowWeights))*attenuation*shape;
 result.minimumRoughness=light.roughness.x;result.enabled=true;return result;
}
`;
