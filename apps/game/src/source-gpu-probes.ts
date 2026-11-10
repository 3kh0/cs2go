import * as T from "three";
import { assetFetch } from "./asset-url";
import { fetchGzipped } from "./gltf";
import { readAssetParts } from "./asset-stream";
import { loadSourceLighting, sourceProbeMetadata } from "./source-lighting";
import {
  packSourceProbeFrames,
  probeFrameKeys,
  type PackedProbeFrames,
  type SourceProbeFrame,
} from "./source-probe-frames";

type ArrayRecord = {
  file?: string;
  /** Independently compressed consecutive slices of the exact decoded atlas. */
  files?: string[];
  format: string;
  width: number;
  height: number;
  layers: number;
  gpuBytes: number;
};
export interface SourceGpuProbes {
  textures: (T.CompressedArrayTexture | T.DataArrayTexture)[];
  frames: Float32Array[];
  packedFrames?: PackedProbeFrames;
  sky: T.Vector4[];
  depth: number;
  count: number;
}
const states = new WeakMap<T.WebGLRenderer, SourceGpuProbes>();
const pending = new WeakMap<T.WebGLRenderer, Promise<SourceGpuProbes | undefined>>();
export function sourceGpuProbes(renderer: T.WebGLRenderer) {
  return states.get(renderer);
}
export function loadSourceGpuProbes(renderer: T.WebGLRenderer) {
  let task = pending.get(renderer);
  if (task) return task;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  if (
    renderer.capabilities.maxFragmentUniforms < 768 ||
    renderer.capabilities.maxTextures < 16 ||
    !renderer.extensions.has("EXT_texture_compression_bptc") ||
    gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) < 720
  )
    return Promise.resolve(undefined);
  task = (async () => {
    const directory = "/models/maps/lighting/gpu-probes/";
    const [metadata, manifest] = await Promise.all([
      loadSourceLighting(true).then(sourceProbeMetadata),
      assetFetch(directory + "source.json").then((r) => {
        if (!r.ok) throw new Error("Native GPU probes unavailable");
        return r.json() as Promise<{ arrays: ArrayRecord[] }>;
      }),
    ]);
    if (metadata.volumes.length !== 43 || manifest.arrays.length !== 2)
      throw new Error("Invalid native GPU probe scope");
    const result = await createSourceGpuProbes(directory, manifest.arrays, metadata);
    states.set(renderer, result);
    return result;
  })();
  pending.set(renderer, task);
  return task;
}

export async function createSourceGpuProbes(
  directory: string,
  arrays: ArrayRecord[],
  metadata: {
    volumes: SourceProbeFrame[];
    skySH: number[][];
  },
): Promise<SourceGpuProbes> {
  if (arrays.length !== 2) throw new Error("Invalid native GPU probe layout");
  const depth = arrays[1].layers;
  if (arrays[0].layers !== depth * 6 || !metadata.volumes.length)
    throw new Error("Invalid native GPU probe layout");
  const loaded = await Promise.allSettled(
    arrays.map(async (entry, index) => {
      const decoded = entry.format === "RGB16F" || entry.format === "RGBA8";
      const expected = decoded
        ? entry.width * entry.height * entry.layers * (entry.format === "RGB16F" ? 6 : 4)
        : Math.ceil(entry.width / 4) * Math.ceil(entry.height / 4) * 16 * entry.layers;
      if (!Number.isSafeInteger(expected) || expected <= 0 || entry.gpuBytes !== expected)
        throw new Error("Invalid native GPU probe blocks");
      if (!!entry.file === !!entry.files || (entry.files && !entry.files.length))
        throw new Error("Invalid native GPU probe transport");
      const bytes = entry.files
        ? await readAssetParts(
            (async function* () {
              for (const file of entry.files!) yield await assetFetch(directory + file);
            })(),
            expected,
          )
        : await fetchGzipped(directory + entry.file!);
      if (bytes.byteLength !== expected || entry.gpuBytes !== expected)
        throw new Error("Invalid native GPU probe blocks");
      const texture = decoded
        ? new T.DataArrayTexture(
            entry.format === "RGB16F" ? new Uint16Array(bytes) : new Uint8Array(bytes),
            entry.width,
            entry.height,
            entry.layers,
          )
        : new T.CompressedArrayTexture(
            [{ data: new Uint8Array(bytes), width: entry.width, height: entry.height }],
            entry.width,
            entry.height,
            entry.layers,
            index === 0 ? T.RGB_BPTC_UNSIGNED_Format : T.RGBA_BPTC_Format,
          );
      if (decoded) {
        texture.format = entry.format === "RGB16F" ? T.RGBFormat : T.RGBAFormat;
        texture.type = entry.format === "RGB16F" ? T.HalfFloatType : T.UnsignedByteType;
        // Three infers sized floating formats for RGBA, but leaves RGB unsized.
        // WebGL2 array storage requires RGB16F for the native three-channel HDR data.
        if (entry.format === "RGB16F") texture.internalFormat = "RGB16F";
        texture.unpackAlignment = 1;
      }
      texture.colorSpace = T.NoColorSpace;
      texture.minFilter = texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = false;
      texture.flipY = false;
      texture.needsUpdate = true;
      return texture;
    }),
  );
  const failure = loaded.find((result) => result.status === "rejected");
  if (failure) {
    for (const result of loaded) if (result.status === "fulfilled") result.value.dispose();
    throw failure.reason;
  }
  const textures = loaded.map(
    (result) =>
      (result as PromiseFulfilledResult<T.CompressedArrayTexture | T.DataArrayTexture>).value,
  );
  return {
    textures,
    depth,
    count: metadata.volumes.length,
    frames: probeFrameKeys.map(
      (key) => new Float32Array(metadata.volumes.flatMap((volume) => volume[key])),
    ),
    packedFrames: packSourceProbeFrames(metadata.volumes),
    sky: metadata.skySH.map((row) => new T.Vector4().fromArray(row)),
  };
}

// VRF 5564866 lighting_lpv.slang (MIT). Original BC blocks, separate native
// borders, priority/fade/remaining coverage, six signed axes, directional sky.
// WebGL2 array layers filter XY in hardware; interpolate adjacent Z layers.
export function applySourceGpuProbes(
  shader: T.WebGLProgramParametersWithUniforms,
  probes: SourceGpuProbes,
) {
  probes.textures.forEach((texture, index) => {
    shader.uniforms[`sourceGpuAtlas${index}`] = { value: texture };
  });
  const packed = probes.packedFrames;
  if (packed) {
    shader.uniforms.sourceGpuPackedFrames = { value: packed.values };
    if (packed.rotations.length)
      shader.uniforms.sourceGpuRotatedFrames = { value: packed.rotations };
  } else
    probes.frames.forEach((frame, index) => {
      shader.uniforms[`sourceGpuFrame${index}`] = { value: frame };
    });
  shader.uniforms.sourceGpuSky = { value: probes.sky };
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <common>",
    `#include <common>
    uniform highp sampler2DArray sourceGpuAtlas0;
    uniform highp sampler2DArray sourceGpuAtlas1;
    ${packed ? `uniform vec4 sourceGpuPackedFrames[${probes.count * 6}];\n${packed.rotations.length ? `uniform vec4 sourceGpuRotatedFrames[${packed.rotations.length / 4}];` : ""}` : probes.frames.map((_, index) => `uniform vec3 sourceGpuFrame${index}[${probes.count}];`).join("\n")}
    uniform vec4 sourceGpuSky[3];
    struct SourceGpuProbe { vec3 irradiance; vec4 occlusion; };
    vec3 sourceGpuFace(vec3 uvw, int face) {
      float z = clamp(uvw.z * ${probes.depth}.0 - 0.5, 0.0, ${probes.depth - 1}.0);
      float lo = floor(z), hi = min(lo + 1.0, ${probes.depth - 1}.0), blend = fract(z);
      float layer = float(face) * ${probes.depth}.0;
      return mix(texture(sourceGpuAtlas0, vec3(uvw.xy, layer + lo)).rgb, texture(sourceGpuAtlas0, vec3(uvw.xy, layer + hi)).rgb, blend);
    }
    vec4 sourceGpuShadow(vec3 uvw) {
      float z = clamp(uvw.z * ${probes.depth}.0 - 0.5, 0.0, ${probes.depth - 1}.0);
      float lo = floor(z), hi = min(lo + 1.0, ${probes.depth - 1}.0);
      return mix(texture(sourceGpuAtlas1, vec3(uvw.xy, lo)), texture(sourceGpuAtlas1, vec3(uvw.xy, hi)), fract(z));
    }
    SourceGpuProbe sourceGpuSample(vec3 position, vec3 normalWorld) {
      vec3 p = vec3(position.x, -position.z, position.y) / 0.0254;
      vec3 n = normalize(vec3(normalWorld.x, -normalWorld.z, normalWorld.y));
      vec3 n2 = n*n;
      SourceGpuProbe result;
      result.irradiance = vec3(0.0); result.occlusion = vec4(0.0);
      float coverage = 0.0;
      for (int i = 0; i < ${probes.count}; i++) {
        ${
          packed
            ? `
        vec4 f0=sourceGpuPackedFrames[i*6], f1=sourceGpuPackedFrames[i*6+1], f2=sourceGpuPackedFrames[i*6+2];
        vec4 f3=sourceGpuPackedFrames[i*6+3], f4=sourceGpuPackedFrames[i*6+4], f5=sourceGpuPackedFrames[i*6+5];
        vec3 packedFrame0=f0.xyz, packedFrame1=vec3(f0.w,f1.xy);
        vec3 packedFrame2=vec3(f1.zw,f2.x), packedFrame3=f2.yzw;
        vec3 packedFrame4=f3.xyz, packedFrame5=vec3(f3.w,f4.xy);
        vec3 packedFrame6=vec3(f4.zw,f5.x), packedFrame7=f5.yzw;
        `
            : ""
        }
        vec3 q = p * sourceGpuFrame0[i] + sourceGpuFrame1[i];
        ${
          packed?.rotations.length
            ? `
        if (packedFrame0.x < 0.0) {
          int base=int(packedFrame0.y)*3;
          q=vec3(dot(sourceGpuRotatedFrames[base],vec4(p,1.0)),dot(sourceGpuRotatedFrames[base+1],vec4(p,1.0)),dot(sourceGpuRotatedFrames[base+2],vec4(p,1.0)));
        }`
            : ""
        }
        vec3 fade = (min(q, 1.0-q) + sourceGpuFrame3[i]) * sourceGpuFrame2[i];
        float edge = clamp(min(min(fade.x, fade.y), fade.z), 0.0, 1.0);
        float weight = edge*edge*(3.0-2.0*edge)*(1.0-coverage);
        if (weight > 0.0) {
          vec3 clipped = clamp(q / vec3(1.0,1.0,6.0), sourceGpuFrame6[i], sourceGpuFrame7[i]) * vec3(1.0,1.0,6.0);
          vec3 uvw = clipped * sourceGpuFrame4[i] + sourceGpuFrame5[i];
          vec3 rgb = n2.x * sourceGpuFace(uvw, n.x >= 0.0 ? 0 : 3)
                   + n2.y * sourceGpuFace(uvw, n.y >= 0.0 ? 1 : 4)
                   + n2.z * sourceGpuFace(uvw, n.z >= 0.0 ? 2 : 5);
          result.irradiance += rgb * weight;
          result.occlusion += sourceGpuShadow(clamp(q,0.0,1.0)*sourceGpuFrame4[i]+sourceGpuFrame5[i]) * weight;
          coverage += weight;
          if (coverage > 0.99) break;
        }
      }
      if (coverage < 0.99) result.irradiance += vec3(sourceGpuSky[0].w+sourceGpuSky[0].z*n.z,sourceGpuSky[1].w+sourceGpuSky[1].z*n.z,sourceGpuSky[2].w+sourceGpuSky[2].z*n.z)*(1.0-coverage);
      return result;
    }
  `,
  );
  if (packed)
    shader.fragmentShader = shader.fragmentShader.replace(
      /sourceGpuFrame([0-7])\[i\]/g,
      "packedFrame$1",
    );
}
