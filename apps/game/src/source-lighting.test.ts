import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as T from "three";
import {
  loadSourceLighting,
  sampleSourceProbe,
  sampleSourceProbeSun,
  sampleSourceProbeLocalShadows,
  nearestSourceProbe,
} from "./source-lighting";

describe("native probe boundaries", () => {
  beforeAll(async () => {
    vi.stubGlobal(
      "fetch",
      async (url: string) =>
        new Response(
          await readFile(new URL(`../../../packages/assets/public${url}`, import.meta.url)),
        ),
    );
    await loadSourceLighting();
  });
  afterAll(() => vi.unstubAllGlobals());
  it("uses native priority and original cell data at actual overlaps", () => {
    // Native entity boxes/priorities select 26 over 31, 10 over 11, and 5 over 7.
    // Independent native-cell crop references, without claiming original GPU equivalence.
    const references = [
      { volume: 26, p: [284, 2336, -36], rgb: [15.7574070456, 7.9902829091, 3.8753465827] },
      { volume: 10, p: [364, 1552, 256], rgb: [3.4090966392, 2.795356984, 2.3971386051] },
      { volume: 5, p: [-284, -191.644165, 148], rgb: [0.0854181678, 0.1609429854, 0.255686593] },
    ];
    for (const { volume, p, rgb } of references) {
      const point = { x: p[0] * 0.0254, y: p[2] * 0.0254, z: -p[1] * 0.0254 };
      expect(nearestSourceProbe(point)).toBe(volume);
      const color = new T.Color();
      expect(sampleSourceProbe(point, { x: 1, y: 0, z: 0 }, color)).toBe(true);
      for (let channel = 0; channel < 3; channel++)
        expect(Math.abs(color.toArray()[channel] - rgb[channel])).toBeLessThan(1e-5);
    }
  });
  it("retains a zero-fade volume inside its native 0.1-inch extended boundary", () => {
    // Volume42's authored minX is516. This point is 0.05 inches outside its box,
    // inside the native skin; the old min/max rejection instead selected volume30.
    // The equality case follows the independently recorded float32 transform.
    for (const x of [515.9, 515.95, 516]) {
      const point = { x: x * 0.0254, y: 100.140793 * 0.0254, z: -1612.362427 * 0.0254 };
      const color = new T.Color();
      expect(sampleSourceProbe(point, { x: 1, y: 0, z: 0 }, color)).toBe(true);
      for (const [channel, value] of [1.2563283902, 0.8045718316, 0.563353602].entries())
        expect(Math.abs(color.toArray()[channel] - value)).toBeLessThan(1e-5);
      expect(sampleSourceProbeSun(point)).toBeCloseTo(0.2764710562, 7);
    }
  });
  it("uses source-derived directional sky ambient outside all LPVs", () => {
    const point = { x: 10000, y: 10000, z: 10000 };
    const color = new T.Color();
    // Independent Windows float32 metadata, from the pinned sky/bounce/sun rules.
    const sky = [
      [-0.0802456886, 0.7061057091],
      [0.0358253866, 0.694874227],
      [0.1605874896, 0.7412867546],
    ];
    for (const up of [-1, 0, 1]) {
      expect(sampleSourceProbe(point, { x: up === 0 ? 1 : 0, y: up, z: 0 }, color)).toBe(true);
      for (const [channel, [vertical, constant]] of sky.entries())
        expect(
          Math.abs(color.toArray()[channel] - (constant + up * vertical) * Math.PI),
        ).toBeLessThan(2e-6);
    }
    expect(sampleSourceProbeSun(point)).toBe(1);
    const local = new T.Vector2(1, 1);
    sampleSourceProbeLocalShadows(point, local);
    expect(local.toArray()).toEqual([0, 0]);
  });
  it("retains all six positive volumes at the native CT-boundary witness", () => {
    // Windows input-derived selection at this point reaches indices
    // 26,31,28,11,12,30. Four contributions cover only 0.5095446 of the point.
    // Expected values come from original atlas cells and all native weights.
    const point = { x: 488 * 0.0254, y: 72 * 0.0254, z: -2297.9 * 0.0254 };
    const color = new T.Color();
    expect(sampleSourceProbe(point, { x: 0, y: 1, z: 0 }, color)).toBe(true);
    for (const [channel, expected] of [0.737338976, 0.7879639227, 0.9897597449].entries())
      expect(Math.abs(color.toArray()[channel] - expected)).toBeLessThan(1e-5);
    expect(sampleSourceProbeSun(point)).toBeCloseTo(0.1939504411, 6);
  });
  it("retains independent native G/B occlusion under the two tunnel fixtures", () => {
    const first = new T.Vector2(),
      second = new T.Vector2();
    sampleSourceProbeLocalShadows({ x: -1040 * 0.0254, y: 0, z: -1424 * 0.0254 }, first);
    sampleSourceProbeLocalShadows({ x: -692 * 0.0254, y: 0, z: -1424 * 0.0254 }, second);
    expect(first.x).toBeLessThan(0.01);
    expect(first.y).toBeCloseTo(0.4729725074, 7);
    expect(second.x).toBeCloseTo(0.2459241776, 7);
    expect(second.y).toBeLessThan(0.01);
  });
  it("keeps the actual mid-underpass indoor/exterior boundary continuous", () => {
    // Native indoor volume18 extends through the doorway facade. Choosing only
    // its box used to turn this exterior wall nearly black, then jump at its edge.
    const boundary = -12.8016;
    const samples = [-0.001, 0, 0.001].map((offset) => {
      const p = { x: boundary + offset, y: 3.16, z: -34.86 };
      const color = new T.Color();
      expect(sampleSourceProbe(p, { x: 1, y: 0, z: 0 }, color)).toBe(true);
      return { color, sun: sampleSourceProbeSun(p) };
    });
    for (const sample of samples) expect(sample.color.r).toBeGreaterThan(0.1);
    expect(Math.abs(samples[0].color.r - samples[2].color.r)).toBeLessThan(0.01);
    expect(Math.abs(samples[0].sun - samples[2].sun)).toBeLessThan(0.01);
  });
  it("matches all 19 independent native atlas cases for six axes, oblique normals and masks", async () => {
    const reference = JSON.parse(
      await readFile(new URL("./fixtures/native-probe-reference.json", import.meta.url), "utf8"),
    ) as {
      cases: {
        name: string;
        position_source_inches: number[];
        faces_including_sky_rgb: number[][];
        shadow_rgba: number[];
        ambient_oblique: { normal: number[]; including_sky_rgb: number[] };
      }[];
    };
    const axes = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [-1, 0, 0],
      [0, -1, 0],
      [0, 0, -1],
    ];
    const color = new T.Color(),
      local = new T.Vector2();
    for (const r of reference.cases) {
      const [x, y, z] = r.position_source_inches;
      const point = { x: x * 0.0254, y: z * 0.0254, z: -y * 0.0254 };
      for (let axis = 0; axis < 7; axis++) {
        const normal = axis < 6 ? axes[axis] : r.ambient_oblique.normal;
        const expected =
          axis < 6 ? r.faces_including_sky_rgb[axis] : r.ambient_oblique.including_sky_rgb;
        expect(
          sampleSourceProbe(point, { x: normal[0], y: normal[2], z: -normal[1] }, color),
          r.name,
        ).toBe(true);
        for (let channel = 0; channel < 3; channel++)
          expect(
            Math.abs(color.toArray()[channel] / Math.PI - expected[channel]),
            r.name,
          ).toBeLessThan(5e-6);
      }
      expect(Math.abs(sampleSourceProbeSun(point) - (1 - r.shadow_rgba[0])), r.name).toBeLessThan(
        5e-6,
      );
      sampleSourceProbeLocalShadows(point, local);
      expect(Math.abs(local.x - r.shadow_rgba[1]), r.name).toBeLessThan(5e-6);
      expect(Math.abs(local.y - r.shadow_rgba[2]), r.name).toBeLessThan(5e-6);
    }
  });
});
