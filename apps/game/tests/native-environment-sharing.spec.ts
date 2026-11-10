import { expect, test } from "@playwright/test";
test("modern environment resources numeric controls and array layers share one correct program", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result: ReturnType<
    typeof import("./native-environment-sharing-fixture").renderEnvironmentSharedPrograms
  > = await page.evaluate(async () => {
    const path = "/tests/native-environment-sharing-fixture.ts";
    return (await import(path)).renderEnvironmentSharedPrograms();
  });
  console.log(JSON.stringify({ result, errors }));
  expect(errors).toEqual([]);
  expect(result.banks).toBe(1);
  for (const row of result.rows) {
    expect(row.programs).toBe(1);
    expect(row.error).toBe(0);
    expect(row.keys[0]).toBe(row.keys[1]);
    row.pixels.forEach((value, i) =>
      expect(Math.abs(value - result.expected[i])).toBeLessThan(0.00001),
    );
  }
  expect(result.rows[0].pixels).toEqual(result.rows[1].pixels);
});

test("legacy environment distinct native resources and color matrices share one correct program", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result: ReturnType<
    typeof import("./native-environment-sharing-fixture").renderLegacyEnvironmentSharedPrograms
  > = await page.evaluate(async () => {
    const path = "/tests/native-environment-sharing-fixture.ts";
    return (await import(path)).renderLegacyEnvironmentSharedPrograms();
  });
  console.log(JSON.stringify({ result, errors }));
  expect(errors).toEqual([]);
  for (const row of result.rows) {
    expect(row.programs).toBe(1);
    expect(row.error).toBe(0);
    expect(row.keys[0]).toBe(row.keys[1]);
    row.pixels.forEach((value, i) => expect(value).toBeCloseTo(result.expected[i], 6));
  }
  expect(result.rows[0].pixels).toEqual(result.rows[1].pixels);
});
