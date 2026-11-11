import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Vector3 } from "three";
import { expect, test } from "vitest";
import { NativeAcoustics } from "./room-acoustics";

function fixture(points: readonly (readonly [number, number, number])[]) {
  const count = points.length,
    pairs = (count * (count - 1)) / 2,
    data = new ArrayBuffer(8 + count * 16 + pairs * 2),
    header = new DataView(data),
    probes = new Float32Array(data, 8, count * 4);
  header.setUint32(0, count, true);
  header.setUint32(4, pairs, true);
  points.forEach((point, i) => probes.set(point, i * 4));
  return new NativeAcoustics(data);
}

// Retain the exhaustive implementation as the behavior oracle, including its
// strict cutoff, original Float32 coordinates and first-index tie resolution.
function exhaustive(acoustics: NativeAcoustics, position: Vector3) {
  let best = -1,
    distance = 144;
  for (let i = 0; i < acoustics.count; i++) {
    const k = i * 4;
    const d =
      (acoustics.probes[k] - position.x) ** 2 +
      (acoustics.probes[k + 1] - position.y) ** 2 +
      (acoustics.probes[k + 2] - position.z) ** 2;
    if (d < distance) {
      distance = d;
      best = i;
    }
  }
  return best;
}

test("native nearest preserves exclusive radius, height and original-index ties across cells", () => {
  const single = fixture([[0, 0, 0]]);
  for (const axis of ["x", "y", "z"] as const)
    for (const sign of [-1, 1]) {
      const position = new Vector3();
      position[axis] = sign * 12;
      expect(single.nearest(position)).toBe(-1);
      position[axis] = sign * (12 - 1e-9);
      expect(single.nearest(position)).toBe(0);
      position[axis] = sign * (12 + 1e-9);
      expect(single.nearest(position)).toBe(-1);
    }
  // Negative cells are visited first, but probe 0 must still win the tie.
  const ties = fixture([
    [1, 0, 1],
    [-1, 0, -1],
    [1, 0, 1],
  ]);
  expect(ties.nearest(new Vector3())).toBe(0);
  expect(ties.nearest(new Vector3(1, 0, 1))).toBe(0);
  expect(fixture([[0, 13, 0]]).nearest(new Vector3())).toBe(-1);
  const boundaries = fixture([
    [-12, 0, -12],
    [12, 0, 12],
    [24, 0, -24],
  ]);
  for (const x of [-24, -12, 0, 12, 24])
    for (const z of [-24, -12, 0, 12, 24])
      for (const offset of [-1e-9, 0, 1e-9]) {
        const position = new Vector3(x + offset, 0, z + offset);
        expect(boundaries.nearest(position)).toBe(exhaustive(boundaries, position));
      }
});

test("native nearest handles empty, nonfinite and extremely separated probes", () => {
  expect(fixture([]).nearest(new Vector3())).toBe(-1);
  const acoustics = fixture([
    [0, 0, 0],
    [3e30, 0, -3e30],
    [-3e30, 0, 3e30],
    [NaN, 0, 0],
    [0, Infinity, 0],
  ]);
  for (const axis of ["x", "y", "z"] as const)
    for (const value of [NaN, Infinity, -Infinity]) {
      const position = new Vector3();
      position[axis] = value;
      expect(acoustics.nearest(position)).toBe(exhaustive(acoustics, position));
    }
  for (const i of [0, 1, 2]) {
    const position = new Vector3().fromArray(acoustics.probes, i * 4);
    expect(acoustics.nearest(position)).toBe(i);
  }
});

test("all 1197 shipped Dust II probes and seeded positions match exhaustive nearest", () => {
  const bytes = gunzipSync(
    readFileSync(
      new URL(
        "../../../packages/assets/public/audio/acoustics/dust2-pathing.bin.gz",
        import.meta.url,
      ),
    ),
  );
  const acoustics = new NativeAcoustics(Uint8Array.from(bytes).buffer);
  expect(acoustics.count).toBe(1197);
  const position = new Vector3();
  let seed = 1977;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < acoustics.count; i++) {
    const k = i * 4;
    for (const offset of [0, -12, -11.999999, 11.999999, 12]) {
      position.set(acoustics.probes[k] + offset, acoustics.probes[k + 1], acoustics.probes[k + 2]);
      expect(acoustics.nearest(position)).toBe(exhaustive(acoustics, position));
    }
    position.set(
      acoustics.probes[k] + (random() - 0.5) * 48,
      acoustics.probes[k + 1] + (random() - 0.5) * 48,
      acoustics.probes[k + 2] + (random() - 0.5) * 48,
    );
    expect(acoustics.nearest(position)).toBe(exhaustive(acoustics, position));
  }
  // Index construction must leave the packed pair metadata intact.
  const pairs = (acoustics.count * (acoustics.count - 1)) / 2;
  expect(acoustics.ratio).toEqual(
    new Uint8Array(bytes.buffer, bytes.byteOffset + 8 + acoustics.count * 16, pairs),
  );
  expect(acoustics.deviation).toEqual(
    new Uint8Array(bytes.buffer, bytes.byteOffset + 8 + acoustics.count * 16 + pairs, pairs),
  );
  expect(acoustics.path(0, 0)).toEqual({ ratio: 1, deviation: 0 });
  expect(acoustics.path(-1, 0)).toBeUndefined();
  const index = 1195;
  expect(acoustics.path(0, 1196)).toEqual({
    ratio: acoustics.ratio[index] / 255,
    deviation: (acoustics.deviation[index] * 12) / 255,
  });
  expect(acoustics.path(1196, 0)).toEqual(acoustics.path(0, 1196));
});
