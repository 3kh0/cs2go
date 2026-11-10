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

test("native bevel binding evaluates authored percentage before the pixel kernel", async () => {
  const { environmentBevelStrength } = await import("./native-environment-parameters");
  // Retained VCS: MATERIAL_PARAM(g_flBevelStrength2), FLOAT, MUL, RETURN.
  // Read the source operand bytes independently of the runtime's constant.
  const expression = new Uint8Array([0x1d, 0x4b, 0x39, 0xdb, 0xdc, 7, 10, 215, 35, 60, 0x15, 0]);
  const factor = new DataView(expression.buffer).getFloat32(6, true);
  for (const authored of [-0.25, -1, 0, 0.125, 1]) {
    const shaderValue = Math.fround(Math.fround(authored) * factor);
    expect(environmentBevelStrength(authored)).toBe(shaderValue);
    const parameters = new EnvironmentShaderParameters();
    const source = { FloatParams: { g_flBevelStrength2: authored, g_flBevelStrength3: authored } } as never;
    const second = parameters.float(source, "g_flBevelStrength2", 0);
    const third = parameters.float(source, "g_flBevelStrength3", 0);
    const shader = { uniforms: {} } as T.WebGLProgramParametersWithUniforms;
    parameters.bind(shader);
    if (authored === 0) expect([second, third]).toEqual(["0.0", "0.0"]);
    else expect([...shader.uniforms.environmentParameters.value].slice(0, 2)).toEqual([shaderValue, shaderValue]);
  }
  expect(environmentBevelStrength(-0.25)).toBe(-0.0024999999441206455);
  expect(environmentBevelStrength(-0.25)).not.toBe(-0.25);
});
