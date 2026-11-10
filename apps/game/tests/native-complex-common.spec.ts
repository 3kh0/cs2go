import { expect, test } from "@playwright/test";
test("eight native complex material families retain independent packed channels tint detail and F0", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/native-complex-common-fixture.ts";
    const m = await import(path);
    return m.renderNativeComplexCommon();
  });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  expect(results).toHaveLength(24);
  for (const result of results) {
    expect(result.error).toBe(0);
    for (let i = 0; i < 4; i++)
      expect(
        Math.abs(result.pixel[i] - result.expected[i]),
        `${result.group}/${result.output}/${i}`,
      ).toBeLessThan(2e-5);
  }
});

test("distinct native material resources textures and numeric uniforms share one program without bleeding", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-complex-shared-fixture.ts";
    return (await import(path)).renderSharedNativeComplex();
  });
  console.log(JSON.stringify({ result, errors }));
  expect(errors).toEqual([]);
  expect(result.programs).toBe(1);
  expect(result.keysEqual).toBe(true);
  for (const frame of result.results) {
    expect(frame.error).toBe(0);
    for (let m = 0; m < 2; m++)
      for (let c = 0; c < 4; c++)
        expect(Math.abs(frame.pixels[m][c] - result.expected[m][c])).toBeLessThan(2e-5);
  }
  expect(result.results[0].pixels).toEqual(result.results[1].pixels);
});
