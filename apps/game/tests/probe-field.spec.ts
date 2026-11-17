import { expect, test } from "@playwright/test";

for (const map of ["vertigo", "inferno"])
  test(`shared and selected probe fields preserve ${map} irradiance and shadow colors`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
    await page.goto("/audio/source/manifest.json");
    const result = await page.evaluate(async (map) => {
      const path = "/tests/probe-field-fixture.ts";
      return (await import(path)).probeFieldFixture(map);
    }, map);
    expect(result.cases).toBeGreaterThan(48);
    expect(result.maxSelected).toBeLessThan(result.total);
    expect(result.maxError).toBeLessThan(0.000002);
    expect(result.nonFinite).toBe(0);
    expect(result.glError).toBe(0);
    expect(errors).toEqual([]);
  });
