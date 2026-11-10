import { test, expect } from "@playwright/test";
test("kilometre-scale sky depth keeps the front surface stable and the panorama visible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.route("**/__native-render-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Native rendering</title>",
    }),
  );
  await page.goto("/__native-render-fixture");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-sky-precision-fixture.ts";
    return (await import(path)).skyPrecisionFixture() as ReturnType<
      typeof import("./native-sky-precision-fixture").skyPrecisionFixture
    >;
  });
  console.log("SKY_PRECISION", JSON.stringify(result));
  expect(result.incorrectAfter).toBe(0);
  expect(result.panorama[2]).toBe(255);
  expect(result.glError).toBe(0);
  expect(errors).toEqual([]);
});
