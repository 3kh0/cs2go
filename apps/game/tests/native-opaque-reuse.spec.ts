import { expect, test } from "@playwright/test";
test("native HDR opaque reuse preserves depth, cutouts, nested transparency, smoke and partial viewports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.route("**/__native-render-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Native rendering</title>",
    }),
  );
  await page.goto("/__native-render-fixture");
  const rows = await page.evaluate(async () => {
    const path = "/tests/native-opaque-reuse-fixture.ts";
    return (await import(path)).nativeOpaqueReuseFixture() as ReturnType<
      typeof import("./native-opaque-reuse-fixture").nativeOpaqueReuseFixture
    >;
  });
  console.log("OPAQUE_REUSE", JSON.stringify(rows));
  for (const row of rows) {
    expect(row.glError).toBe(0);
    expect(row.layersRestored && row.backgroundRestored).toBe(true);
    expect(row.maxError).toBeLessThan(0.002);
    if (!row.partial && row.mode !== "smoke")
      expect(row.reuseCalls).toBeLessThan(row.baselineCalls);
    // A nearby cloud can cull every world mesh from the old short-far depth
    // pass. Reusing color/depth still matches it without increasing draws.
    else if (!row.partial && row.clouds)
      expect(row.reuseCalls).toBeLessThanOrEqual(row.baselineCalls);
    else expect(row.reuseCalls).toBe(row.baselineCalls);
  }
  expect(errors).toEqual([]);
});
