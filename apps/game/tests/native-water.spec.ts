import { expect, test } from "@playwright/test";
test("native water consumes linear HDR and alpha-cutout depth with active FX smoke half resolution and letterbox", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result: ReturnType<typeof import("./native-water-fixture").renderNativeWater> =
    await page.evaluate(async () => {
      const path = "/tests/native-water-fixture.ts";
      return (await import(path)).renderNativeWater();
    });
  console.log(JSON.stringify({ result, errors }));
  const { results, control, hole, solid, nativeFormula } = result;
  expect(errors).toEqual([]);
  expect(results.map((r) => r.size)).toEqual([64, 32, 64]);
  for (const r of results) {
    expect(r.error).toBe(0);
    expect(r.fxVisible && r.waterVisible && r.backgroundRestored).toBe(true);
    expect(r.viewport).toEqual([8, 8, 48, 48]);
    for (const [i, expected] of [1.7, 0.2, 0.05].entries())
      expect(Math.abs(r.hdr[i] - expected)).toBeLessThan(0.001);
    expect(r.gradeEnabled).toBe(1);
    expect(r.pixel.slice(0, 3).some((value) => value > 0)).toBe(true);
  }
  expect(results[0].pixel).toEqual(results[2].pixel);
  expect(results[0].pixel).not.toEqual(control);
  expect(hole).toBeGreaterThan(solid);
  expect(nativeFormula[0]).toBe(546);
  expect(result.error).toBe(0);
});
test("native quality1 water and complex keep distinct normalization and roughness box rays", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results: ReturnType<
    typeof import("./native-reflection-family-fixture").renderNativeReflectionFamilies
  > = await page.evaluate(async () => {
    const path = "/tests/native-reflection-family-fixture.ts";
    return (await import(path)).renderNativeReflectionFamilies();
  });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  for (const result of results) {
    expect(result.error).toBe(0);
    const expected =
      result.mode === "normalization"
        ? result.family === "legacy"
          ? 8
          : result.family === "complex"
            ? 16
            : 64
        : result.family === "legacy" || result.roughness === 0
          ? [252, 0, 0]
          : [0, 0, 252];
    if (typeof expected === "number")
      for (const value of result.pixel.slice(0, 3))
        expect(Math.abs(value - expected)).toBeLessThanOrEqual(1);
    else expect(result.pixel.slice(0, 3)).toEqual(expected);
  }
});
test("actual native concrete detail2 packed normal and quality1 direct AO response match independent source equations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results: ReturnType<typeof import("./native-complex-fixture").renderNativeComplex> =
    await page.evaluate(async () => {
      const path = "/tests/native-complex-fixture.ts";
      return (await import(path)).renderNativeComplex();
    });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  for (const result of results) {
    expect(result.error).toBe(0);
    const n = [
        0.8 + 0.2 - 256 / 255,
        -(0.8 - 0.2),
        1 - Math.abs(0.8 + 0.2 - 256 / 255) - Math.abs(0.8 - 0.2),
      ],
      length = Math.hypot(...n);
    const overlay = (detail: number) =>
      0.217637640824031 + (Math.pow((detail * 254) / 255, 2.2) - 0.217637640824031) * 0.653;
    const expected =
      result.mode === "overlay"
        ? [0.4717590012408506, 0.4717590012408506, 0.4717590012408506]
        : result.mode === "pivot"
          ? [overlay(0.3), overlay(0.3), overlay(0.3)]
          : result.mode === "normal"
            ? [...n.map((value) => (value / length) * 0.5 + 0.5), 0.25]
            : Array(3).fill(
                2.56 *
                  (1 + 0.04 * 0.125 * Math.pow(0.5, 4)) *
                  (result.mode === "specular0" ? 0 : result.mode === "specular03" ? 0.3 : 1),
              );
    for (const [index, value] of expected.entries())
      expect(Math.abs(result.pixel[index] - value)).toBeLessThan(0.002);
  }
});
test("native quality1 wave predictor samples twice but carries the first sample", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results: ReturnType<
    typeof import("./native-water-wave-fixture").renderNativeWaterPredictor
  > = await page.evaluate(async () => {
    const path = "/tests/native-water-wave-fixture.ts";
    return (await import(path)).renderNativeWaterPredictor();
  });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  for (const result of results) {
    expect(result.error).toBe(0);
    for (let i = 0; i < 3; i++)
      expect(Math.abs(result.actual[i] - result.expected[i])).toBeLessThan(2e-7);
  }
  expect(Math.abs(results[0].actual[0] - results[1].actual[0])).toBeGreaterThan(1e-6);
});
