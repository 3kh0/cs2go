import { expect, test } from "@playwright/test";
test("native light UBO binds first StandardMaterial draw shares programs and restores ownership state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result: Awaited<
    ReturnType<typeof import("./native-light-buffer-fixture").renderNativeLightBuffers>
  > = await page.evaluate(async () => {
    const path = "/tests/native-light-buffer-fixture.ts";
    return (await import(path)).renderNativeLightBuffers();
  });
  console.log(JSON.stringify({ result, errors }));
  expect(errors).toEqual([]);
  for (const key of [
    "contextRestored",
    "restored",
    "exceptionRestored",
    "ownedReleased",
    "externalSurvived",
    "oversizedRejected",
    "disposedRejected",
  ] as const)
    expect(result[key]).toBe(true);
  expect(result.defaultBinding).toBe(0);
  for (const row of result.rows) {
    expect(row.error).toBe(0);
    expect(row.programs).toBe(1);
    const expected = row.name.includes("second")
      ? [0.72, 0.24, 0.06]
      : row.name === "external-after-native"
        ? [0.02, 0.06, 0.12]
        : [0.1, 0.21, 0.36];
    row.pixel
      .slice(0, 3)
      .forEach((value, i) => expect(Math.abs(value - expected[i])).toBeLessThan(1e-6));
  }
});
