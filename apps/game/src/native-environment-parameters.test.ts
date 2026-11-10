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
    const source = {
      FloatParams: { g_flBevelStrength2: authored, g_flBevelStrength3: authored },
    } as never;
    const second = parameters.float(source, "g_flBevelStrength2", 0);
    const third = parameters.float(source, "g_flBevelStrength3", 0);
    const shader = { uniforms: {} } as T.WebGLProgramParametersWithUniforms;
    parameters.bind(shader);
    if (authored === 0) expect([second, third]).toEqual(["0.0", "0.0"]);
    else
      expect([...shader.uniforms.environmentParameters.value].slice(0, 2)).toEqual([
        shaderValue,
        shaderValue,
      ]);
  }
  expect(environmentBevelStrength(-0.25)).toBe(-0.0024999999441206455);
  expect(environmentBevelStrength(-0.25)).not.toBe(-0.25);
});

test("native AO controls evaluate their compiled expression once for each layer", async () => {
  const { environmentAmbientOcclusionLevels } = await import("./native-environment-parameters");
  // Independent VCS FLOAT operands: 0x3fb8aa65 and 0x38d1b717.
  const bytes = new Uint8Array([0x65, 0xaa, 0xb8, 0x3f, 0x17, 0xb7, 0xd1, 0x38]);
  const view = new DataView(bytes.buffer),
    coefficient = view.getFloat32(0, true),
    floor = view.getFloat32(4, true);
  for (const raw of [
    [0, 0.5, 1],
    [0.2, 0.09, 1.4],
    [0.8, 1, 0.3],
  ]) {
    const expected = [-raw[0], -coefficient * Math.log(Math.max(floor, 1 - raw[1])), 2 - raw[2]];
    const resolved = environmentAmbientOcclusionLevels(raw);
    resolved.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 5));
    const parameters = new EnvironmentShaderParameters();
    const source = {
      VectorParams: Object.fromEntries(
        [1, 2, 3].map((layer) => [`g_vAmbientOcclusionLevels${layer}`, raw]),
      ),
    } as never;
    for (const layer of [1, 2, 3])
      parameters.vector(source, `g_vAmbientOcclusionLevels${layer}`, [0, 0.5, 1], 3);
    const shader = { uniforms: {} } as T.WebGLProgramParametersWithUniforms;
    parameters.bind(shader);
    for (const offset of [0, 4, 8])
      expect([...shader.uniforms.environmentParameters.value].slice(offset, offset + 3)).toEqual(
        resolved,
      );
  }
  expect(environmentAmbientOcclusionLevels([0, 0.5, 1])[1]).toBeCloseTo(1.000003457, 6);
  expect(environmentAmbientOcclusionLevels([0, 0.5, 1])[1]).not.toBe(0.5);
  expect(() => environmentAmbientOcclusionLevels([0, Number.NaN, 1])).toThrow("Invalid");
});
