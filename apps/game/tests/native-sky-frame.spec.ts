import { expect, test } from "@playwright/test";

test("native sky frame keeps curvature units and raw reflection cube direction invariant at scale16", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const rows = await page.evaluate(async () => {
    const path = "/tests/native-sky-frame-fixture.ts";
    const fixture = await import(path);
    return {
      curvature: fixture.renderNativeSkyCurvatureFixture(),
      reflections: fixture.renderNativeSkyReflectionFixture(),
    };
  });
  console.log(JSON.stringify(rows));
  for (const cases of [rows.curvature, rows.reflections]) {
    for (const row of cases) expect(row.error).toBe(0);
    for (let i = 0; i < 3; i++)
      expect(Math.abs(cases[0].pixel[i] - cases[1].pixel[i])).toBeLessThanOrEqual(2);
  }
  expect(rows.curvature[0].pixel[0]).toBeGreaterThan(5);
  expect(Math.abs(rows.curvature[1].pixel[0] - rows.curvature[2].pixel[0])).toBeGreaterThan(2);
  expect(rows.reflections[0].pixel[0]).toBeGreaterThan(50);
  expect(rows.reflections[0].pixel[1]).toBeGreaterThan(50);
  expect(rows.reflections[0].pixel[2]).toBeLessThan(5);
  expect(rows.reflections[2].pixel).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});
