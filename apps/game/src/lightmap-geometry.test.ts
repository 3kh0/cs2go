import { describe, expect, it } from "vitest";
import * as T from "three";
import { applyCornerLightmap } from "./lightmap-geometry";

describe("native lightmap chart seams", () => {
  it("separates two charts without changing triangles or quantized/interleaved material coordinates", () => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3),
    );
    const buffer = new T.InterleavedBuffer(
      new Uint16Array([0, 0, 9, 65535, 0, 9, 0, 65535, 9, 65535, 65535, 9]),
      3,
    );
    geometry.setAttribute("uv", new T.InterleavedBufferAttribute(buffer, 2, 0, true));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    const before = Array.from(geometry.index!.array).map((i) => [
      geometry.attributes.position.getX(i),
      geometry.attributes.position.getY(i),
      geometry.attributes.uv.getX(i),
      geometry.attributes.uv.getY(i),
    ]);
    const corners = new Uint16Array([
      100, 100, 200, 100, 100, 200, 1000, 1000, 2000, 1000, 2000, 2000,
    ]);
    const splits = applyCornerLightmap(
      geometry,
      corners,
      new Uint8Array([1, 1]),
      new Uint8Array(16).fill(99),
    );
    expect(splits).toBe(2);
    const after = Array.from(geometry.index!.array).map((i) => [
      geometry.attributes.position.getX(i),
      geometry.attributes.position.getY(i),
      geometry.attributes.uv.getX(i),
      geometry.attributes.uv.getY(i),
    ]);
    expect(after).toEqual(before);
    Array.from(geometry.index!.array).forEach((i, corner) => {
      expect(geometry.attributes.sourceUv.getX(i)).toBeCloseTo(corners[corner * 2] / 65535);
      expect(geometry.attributes.sourceUv.getY(i)).toBeCloseTo(corners[corner * 2 + 1] / 65535);
      expect(geometry.attributes.sourceProbe.getX(i)).toBeCloseTo(99 / 255);
    });
  });
  it("keeps invalid triangles wholly on probe fallback at shared chart boundaries", () => {
    const geometry = new T.PlaneGeometry(1, 1);
    applyCornerLightmap(
      geometry,
      new Uint16Array(12).fill(800),
      new Uint8Array([1, 0]),
      new Uint8Array(16),
    );
    const ids = geometry.index!;
    expect([0, 1, 2].map((i) => geometry.attributes.sourceUv.getZ(ids.getX(i)))).toEqual([1, 1, 1]);
    expect([3, 4, 5].map((i) => geometry.attributes.sourceUv.getZ(ids.getX(i)))).toEqual([0, 0, 0]);
  });
  it("joins atlas and fallback lighting continuously without corrupting chart coordinates", () => {
    const geometry = new T.PlaneGeometry(1, 1);
    const original = Array.from(geometry.index!.array);
    const confidence = new Uint8Array(4).fill(255);
    for (const vertex of original.slice(3)) confidence[vertex] = 0;
    applyCornerLightmap(
      geometry,
      new Uint16Array(12).fill(800),
      new Uint8Array([1, 0]),
      new Uint8Array(16).fill(99),
      confidence,
    );
    for (let corner = 0; corner < 6; corner++) {
      const vertex = geometry.index!.getX(corner);
      const uv = geometry.attributes.sourceUv;
      expect(uv.getZ(vertex)).toBe(corner < 3 ? confidence[original[corner]] / 255 : 0);
      expect(uv.getX(vertex)).toBeCloseTo(corner < 3 ? 800 / 65535 : 0);
      expect(geometry.attributes.sourceProbe.getX(vertex)).toBeCloseTo(99 / 255);
    }
  });
});
