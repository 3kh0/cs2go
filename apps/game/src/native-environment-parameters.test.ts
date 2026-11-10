import { expect, test } from "vitest";
import { EnvironmentShaderParameters } from "./native-environment-parameters";
import type * as T from "three";

test("native ENV values share a packed uniform layout independently of their values", () => {
  const build = (offset: number) => {
    const parameters = new EnvironmentShaderParameters();
    const expressions = Array.from({ length: 7 }, (_, index) =>
      parameters.value(`scalar:${index}`, [index + offset]),
    );
    expressions.push(parameters.value("tint", [0.2 + offset, 0.3, 0.4]));
    expressions.push(parameters.value("scalar:0", [offset]));
    const shader = { uniforms: {} } as T.WebGLProgramParametersWithUniforms;
    return { expressions, declaration: parameters.bind(shader), shader, parameters };
  };
  const first = build(0),
    second = build(4);
  expect(first.expressions).toEqual(second.expressions);
  expect(first.declaration).toBe(second.declaration);
  expect(first.parameters.vectorCount).toBe(3);
  expect([...first.shader.uniforms.environmentParameters.value]).toEqual([
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    0,
    expect.closeTo(0.2),
    expect.closeTo(0.3),
    expect.closeTo(0.4),
    0,
  ]);
  expect(second.shader.uniforms.environmentParameters.value[0]).toBe(4);
});

test("native ENV rejects malformed packed values and inconsistent parameter shapes", () => {
  const parameters = new EnvironmentShaderParameters();
  expect(() => parameters.value("bad", [Number.NaN])).toThrow("Invalid");
  expect(() => parameters.value("bad", [])).toThrow("Invalid");
  parameters.value("shape", [1]);
  expect(() => parameters.value("shape", [1, 2])).toThrow("shape changed");
});
