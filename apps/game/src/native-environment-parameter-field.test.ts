import * as T from "three";
import { expect, test } from "vitest";
import { NativeEnvironmentParameterField } from "./native-environment-parameter-field";

test("parameter banks survive material clones, preserve other blocks and bound allocation", () => {
  const field = new NativeEnvironmentParameterField(2, 2);
  const a = new T.MeshStandardMaterial(),
    b = a.clone(),
    c = a.clone(),
    overflow = a.clone();
  const other = new T.UniformsGroup();
  const words = new Float32Array([0.1, -0, 3, 4, 5, 6, 7, 8]);
  expect(field.add(a, words)).toBeDefined();
  const clone = a.clone() as T.MeshStandardMaterial & { uniformsGroups?: T.UniformsGroup[] };
  clone.uniformsGroups = [other];
  field.attach(clone);
  expect(clone.uniformsGroups).toHaveLength(2);
  const group = clone.uniformsGroups![1];
  expect((group.uniforms[0] as T.Uniform<T.Vector4[]>).value.flatMap((v) => v.toArray())).toEqual([
    ...words,
  ]);
  field.add(b, words);
  field.attach(b);
  expect((b as typeof clone).uniformsGroups![0]).toBe(group);
  expect(field.add(c, new Float32Array(words).fill(1))).toBeDefined();
  field.attach(c);
  expect((c as typeof clone).uniformsGroups![0]).not.toBe(group);
  expect(field.add(overflow, new Float32Array(words).fill(2))).toBeUndefined();
  field.dispose();
  other.dispose();
  [a, b, c, overflow, clone].forEach((m) => m.dispose());
});
