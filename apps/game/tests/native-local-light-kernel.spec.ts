import { test, expect } from "@playwright/test";
test("native local-light projection attenuation barn and baked mask branches retain independent HDR vectors", async ({
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
    typeof import("./native-local-light-kernel-fixture").renderNativeLocalLightKernel
  > = await page.evaluate(async () => {
    const path = "/tests/native-local-light-kernel-fixture.ts";
    return (await import(path)).renderNativeLocalLightKernel();
  });
  console.log(JSON.stringify({ rows, errors }));
  expect(errors).toEqual([]);
  for (const row of rows) {
    expect(row.error).toBe(0);
    row.actual.forEach((value, i) =>
      expect(Math.abs(value - row.expected[i])).toBeLessThan(0.00001),
    );
  }
});
