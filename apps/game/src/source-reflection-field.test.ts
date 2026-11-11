import * as T from "three";
import { expect, test, vi } from "vitest";
import {
  createSourceReflectionField,
  packSourceReflectionRecords,
} from "./source-reflection-field";
import type { SourceReflections } from "./source-reflections";
function data() {
  const uniforms = Array.from({ length: 65 }, (_, i) => ({
    origin: new T.Vector3(i + 0.1, 2, 3),
    index: i,
    mins: new T.Vector3(-3, -4, -5),
    maxs: new T.Vector3(4, 5, 6),
    invEdge: new T.Vector3(0.01, 0.02, 0.03),
    sh: new T.Vector4(0.1, 0.2, 0.3, 0.4),
    worldToLocal: new T.Matrix4().makeTranslation(i, -i, 3),
    localToWorld: new T.Matrix4().makeTranslation(-i, i, -3),
  }));
  return { uniforms, volumes: Array.from({ length: 65 }, () => ({})) } as SourceReflections;
}
test.each([false, true])(
  "default-uniform records retain every Float32 field (affine=%s)",
  (affine) => {
    const records = data().uniforms.slice(0, 2);
    // Exercise nontrivial matrix columns, negative values and zero-width fades.
    records[0].worldToLocal!.makeRotationY(0.73).setPosition(-12.5, 33.25, 9.1);
    records[0].localToWorld!.copy(records[0].worldToLocal!).invert();
    records[1].invEdge.x = 3.402823466e38;
    const packed = packSourceReflectionRecords(records, affine),
      stride = affine ? 52 : 20;
    expect(packed.length).toBe(records.length * stride);
    for (const [index, record] of records.entries()) {
      const at = index * stride;
      expect(Array.from(packed.slice(at, at + 4))).toEqual(
        [record.origin.x, record.origin.y, record.origin.z, record.index].map(Math.fround),
      );
      for (const [offset, vector] of [
        [4, record.mins],
        [8, record.maxs],
        [12, record.invEdge],
      ] as const) {
        expect(Array.from(packed.slice(at + offset, at + offset + 4))).toEqual(
          [vector.x, vector.y, vector.z, 0].map(Math.fround),
        );
      }
      expect(Array.from(packed.slice(at + 16, at + 20))).toEqual(
        record.sh.toArray().map(Math.fround),
      );
      if (affine) {
        expect(Array.from(packed.slice(at + 20, at + 36))).toEqual(
          record.worldToLocal!.elements.map(Math.fround),
        );
        expect(Array.from(packed.slice(at + 36, at + 52))).toEqual(
          record.localToWorld!.elements.map(Math.fround),
        );
      }
    }
  },
);
test("std140 retains the complete65 record Float32 values within16KiB", () => {
  const d = data(),
    field = createSourceReflectionField(d);
  expect(field.byteLength).toBe(13520);
  expect(field.byteLength).toBeLessThanOrEqual(16384);
  for (let i = 0; i < 65; i++) {
    const v = d.uniforms[i],
      p = field.packed.subarray(i * 52, i * 52 + 52);
    expect(Array.from(p.slice(0, 4))).toEqual(
      [v.origin.x, v.origin.y, v.origin.z, v.index].map(Math.fround),
    );
    expect(Array.from(p.slice(20, 36))).toEqual(v.worldToLocal!.elements.map(Math.fround));
    expect(Array.from(p.slice(36, 52))).toEqual(v.localToWorld!.elements.map(Math.fround));
  }
  expect(field.group.uniforms).toHaveLength(1);
});
test("shared block releases once after its last final material and rejects unproved coexisting groups", () => {
  const field = createSourceReflectionField(data()),
    a = new T.MeshStandardMaterial(),
    b = a.clone(),
    dispose = vi.fn();
  field.group.addEventListener("dispose", dispose);
  field.attach(a);
  field.attach(b);
  expect(() => field.attach(a)).toThrow("coexistence");
  a.dispose();
  expect(dispose).not.toHaveBeenCalled();
  b.dispose();
  b.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(() => field.attach(new T.MeshStandardMaterial())).toThrow("disposed");
});
