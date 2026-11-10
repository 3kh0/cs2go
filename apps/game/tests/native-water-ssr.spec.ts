import { expect, test } from "@playwright/test";
test("native SSR hit/miss/zero-step fixed UV taps and oil gates are distinguishing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const p = "/tests/native-water-ssr-fixture.ts";
    return (await import(p)).renderNativeWaterSSR();
  });
  console.log(JSON.stringify({ result, errors }));
  expect(errors).toEqual([]);
  const rows = new Map<string, { name: string; pixel: number[]; error: number }>(
    result.rows.map((r: { name: string; pixel: number[]; error: number }) => [r.name, r]),
  );
  const row = (name: string) => {
    const value = rows.get(name);
    if (!value) throw new Error(name);
    return value;
  };
  for (const r of result.rows as any[]) expect(r.error).toBe(0);
  for (const p of result.programs) expect(p.linked).toBe(true);
  let step = 0.3,
    z = -100,
    index = 1;
  for (; index <= 32; index++) {
    step *= 1.149999976158142;
    z += step;
    const gap = -90 - z;
    if (gap >= 0 && gap < 3 * step) break;
  }
  const progress = index / 32,
    fade = 1 - progress ** 4,
    offset = (-progress / 256) * (6 / 9) + (1 / 512) * (3 / 9),
    sample = [1 + 2 * offset, 1 + 2 * offset, 0.3],
    expected = sample.map((v, i) => [0.1, 0.2, 0.8][i]! * (1 - fade) + v * fade);
  expected.forEach((v, i) => expect(row("hit").pixel[i]).toBeCloseTo(v, 4));
  for (const name of ["translatedRotated", "differentFovNearFar"])
    expected.forEach((v, i) => expect(row(name).pixel[i]).toBeCloseTo(v, 4));
  expect(Math.abs(row("wrongWorldProjection").pixel[0] - row("hit").pixel[0])).toBeGreaterThan(
    0.05,
  );
  for (const name of ["miss", "zeroSteps"])
    [0.1, 0.2, 0.8].forEach((v, i) => expect(row(name).pixel[i]).toBeCloseTo(v, 5));
  expect(Math.abs(row("wrongResolutionOffsets").pixel[0] - row("hit").pixel[0])).toBeGreaterThan(
    0.005,
  );
  for (const [name, y] of [
    ["browserTopFade", 0.95],
    ["browserBottomNoFade", 0.05],
  ] as const) {
    const edgeFade = fade * Math.min((1 - y) * 8, 1),
      edgeSample = [1 + 2 * offset, y * 2 + 2 * offset, 0.3];
    edgeSample.forEach((value, i) =>
      expect(row(name).pixel[i]).toBeCloseTo(
        [0.1, 0.2, 0.8][i]! * (1 - edgeFade) + value * edgeFade,
        4,
      ),
    );
  }
  for (const [name, rgb] of [
    ["oilActiveNoVisibleDebris", [0.9875, 0.95, 0.95]],
    ["oilAlphaHalf", [1, 1, 1]],
    ["oilDeep", [1, 1, 1]],
    ["oilTime", [0.9875, 0.96125, 0.95]],
  ] as const)
    rgb.forEach((v, i) => expect(row(name).pixel[i]).toBeCloseTo(v, 5));
});
test("actual native fountain material and full authored texture chains render through HDR depth framework", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async (path) => {
    const p = "/tests/native-water-ssr-fixture.ts";
    return (await import(p)).renderActualNativeFountain(path);
  }, process.env.NATIVE_FOUNTAIN_URL);
  console.log(JSON.stringify({ actualNativeFountain: result, errors }));
  expect(errors).toEqual([]);
  expect(result.proof.resource).toBe("materials/liquids/inferno_fountain.vmat");
  expect(result.proof.contract).toBe("inferno-fountain-860-d2");
  expect(result.proof.textures).toBe(4);
  expect(result.error).toBe(0);
  for (const row of result.results) {
    expect(row.error).toBe(0);
    expect(row.waterVisible).toBe(true);
    expect(row.backgroundRestored).toBe(true);
    expect(row.pixel.every(Number.isFinite)).toBe(true);
  }
  expect(result.results.map((r: any) => r.size)).toEqual([64, 32, 64]);
  expect(result.cubeRoughness).toHaveLength(3);
  for (const [index, expected] of [0.01, 0.208, 0.3565].entries())
    expect(result.cubeRoughness[index]!.actual).toBeCloseTo(expected, 3);
});
