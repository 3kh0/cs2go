import { expect, test } from "vitest";
import * as T from "three";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  partitionNativeInstanceReflections,
  assertNativeInstanceReflectionCoverage,
  createNativeInstanceReflectionCandidates,
  assertNativeInstanceReflectionCandidates,
  nativeInstanceReflectionAttributes,
} from "./native-instance-reflections";
import { partitionNativeReflections } from "./native-reflection-partition";
import { applyNativeMapReflections } from "./native-map-reflections";
import type { SourceReflections } from "./source-reflections";

type Volume = SourceReflections["volumes"][number];
const resource = (path: string) =>
  new URL(`../../../packages/assets/public/${path}`, import.meta.url);
const native = JSON.parse(
  readFileSync(resource("models/maps/cache-lighting/reflections/source.json"), "utf8"),
) as SourceReflections;
let leafPromise: Promise<T.BufferGeometry> | undefined;
function leaf() {
  return (leafPromise ??= (async () => {
    await MeshoptDecoder.ready;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register((parser) => {
      const loadTexture = () => Promise.resolve(new T.Texture());
      parser.loadTexture = loadTexture;
      return { name: "KHR_texture_basisu", loadTexture };
    });
    const bytes = gunzipSync(readFileSync(resource("models/maps/nuke-foliage/world.glb.gz")));
    const asset = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    asset.scene.updateMatrixWorld(true);
    let mesh: T.Mesh | undefined;
    asset.scene.traverse((o) => {
      if (
        !mesh &&
        o instanceof T.Mesh &&
        !Array.isArray(o.material) &&
        o.material.name === "tree_beech_card_01"
      )
        mesh = o;
    });
    if (!mesh) throw Error("Actual retained native leaf template missing");
    const full = mesh.geometry,
      ids = full.index ? Array.from(full.index.array.slice(0, 6)) : [0, 1, 2, 3, 4, 5],
      vertices = [...new Set(ids)],
      remap = new Map(vertices.map((v, i) => [v, i])),
      geometry = new T.BufferGeometry();
    for (const [name, a] of Object.entries(full.attributes))
      geometry.setAttribute(
        name,
        new T.Float32BufferAttribute(
          vertices.flatMap((v) =>
            Array.from({ length: a.itemSize }, (_, c) => a.getComponent(v, c)),
          ),
          a.itemSize,
        ),
      );
    geometry.setIndex(ids.map((id) => remap.get(id)!));
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.center();
    asset.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const value of Object.values(m)) if (value instanceof T.Texture) value.dispose();
          m.dispose();
        }
      }
    });
    return geometry;
  })());
}
function boxCenter(v: Volume) {
  const p = new T.Vector3()
    .fromArray(v.localMin ?? v.min)
    .add(new T.Vector3().fromArray(v.localMax ?? v.max))
    .multiplyScalar(0.5);
  if (v.localToWorld) p.applyMatrix4(new T.Matrix4().fromArray(v.localToWorld));
  else p.add(new T.Vector3().fromArray(v.origin));
  return new T.Vector3(p.x, p.z, -p.y).multiplyScalar(0.0254);
}
function field(point: T.Vector3, ids: readonly number[], data: Pick<SourceReflections, "volumes">) {
  const source = new T.Vector3(point.x, -point.z, point.y).divideScalar(0.0254);
  let coverage = 0.01;
  const sh = new T.Vector4();
  for (const id of ids) {
    const v = data.volumes[id],
      p = v.worldToLocal
        ? source.clone().applyMatrix4(new T.Matrix4().fromArray(v.worldToLocal))
        : source.clone().sub(new T.Vector3().fromArray(v.origin)),
      lo = v.localMin ?? v.min,
      hi = v.localMax ?? v.max,
      fades = v.localFade ?? v.fade;
    let fade = 1;
    for (let axis = 0; axis < 3; axis++) {
      const inverse = fades[axis] > 0 ? 1 / fades[axis] : 3.402823466e38;
      fade = Math.min(
        fade,
        T.MathUtils.clamp((p.getComponent(axis) - lo[axis]) * inverse, 0, 1),
        T.MathUtils.clamp((hi[axis] - p.getComponent(axis)) * inverse, 0, 1),
      );
    }
    if (fade <= 0) continue;
    const weight = fade * fade * (3 - 2 * fade) * (1 - coverage);
    sh.addScaledVector(new T.Vector4().fromArray(v.normalizationSH), weight);
    coverage += weight;
    if (coverage > 0.99) break;
  }
  return [coverage, ...sh.toArray()];
}
function createBatch(
  source: T.InstancedMesh,
  batch: ReturnType<typeof partitionNativeInstanceReflections>["batches"][number],
) {
  const mesh = new T.InstancedMesh(batch.geometry, batch.material, 0);
  mesh.instanceMatrix = new T.InstancedBufferAttribute(batch.matrices, 16);
  mesh.count = batch.instances.length;
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(batch.worldMatrix);
  mesh.matrixWorldNeedsUpdate = true;
  return mesh;
}
function synthetic(count: number, overlap = false) {
  return {
    volumes: Array.from({ length: count }, (_, i) => ({
      origin: [0, 0, 0],
      min: [(overlap ? 0 : i * 2) / 0.0254, -1 / 0.0254, -1 / 0.0254],
      max: [(overlap ? 30 : i * 2 + 1.5) / 0.0254, 1 / 0.0254, 1 / 0.0254],
      fade: [1, 1, 1],
      normalizationSH: [0.1, 0.2, 0.3, 1],
    })),
  } as SourceReflections;
}
function area(geometry: T.BufferGeometry) {
  const p = geometry.getAttribute("position"),
    index = geometry.index;
  let sum = 0;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const vertices = [0, 1, 2].map((n) =>
      new T.Vector3().fromBufferAttribute(p, index ? index.getX(i + n) : i + n),
    );
    sum += new T.Triangle(...(vertices as [T.Vector3, T.Vector3, T.Vector3])).getArea();
  }
  return sum;
}

test("actual65 native affine/SH frames retain every native leaf instance, matrix bit and weighted field under main/own-sky placement", async () => {
  expect(native.volumes).toHaveLength(65);
  const geometry = await leaf(),
    material = new T.MeshStandardMaterial(),
    mesh = new T.InstancedMesh(geometry, material, 66),
    matrixBefore = new Float32Array(mesh.instanceMatrix.array);
  native.volumes.forEach((v, i) =>
    mesh.setMatrixAt(
      i,
      new T.Matrix4().compose(
        boxCenter(v),
        new T.Quaternion().setFromEuler(new T.Euler(0.1, 0.3 * i, -0.1)),
        new T.Vector3(0.2 + (i % 3) * 0.2, 0.2 + (i % 3) * 0.2, 0.2 + (i % 3) * 0.2),
      ),
    ),
  );
  mesh.setMatrixAt(65, new T.Matrix4().makeTranslation(100000, 100000, 100000));
  matrixBefore.set(mesh.instanceMatrix.array);
  const indexBefore = Array.from(geometry.index!.array),
    attributes = { ...geometry.attributes },
    all = native.volumes.map((_, i) => i);
  for (const ownSky of [false, true]) {
    const world = ownSky
      ? new T.Matrix4().compose(
          new T.Vector3(21, -9, 13),
          new T.Quaternion().setFromEuler(new T.Euler(0.2, 0.5, -0.3)),
          new T.Vector3(16, 16, 16),
        )
      : new T.Matrix4();
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(world);
    mesh.matrixWorldNeedsUpdate = true;
    const options = { worldToNative: ownSky ? world.clone().invert() : undefined, worldPadding: 0 },
      result = partitionNativeInstanceReflections(mesh, native, options),
      seen = new Set<number>(),
      instanceAreas = Array.from({ length: 66 }, () => 0);
    for (const batch of result.batches) {
      expect(batch.candidates.length).toBeLessThanOrEqual(8);
      expect(batch.candidates).toEqual([...batch.candidates].sort((a, b) => a - b));
      const prepared = createBatch(mesh, batch);
      expect(() =>
        assertNativeInstanceReflectionCoverage(prepared, native, batch.candidates, options),
      ).not.toThrow();
      batch.instances.forEach((original, i) => {
        seen.add(original);
        instanceAreas[original] += area(batch.geometry);
        expect(new Uint8Array(batch.matrices.buffer, i * 64, 64)).toEqual(
          new Uint8Array(matrixBefore.buffer, original * 64, 64),
        );
        expect(Array.from(batch.matrices.subarray(i * 16, i * 16 + 16))).toEqual(
          Array.from(matrixBefore.subarray(original * 16, original * 16 + 16)),
        );
        const transform = (options.worldToNative ?? new T.Matrix4())
            .clone()
            .multiply(world)
            .multiply(new T.Matrix4().fromArray(batch.matrices, i * 16)),
          p = batch.geometry.getAttribute("position"),
          idx = batch.geometry.index!;
        for (let n = 0; n < idx.count; n += 3) {
          const tri = [0, 1, 2].map((j) =>
            new T.Vector3().fromBufferAttribute(p, idx.getX(n + j)).applyMatrix4(transform),
          );
          for (const sample of [
            ...tri,
            tri[0]
              .clone()
              .add(tri[1])
              .add(tri[2])
              .multiplyScalar(1 / 3),
          ])
            expect(field(sample, batch.candidates, native)).toEqual(field(sample, all, native));
        }
      });
      prepared.dispose();
    }
    for (const value of instanceAreas) expect(value).toBeCloseTo(area(geometry), 6);
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 66 }, (_, i) => i));
    for (const geometry of result.ownedGeometries) geometry.dispose();
  }
  expect(Array.from(mesh.instanceMatrix.array)).toEqual(Array.from(matrixBefore));
  expect(Array.from(geometry.index!.array)).toEqual(indexBefore);
  expect(geometry.attributes).toEqual(attributes);
  mesh.dispose();
  material.dispose();
});

test("per-instance triangle splitting preserves the separate-mesh baseline area and authored streams without losing instances", () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute([0, 0, 0, 24, 0, 0, 0, 0.5, 0], 3),
  );
  geometry.setAttribute(
    "color",
    new T.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1], 4),
  );
  const material = new T.MeshStandardMaterial(),
    mesh = new T.InstancedMesh(geometry, material, 2),
    data = synthetic(12);
  mesh.setMatrixAt(0, new T.Matrix4());
  mesh.setMatrixAt(1, new T.Matrix4().makeTranslation(0, 0.1, 0));
  const result = partitionNativeInstanceReflections(mesh, data, { worldPadding: 0 });
  expect(result.splitInstances).toBe(2);
  expect(result.extraVertices).toBeGreaterThan(0);
  const areas = [0, 0];
  for (const batch of result.batches) {
    expect(batch.candidates.length).toBeLessThanOrEqual(8);
    expect(batch.instances).toHaveLength(1);
    areas[batch.instances[0]] += area(batch.geometry);
    const p = batch.geometry.getAttribute("position"),
      c = batch.geometry.getAttribute("color");
    for (let i = 0; i < p.count; i++) {
      expect(c.getX(i)).toBeCloseTo(p.getX(i) / 24, 6);
      expect(c.getY(i)).toBeCloseTo(p.getY(i) * 2, 6);
    }
  }
  for (let i = 0; i < 2; i++) {
    const separate = new T.Mesh(geometry, material);
    separate.matrixAutoUpdate = false;
    mesh.getMatrixAt(i, separate.matrix);
    separate.matrixWorldNeedsUpdate = true;
    const baseline = partitionNativeReflections(separate, data);
    expect(areas[i]).toBeCloseTo(
      area(baseline.original.geometry) + (baseline.overflow ? area(baseline.overflow.geometry) : 0),
      6,
    );
    baseline.original.geometry.dispose();
    baseline.overflow?.geometry.dispose();
  }
  for (const g of result.ownedGeometries) g.dispose();
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("empty coverage preserves geometry and instances, while irreducible overlap or incomplete bindings fail closed", () => {
  const geometry = new T.PlaneGeometry(),
    material = new T.MeshStandardMaterial(),
    mesh = new T.InstancedMesh(geometry, material, 2),
    data = synthetic(9, true);
  mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(100, 100, 100));
  mesh.setMatrixAt(1, new T.Matrix4().makeTranslation(101, 100, 100));
  const result = partitionNativeInstanceReflections(mesh, data, { worldPadding: 0 });
  expect(result.batches).toHaveLength(1);
  expect(result.batches[0].instances).toEqual([0, 1]);
  expect(result.batches[0].candidates).toEqual([]);
  expect(result.batches[0].geometry).toBe(geometry);
  mesh.count = 1;
  mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(0.5, 0, 0));
  let overlap: unknown;
  try {
    partitionNativeInstanceReflections(mesh, data, { worldPadding: 0 });
  } catch (error) {
    overlap = error;
  }
  expect(overlap).toBeInstanceOf(Error);
  expect((overlap as Error).cause).toMatchObject({
    capacity: 8,
    reason: expect.stringContaining("overlap exceeds"),
  });
  expect(() =>
    assertNativeInstanceReflectionCoverage(mesh, data, [0], { worldPadding: 0 }),
  ).toThrow(/do not cover/);
  expect(() => applyNativeMapReflections(mesh, data)).toThrow(/not been verified/);
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("deformation envelopes split existing triangles but never introduce nonlinear wind vertices", () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute([0, 0, 0, 24, 0, 0, 0, 0.5, 0], 3),
  );
  const material = new T.MeshStandardMaterial(),
    mesh = new T.InstancedMesh(geometry, material, 1);
  mesh.setMatrixAt(0, new T.Matrix4());
  let error: unknown;
  try {
    partitionNativeInstanceReflections(mesh, synthetic(12), { worldPadding: 0.1 });
  } catch (failure) {
    error = failure;
  }
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).cause).toMatchObject({
    reason: expect.stringContaining("deformed reflection triangle exceeds"),
  });
  const small = new T.InstancedMesh(new T.PlaneGeometry(0.1, 0.1), material, 1);
  small.setMatrixAt(0, new T.Matrix4().makeTranslation(0.5, 0, 0));
  const result = partitionNativeInstanceReflections(small, synthetic(12), { worldPadding: 0.1 });
  expect(result.extraVertices).toBe(0);
  expect(result.batches[0].geometry).toBe(small.geometry);
  small.dispose();
  small.geometry.dispose();
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("runtime binding accepts only complete foliage instance coverage and binds native zero for an empty field", () => {
  const data = synthetic(2);
  data.uniforms = data.volumes.map((v, index) => ({
    origin: new T.Vector3(),
    index,
    mins: new T.Vector3().fromArray(v.min),
    maxs: new T.Vector3().fromArray(v.max),
    invEdge: new T.Vector3(1, 1, 1),
    sh: new T.Vector4(0.1, 0.2, 0.3, 1),
  }));
  data.textures = [];
  data.combined = true;
  const geometry = new T.PlaneGeometry(0.1, 0.1),
    material = new T.MeshStandardMaterial(),
    mesh = new T.InstancedMesh(geometry, material, 1);
  mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(0.5, 0, 0));
  const bindings = new Map([[mesh, { candidates: [0], worldPadding: 0 }]]);
  expect(() => applyNativeMapReflections(mesh, data, [], [], { instances: bindings })).toThrow(
    /not been verified/,
  );
  material.userData.nativeFoliageInstanceSafe = true;
  expect(() =>
    applyNativeMapReflections(mesh, data, [], [], {
      instances: new Map([[mesh, { candidates: [], worldPadding: 0 }]]),
    }),
  ).toThrow(/do not cover/);
  expect(() =>
    applyNativeMapReflections(mesh, data, [], [], { instances: bindings }),
  ).not.toThrow();
  expect(mesh.geometry).toBe(geometry);
  expect(mesh.userData.nativeReflectionPartition.partitioned).toBe(0);
  (mesh.material as T.Material).dispose();
  mesh.material = material;
  mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(100, 100, 100));
  applyNativeMapReflections(mesh, data, [], [], {
    instances: new Map([[mesh, { candidates: [], worldPadding: 0 }]]),
  });
  const shader = {
    uniforms: {},
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  } as T.WebGLProgramParametersWithUniforms;
  (mesh.material as T.Material).onBeforeCompile(shader, {} as T.WebGLRenderer);
  expect(shader.uniforms.sourceEnvironmentCount.value).toBe(0);
  expect(shader.fragmentShader).toContain("#undef USE_ENVMAP");
  (mesh.material as T.Material).dispose();
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("native BYTE candidates retain authored leaf order and exact field weights across the full65 main/own-sky frames", async () => {
  const geometry = (await leaf()).clone(),
    material = new T.MeshStandardMaterial(),
    mesh = new T.InstancedMesh(geometry, material, 66),
    all = native.volumes.map((_, i) => i);
  native.volumes.forEach((volume, i) =>
    mesh.setMatrixAt(
      i,
      new T.Matrix4().compose(
        boxCenter(volume),
        new T.Quaternion().setFromEuler(new T.Euler(0.1, i * 0.3, -0.1)),
        new T.Vector3().setScalar(0.15),
      ),
    ),
  );
  mesh.setMatrixAt(65, new T.Matrix4().makeTranslation(100000, 100000, 100000));
  const before = new Uint8Array(mesh.instanceMatrix.array.buffer).slice(),
    indexBefore = Array.from(geometry.index!.array),
    originalAttributes = { ...geometry.attributes };
  for (const sky of [false, true]) {
    const world = sky
      ? new T.Matrix4().compose(
          new T.Vector3(21, -9, 13),
          new T.Quaternion().setFromEuler(new T.Euler(0.2, 0.5, -0.3)),
          new T.Vector3().setScalar(16),
        )
      : new T.Matrix4();
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(world);
    mesh.matrixWorldNeedsUpdate = true;
    const options = { worldToNative: sky ? world.clone().invert() : undefined, worldPadding: 0 },
      table = createNativeInstanceReflectionCandidates(mesh, native, options);
    expect(table.bytes).toBe(66 * 8);
    expect(table.maximumCandidates).toBeLessThanOrEqual(8);
    nativeInstanceReflectionAttributes.forEach((name, i) =>
      geometry.setAttribute(name, table.attributes[i]),
    );
    expect(() => assertNativeInstanceReflectionCandidates(mesh, native, options)).not.toThrow();
    for (let instance = 0; instance < mesh.count; instance++) {
      const ids = Array.from({ length: 8 }, (_, slot) =>
        table.attributes[slot < 4 ? 0 : 1].getComponent(instance, slot % 4),
      ).filter((id) => id !== 255);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
      const transform = (options.worldToNative ?? new T.Matrix4())
        .clone()
        .multiply(world)
        .multiply(new T.Matrix4().fromArray(mesh.instanceMatrix.array, instance * 16));
      for (const id of geometry.index!.array) {
        const point = new T.Vector3()
          .fromBufferAttribute(geometry.getAttribute("position"), id)
          .applyMatrix4(transform);
        expect(field(point, ids, native)).toEqual(field(point, all, native));
      }
    }
    expect(Array.from(table.attributes[0].array.slice(65 * 4))).toEqual([255, 255, 255, 255]);
    expect(Array.from(table.attributes[1].array.slice(65 * 4))).toEqual([255, 255, 255, 255]);
  }
  expect(new Uint8Array(mesh.instanceMatrix.array.buffer)).toEqual(before);
  expect(Array.from(geometry.index!.array)).toEqual(indexBefore);
  for (const [name, attribute] of Object.entries(originalAttributes))
    expect(geometry.getAttribute(name)).toBe(attribute);
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("BYTE instance reflection bindings reject lost, reordered, normalized or over-capacity coverage", () => {
  const geometry = new T.PlaneGeometry(0.01, 0.01),
    material = new T.MeshStandardMaterial(),
    mesh = new T.InstancedMesh(geometry, material, 2),
    data = synthetic(3),
    options = { worldPadding: 0.02 };
  mesh.setMatrixAt(0, new T.Matrix4().makeTranslation(0.5, 0, 0));
  mesh.setMatrixAt(1, new T.Matrix4().makeTranslation(4.5, 0, 0));
  const table = createNativeInstanceReflectionCandidates(mesh, data, options);
  nativeInstanceReflectionAttributes.forEach((name, i) =>
    geometry.setAttribute(name, table.attributes[i]),
  );
  expect(() => assertNativeInstanceReflectionCandidates(mesh, data, options)).not.toThrow();
  const first = table.attributes[0].array[0];
  table.attributes[0].array[0] = 255;
  expect(() => assertNativeInstanceReflectionCandidates(mesh, data, options)).toThrow(/coverage/);
  table.attributes[0].array[0] = first;
  table.attributes[0].array[1] = first;
  expect(() => assertNativeInstanceReflectionCandidates(mesh, data, options)).toThrow(/coverage/);
  table.attributes[0].array[1] = 255;
  table.attributes[0].normalized = true;
  expect(() => assertNativeInstanceReflectionCandidates(mesh, data, options)).toThrow(/invalid/);
  table.attributes[0].normalized = false;
  expect(() => createNativeInstanceReflectionCandidates(mesh, synthetic(9, true), options)).toThrow(
    /exceed eight/,
  );
  expect(() => createNativeInstanceReflectionCandidates(mesh, synthetic(256), options)).toThrow(
    /BYTE/,
  );
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("native instance admission rejects mirrored and singular transforms", () => {
  const geometry = new T.PlaneGeometry(),
    material = new T.MeshStandardMaterial(),
    mesh = new T.InstancedMesh(geometry, material, 1),
    options = { worldPadding: 0 };
  for (const scale of [new T.Vector3(-1, 1, 1), new T.Vector3(0, 1, 1)]) {
    mesh.setMatrixAt(0, new T.Matrix4().makeScale(scale.x, scale.y, scale.z));
    expect(() => createNativeInstanceReflectionCandidates(mesh, synthetic(1), options)).toThrow(
      /positive nonsingular/,
    );
  }
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});
