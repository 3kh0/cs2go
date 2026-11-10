import { runPreparationSteps } from "./loading";
import { expect, test } from "vitest";
import * as T from "three";
import {
  partitionNativeReflections,
  partitionNativeReflectionSteps,
} from "./native-reflection-partition";
import type { SourceReflections } from "./source-reflections";

function reflections(count: number, overlapping = false) {
  return {
    volumes: Array.from({ length: count }, (_, i) => {
      const x = overlapping ? 0 : i * 2;
      return {
        origin: [0, 0, 0],
        min: [x / 0.0254, -1 / 0.0254, -1 / 0.0254],
        max: [(x + 1.5) / 0.0254, 1 / 0.0254, 1 / 0.0254],
      };
    }),
  } as SourceReflections;
}
function mesh(positions: number[]) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    "uv1",
    new T.Float32BufferAttribute(
      positions.flatMap((x, i) => (i % 3 ? [] : [x * 0.25, 0.5])),
      2,
    ),
  );
  geometry.setAttribute(
    "color_1",
    new T.Float32BufferAttribute(
      positions.flatMap((x, i) => (i % 3 ? [] : [x * 0.1, 0.3, 0.7, 0.2])),
      4,
    ),
  );
  const object = new T.Mesh(geometry, new T.MeshStandardMaterial());
  object.updateMatrixWorld(true);
  return object;
}

test("large batches retain all local native volumes without copying authored vertex streams", () => {
  const positions = Array.from({ length: 12 }, (_, i) => [
    i * 2,
    0,
    0,
    i * 2 + 1,
    0,
    0,
    i * 2,
    0.5,
    0,
  ]).flat();
  const object = mesh(positions),
    original = object.geometry;
  const result = partitionNativeReflections(object, reflections(12));
  expect(result.extraVertices).toBe(0);
  expect(result.original.groups.length).toBe(2);
  expect(result.original.groups.flatMap((group) => group.candidates)).toEqual(
    Array.from({ length: 12 }, (_, i) => i),
  );
  expect(result.original.geometry.getAttribute("position")).toBe(original.getAttribute("position"));
  expect(result.original.geometry.getAttribute("uv1")).toBe(original.getAttribute("uv1"));
  expect(result.original.geometry.getAttribute("color_1")).toBe(original.getAttribute("color_1"));
  expect(result.original.groups.flatMap((group) => group.indices).sort((a, b) => a - b)).toEqual(
    Array.from({ length: 36 }, (_, i) => i),
  );
});

test("triangles spanning more than eight volumes retain area, UVs and controls through bisection", () => {
  const object = mesh([0, 0, 0, 24, 0, 0, 0, 0.5, 0]);
  const result = partitionNativeReflections(object, reflections(12));
  expect(result.extraVertices).toBeGreaterThan(3);
  expect(result.overflow).toBeDefined();
  const { geometry, groups } = result.overflow!;
  const p = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv1"),
    controls = geometry.getAttribute("color_1");
  for (let i = 0; i < p.count; i++) {
    expect(uv.getX(i)).toBeCloseTo(p.getX(i) * 0.25, 6);
    expect(controls.getX(i)).toBeCloseTo(p.getX(i) * 0.1, 6);
    expect(controls.getW(i)).toBeCloseTo(0.2, 6);
  }
  let area = 0;
  for (const group of groups) {
    expect(group.candidates.length).toBeLessThanOrEqual(8);
    for (let i = 0; i < group.indices.length; i += 3) {
      const vertices = group.indices
        .slice(i, i + 3)
        .map((index) => new T.Vector3().fromBufferAttribute(p, index));
      area += new T.Triangle(...(vertices as [T.Vector3, T.Vector3, T.Vector3])).getArea();
      // Every volume containing an interior sample must be available in its
      // draw, including samples far from the original triangle's midpoint.
      for (const weights of [
        [0.8, 0.1, 0.1],
        [0.1, 0.8, 0.1],
        [0.1, 0.1, 0.8],
        [1 / 3, 1 / 3, 1 / 3],
      ]) {
        const x = vertices.reduce((sum, v, j) => sum + v.x * weights[j], 0);
        for (let volume = 0; volume < 12; volume++)
          if (x > volume * 2 && x < volume * 2 + 1.5) expect(group.candidates).toContain(volume);
      }
    }
  }
  expect(area).toBeCloseTo(6, 6);
});

test("genuine over-capacity overlap fails instead of silently losing native priority", () => {
  expect(() =>
    partitionNativeReflections(mesh([0.1, 0, 0, 1, 0, 0, 0.1, 0.5, 0]), reflections(9, true)),
  ).toThrow("overlap exceeds 8 volumes");
});

test("transparent triangles preserve their authored blending order across reflection regions", () => {
  const object = mesh([0, 2, 0, 2, 0].flatMap((x) => [x, 0, 0, x + 1, 0, 0, x, 0.5, 0]));
  (object.material as T.MeshStandardMaterial).transparent = true;
  const result = partitionNativeReflections(object, reflections(2), 1);
  expect(result.original.groups.flatMap((group) => group.indices)).toEqual(
    Array.from({ length: 15 }, (_, i) => i),
  );
  expect(result.original.groups.map((group) => group.candidates)).toEqual([
    [0],
    [1],
    [0],
    [1],
    [0],
  ]);
});

test("spatial lookup preserves transformed indexed triangle coverage and cooperatively yields", async () => {
  const positions = Array.from({ length: 400 }, (_, i) => {
    const x = (i % 96) * 2;
    return [x, 0, 0, x + 1, 0, 0, x, 0.5, 0];
  }).flat();
  const object = mesh(positions);
  object.geometry.setIndex(Array.from({ length: positions.length / 3 }, (_, i) => i));
  object.position.x = 2;
  object.updateMatrixWorld(true);
  const data = reflections(100);
  const generator = partitionNativeReflectionSteps(object, data);
  expect(generator.next().done).toBe(false);
  const result = await runPreparationSteps(generator);
  const synchronous = partitionNativeReflections(object, data);
  expect(result.original.groups).toEqual(synchronous.original.groups);
  for (const group of result.original.groups) {
    for (const index of group.indices) {
      const x = object.geometry.getAttribute("position").getX(index);
      expect(group.candidates).toContain(Math.floor((x + 2) / 2));
    }
  }
});
