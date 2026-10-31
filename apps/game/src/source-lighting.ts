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
};
type Manifest = { volumes: Volume[] };
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
function sample(v: Volume, p: Point, direction: number, channel: number, shadow: boolean) {
  const x =
    T.MathUtils.clamp((p.x / 0.0254 - v.min[0]) / (v.max[0] - v.min[0]), 0, 1) *
    (v.dimensions[0] - 1);
  const y =
    T.MathUtils.clamp((-p.z / 0.0254 - v.min[1]) / (v.max[1] - v.min[1]), 0, 1) *
    (v.dimensions[1] - 1);
  const z =
    T.MathUtils.clamp((p.y / 0.0254 - v.min[2]) / (v.max[2] - v.min[2]), 0, 1) *
    (v.dimensions[2] - 1);
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  let result = 0;
  for (let k = 0; k < 8; k++) {
    const xx = Math.min(ix + (k & 1), v.dimensions[0] - 1),
      yy = Math.min(iy + ((k >> 1) & 1), v.dimensions[1] - 1),
      zz = Math.min(iz + ((k >> 2) & 1), v.dimensions[2] - 1);
    const weight =
      (k & 1 ? x - ix : 1 - x + ix) * (k & 2 ? y - iy : 1 - y + iy) * (k & 4 ? z - iz : 1 - z + iz);
    const voxel = (zz * v.dimensions[1] + yy) * v.dimensions[0] + xx;
    result +=
      weight *
      (shadow
        ? shadows[v.shadowOffset + voxel] / 255
        : T.DataUtils.fromHalfFloat(values[v.offset + voxel * 18 + direction * 3 + channel]));
  }
  return result;
}
// Native LPV edge feathering prevents an indoor box extending through a wall
// from replacing all exterior irradiance. Blend at most four priority volumes.
const blendedVolumes: Volume[] = [];
const blendedWeights = new Float32Array(4);
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
    for (let axis = 0; axis < 3; axis++)
      edge = Math.min(
        edge,
        Math.min(point[axis] - v.min[axis], v.max[axis] - point[axis]) /
          Math.max(v.fade[axis], 0.02),
      );
    if (edge <= 0) continue;
    const weight = edge * edge * (3 - 2 * edge) * (1 - blendedCoverage);
    blendedWeights[blendedVolumes.length] = weight;
    blendedVolumes.push(v);
    blendedCoverage += weight;
    if (blendedCoverage > 0.99 || blendedVolumes.length === 4) break;
  }
}
export function sampleSourceProbe(p: Point, normal: Point, out: T.Color) {
  blendVolumes(p);
  if (!blendedVolumes.length) return false;
  const nx = normal.x,
    ny = -normal.z,
    nz = normal.y;
  const magnitude = nx * nx + ny * ny + nz * nz || 1;
  const x = nx >= 0 ? 0 : 3,
    y = ny >= 0 ? 1 : 4,
    z = nz >= 0 ? 2 : 5;
  out.setRGB(0.35, 0.4, 0.5).multiplyScalar((1 - blendedCoverage) * Math.PI);
  for (let i = 0; i < blendedVolumes.length; i++) {
    const v = blendedVolumes[i],
      weight = (blendedWeights[i] * Math.PI) / magnitude;
    out.r +=
      (sample(v, p, x, 0, false) * nx * nx +
        sample(v, p, y, 0, false) * ny * ny +
        sample(v, p, z, 0, false) * nz * nz) *
      weight;
    out.g +=
      (sample(v, p, x, 1, false) * nx * nx +
        sample(v, p, y, 1, false) * ny * ny +
        sample(v, p, z, 1, false) * nz * nz) *
      weight;
    out.b +=
      (sample(v, p, x, 2, false) * nx * nx +
        sample(v, p, y, 2, false) * ny * ny +
        sample(v, p, z, 2, false) * nz * nz) *
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
