import * as T from "three";
import { assetFetch } from "./asset-url";
import { fetchGzipped } from "./gltf";

// Dust's legacy path follows VRF 5564866 envmap.slang/envmap_data.slang.
// Mirage's 8.2 path follows VRF 20.1 (9e2e6c7) environment.slang/SceneEnvMap.cs.
// These are renderer reconstructions, not Valve's native viewmodel binding code.
// MIT, Copyright (c) 2015 ValveResourceFormat Contributors.
// Full notice: packages/assets/public/models/maps/licenses/ValveResourceFormat-MIT.txt.

interface Volume {
  index: number;
  origin: number[];
  min: number[];
  max: number[];
  fade: number[];
  normalizationSH: number[];
}
interface Manifest {
  lightmapVersion?: [number, number];
  gpuBytes: number;
  lastLod: number;
  arrays: {
    file: string;
    layers: number;
    gpuBytes: number;
    mips: { width: number; height: number; bytes: number }[];
  }[];
  volumes: Volume[];
}
export interface SourceReflections {
  lightmapVersion?: [number, number];
  lastLod?: number;
  textures: T.CompressedArrayTexture[];
  combined?: boolean;
  volumes: Manifest["volumes"];
  uniforms: {
    origin: T.Vector3;
    index: number;
    mins: T.Vector3;
    maxs: T.Vector3;
    invEdge: T.Vector3;
    sh: T.Vector4;
  }[];
}
const directory = "/models/maps/lighting/reflections/";
export async function loadSourceReflections(
  renderer: T.WebGLRenderer,
  preferCombined = false,
  bundle = { directory, manifest: "source.json", volumes: 43 },
): Promise<SourceReflections | undefined> {
  if (
    !renderer.extensions.has("EXT_texture_compression_bptc") ||
    renderer.capabilities.maxFragmentUniforms < 512
  )
    return undefined;
  const response = await assetFetch(bundle.directory + bundle.manifest);
  if (!response.ok) throw new Error("Native reflection metadata unavailable");
  const manifest = (await response.json()) as Manifest;
  if (
    manifest.volumes.length !== bundle.volumes ||
    manifest.arrays.length !== Math.ceil(bundle.volumes / 42) ||
    manifest.gpuBytes > 32 * 1024 * 1024 ||
    manifest.lastLod !==
      (manifest.lightmapVersion?.[0] === 8 && manifest.lightmapVersion[1] >= 2 ? 6 : 5)
  )
    throw new Error("Invalid native reflection budget/layout");
  let textures = await Promise.all(
    manifest.arrays.map(async (entry) => {
      const bytes = await fetchGzipped(bundle.directory + entry.file);
      if (bytes.byteLength !== entry.gpuBytes || entry.layers > 256)
        throw new Error("Invalid native reflection array");
      let offset = 0;
      const mips = entry.mips.map((mip) => {
        const data = new Uint8Array(bytes, offset, mip.bytes);
        offset += mip.bytes;
        return { data, width: mip.width, height: mip.height };
      });
      if (offset !== bytes.byteLength || mips.length !== 7)
        throw new Error("Invalid native reflection mips");
      const texture = new T.CompressedArrayTexture(
        mips,
        256,
        256,
        entry.layers,
        T.RGB_BPTC_UNSIGNED_Format,
      );
      texture.colorSpace = T.NoColorSpace;
      texture.minFilter = T.LinearMipmapLinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.needsUpdate = true;
      return texture;
    }),
  );
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const layers = manifest.arrays.reduce((sum, entry) => sum + entry.layers, 0);
  const combined =
    textures.length === 1 ||
    (preferCombined && gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) >= layers);
  if (combined && textures.length === 2) {
    const mips = textures[0].mipmaps.map((mip, index) => {
      const first = mip.data as Uint8Array,
        last = textures[1].mipmaps[index].data as Uint8Array;
      const data = new Uint8Array(first.byteLength + last.byteLength);
      data.set(first);
      data.set(last, first.byteLength);
      return { data, width: mip.width, height: mip.height };
    });
    const texture = new T.CompressedArrayTexture(
      mips,
      256,
      256,
      layers,
      T.RGB_BPTC_UNSIGNED_Format,
    );
    texture.colorSpace = T.NoColorSpace;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
    textures = [texture];
  }
  return {
    lightmapVersion: manifest.lightmapVersion,
    lastLod: manifest.lastLod,
    textures,
    combined,
    volumes: manifest.volumes,
    uniforms: manifest.volumes.map((v) => ({
      origin: new T.Vector3().fromArray(v.origin),
      index: v.index,
      mins: new T.Vector3().fromArray(v.min),
      maxs: new T.Vector3().fromArray(v.max),
      invEdge: new T.Vector3(
        ...(v.fade.map((distance) => (distance > 0 ? 1 / distance : 3.402823466e38)) as [
          number,
          number,
          number,
        ]),
      ),
      sh: new T.Vector4().fromArray(v.normalizationSH),
    })),
  };
}

export function sourceReflectionCandidates(bounds: T.Box3, data: SourceReflections) {
  return data.volumes.flatMap((v, index) => {
    const lo = [bounds.min.x / 0.0254, -bounds.max.z / 0.0254, bounds.min.y / 0.0254];
    const hi = [bounds.max.x / 0.0254, -bounds.min.z / 0.0254, bounds.max.y / 0.0254];
    return v.origin.every(
      (origin, axis) => lo[axis] <= origin + v.max[axis] && hi[axis] >= origin + v.min[axis],
    )
      ? [index]
      : [];
  });
}

/** Actor-local uniform window; textures and native cubemap indices remain shared. */
export interface SourceReflectionBinding extends SourceReflections {
  source: SourceReflections;
  count: { value: number };
  candidates: Int32Array;
}
export function createSourceReflectionBinding(
  data: SourceReflections,
  capacity = 8,
): SourceReflectionBinding {
  return {
    ...data,
    source: data,
    count: { value: 0 },
    candidates: Int32Array.from({ length: capacity }, (_, index) => index),
    uniforms: Array.from({ length: capacity }, () => ({
      origin: new T.Vector3(),
      index: 0,
      mins: new T.Vector3(),
      maxs: new T.Vector3(),
      invEdge: new T.Vector3(),
      sh: new T.Vector4(),
    })),
  };
}
/** Preserve native priority order, bounded to the actor's conservative world bounds. */
export function updateSourceReflectionBinding(binding: SourceReflectionBinding, bounds: T.Box3) {
  const indices = sourceReflectionCandidates(bounds, binding.source);
  binding.count.value = Math.min(indices.length, binding.uniforms.length);
  for (let i = 0; i < binding.count.value; i++) {
    const source = binding.source.uniforms[indices[i]],
      target = binding.uniforms[i];
    target.origin.copy(source.origin);
    target.index = source.index;
    target.mins.copy(source.mins);
    target.maxs.copy(source.maxs);
    target.invEdge.copy(source.invEdge);
    target.sh.copy(source.sh);
  }
  return indices.length;
}

// OpenGL cube addressing over native face layers. Interior sampling uses the
// hardware filter; edge taps cross to adjacent faces, including corner averages.
// ES 3.0 section 3.8.9.1 recommends the three-corner average but permits other
// hardware replacements. This does not promise bit-identical cube corners.
export const sourceCubeSampling = `
uniform highp sampler2DArray sourceReflectionCubes0;
#ifndef SOURCE_REFLECTION_SINGLE_ARRAY
uniform highp sampler2DArray sourceReflectionCubes1;
#endif
vec3 sourceCubeAddress(vec3 d) {
  vec3 a=abs(d); vec2 uv; float face;
  if(a.x>=a.y && a.x>=a.z) {face=d.x>0.0?0.0:1.0;uv=vec2(d.x>0.0?-d.z:d.z,-d.y)/a.x;}
  else if(a.y>=a.z) {face=d.y>0.0?2.0:3.0;uv=vec2(d.x,d.y>0.0?d.z:-d.z)/a.y;}
  else {face=d.z>0.0?4.0:5.0;uv=vec2(d.z>0.0?d.x:-d.x,-d.y)/a.z;}
  return vec3(uv*0.5+0.5,face);
}
vec3 sourceCubeDirection(vec2 uv,int face) {
  vec2 p=uv*2.0-1.0;
  if(face==0)return vec3(1.0,-p.y,-p.x);
  if(face==1)return vec3(-1.0,-p.y,p.x);
  if(face==2)return vec3(p.x,1.0,p.y);
  if(face==3)return vec3(p.x,-1.0,-p.y);
  if(face==4)return vec3(p.x,-p.y,1.0);
  return vec3(-p.x,-p.y,-1.0);
}
vec3 sourceCubeFetch(ivec2 xy,int face,int cube,int level) {
  #ifdef SOURCE_REFLECTION_SINGLE_ARRAY
  return texelFetch(sourceReflectionCubes0,ivec3(xy,cube*6+face),level).rgb;
  #else
  return cube<42 ? texelFetch(sourceReflectionCubes0,ivec3(xy,cube*6+face),level).rgb
    : texelFetch(sourceReflectionCubes1,ivec3(xy,(cube-42)*6+face),level).rgb;
  #endif
}
vec3 sourceCubeCrossTap(ivec2 pixel,int face,int cube,int level,int size) {
  vec3 a=sourceCubeAddress(sourceCubeDirection((vec2(pixel)+0.5)/float(size),face));
  return sourceCubeFetch(clamp(ivec2(a.xy*float(size)),ivec2(0),ivec2(size-1)),int(a.z),cube,level);
}
vec3 sourceCubeTap(ivec2 pixel,int face,int cube,int level,int size) {
  bool outsideX=pixel.x<0 || pixel.x>=size, outsideY=pixel.y<0 || pixel.y>=size;
  if(outsideX && outsideY) {
    ivec2 corner=clamp(pixel,ivec2(0),ivec2(size-1));
    return (sourceCubeFetch(corner,face,cube,level)+
      sourceCubeCrossTap(ivec2(pixel.x,corner.y),face,cube,level,size)+
      sourceCubeCrossTap(ivec2(corner.x,pixel.y),face,cube,level,size))/3.0;
  }
  return sourceCubeCrossTap(pixel,face,cube,level,size);
}
vec3 sourceCubeLevel(vec3 a,int cube,int level) {
  int size=256>>level;
  vec2 p=a.xy*float(size)-0.5;ivec2 base=ivec2(floor(p));vec2 f=fract(p);
  return mix(mix(sourceCubeTap(base,int(a.z),cube,level,size),sourceCubeTap(base+ivec2(1,0),int(a.z),cube,level,size),f.x),
    mix(sourceCubeTap(base+ivec2(0,1),int(a.z),cube,level,size),sourceCubeTap(base+ivec2(1),int(a.z),cube,level,size),f.x),f.y);
}
vec3 sourceCubeSample(vec3 direction,int cube,float lod) {
  vec3 a=sourceCubeAddress(direction);
  int upper=int(ceil(lod));float inset=0.5/float(256>>upper);
  if(all(greaterThanEqual(a.xy,vec2(inset))) && all(lessThanEqual(a.xy,vec2(1.0-inset)))) {
    #ifdef SOURCE_REFLECTION_SINGLE_ARRAY
    return textureLod(sourceReflectionCubes0,vec3(a.xy,float(cube*6)+a.z),lod).rgb;
    #else
    return cube<42 ? textureLod(sourceReflectionCubes0,vec3(a.xy,float(cube*6)+a.z),lod).rgb
      : textureLod(sourceReflectionCubes1,vec3(a.xy,float((cube-42)*6)+a.z),lod).rgb;
    #endif
  }
  return mix(sourceCubeLevel(a,cube,int(floor(lod))),sourceCubeLevel(a,cube,upper),fract(lod));
}
`;

/** Native 8.2 box projection, priority/edge blending and radiance normalization. */
export function applySourceReflections(
  shader: T.WebGLProgramParametersWithUniforms,
  data: SourceReflections,
  candidates: number[],
  options: {
    count?: { value: number };
    worldPosition?: string;
    worldNormal?: string;
    worldView?: string;
  } = {},
) {
  shader.uniforms.sourceReflectionCubes0 = { value: data.textures[0] };
  shader.uniforms.sourceReflectionCubes1 = { value: data.textures[1] ?? data.textures[0] };
  shader.uniforms.sourceEnvironments = { value: data.uniforms };
  const indices = new Int32Array(data.uniforms.length);
  indices.set(candidates);
  shader.uniforms.sourceEnvironmentCandidates = { value: indices };
  shader.uniforms.sourceEnvironmentCount = options.count ?? { value: candidates.length };
  shader.fragmentShader =
    (data.combined ? "#define SOURCE_REFLECTION_SINGLE_ARRAY\n" : "") +
    sourceCubeSampling +
    `
struct SourceEnvironment {vec3 origin;float index;vec3 mins;vec3 maxs;vec3 invEdge;vec4 sh;};
uniform SourceEnvironment sourceEnvironments[${data.uniforms.length}];
uniform int sourceEnvironmentCandidates[${data.uniforms.length}];
uniform int sourceEnvironmentCount;
vec3 sourceMapReflection(vec3 position,vec3 normal,vec3 viewDir,float roughness,vec3 irradiance) {
  vec3 R=reflect(-viewDir,normal);float r2=roughness*roughness;
  float smoothness=clamp(1.0-r2,0.0,1.0);
  R=normalize(mix(normal,R,smoothness*(sqrt(smoothness)+r2)));
  roughness=clamp(roughness,0.0,1.0);
  float coverage=0.01;vec3 color=vec3(0.0);vec4 sh=vec4(0.0);
  for(int i=0;i<${data.uniforms.length};i++) {
    if(i>=sourceEnvironmentCount)break;
    SourceEnvironment env=sourceEnvironments[sourceEnvironmentCandidates[i]];vec3 local=position-env.origin;
    vec3 fromMin=clamp((local-env.mins)*env.invEdge,0.0,1.0);
    vec3 fromMax=clamp((env.maxs-local)*env.invEdge,0.0,1.0);
    vec3 edges=min(fromMin,fromMax);float fade=min(edges.x,min(edges.y,edges.z));
    if(fade<=0.0)continue;
    float weight=fade*fade*(3.0-2.0*fade)*(1.0-coverage);
    vec3 farPlane=max((env.mins-local)/R,(env.maxs-local)/R);
    float distance=abs(min(farPlane.x,min(farPlane.y,farPlane.z)));
    vec3 hit=local+R*distance;
    ${data.lightmapVersion?.[0] === 8 && data.lightmapVersion[1] >= 2 ? "vec3 direction=normalize(hit);" : "vec3 direction=mix(hit,R,roughness);"}
    color+=sourceCubeSample(direction,int(env.index),sqrt(roughness)*${data.lastLod ?? 5}.0)*weight;
    sh+=env.sh*weight;coverage+=weight;
    if(coverage>0.99)break;
  }
  ${data.lightmapVersion?.[0] === 8 && data.lightmapVersion[1] >= 2 ? "sh/=coverage;" : "color/=coverage;sh/=coverage;"}
  float captured=dot(sh,vec4(normal,1.0));
  if(captured>0.0)color*=min(dot(irradiance,vec3(0.2125,0.7154,0.0721))/captured,${data.lightmapVersion?.[0] === 8 && data.lightmapVersion[1] >= 2 ? "max(roughness*2.0+1.0,1.0)" : "1.0"});
  return color;
}
` +
    shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_fragment_end>",
    `
    vec3 sourceReflectionWorld= ${options.worldPosition ?? "cameraPosition+transpose(mat3(viewMatrix))*(-vViewPosition)"};
    vec3 sourceReflectionNormal=${options.worldNormal ?? "inverseTransformDirection(geometryNormal,viewMatrix)"};
    vec3 sourceReflectionView=${options.worldView ?? "inverseTransformDirection(geometryViewDir,viewMatrix)"};
    radiance=sourceMapReflection(vec3(sourceReflectionWorld.x,-sourceReflectionWorld.z,sourceReflectionWorld.y)/0.0254,
      vec3(sourceReflectionNormal.x,-sourceReflectionNormal.z,sourceReflectionNormal.y),
      vec3(sourceReflectionView.x,-sourceReflectionView.z,sourceReflectionView.y),material.roughness,irradiance*RECIPROCAL_PI);
    #include <lights_fragment_end>`,
  );
}
