import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import * as T from "three";
import {
  createSourceReflectionBinding,
  updateSourceReflectionBinding,
  type SourceReflections,
} from "./source-reflections";

const directory = new URL(
  "../../../packages/assets/public/models/maps/mirage-lighting/reflections/",
  import.meta.url,
);
const source = JSON.parse(readFileSync(new URL("source.json", directory), "utf8")) as {
  lightmapVersion: [number, number];
  lastLod: number;
  gpuBytes: number;
  arrays: {
    file: string;
    firstCube: number;
    layers: number;
    gpuBytes: number;
    sha256: string;
    mips: { width: number; height: number; bytes: number; sha256: string }[];
  }[];
  volumes: SourceReflections["volumes"];
};
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("Mirage reflection arrays retain every native cube face and authored roughness mip", () => {
  expect(source.arrays.map((array) => [array.firstCube, array.layers])).toEqual([
    [0, 252],
    [42, 96],
  ]);
  expect(source.gpuBytes).toBe(30_406_848);
  expect(source.lightmapVersion).toEqual([8, 2]);
  expect(source.lastLod).toBe(6);
  expect(source.volumes.find((volume) => volume.index === 0)!.fade[0]).toBeCloseTo(8.1, 5);
  for (const array of source.arrays) {
    const payload = gunzipSync(readFileSync(new URL(array.file, directory)));
    expect(payload.byteLength).toBe(array.gpuBytes);
    expect(sha(payload)).toBe(array.sha256);
    expect(array.mips).toHaveLength(7);
    let offset = 0;
    for (const [level, mip] of array.mips.entries()) {
      const side = 256 >> level;
      expect([mip.width, mip.height]).toEqual([side, side]);
      expect(mip.bytes).toBe(Math.ceil(side / 4) ** 2 * 16 * array.layers);
      expect(sha(payload.subarray(offset, offset + mip.bytes))).toBe(mip.sha256);
      offset += mip.bytes;
    }
    expect(offset).toBe(payload.byteLength);
  }
  expect(source.volumes.map((volume) => volume.index).sort((a, b) => a - b)).toEqual(
    Array.from({ length: 58 }, (_, i) => i),
  );
  // Native VTEX cube0's original27SH floats evaluated independently using
  // pinned20.1 SceneEnvMap.cs; newer-reference sign/clamp conventions differ.
  const nativeCube0 = source.volumes.find((volume) => volume.index === 0)!;
  const expectedSH = [
    -0.0012357189552858472, 0.02041546069085598, -0.01912134513258934, 0.6548210978507996,
  ];
  nativeCube0.normalizationSH.forEach((value, index) =>
    expect(value).toBeCloseTo(expectedSH[index], 7),
  );
  for (const volume of source.volumes) {
    const [x, y, z, constant] = volume.normalizationSH;
    expect(constant - Math.hypot(x, y, z)).toBeGreaterThan(0);
  }
});

test("actor reflection bindings update native indoor priority without changing shader uniform identities", () => {
  const data: SourceReflections = {
    textures: [],
    volumes: source.volumes,
    uniforms: source.volumes.map((volume) => ({
      index: volume.index,
      origin: new T.Vector3().fromArray(volume.origin),
      mins: new T.Vector3().fromArray(volume.min),
      maxs: new T.Vector3().fromArray(volume.max),
      invEdge: new T.Vector3(
        ...(volume.fade.map((n) => (n > 0 ? 1 / n : 3.402823466e38)) as [number, number, number]),
      ),
      sh: new T.Vector4().fromArray(volume.normalizationSH),
    })),
  };
  const binding = createSourceReflectionBinding(data);
  const records = [...binding.uniforms];
  const origins = records.map((record) => record.origin);
  const count = binding.count;
  const bounds = new T.Box3().setFromCenterAndSize(
    new T.Vector3(-33, -3, 24),
    new T.Vector3(1, 2, 1),
  );
  expect(updateSourceReflectionBinding(binding, bounds)).toBe(2);
  expect(binding.uniforms.slice(0, binding.count.value).map((record) => record.index)).toEqual([
    10, 0,
  ]);
  bounds.setFromCenterAndSize(new T.Vector3(-44, -2, 18), new T.Vector3(1, 2, 1));
  expect(updateSourceReflectionBinding(binding, bounds)).toBe(3);
  expect(binding.uniforms.slice(0, binding.count.value).map((record) => record.index)).toEqual([
    9, 41, 0,
  ]);
  expect(binding.uniforms).toHaveLength(8);
  records.forEach((record, i) => {
    expect(binding.uniforms[i]).toBe(record);
    expect(binding.uniforms[i].origin).toBe(origins[i]);
  });
  expect(binding.count).toBe(count);
  bounds.translate(new T.Vector3(1000, 1000, 1000));
  expect(updateSourceReflectionBinding(binding, bounds)).toBe(0);
  expect(binding.count.value).toBe(0);
});
