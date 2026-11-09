import type * as T from "three";

// VRF 9e2e6c7, ParticleRenderer/Utils/Noise.cs and ForceGenerators/CurlNoiseForce.cs.
// MIT notice: models/maps/licenses/ValveResourceFormat-MIT.txt.
function lattice(x: number, y: number, z: number) {
  const index = (x + (y << 10) + (z << 20)) | 0;
  let k = Math.imul(index, 0xcc9e2d51) & 0x7fffffff;
  k = Math.imul((k << 15) | (k >>> 17), 0x1b873593) & 0x7fffffff;
  const h = (Math.imul((k << 13) | (k >>> 19), 5) + 0xe6546b64) | 0;
  const mixed = (h ^ (h >> 16)) & 0x7fffffff;
  const scaled = Math.imul(mixed, 0x04b2ae35);
  return ((scaled ^ (scaled >> 16)) & 0xffff) / 65535;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function homeValueNoise(x: number, y: number, z: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  const c00 = mix(lattice(ix, iy, iz), lattice(ix + 1, iy, iz), fx);
  const c10 = mix(lattice(ix, iy + 1, iz), lattice(ix + 1, iy + 1, iz), fx);
  const c01 = mix(lattice(ix, iy, iz + 1), lattice(ix + 1, iy, iz + 1), fx);
  const c11 = mix(lattice(ix, iy + 1, iz + 1), lattice(ix + 1, iy + 1, iz + 1), fx);
  return (mix(mix(c00, c10, fy), mix(c01, c11, fy), fz) - 0.5) * 2;
}

/** Curl of three decorrelated scalar fields; no allocations in the force loop. */
export function homeCurlNoise(x: number, y: number, z: number, out: T.Vector3) {
  const e = 0.01,
    shiftX = 31.416,
    shiftZ = 47.853;
  return out.set(
    (homeValueNoise(x, y + e, z + shiftZ) -
      homeValueNoise(x, y - e, z + shiftZ) -
      homeValueNoise(x + shiftX, y, z + e) +
      homeValueNoise(x + shiftX, y, z - e)) /
      (2 * e),
    (homeValueNoise(x, y, z + e) -
      homeValueNoise(x, y, z - e) -
      homeValueNoise(x + e, y, z + shiftZ) +
      homeValueNoise(x - e, y, z + shiftZ)) /
      (2 * e),
    (homeValueNoise(x + e + shiftX, y, z) -
      homeValueNoise(x - e + shiftX, y, z) -
      homeValueNoise(x, y + e, z) +
      homeValueNoise(x, y - e, z)) /
      (2 * e),
  );
}
