import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { expect, test, vi } from "vitest";
import * as T from "three";
import {
  applySourceReflections,
  createSourceReflectionBinding,
  loadSourceReflections,
  updateSourceReflectionBinding,
  validateSourceReflections,
  sourceReflectionCandidates,
  type SourceReflectionManifest,
  type SourceReflections,
} from "./source-reflections";
import { assetFetch } from "./asset-url";
import { fetchGzipped } from "./gltf";

vi.mock("./asset-url", () => ({ assetFetch: vi.fn() }));
vi.mock("./gltf", () => ({ fetchGzipped: vi.fn() }));

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

function reflectionBundle(partitions: number[]): SourceReflectionManifest {
  let firstCube = 0;
  const arrays = partitions.map((cubes, index) => {
    const layers = cubes * 6;
    const mips = [8, 4, 2].map((size) => ({
      width: size,
      height: size,
      bytes: Math.ceil(size / 4) ** 2 * 16 * layers,
    }));
    const entry = {
      file: `cubes-${index}.bin.gz`,
      firstCube,
      layers,
      gpuBytes: mips.reduce((bytes, mip) => bytes + mip.bytes, 0),
      mips,
    };
    firstCube += cubes;
    return entry;
  });
  return {
    arrays,
    lightmapVersion: [8, 2],
    lastLod: 2,
    gpuBytes: arrays.reduce((bytes, array) => bytes + array.gpuBytes, 0),
    volumes: Array.from({ length: firstCube }, (_, index) => ({
      index,
      origin: [0, 0, 0],
      min: [-1, -1, -1],
      max: [1, 1, 1],
      fade: [0, 0, 0],
      normalizationSH: [0, 0, 0, 1],
    })),
  };
}

function reflectionRenderer(maxLayers: number) {
  return {
    extensions: { has: () => true },
    capabilities: { maxFragmentUniforms: 1024, maxTextureSize: 4096, maxTextures: 16 },
    getContext: () => ({ MAX_ARRAY_TEXTURE_LAYERS: 1, getParameter: () => maxLayers }),
  } as unknown as T.WebGLRenderer;
}

function serveReflections(manifest: SourceReflectionManifest) {
  vi.mocked(assetFetch).mockImplementation(async () => new Response(JSON.stringify(manifest)));
  vi.mocked(fetchGzipped).mockImplementation(async (path) => {
    const index = manifest.arrays.findIndex((array) => path.endsWith(array.file));
    const array = manifest.arrays[index];
    return new Uint8Array(array.gpuBytes).fill(index + 1).buffer;
  });
}

test("reflection validation preserves shipped layouts and rejects incomplete or ambiguous native face data", () => {
  expect(validateSourceReflections(source)).toEqual({ size: 256, layers: 348, mipCount: 7 });
  const legacy = JSON.parse(
    readFileSync(new URL("../../lighting/reflections/source.json", directory), "utf8"),
  ) as SourceReflectionManifest;
  expect(validateSourceReflections(legacy, { volumes: 43 }).size).toBe(256);
  const sky = JSON.parse(
    readFileSync(new URL("../../lighting/sky/reflections.json", directory), "utf8"),
  ) as SourceReflectionManifest;
  expect(validateSourceReflections(sky, { volumes: 2 })).toEqual({
    size: 256,
    layers: 12,
    mipCount: 7,
  });
  const valid = reflectionBundle([2, 1]);
  expect(validateSourceReflections(valid)).toEqual({ size: 8, layers: 18, mipCount: 3 });
  for (const mutate of [
    (data: SourceReflectionManifest) => (data.arrays[1].firstCube = 3),
    (data: SourceReflectionManifest) => data.arrays[0].mips[0].bytes++,
    (data: SourceReflectionManifest) => (data.volumes[1].index = 0),
    (data: SourceReflectionManifest) => (data.volumes[0].origin[0] = NaN),
    (data: SourceReflectionManifest) => (data.volumes[0].min[0] = 2),
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    expect(() => validateSourceReflections(invalid)).toThrow("Invalid native reflection");
  }
  expect(() => validateSourceReflections(valid, { maxGpuBytes: 1 })).toThrow();
  expect(() => validateSourceReflections(valid, { volumes: 58 })).toThrow();
});

test("map reflection loading combines every source array without changing cube face indices", async () => {
  const manifest = reflectionBundle([1, 1, 1]);
  serveReflections(manifest);
  const data = await loadSourceReflections(reflectionRenderer(18), true, {
    directory: "/test/",
    manifest: "source.json",
  });
  expect(data?.textures).toHaveLength(1);
  expect(data?.cubeSize).toBe(8);
  expect(data?.combined).toBe(true);
  for (const [level, mip] of data!.textures[0].mipmaps.entries()) {
    const bytes = manifest.arrays[0].mips[level].bytes;
    expect(Array.from(mip.data as Uint8Array)).toEqual([
      ...Array.from({ length: bytes }, () => 1),
      ...Array.from({ length: bytes }, () => 2),
      ...Array.from({ length: bytes }, () => 3),
    ]);
  }
  data!.textures.forEach((texture) => texture.dispose());
  vi.mocked(fetchGzipped).mockClear();
  expect(
    await loadSourceReflections(reflectionRenderer(12), true, {
      directory: "/test/",
      manifest: "source.json",
    }),
  ).toBeUndefined();
  expect(fetchGzipped).not.toHaveBeenCalled();
});

test("separate reflection arrays use their own face size and split in the shader", async () => {
  const manifest = reflectionBundle([2, 1]);
  serveReflections(manifest);
  const data = await loadSourceReflections(reflectionRenderer(12), false, {
    directory: "/test/",
    manifest: "source.json",
  });
  expect(data?.textures).toHaveLength(2);
  expect(data?.arraySplit).toBe(2);
  const shader = {
    uniforms: {},
    fragmentShader: "#include <lights_fragment_end>",
  } as T.WebGLProgramParametersWithUniforms;
  applySourceReflections(shader, data!, [0]);
  expect(shader.fragmentShader).toContain("#define SOURCE_REFLECTION_CUBE_SIZE 8");
  expect(shader.fragmentShader).toContain("#define SOURCE_REFLECTION_ARRAY_SPLIT 2");
  expect(shader.fragmentShader).not.toContain("#define SOURCE_REFLECTION_SINGLE_ARRAY");
  data!.textures.forEach((texture) => texture.dispose());
});

test("rotated reflection volumes select their authored world extent and retain inverse affine frames", async () => {
  const manifest = reflectionBundle([1]);
  const transform = new T.Matrix4()
    .makeTranslation(100, 200, 300)
    .multiply(new T.Matrix4().makeRotationZ(Math.PI / 2));
  const localBounds = new T.Box3(new T.Vector3(-20, -1, -1), new T.Vector3(20, 1, 1));
  const worldBounds = localBounds.clone().applyMatrix4(transform);
  Object.assign(manifest.volumes[0], {
    origin: [100, 200, 300],
    min: localBounds.min.toArray(),
    max: localBounds.max.toArray(),
    localMin: localBounds.min.toArray(),
    localMax: localBounds.max.toArray(),
    localFade: [1, 1, 1],
    worldToLocal: transform.clone().invert().toArray(),
    localToWorld: transform.toArray(),
    worldAABB: [worldBounds.min.toArray(), worldBounds.max.toArray()],
  });
  validateSourceReflections(manifest);
  serveReflections(manifest);
  const data = (await loadSourceReflections(reflectionRenderer(6), true, {
    directory: "/test/",
    manifest: "source.json",
  }))!;
  // This point is inside the rotated long axis, outside the old unrotated box.
  const bounds = new T.Box3().setFromCenterAndSize(
    new T.Vector3(100 * 0.0254, 300 * 0.0254, -210 * 0.0254),
    new T.Vector3(0.001, 0.001, 0.001),
  );
  expect(sourceReflectionCandidates(bounds, data)).toEqual([0]);
  const binding = createSourceReflectionBinding(data);
  updateSourceReflectionBinding(binding, bounds);
  expect(
    new T.Vector3(100, 210, 300).applyMatrix4(binding.uniforms[0].worldToLocal!).x,
  ).toBeCloseTo(10, 6);
  const shader = {
    uniforms: {},
    fragmentShader: T.ShaderChunk.lights_fragment_end,
  } as T.WebGLProgramParametersWithUniforms;
  applySourceReflections(shader, binding, [0], { count: binding.count });
  expect(shader.fragmentShader).toContain("mat3(env.worldToLocal)*R");
  expect(shader.fragmentShader).toContain("radiance=sourceMapReflection");
  expect(shader.uniforms.sourceEnvironments.value).toBe(binding.uniforms);
  const invalid = structuredClone(manifest);
  invalid.volumes[0].worldToLocal![0] = NaN;
  expect(() => validateSourceReflections(invalid)).toThrow(/Invalid native reflection/);
  data.textures.forEach((texture) => texture.dispose());
});

test("instance IDs keep the complete shared field with a fixed eight-slot shader and no extra sampler", async () => {
  const manifest = reflectionBundle([1]);
  serveReflections(manifest);
  const base = await loadSourceReflections(reflectionRenderer(12), false, {
    directory: "/test/",
    manifest: "source.json",
  });
  const data = {
    ...base!,
    volumes: Array.from({ length: 65 }, () => base!.volumes[0]),
    uniforms: Array.from({ length: 65 }, () => base!.uniforms[0]),
  };
  const shader = {
    uniforms: {},
    vertexShader: "void main(){vec3 transformed=position;}",
    fragmentShader: "#include <lights_fragment_end>",
  } as T.WebGLProgramParametersWithUniforms;
  applySourceReflections(shader, data, [], { instanceCandidates: true });
  expect(shader.fragmentShader).toContain("sourceEnvironments[65]");
  expect(shader.fragmentShader).toContain("for(int i=0;i<8;i++)");
  expect(shader.fragmentShader).not.toContain("for(int i=0;i<65;i++)");
  expect(shader.fragmentShader).toContain("if(candidate==255)continue");
  expect(shader.fragmentShader).toContain("candidate>=65");
  expect(shader.fragmentShader).toContain("flat varying vec4 vSourceReflectionCandidates0");
  expect(shader.vertexShader).toContain("flat varying vec4 vSourceReflectionCandidates0");
  expect(shader.vertexShader).toContain(
    "void main(){\n vSourceReflectionCandidates0=sourceReflectionCandidates0;",
  );
  expect(shader.uniforms.sourceEnvironments.value).toBe(data.uniforms);
  expect(shader.uniforms.sourceEnvironmentCandidates).toBeUndefined();
  expect(shader.uniforms.sourceEnvironmentCount).toBeUndefined();
  expect(
    Object.values(shader.uniforms).filter((uniform) => uniform.value instanceof T.Texture),
  ).toHaveLength(2);
  expect(() =>
    applySourceReflections(shader, { ...data, uniforms: data.uniforms.slice(0, 8) }, [], {
      instanceCandidates: true,
    }),
  ).toThrow(/complete/);
  base!.textures.forEach((texture) => texture.dispose());
});
