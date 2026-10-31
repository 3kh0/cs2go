// @ts-expect-error The Node test runner provides fs; browser source intentionally excludes Node typings.
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as T from "three";
import { loadSourceLighting, sampleSourceProbe, sampleSourceProbeSun } from "./source-lighting";

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
  it("retains irradiance on baked vertical T-spawn walls", async () => {
    const packed = await readFile(
      new URL(
        "../../../packages/assets/public/models/maps/lighting/fallback.bin.gz",
        import.meta.url,
      ),
    );
    const bytes = new Uint8Array(
      await new Response(
        new Blob([packed]).stream().pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer(),
    );
    // Actual +X plaster vertex. A reused normal-axis weight previously zeroed
    // every vertical wall even though the dynamic probe sampler was correct.
    const index = 1080471;
    const dynamic = new T.Color();
    sampleSourceProbe(
      { x: -14.660554885864258, y: 4.518736839294434, z: 27.4834041595459 },
      { x: 1, y: 0, z: 0 },
      dynamic,
    );
    const baked = (bytes[index * 4] / 255) ** 2 * 16 * Math.PI;
    expect(baked).toBeGreaterThan(0.1);
    expect(baked / dynamic.r).toBeGreaterThan(0.5);
    expect(baked / dynamic.r).toBeLessThan(2);
  });
  it("fades the actual CT plaster chart boundary to matching probe lighting", async () => {
    const packed = await readFile(
      new URL(
        "../../../packages/assets/public/models/maps/lighting/confidence.bin.gz",
        import.meta.url,
      ),
    );
    const confidence = new Uint8Array(
      await new Response(
        new Blob([packed]).stream().pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer(),
    );
    // Ray-identified faces 1449996 and 1450040 on either side of the visible
    // CT plaster patch: one rejected chart, one accepted chart. Both must use
    // the shared probe endpoint instead of making a sharp triangular seam.
    for (const vertex of [1868275, 1868277, 1868278, 1868292, 1868312, 1868290])
      expect(confidence[vertex]).toBe(0);
  });
  it("retains native chart lighting on the formerly black garage facade", async () => {
    const [valid, fallback] = await Promise.all(
      ["triangle-valid.bin.gz", "fallback.bin.gz"].map(async (file) => {
        const packed = await readFile(
          new URL(`../../../packages/assets/public/models/maps/lighting/${file}`, import.meta.url),
        );
        return new Uint8Array(
          await new Response(
            new Blob([packed]).stream().pipeThrough(new DecompressionStream("gzip")),
          ).arrayBuffer(),
        );
      }),
    );
    // Ray-identified wall faces at [11.02, 2.03, 16.26]. Simplification spans
    // multiple native triangles; rejecting their shared chart selected an
    // almost-black indoor probe on the outdoor garage facade.
    expect(valid[1557547]).toBe(1);
    expect(valid[1557541]).toBe(1);
    // Farther street facade: equivalent baked charts once caused the complete
    // 221-face surface to fall back to an almost-black indoor probe.
    for (const face of [1541911, 1548927, 1548954, 1548955]) expect(valid[face]).toBe(1);
    const boundaryIrradiance = (fallback[1958757 * 4] / 255) ** 2 * 16;
    expect(boundaryIrradiance).toBeGreaterThan(0.4);
    expect(boundaryIrradiance).toBeLessThan(0.8);
  });
});
