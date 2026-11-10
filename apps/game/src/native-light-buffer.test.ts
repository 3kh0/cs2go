import { expect, test } from "vitest";
import { NativeLightBuffer } from "./native-light-buffer";

test("native light records require finite complete std140 vectors", () => {
  expect(() => new NativeLightBuffer(new Float32Array())).toThrow("std140");
  expect(() => new NativeLightBuffer(new Float32Array(3))).toThrow("std140");
  expect(() => new NativeLightBuffer(new Float32Array([0, 1, Number.NaN, 1]))).toThrow("std140");
  const records = new NativeLightBuffer(new Float32Array(15 * 24 * 4));
  expect(records.byteLength).toBe(15 * 24 * 16);
  records.dispose();
  records.dispose();
  const raw = new NativeLightBuffer(new Uint32Array([0x7fc00001, 0xffffffff, 0, 1]));
  expect(raw.byteLength).toBe(16);
  raw.dispose();
});

test("context loss invalidates records before an earlier application restore listener draws", () => {
  const canvas = new EventTarget();
  let lost = false;
  let nextBuffer = 0;
  let generic: WebGLBuffer | null = null;
  let indexed: WebGLBuffer | null = null;
  const gl = {
    MAX_UNIFORM_BLOCK_SIZE: 1,
    UNIFORM_BUFFER_BINDING: 2,
    UNIFORM_BUFFER: 3,
    STATIC_DRAW: 4,
    isContextLost: () => lost,
    getParameter: (key: number) => (key === 1 ? 65536 : generic),
    getIndexedParameter: () => indexed,
    createBuffer: () => ({ id: ++nextBuffer }),
    bindBuffer: (_target: number, buffer: WebGLBuffer | null) => {
      generic = buffer;
    },
    bindBufferBase: (_target: number, _index: number, buffer: WebGLBuffer | null) => {
      indexed = buffer;
      generic = buffer;
    },
    bufferData: () => {},
    deleteBuffer: () => {},
  };
  const renderer = {
    getContext: () => gl,
    domElement: canvas,
  } as unknown as import("three").WebGLRenderer;
  const records = new NativeLightBuffer(new Float32Array([1, 2, 3, 4]));
  let restoredBuffer: WebGLBuffer | null = null;
  canvas.addEventListener("webglcontextrestored", () =>
    records.withBinding(renderer, () => {
      restoredBuffer = indexed;
    }),
  );
  const initial = records.withBinding(renderer, () => indexed);
  lost = true;
  canvas.dispatchEvent(new Event("webglcontextlost"));
  records.withBinding(renderer, () => {});
  expect(nextBuffer).toBe(1);
  lost = false;
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(nextBuffer).toBe(2);
  expect(restoredBuffer).not.toBe(initial);
  expect(indexed).toBeNull();
  expect(generic).toBeNull();
  records.dispose();
});
