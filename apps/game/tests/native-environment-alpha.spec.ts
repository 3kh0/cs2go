import { expect, test } from "@playwright/test";
for (const instanced of [false, true])
  test(`native alpha coverage survives lighting clones shadow depth distance and SmokeComposite (instanced=${instanced})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
    await page.goto("/audio/source/manifest.json");
    const result = await page.evaluate(async (instanced) => {
      const path = "/tests/native-environment-alpha-fixture.ts";
      return (await import(path)).renderNativeAlphaConsumers(instanced);
    }, instanced);
    console.log(JSON.stringify({ result, errors }));
    expect(errors).toEqual([]);
    expect(result.restored).toBe(true);
    expect(result.mapDetached).toBe(true);
    expect(result.alphaToCoverage).toBe(false);
    expect(result.bankDepth).toBe(2);
    expect(result.display.hole).toEqual([0, 0, 0, 0]);
    expect(result.display.surface).toEqual([255, 255, 255, 255]);
    for (const pass of [result.shadow, result.distance, result.smokeDepth]) {
      expect(pass.hole).toEqual([255, 255, 255, 255]);
      expect(pass.surface).not.toEqual(pass.hole);
      expect(pass.error).toBe(0);
    }
    expect(result.display.error).toBe(0);
  });
test("native AA equations retain UV footprint and strength-zero semantics without guessing engine state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/native-environment-alpha-fixture.ts";
    return (await import(path)).renderNativeAlphaEquations();
  });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  for (const result of results) {
    expect(result.error).toBe(0);
    for (const value of result.actual.slice(0, 3))
      expect(Math.abs(value - result.expected)).toBeLessThanOrEqual(1);
  }
});
