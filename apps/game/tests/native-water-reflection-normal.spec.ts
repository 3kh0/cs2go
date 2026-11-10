import { test, expect } from "@playwright/test";
test("native water matrix role, reflection normal axes and live family hook match independent controls", async ({
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
    const a = "/tests/native-water-reflection-normal-fixture.ts",
      b = "/tests/native-reflection-family-fixture.ts";
    return {
      axes: (await import(a)).renderNativeWaterReflectionNormal(),
      family: (await import(b)).renderNativeReflectionFamilies({
        normalSource: [0.25, 0.1, 1],
        directionPalette: true,
      }),
      old: (await import(b)).renderNativeReflectionFamilies({
        normalSource: [0.25, 0.1, 1],
        directionPalette: true,
        disableWaterShape: true,
      }),
    };
  });
  console.log(JSON.stringify(result));
  for (const row of result.axes) {
    expect(row.error).toBe(0);
    if (row.expected)
      for (let i = 0; i < 3; i++)
        expect(Math.abs(row.normal[i] - row.expected[i])).toBeLessThan(0.000005);
  }
  const diagonal = result.axes.find((x: any) => x.name === "diagonal")!;
  for (const name of ["oldUnshaped", "wrongInverseRole"]) {
    const negative = result.axes.find((x: any) => x.name === name)!;
    expect(
      Math.hypot(...negative.normal.map((x: number, i: number) => x - diagonal.normal[i])),
    ).toBeGreaterThan(0.3);
  }
  const identity = result.axes.find((x: any) => x.name === "identity")!,
    noAmplitude = result.axes.find((x: any) => x.name === "missingViewAmplitude")!;
  expect(
    Math.hypot(...noAmplitude.normal.map((x: number, i: number) => x - identity.normal[i])),
  ).toBeGreaterThan(0.2);
  for (const row of [...result.family, ...result.old]) expect(row.error).toBe(0);
  const select = (rows: any[]) =>
      rows.find((x) => x.family === "water" && x.mode === "normalization")!.pixel,
    now = select(result.family),
    old = select(result.old);
  expect(now[0]).toBeGreaterThan(100);
  expect(now[2]).toBe(0);
  expect(old[0]).toBe(0);
  expect(old[2]).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});
