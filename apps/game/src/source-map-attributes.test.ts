import { describe, expect, it } from "vitest";
import * as T from "three";
import { bindSourceMapAttributes } from "./source-map-attributes";

function geometry(bytes = new Uint8Array([0, 0, 0, 0, 0, 128, 255, 255, 255, 255, 1, 0])) {
  const result = new T.BufferGeometry();
  result.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(9), 3));
  result.setAttribute("color_1", new T.BufferAttribute(bytes, 4, true));
  result.setAttribute("color_2", new T.Uint8BufferAttribute(new Uint8Array(12), 4, true));
  result.setIndex([0, 1, 2]);
  return result;
}

describe("embedded native map lighting", () => {
  it("restores little-endian atlas endpoints and probe sentinel without copying or splitting", () => {
    const mesh = geometry();
    const bytes = mesh.getAttribute("color_1").array;
    const probe = mesh.getAttribute("color_2");
    const index = mesh.getIndex();
    bindSourceMapAttributes(mesh);
    const uv = mesh.getAttribute("sourceUv");
    expect(uv.array.buffer).toBe(bytes.buffer);
    expect(uv.getX(0)).toBe(0);
    expect(uv.getY(0)).toBe(0);
    expect(uv.getX(1)).toBe(32768 / 65535);
    expect(uv.getY(1)).toBe(1);
    expect(uv.getX(2)).toBe(1);
    expect(uv.getY(2)).toBe(1 / 65535);
    expect(mesh.getAttribute("sourceProbe")).toBe(probe);
    expect(mesh.getAttribute("position").count).toBe(3);
    expect(mesh.getIndex()).toBe(index);
    expect(mesh.hasAttribute("color_1")).toBe(false);
    expect(mesh.hasAttribute("color_2")).toBe(false);
  });

  it("rejects truncated lighting and misaligned UV bytes", () => {
    expect(() => bindSourceMapAttributes(geometry(new Uint8Array(8)))).toThrow("invalid");
    const misaligned = new Uint8Array(new ArrayBuffer(13), 1, 12);
    expect(() => bindSourceMapAttributes(geometry(misaligned))).toThrow("not aligned");
  });
});
