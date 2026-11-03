import { assetFetch } from "./asset-url";
import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { fetchGzipped } from "./gltf";

type Point = { x: number; y: number; z: number };
type Volume = {
  min: number[];
  max: number[];
  dimensions: number[];
  fade: number[];
  offset: number;
  shadowOffset: number;
  index: number;
  origin: number[];
  atlas: number[];
  shadowDimensions: number[];
  atlasScale: number[];
  atlasOffset: number[];
  borderMin: number[];
  borderMax: number[];
  boundsExtend: number;
  normalizedScale: number[];
  normalizedOffset: number[];
  inverseEdge: number[];
  normalizedSkin: number[];
};
type Manifest = {
  volumes: Volume[];
  skySH: number[][];
  sampling: string;
  dataBytes: { irradiance: number; shadow: number };
};
let manifest: Manifest | undefined;
let values: Uint16Array;
let shadows: Uint8Array;
let pending: Promise<void> | undefined;
export function loadSourceLighting() {
  pending ??= Promise.all([
    assetFetch("/models/maps/lighting/probes.json").then(async (r) => {
      if (!r.ok) throw new Error("Native lighting metadata unavailable");
      return (await r.json()) as Manifest;
    }),
    fetchGzipped("/models/maps/lighting/probes.bin.gz"),
    fetchGzipped("/models/maps/lighting/probe-shadows.bin.gz"),
  ]).then(([data, rgb, mask]) => {
    values = new Uint16Array(rgb);
    shadows = new Uint8Array(mask);
    if (
      data.sampling !== "native-cells-v1" ||
      rgb.byteLength !== data.dataBytes.irradiance ||
      mask.byteLength !== data.dataBytes.shadow ||
      rgb.byteLength + mask.byteLength > 80 * 1024 * 1024
    )
      throw new Error("Invalid native LPV cell payloads");
    for (const volume of data.volumes) {
      const cells = volume.dimensions[0] * volume.dimensions[1] * volume.dimensions[2];
      const halo = volume.shadowDimensions;
      if (
        halo?.length !== 3 ||
        halo.some((dimension, axis) => dimension !== volume.dimensions[axis] + 2) ||
        volume.offset < 0 ||
        volume.offset + cells * 18 > values.length ||
        volume.shadowOffset < 0 ||
        (volume.shadowOffset + halo[0] * halo[1] * halo[2]) * 4 > shadows.length
      )
        throw new Error("Native LPV cell offsets/dimensions are invalid");
    }
    if (
      data.volumes.some(
        (volume) => volume.boundsExtend !== 0.1 || volume.normalizedScale?.length !== 3,
      ) ||
      data.skySH?.length !== 3
    )
      throw new Error("Native LPV selection metadata missing; regenerate the probe volumes");
    blendedWeights = new Float32Array(data.volumes.length);
    manifest = data;
  });
  return pending;
}
function volumeAt(p: Point) {
  if (!manifest) return undefined;
  // Coordinates and boxes retain native inches; axes match the source volume.
  const x = p.x / 0.0254,
    y = -p.z / 0.0254,
    z = p.y / 0.0254;
  return manifest.volumes.find(
    (v) =>
      x >= v.min[0] &&
      y >= v.min[1] &&
      z >= v.min[2] &&
      x <= v.max[0] &&
      y <= v.max[1] &&
      z <= v.max[2],
  );
}
const atlasDimensions = [192, 176, 120];
function nativeCoordinate(v: Volume, p: Point, axis: number, shadow: boolean) {
  const position = axis === 0 ? p.x / 0.0254 : axis === 1 ? -p.z / 0.0254 : p.y / 0.0254;
  const local = Math.fround(
    Math.fround(Math.fround(position) * v.normalizedScale[axis]) + v.normalizedOffset[axis],
  );
  const divisor = axis === 2 ? 6 : 1;
  const clamped = shadow
    ? T.MathUtils.clamp(local, 0, 1)
    : T.MathUtils.clamp(local / divisor, v.borderMin[axis], v.borderMax[axis]) * divisor;
  const coordinate =
    (clamped * v.atlasScale[axis] + v.atlasOffset[axis]) * atlasDimensions[axis] -
    0.5 -
    v.atlas[axis] +
    (shadow ? 1 : 0);
  return T.MathUtils.clamp(
    coordinate,
    0,
    (shadow ? v.shadowDimensions[axis] : v.dimensions[axis]) - 1,
  );
}
const stencilWeights = new Float64Array(8);
const stencilVoxels = new Uint32Array(8);
let stencilVolume: Volume | undefined;
let stencilX = NaN,
  stencilY = NaN,
  stencilZ = NaN,
  stencilShadow = false;
function prepareStencil(v: Volume, p: Point, shadow: boolean) {
  if (
    stencilVolume === v &&
    stencilX === p.x &&
    stencilY === p.y &&
    stencilZ === p.z &&
    stencilShadow === shadow
  )
    return;
  stencilVolume = v;
  stencilX = p.x;
  stencilY = p.y;
  stencilZ = p.z;
  stencilShadow = shadow;
  const dimensions = shadow ? v.shadowDimensions : v.dimensions;
  const x = nativeCoordinate(v, p, 0, shadow),
    y = nativeCoordinate(v, p, 1, shadow),
    z = nativeCoordinate(v, p, 2, shadow);
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  for (let k = 0; k < 8; k++) {
    const xx = Math.min(ix + (k & 1), dimensions[0] - 1),
      yy = Math.min(iy + ((k >> 1) & 1), dimensions[1] - 1),
      zz = Math.min(iz + ((k >> 2) & 1), dimensions[2] - 1);
    stencilWeights[k] =
      (k & 1 ? x - ix : 1 - x + ix) * (k & 2 ? y - iy : 1 - y + iy) * (k & 4 ? z - iz : 1 - z + iz);
    stencilVoxels[k] = (zz * dimensions[1] + yy) * dimensions[0] + xx;
  }
}
function sample(
  v: Volume,
  p: Point,
  direction: number,
  channel: number,
  shadow: boolean,
  local = false,
) {
  prepareStencil(v, p, shadow);
  let result = 0;
  for (let k = 0; k < 8; k++) {
    const voxel = stencilVoxels[k];
    result +=
      stencilWeights[k] *
      (shadow
        ? shadows[(v.shadowOffset + voxel) * 4 + (local ? channel + 1 : 0)] / 255
        : T.DataUtils.fromHalfFloat(values[v.offset + voxel * 18 + direction * 3 + channel]));
  }
  return result;
}
// Native priority order, 0.1 Source-inch box skin and authored edge feathering.
// Continue until coverage exceeds 0.99, without an arbitrary overlap limit.
const blendedVolumes: Volume[] = [];
let blendedWeights = new Float32Array(0);
const blendPoint = new Float64Array(3);
let blendedCoverage = 0;
function blendVolumes(p: Point) {
  blendedVolumes.length = 0;
  blendedCoverage = 0;
  const point = blendPoint;
  point[0] = p.x / 0.0254;
  point[1] = -p.z / 0.0254;
  point[2] = p.y / 0.0254;
  for (const v of manifest?.volumes ?? []) {
    let edge = 1;
    for (let axis = 0; axis < 3; axis++) {
      // The packed native transform is float32; this matters at hard boundaries.
      const local = Math.fround(
        Math.fround(Math.fround(point[axis]) * v.normalizedScale[axis]) + v.normalizedOffset[axis],
      );
      const distance = Math.min(local, 1 - local) + v.normalizedSkin[axis];
      edge = Math.min(edge, distance * v.inverseEdge[axis]);
    }
    if (edge <= 0) continue;
    const weight = edge * edge * (3 - 2 * edge) * (1 - blendedCoverage);
    blendedWeights[blendedVolumes.length] = weight;
    blendedVolumes.push(v);
    blendedCoverage += weight;
    if (blendedCoverage > 0.99) break;
  }
}
export function sampleSourceProbe(p: Point, normal: Point, out: T.Color) {
  if (!manifest) return false;
  blendVolumes(p);
  const nx = normal.x,
    ny = -normal.z,
    nz = normal.y;
  const magnitude = nx * nx + ny * ny + nz * nz || 1;
  const x = nx >= 0 ? 0 : 3,
    y = ny >= 0 ? 1 : 4,
    z = nz >= 0 ? 2 : 5;
  // 8.2 fills uncovered space with the environment light's directional ambient,
  // and discards the tiny remainder once probe coverage reaches 0.99.
  const skyWeight = blendedCoverage < 0.99 ? (1 - blendedCoverage) * Math.PI : 0;
  const skyNormalZ = nz / Math.sqrt(magnitude);
  out
    .setRGB(
      manifest.skySH[0][3] + manifest.skySH[0][2] * skyNormalZ,
      manifest.skySH[1][3] + manifest.skySH[1][2] * skyNormalZ,
      manifest.skySH[2][3] + manifest.skySH[2][2] * skyNormalZ,
    )
    .multiplyScalar(skyWeight);
  for (let i = 0; i < blendedVolumes.length; i++) {
    const v = blendedVolumes[i],
      weight = (blendedWeights[i] * Math.PI) / magnitude;
    out.r +=
      ((nx !== 0 ? sample(v, p, x, 0, false) * nx * nx : 0) +
        (ny !== 0 ? sample(v, p, y, 0, false) * ny * ny : 0) +
        (nz !== 0 ? sample(v, p, z, 0, false) * nz * nz : 0)) *
      weight;
    out.g +=
      ((nx !== 0 ? sample(v, p, x, 1, false) * nx * nx : 0) +
        (ny !== 0 ? sample(v, p, y, 1, false) * ny * ny : 0) +
        (nz !== 0 ? sample(v, p, z, 1, false) * nz * nz : 0)) *
      weight;
    out.b +=
      ((nx !== 0 ? sample(v, p, x, 2, false) * nx * nx : 0) +
        (ny !== 0 ? sample(v, p, y, 2, false) * ny * ny : 0) +
        (nz !== 0 ? sample(v, p, z, 2, false) * nz * nz : 0)) *
      weight;
  }
  return true;
}
export function sampleSourceProbeSun(p: Point) {
  blendVolumes(p);
  let visibility = 1 - blendedCoverage;
  for (let i = 0; i < blendedVolumes.length; i++)
    visibility += (1 - sample(blendedVolumes[i], p, 0, 0, true)) * blendedWeights[i];
  return visibility;
}
export function sampleSourceProbeLocalShadows(p: Point, out: T.Vector2) {
  blendVolumes(p);
  out.set(0, 0);
  for (let i = 0; i < blendedVolumes.length; i++) {
    out.x += sample(blendedVolumes[i], p, 0, 0, true, true) * blendedWeights[i];
    out.y += sample(blendedVolumes[i], p, 0, 1, true, true) * blendedWeights[i];
  }
  return out;
}
export function nearestSourceProbe(p: Point): number | null {
  const inside = volumeAt(p);
  if (inside) return inside.index;
  let result: Volume | undefined,
    distance = Infinity;
  for (const v of manifest?.volumes ?? []) {
    const d =
      (p.x - v.origin[0] * 0.0254) ** 2 +
      (p.y - v.origin[2] * 0.0254) ** 2 +
      (p.z + v.origin[1] * 0.0254) ** 2;
    if (d < distance) {
      distance = d;
      result = v;
    }
  }
  return result?.index ?? null;
}
export async function loadSourceReflection(index: number) {
  const parsed = new HDRLoader().parse(
    await fetchGzipped(`/models/maps/lighting/reflection-${index}.hdr.gz`),
  );
  const texture = new T.DataTexture(
    parsed.data,
    parsed.width,
    parsed.height,
    T.RGBAFormat,
    T.HalfFloatType,
  );
  texture.flipY = true;
  texture.mapping = T.EquirectangularReflectionMapping;
  texture.colorSpace = T.LinearSRGBColorSpace;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
