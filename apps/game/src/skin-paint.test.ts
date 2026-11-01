import { describe, expect, it } from "vitest";
import sourcePaint from "../../../packages/assets/public/skins/paints/7_44.json";
import { expression, paintVariables, type Paint } from "./skin-paint";

const paint = sourcePaint as Paint;
function colorExpression(values: number[], conversion: number) {
  const bytes: number[] = [];
  for (const value of values) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    bytes.push(7, ...new Uint8Array(buffer));
  }
  bytes.push(6, 24, 0, 6, conversion, 0, 0);
  return expression(bytes.map((x) => x.toString(16).padStart(2, "0")).join(""), {}, []) as number[];
}

it("evaluates Source sRGB tint functions without converting alpha", () => {
  const gamma = colorExpression([0.001, 0.18, 1, 0.25], 30);
  expect(gamma[0]).toBeCloseTo(0.01292, 6);
  expect(gamma[1]).toBeCloseTo(0.4613561295, 6);
  expect(gamma[2]).toBeCloseTo(1, 6);
  expect(gamma[3]).toBe(0.25);
  const linear = colorExpression([0.02, 0.5, 1, 0.25], 31);
  expect(linear[0]).toBeCloseTo(0.0015479876, 7);
  expect(linear[1]).toBeCloseTo(0.2140411405, 7);
  expect(linear[2]).toBeCloseTo(1, 6);
  expect(linear[3]).toBe(0.25);
});
describe("native paint seeds", () => {
  it("matches the viewer reference for AK Case Hardened seed 661", () => {
    const t = paint.targets[0],
      v = paintVariables(t.passes[0], t, 661, 0.01);
    // Captured from the public viewer material evaluator, independent of ours.
    const expected = [-0.145778232204422, -0.5303288668508944, 0, 0.18015801628192202];
    expect(v.g_vPatternTexCoordXform0).toEqual(expected);
    expect(v.g_flWearAmount).toBe(0.01);
    expect(v.g_flWearTexCoordRotation).toBeCloseTo(198.04525593204667, 10);
  });
  it("preserves seeded placement across wear changes and changes it across seeds", () => {
    const t = paint.targets[0],
      p = t.passes[0];
    const fresh = paintVariables(p, t, 661, 0.01),
      worn = paintVariables(p, t, 661, 0.95),
      other = paintVariables(p, t, 321, 0.01);
    expect(fresh.g_vPatternTexCoordXform0).toEqual(worn.g_vPatternTexCoordXform0);
    expect(fresh.g_vWearTexCoordXform0).toEqual(worn.g_vWearTexCoordXform0);
    expect(other.g_vPatternTexCoordXform0).not.toEqual(fresh.g_vPatternTexCoordXform0);
    expect(worn.g_flWearAmount).toBe(0.95);
  });
});
