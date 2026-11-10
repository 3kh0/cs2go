import { expect, test } from "@playwright/test";

test("native min-radius branch keeps distant cables visible with quarter coverage and opaque blending", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-cables-fixture.ts";
    const { renderNativeCableFixture: render } = await import(path);
    const parent = render({ pose: "parent", capture: true }),
      baked = render({ pose: "baked", capture: true }),
      wrong = render({ pose: "parent", wrongModelScale: true, capture: true });
    const difference = (a: number[], b: number[]) =>
      a.reduce((sum, v, i) => sum + (v !== b[i] ? 1 : 0), 0);
    const poseDifference = difference(parent.captured!, baked.captured!),
      wrongScaleDifference = difference(parent.captured!, wrong.captured!);
    const clean = (r: typeof parent) => {
      const { captured: _captured, ...metrics } = r;
      return metrics;
    };
    return {
      parent: clean(parent),
      baked: clean(baked),
      wrongScale: clean(wrong),
      poseDifference,
      wrongScaleDifference,
      staleFov: render({ staleFov: true }),
      cloneDepth: render({ cloneDepth: true }),
      ortho: render({ orthographic: true }),
      near: render(),
      far: render({ distance: 40 }),
      physical: render({ distance: 40, clamp: false }),
      noFloor: render({ distance: 40, noCoverageFloor: true }),
      offAxis: render({ centerX: 5 }),
      wrongDepth: render({ centerX: 5, euclideanDepth: true }),
    };
  });
  console.log(JSON.stringify(result));
  expect(errors).toEqual([]);
  for (const row of Object.values(result)) if (typeof row === "object") expect(row.glError).toBe(0);
  expect(result.poseDifference).toBeLessThanOrEqual(4);
  expect(result.wrongScaleDifference).toBeGreaterThan(100);
  expect(result.baked.streamRadius).toBeCloseTo(1.6, 6);
  expect(result.baked.streamHeight).toBeCloseTo(1.6, 6);
  expect(result.parent.maxRGB).toBe(result.baked.maxRGB);
  expect(result.staleFov).toEqual(result.near);
  expect(result.cloneDepth.rows).toEqual(result.cloneDepth.depthRows);
  expect(result.cloneDepth.depthPixels).toBe(result.cloneDepth.pixels);
  expect(result.ortho.maxRGB).toBe(255);
  expect(result.ortho.rows).toEqual([31, 32]);
  expect(result.far.pixels).toBeGreaterThan(0);
  expect(result.physical.pixels).toBe(0);
  expect(result.far.maxRGB).toBe(64);
  expect(result.noFloor.maxRGB).toBeLessThan(30);
  expect(result.near.rows).toEqual([31, 32]);
  expect(result.far.rows).toEqual([31, 32]);
  expect(result.offAxis.maxRGB).toBeGreaterThan(result.wrongDepth.maxRGB);
});
