import { test, expect } from "@playwright/test";
test("packed reflection uniforms preserve all native family pixels and shared-program bindings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.route("**/__native-render-fixture", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Reflection transport</title>",
    }),
  );
  await page.goto("/__native-render-fixture");
  const result = await page.evaluate(async () => {
    const path = "/tests/reflection-uniforms-fixture.ts";
    return (await import(path)).reflectionUniformsFixture() as ReturnType<
      typeof import("./reflection-uniforms-fixture").reflectionUniformsFixture
    >;
  });
  console.log("REFLECTION_UNIFORMS", JSON.stringify(result));
  expect(result.results).toHaveLength(10);
  expect(result.maxError).toBeLessThan(0.000002);
  expect(result.sharedRestoreError).toBe(0);
  expect(result.nonFinite).toBe(0);
  expect(result.glError).toBe(0);
  for (const row of result.results) {
    expect(row.cases).toBe(36);
    expect(row.differenceFromOther).toBeGreaterThan(0.001);
    const [structured, packed] = row.firstUploads;
    expect(structured.uniform3f).toBeGreaterThan(0);
    expect(packed.uniform3f).toBe(0);
    expect(packed.uniform4fv).toBe(1);
    expect(Object.values(packed).reduce((a, b) => a + b, 0)).toBeLessThan(
      Object.values(structured).reduce((a, b) => a + b, 0),
    );
  }
  expect(errors).toEqual([]);
});
