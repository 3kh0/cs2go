import * as T from "three";
import { nativeWaterReflectionNormalGLSL } from "./native-water-reflection-normal";
import { assetFetch } from "./asset-url";
import { fetchGzipped } from "./gltf";
import { packSourceReflectionRecords } from "./source-reflection-field";

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
  worldToLocal?: number[];
  localToWorld?: number[];
  localMin?: number[];
  localMax?: number[];
  localFade?: number[];
  worldAABB?: number[][];
}
export interface SourceReflectionManifest {
  lightmapVersion?: [number, number];
  gpuBytes: number;
  lastLod: number;
  arrays: {
    file: string;
    firstCube?: number;
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
  volumes: SourceReflectionManifest["volumes"];
  cubeSize?: number;
  arraySplit?: number;
  uniforms: {
    origin: T.Vector3;
    index: number;
    mins: T.Vector3;
    maxs: T.Vector3;
    invEdge: T.Vector3;
    sh: T.Vector4;
    worldToLocal?: T.Matrix4;
    localToWorld?: T.Matrix4;
  }[];
}
const directory = "/models/maps/lighting/reflections/";
interface ReflectionBundle {
  directory: string;
  manifest: string;
  /** Optional checked source count, never a count borrowed from another map. */
  volumes?: number;
  /** Explicit per-map residency budget; existing bundles fit within 32 MiB. */
  maxGpuBytes?: number;
}

/** Validate complete native cube faces and mip payloads before allocating GPU resources. */
export function validateSourceReflections(
  manifest: SourceReflectionManifest,
  bundle: Pick<ReflectionBundle, "volumes" | "maxGpuBytes"> = {},
) {
  const invalid = () => {
    throw new Error("Invalid native reflection budget/layout");
  };
  const integer = (value: number) => Number.isSafeInteger(value) && value > 0;
  if (
    !manifest.arrays?.length ||
    !manifest.volumes?.length ||
    (bundle.volumes !== undefined && manifest.volumes.length !== bundle.volumes) ||
    !integer(manifest.gpuBytes) ||
    manifest.gpuBytes > (bundle.maxGpuBytes ?? 32 * 1024 * 1024)
  )
    invalid();
  const size = manifest.arrays[0].mips?.[0]?.width;
  const mipCount = manifest.arrays[0].mips?.length;
  if (!integer(size) || (size & (size - 1)) !== 0 || !integer(mipCount)) invalid();
  const native82 = manifest.lightmapVersion?.[0] === 8 && manifest.lightmapVersion[1] >= 2;
  if (
    !Number.isInteger(manifest.lastLod) ||
    manifest.lastLod < 0 ||
    manifest.lastLod >= mipCount ||
    (native82 && manifest.lastLod !== mipCount - 1)
  )
    invalid();
  let cubes = 0,
    gpuBytes = 0;
  for (const array of manifest.arrays) {
    if (
      !array.file ||
      array.file.includes("..") ||
      array.file.startsWith("/") ||
      (array.firstCube ?? (manifest.arrays.length === 1 ? 0 : NaN)) !== cubes ||
      !integer(array.layers) ||
      array.layers % 6 !== 0 ||
      array.mips.length !== mipCount
    )
      invalid();
    let arrayBytes = 0;
    for (const [level, mip] of array.mips.entries()) {
      const side = Math.max(1, size / 2 ** level);
      if (
        !Number.isInteger(side) ||
        mip.width !== side ||
        mip.height !== side ||
        mip.bytes !== Math.ceil(side / 4) ** 2 * 16 * array.layers
      )
        invalid();
      arrayBytes += mip.bytes;
    }
    if (arrayBytes !== array.gpuBytes) invalid();
    gpuBytes += arrayBytes;
    cubes += array.layers / 6;
  }
  const indices = new Set<number>();
  const affine = manifest.volumes.some((volume) => volume.worldToLocal || volume.localToWorld);
  for (const volume of manifest.volumes) {
    if (
      !Number.isInteger(volume.index) ||
      volume.index < 0 ||
      volume.index >= cubes ||
      indices.has(volume.index) ||
      ![volume.origin, volume.min, volume.max, volume.fade].every(
        (values) => values.length === 3 && values.every(Number.isFinite),
      ) ||
      volume.normalizationSH.length !== 4 ||
      !volume.normalizationSH.every(Number.isFinite) ||
      volume.min.some((value, axis) => value > volume.max[axis]) ||
      volume.fade.some((value) => value < 0)
    )
      invalid();
    indices.add(volume.index);
    if (affine) {
      for (const matrix of [volume.worldToLocal, volume.localToWorld])
        if (
          !matrix ||
          matrix.length !== 16 ||
          !matrix.every(Number.isFinite) ||
          matrix[3] !== 0 ||
          matrix[7] !== 0 ||
          matrix[11] !== 0 ||
          matrix[15] !== 1
        )
          invalid();
      const inverse = new T.Matrix4().fromArray(volume.worldToLocal!);
      const forward = new T.Matrix4().fromArray(volume.localToWorld!);
      if (
        inverse.determinant() === 0 ||
        forward.determinant() === 0 ||
        inverse
          .multiply(forward)
          .elements.some((value, index) => Math.abs(value - (index % 5 === 0 ? 1 : 0)) > 0.02)
      )
        invalid();
      if (
        ![volume.localMin, volume.localMax, volume.localFade].every(
          (values) => values?.length === 3 && values.every(Number.isFinite),
        ) ||
        !volume.worldAABB ||
        volume.worldAABB.length !== 2 ||
        volume.worldAABB.some((values) => values.length !== 3 || !values.every(Number.isFinite)) ||
        volume.worldAABB[0].some((value, axis) => value > volume.worldAABB![1][axis]) ||
        volume.localMin!.some((value, axis) => value > volume.localMax![axis]) ||
        volume.localFade!.some((value) => value < 0)
      )
        invalid();
    }
  }
  if (indices.size !== cubes || gpuBytes !== manifest.gpuBytes) invalid();
  return { size, layers: cubes * 6, mipCount };
}

export async function loadSourceReflections(
  renderer: T.WebGLRenderer,
  preferCombined = false,
  bundle: ReflectionBundle = { directory, manifest: "source.json", volumes: 43 },
): Promise<SourceReflections | undefined> {
  if (
    !renderer.extensions.has("EXT_texture_compression_bptc") ||
    renderer.capabilities.maxFragmentUniforms < 512
  )
    return undefined;
  const response = await assetFetch(bundle.directory + bundle.manifest);
  if (!response.ok) throw new Error("Native reflection metadata unavailable");
  const manifest = (await response.json()) as SourceReflectionManifest;
  const { size, layers } = validateSourceReflections(manifest, bundle);
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) as number;
  const combined =
    manifest.arrays.length === 1 ||
    ((preferCombined || manifest.arrays.length > 2) && layers <= maxLayers);
  // Keep reflection sampling within its existing two-sampler budget. Larger
  // source bundles can still use one array on GPUs with sufficient layer capacity.
  if (
    size > renderer.capabilities.maxTextureSize ||
    renderer.capabilities.maxTextures < (combined ? 1 : 2) ||
    (combined && layers > maxLayers) ||
    (!combined &&
      (manifest.arrays.length > 2 || manifest.arrays.some((entry) => entry.layers > maxLayers)))
  )
    return undefined;
  const payloads = await Promise.all(
    manifest.arrays.map(async (entry) => {
      const bytes = await fetchGzipped(bundle.directory + entry.file);
      if (bytes.byteLength !== entry.gpuBytes) throw new Error("Invalid native reflection array");
      let offset = 0;
      return entry.mips.map((mip) => {
        const data = new Uint8Array(bytes, offset, mip.bytes);
        offset += mip.bytes;
        return { data, width: mip.width, height: mip.height };
      });
    }),
  );
  // Combine CPU mip payloads before constructing textures, so no abandoned
  // array textures need disposing and each native face keeps its original index.
  const arrays =
    combined && payloads.length > 1
      ? [
          payloads[0].map((mip, level) => {
            const data = new Uint8Array(
              payloads.reduce((bytes, array) => bytes + array[level].data.byteLength, 0),
            );
            let offset = 0;
            for (const array of payloads) {
              data.set(array[level].data, offset);
              offset += array[level].data.byteLength;
            }
            return { data, width: mip.width, height: mip.height };
          }),
        ]
      : payloads;
  const textures = arrays.map((mips, index) => {
    const texture = new T.CompressedArrayTexture(
      mips,
      size,
      size,
      combined ? layers : manifest.arrays[index].layers,
      T.RGB_BPTC_UNSIGNED_Format,
    );
    texture.colorSpace = T.NoColorSpace;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  });
  return {
    lightmapVersion: manifest.lightmapVersion,
    lastLod: manifest.lastLod,
    cubeSize: size,
    arraySplit: manifest.arrays[0].layers / 6,
    textures,
    combined,
    volumes: manifest.volumes,
    uniforms: manifest.volumes.map((v) => ({
      origin: new T.Vector3().fromArray(v.origin),
      index: v.index,
      mins: new T.Vector3().fromArray(v.localMin ?? v.min),
      maxs: new T.Vector3().fromArray(v.localMax ?? v.max),
      invEdge: new T.Vector3(
        ...((v.localFade ?? v.fade).map((distance) =>
          distance > 0 ? 1 / distance : 3.402823466e38,
        ) as [number, number, number]),
      ),
      sh: new T.Vector4().fromArray(v.normalizationSH),
      worldToLocal: v.worldToLocal ? new T.Matrix4().fromArray(v.worldToLocal) : undefined,
      localToWorld: v.localToWorld ? new T.Matrix4().fromArray(v.localToWorld) : undefined,
    })),
  };
}

export function sourceReflectionCandidates(bounds: T.Box3, data: SourceReflections) {
  const minX = bounds.min.x / 0.0254;
  const minY = -bounds.max.z / 0.0254;
  const minZ = bounds.min.y / 0.0254;
  const maxX = bounds.max.x / 0.0254;
  const maxY = -bounds.min.z / 0.0254;
  const maxZ = bounds.max.y / 0.0254;
  const candidates: number[] = [];
  for (let index = 0; index < data.volumes.length; index++) {
    const v = data.volumes[index];
    if (
      minX <= (v.worldAABB?.[1][0] ?? v.origin[0] + v.max[0]) &&
      maxX >= (v.worldAABB?.[0][0] ?? v.origin[0] + v.min[0]) &&
      minY <= (v.worldAABB?.[1][1] ?? v.origin[1] + v.max[1]) &&
      maxY >= (v.worldAABB?.[0][1] ?? v.origin[1] + v.min[1]) &&
      minZ <= (v.worldAABB?.[1][2] ?? v.origin[2] + v.max[2]) &&
      maxZ >= (v.worldAABB?.[0][2] ?? v.origin[2] + v.min[2])
    )
      candidates.push(index);
  }
  return candidates;
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
      worldToLocal: new T.Matrix4(),
      localToWorld: new T.Matrix4(),
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
    if (source.worldToLocal) target.worldToLocal!.copy(source.worldToLocal);
    else target.worldToLocal!.identity();
    if (source.localToWorld) target.localToWorld!.copy(source.localToWorld);
    else target.localToWorld!.identity();
  }
  return indices.length;
}

// OpenGL cube addressing over native face layers. Interior sampling uses the
// hardware filter; edge taps cross to adjacent faces, including corner averages.
// ES 3.0 section 3.8.9.1 recommends the three-corner average but permits other
// hardware replacements. This does not promise bit-identical cube corners.
export const sourceCubeSampling = `
#ifndef SOURCE_REFLECTION_CUBE_SIZE
#define SOURCE_REFLECTION_CUBE_SIZE 256
#endif
#ifndef SOURCE_REFLECTION_ARRAY_SPLIT
#define SOURCE_REFLECTION_ARRAY_SPLIT 42
#endif
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
  return cube<SOURCE_REFLECTION_ARRAY_SPLIT ? texelFetch(sourceReflectionCubes0,ivec3(xy,cube*6+face),level).rgb
    : texelFetch(sourceReflectionCubes1,ivec3(xy,(cube-SOURCE_REFLECTION_ARRAY_SPLIT)*6+face),level).rgb;
  #endif
}
vec3 sourceCubeCrossTap(ivec2 pixel,int face,int cube,int level,int size) {
  vec3 a=sourceCubeAddress(sourceCubeDirection((vec2(pixel)+0.5)/float(size),face));
  return sourceCubeFetch(clamp(ivec2(a.xy*float(size)),ivec2(0),ivec2(size-1)),int(a.z),cube,level);
}
vec3 sourceCubeTap(ivec2 pixel,int face,int cube,int level,int size) {
  bool outsideX=pixel.x<0 || pixel.x>=size, outsideY=pixel.y<0 || pixel.y>=size;
  vec3 result=vec3(0.0);
  if(outsideX && outsideY) {
    ivec2 corner=clamp(pixel,ivec2(0),ivec2(size-1));
    result=(sourceCubeFetch(corner,face,cube,level)+
      sourceCubeCrossTap(ivec2(pixel.x,corner.y),face,cube,level,size)+
      sourceCubeCrossTap(ivec2(corner.x,pixel.y),face,cube,level,size))/3.0;
  } else result=sourceCubeCrossTap(pixel,face,cube,level,size);
  return result;
}
vec3 sourceCubeLevel(vec3 a,int cube,int level) {
  int size=SOURCE_REFLECTION_CUBE_SIZE>>level;
  vec2 p=a.xy*float(size)-0.5;ivec2 base=ivec2(floor(p));vec2 f=fract(p);
  return mix(mix(sourceCubeTap(base,int(a.z),cube,level,size),sourceCubeTap(base+ivec2(1,0),int(a.z),cube,level,size),f.x),
    mix(sourceCubeTap(base+ivec2(0,1),int(a.z),cube,level,size),sourceCubeTap(base+ivec2(1),int(a.z),cube,level,size),f.x),f.y);
}
vec3 sourceCubeSample(vec3 direction,int cube,float lod) {
  vec3 a=sourceCubeAddress(direction);
  int upper=int(ceil(lod));float inset=0.5/float(SOURCE_REFLECTION_CUBE_SIZE>>upper);
  vec3 result=vec3(0.0);
  // Keep unordered coordinates in the hardware sampler: D3D converts NaN
  // texture addresses to fixed-point zero. Manual fract/mix would propagate
  // NaN instead. Finite edge coordinates still use the seamless taps below.
  if(!(any(lessThan(a.xy,vec2(inset))) || any(greaterThan(a.xy,vec2(1.0-inset))))) {
    #ifdef SOURCE_REFLECTION_SINGLE_ARRAY
    result=textureLod(sourceReflectionCubes0,vec3(a.xy,float(cube*6)+a.z),lod).rgb;
    #else
    result=cube<SOURCE_REFLECTION_ARRAY_SPLIT ? textureLod(sourceReflectionCubes0,vec3(a.xy,float(cube*6)+a.z),lod).rgb
      : textureLod(sourceReflectionCubes1,vec3(a.xy,float((cube-SOURCE_REFLECTION_ARRAY_SPLIT)*6)+a.z),lod).rgb;
    #endif
  } else result=mix(sourceCubeLevel(a,cube,int(floor(lod))),sourceCubeLevel(a,cube,upper),fract(lod));
  return result;
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
    /** Actual water/complex quality1 bytecode differs from the legacy adapter. */
    nativeFamily?: "water" | "complex" | "glass" | "lightmapped";
    /** Complete BYTE4 instance IDs address the shared field with a fixed eight
     * slot loop. The caller proves coverage and hardware budgets before use. */
    instanceCandidates?: boolean;
    /** Complete records in one std140 block instead of default uniforms. */
    instanceField?: boolean;
    /** Immutable static windows use one default vec4-array upload. */
    packedUniforms?: boolean;
  } = {},
) {
  const affine = data.volumes.some((volume) => volume.worldToLocal);
  if (options.packedUniforms && (options.instanceCandidates || options.instanceField))
    throw new Error("Packed static reflection uniforms require a static candidate window");
  const packedWords = affine ? 13 : 5;
  if (
    options.instanceCandidates &&
    (data.uniforms.length !== data.volumes.length || data.uniforms.length > 255)
  )
    throw new Error("Instanced reflections require the complete BYTE-addressable field");
  shader.uniforms.sourceReflectionCubes0 = { value: data.textures[0] };
  shader.uniforms.sourceReflectionCubes1 = { value: data.textures[1] ?? data.textures[0] };
  if (options.packedUniforms)
    shader.uniforms.nativeReflectionWords = {
      value: packSourceReflectionRecords(data.uniforms, affine),
    };
  else if (!options.instanceField) shader.uniforms.sourceEnvironments = { value: data.uniforms };
  if (options.instanceField && !options.instanceCandidates)
    throw new Error("Native reflection field block requires instance candidate IDs");
  if (options.instanceCandidates) {
    const declarations =
      "flat varying vec4 vSourceReflectionCandidates0, vSourceReflectionCandidates1;\n";
    const main = /void\s+main\s*\(\s*\)\s*\{/;
    if (!main.test(shader.vertexShader))
      throw new Error("Native instance reflection vertex entry point unavailable");
    shader.vertexShader =
      "attribute vec4 sourceReflectionCandidates0, sourceReflectionCandidates1;\n" +
      declarations +
      shader.vertexShader.replace(
        main,
        `$&
 vSourceReflectionCandidates0=sourceReflectionCandidates0;
 vSourceReflectionCandidates1=sourceReflectionCandidates1;`,
      );
  } else {
    const indices = new Int32Array(data.uniforms.length);
    indices.set(candidates);
    shader.uniforms.sourceEnvironmentCandidates = { value: indices };
    shader.uniforms.sourceEnvironmentCount = options.count ?? { value: candidates.length };
  }
  shader.fragmentShader =
    (data.combined ? "#define SOURCE_REFLECTION_SINGLE_ARRAY\n" : "") +
    `#define SOURCE_REFLECTION_CUBE_SIZE ${data.cubeSize ?? 256}\n#define SOURCE_REFLECTION_ARRAY_SPLIT ${data.arraySplit ?? 42}\n` +
    sourceCubeSampling +
    `
struct SourceEnvironment {vec3 origin;float index;vec3 mins;vec3 maxs;vec3 invEdge;vec4 sh;${affine ? "mat4 worldToLocal;mat4 localToWorld;" : ""}};
${
  options.instanceField || options.packedUniforms
    ? `${options.instanceField ? `layout(std140) uniform NativeSourceReflectionField { vec4 nativeReflectionWords[${data.uniforms.length * 13}]; };` : `uniform vec4 nativeReflectionWords[${data.uniforms.length * packedWords}];`}
SourceEnvironment sourceFieldEnvironment(int index) {
  int at=index*${options.instanceField ? 13 : packedWords};
  vec4 first=nativeReflectionWords[at];
  return SourceEnvironment(first.xyz,first.w,nativeReflectionWords[at+1].xyz,nativeReflectionWords[at+2].xyz,nativeReflectionWords[at+3].xyz,nativeReflectionWords[at+4]${affine ? `,mat4(nativeReflectionWords[at+5],nativeReflectionWords[at+6],nativeReflectionWords[at+7],nativeReflectionWords[at+8]),mat4(nativeReflectionWords[at+9],nativeReflectionWords[at+10],nativeReflectionWords[at+11],nativeReflectionWords[at+12])` : ""});
}`
    : `uniform SourceEnvironment sourceEnvironments[${data.uniforms.length}];`
}
${
  options.instanceCandidates
    ? `flat varying vec4 vSourceReflectionCandidates0,vSourceReflectionCandidates1;
int sourceInstanceReflectionId(int slot) {
  if(slot<4)return int(floor(vSourceReflectionCandidates0[slot]+0.5));
  return int(floor(vSourceReflectionCandidates1[slot-4]+0.5));
}`
    : `uniform int sourceEnvironmentCandidates[${data.uniforms.length}];
uniform int sourceEnvironmentCount;`
}
${options.nativeFamily === "water" ? nativeWaterReflectionNormalGLSL : ""}
vec3 sourceMapReflection(vec3 position,vec3 normal,vec3 viewDir,float roughness,vec3 irradiance) {
  vec3 R=reflect(-viewDir,normal);float r2=roughness*roughness;
  float smoothness=clamp(1.0-r2,0.0,1.0);
  R=normalize(mix(normal,R,smoothness*(sqrt(smoothness)+r2)));
  roughness=clamp(roughness,0.0,1.0);
  float coverage=0.01;vec3 color=vec3(0.0);vec4 sh=vec4(0.0);
  for(int i=0;i<${options.instanceCandidates ? 8 : data.uniforms.length};i++) {
    ${
      options.instanceCandidates
        ? `int candidate=sourceInstanceReflectionId(i);
    if(candidate==255)continue;
    if(candidate<0||candidate>=${data.uniforms.length})continue;
    SourceEnvironment env=${options.instanceField ? "sourceFieldEnvironment(candidate)" : "sourceEnvironments[candidate]"};`
        : `if(i>=sourceEnvironmentCount)break;
    SourceEnvironment env=${options.packedUniforms ? "sourceFieldEnvironment(sourceEnvironmentCandidates[i])" : "sourceEnvironments[sourceEnvironmentCandidates[i]]"};`
    }
    vec3 local=${affine ? "(env.worldToLocal*vec4(position,1.0)).xyz" : "position-env.origin"};
    vec3 localRay=${affine ? "mat3(env.worldToLocal)*R" : "R"};
    vec3 fromMin=clamp((local-env.mins)*env.invEdge,0.0,1.0);
    vec3 fromMax=clamp((env.maxs-local)*env.invEdge,0.0,1.0);
    vec3 edges=min(fromMin,fromMax);float fade=min(edges.x,min(edges.y,edges.z));
    if(fade<=0.0)continue;
    float weight=fade*fade*(3.0-2.0*fade)*(1.0-coverage);
    vec3 farPlane=max((env.mins-local)/localRay,(env.maxs-local)/localRay);
    float distance=abs(min(farPlane.x,min(farPlane.y,farPlane.z)));
    vec3 hit=local+localRay*distance;
    ${affine ? "hit=(env.localToWorld*vec4(hit,1.0)).xyz-env.origin;" : ""}
    ${!options.nativeFamily && data.lightmapVersion?.[0] === 8 && data.lightmapVersion[1] >= 2 ? "vec3 direction=normalize(hit);" : "vec3 direction=mix(hit,R,roughness);"}
    color+=sourceCubeSample(direction,int(env.index),sqrt(roughness)*${data.lastLod ?? 5}.0)*weight;
    sh+=env.sh*weight;coverage+=weight;
    if(coverage>0.99)break;
  }
  ${!options.nativeFamily && data.lightmapVersion?.[0] === 8 && data.lightmapVersion[1] >= 2 ? "sh/=coverage;" : "color/=coverage;sh/=coverage;"}
  float captured=dot(sh,vec4(normal,1.0));
  if(captured>0.0)color*=min(${options.nativeFamily === "water" ? "1.0" : "dot(irradiance,vec3(0.2125,0.7154,0.0721))"}/captured,${data.lightmapVersion?.[0] === 8 && data.lightmapVersion[1] >= 2 ? "max(roughness*2.0+1.0,1.0)" : "1.0"});
  return color;
}
` +
    shader.fragmentShader;
  const reflection = `
    vec3 sourceReflectionWorld= ${options.worldPosition ?? "cameraPosition+transpose(mat3(viewMatrix))*(-vViewPosition)"};
    vec3 sourceReflectionNormal=${options.worldNormal ?? "inverseTransformDirection(geometryNormal,viewMatrix)"};
    vec3 sourceReflectionView=${options.worldView ?? "inverseTransformDirection(geometryViewDir,viewMatrix)"};
    radiance=sourceMapReflection(vec3(sourceReflectionWorld.x,-sourceReflectionWorld.z,sourceReflectionWorld.y)/0.0254,
      ${options.nativeFamily === "water" ? "sourceWaterReflectionNormal(vec3(sourceReflectionNormal.x,-sourceReflectionNormal.z,sourceReflectionNormal.y),sourceWaterViewRowFromBrowser(viewMatrix))" : "vec3(sourceReflectionNormal.x,-sourceReflectionNormal.z,sourceReflectionNormal.y)"},
      vec3(sourceReflectionView.x,-sourceReflectionView.z,sourceReflectionView.y),material.roughness,irradiance*RECIPROCAL_PI);
    `;
  // Keep the injection inside RE_IndirectSpecular's guard, after the light
  // accumulators exist. Diffuse-only native surfaces have no radiance variable.
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_fragment_end>",
    T.ShaderChunk.lights_fragment_end,
  );
  const call =
    "RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";
  if (!shader.fragmentShader.includes(call))
    throw new Error("Native reflection lighting anchor unavailable");
  shader.fragmentShader = shader.fragmentShader.replace(call, reflection + call);
}
