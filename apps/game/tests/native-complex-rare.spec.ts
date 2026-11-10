import { expect, test } from "@playwright/test";
test("selected rare14 source channels, paint sentinel, emission and signed transmission execute on GPU", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/native-complex-rare-fixture.ts";
    return (await import(path)).renderNativeComplexRare();
  });
  for (const row of results) {
    expect(row.error, `${row.group}/${row.output}`).toBe(0);
    for (let c = 0; c < 4; c++)
      expect(
        Math.abs(row.pixel[c] - row.expected[c]),
        `${row.group}/${row.output}/${row.paint}/${c}`,
      ).toBeLessThan(0.00003);
  }
  expect(errors).toEqual([]);
  expect(results).toHaveLength(74);
});

test("native alpha matching prepass preserves equality and explicit browser MSAA coverage", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const rows: ReturnType<
    typeof import("./native-complex-rare-fixture").renderNativeComplexRareCoverage
  > = await page.evaluate(async () => {
    const path = "/tests/native-complex-rare-fixture.ts";
    return (await import(path)).renderNativeComplexRareCoverage();
  });
  for (const row of rows) {
    expect(row.error).toBe(0);
    if (!row.samples) expect(row.pixel[0]).toBe(row.alpha < 0.5 ? 0 : 255);
  }
  for (const alpha of [0.25, 0.49, 0.5, 0.75]) {
    const posed = rows.find(
      (r) => r.samples === 4 && r.scale === 1 && r.uvScale === 1 && r.alpha === alpha,
    )!;
    const baked = rows.find(
      (r) => r.samples === 4 && r.scale === 16 && r.uvScale === 1 && r.alpha === alpha,
    )!;
    expect(baked.pixel).toEqual(posed.pixel);
  }
  const half = rows.find((r) => r.samples === 4 && r.scale === 1 && r.alpha === 0.5)!;
  expect(half.pixel[0]).toBeGreaterThan(0);
  expect(half.pixel[0]).toBeLessThan(255);
  const nativeUv = rows.find(
    (r) => r.samples === 4 && r.scale === 16 && r.uvScale === 1 && r.alpha === 0.49,
  )!;
  const wrongUv = rows.find(
    (r) => r.samples === 4 && r.scale === 16 && r.uvScale === 4 && r.alpha === 0.49,
  )!;
  expect(wrongUv.pixel[0]).not.toBe(nativeUv.pixel[0]);
  expect(errors).toEqual([]);
  expect(rows).toHaveLength(16);
});

test("ordinary native translucent COLOR uses source alpha composition and writes depth", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const row = await page.evaluate(async () => {
    const path = "/tests/native-complex-rare-fixture.ts";
    return (await import(path)).renderNativeComplexTruckBlend();
  });
  expect(row.error).toBe(0);
  expect(row.depthWrite).toBe(true);
  for (let c = 0; c < 3; c++)
    expect(Math.abs(row.pixel[c] - row.expected[c])).toBeLessThan(0.00003);
  expect(errors).toEqual([]);
});
