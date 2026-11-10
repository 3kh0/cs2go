import { expect, test } from "@playwright/test";
test("main native FX obtains depth without smoke, feathers with full camera far and aligns letterboxed fog transport", async ({
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
    const path = "/tests/native-map-effects-fixture.ts";
    return (await import(path)).renderNativeMapEffectsFixture();
  });
  console.log(JSON.stringify(rows));
  for (const row of rows) {
    expect(row.control.depthCreated).toBe(false);
    expect(row.feather.depthCreated).toBe(true);
    expect(row.control.error).toBe(0);
    expect(row.feather.error).toBe(0);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(row.control.pixel[i] - row.expectedControl[i]), row.mode).toBeLessThanOrEqual(
        2,
      );
      expect(Math.abs(row.feather.pixel[i] - row.expectedFeather[i]), row.mode).toBeLessThanOrEqual(
        2,
      );
    }
    expect(row.feather.pixel[0]).toBeLessThan(row.control.pixel[0] - 20);
    if (row.mode !== "full") expect(row.feather.outside).toEqual([0, 0, 0]);
    if (row.mode === "half-depth") expect(row.feather.depthSize).toEqual([48, 32]);
  }
  expect(errors).toEqual([]);
});
