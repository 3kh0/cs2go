import { describe, expect, it } from "vitest";
import sourcePaint from "../../../packages/assets/public/skins/paints/7_44.json";
import { paintVariables, type Paint } from "./skin-paint";

const paint = sourcePaint as Paint;
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
