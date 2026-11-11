import { expect, test } from "@playwright/test";

test("utility shader bounds preserve GPU pixels at frustum edges and skip offscreen draws", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.route("**/__utility-culling", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Utility culling</title>",
    }),
  );
  await page.goto("/__utility-culling");
  const result: ReturnType<
    typeof import("./utility-effects-culling-fixture").renderUtilityCulling
  > = await page.evaluate(async () => {
    const path = "/tests/utility-effects-culling-fixture.ts";
    return (await import(path)).renderUtilityCulling();
  });
  await test.info().attach("utility-culling", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  await test.info().attach("utility-culling-visible-pixels", {
    body: await page.locator("canvas").screenshot(),
    contentType: "image/png",
  });
  expect(errors).toEqual([]);
  expect(result.glError).toBe(0);
  expect(result.rows).toHaveLength(192);
  for (const row of result.rows) {
    const label = JSON.stringify(row);
    expect.soft(row.mismatchedBytes, label).toBe(0);
    expect.soft(row.controlCalls, label).toBe(1);
    expect.soft(row.culledCalls, label).toBe(row.visible ? 1 : 0);
    if (row.visible) expect.soft(row.nonzeroPixels, label).toBeGreaterThan(0);
    else expect.soft(row.nonzeroPixels, label).toBe(0);
  }
});
