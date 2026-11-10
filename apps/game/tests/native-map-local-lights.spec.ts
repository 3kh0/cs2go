import { expect, test } from "@playwright/test";
test("qualified native local-light world wrapper preserves native atlas/probe shadows and post-light AO", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const rows: ReturnType<typeof import("./native-map-local-lights-fixture").renderMapLocalLights> =
    await page.evaluate(async () => {
      const path = "/tests/native-map-local-lights-fixture.ts";
      return (await import(path)).renderMapLocalLights();
    });
  console.log(JSON.stringify({ rows, errors }));
  expect(errors).toEqual([]);
  for (const row of rows) {
    expect(row.error).toBe(0);
    row.pixel.slice(0, 3).forEach((v, i) => {
      const incident = [0.5, 1, 1.5][i] * (1 - row.shadow);
      expect(v).toBeCloseTo(incident * (1 + (row.direct ? 0.01 * row.ao : 0)), 5);
    });
  }
});
