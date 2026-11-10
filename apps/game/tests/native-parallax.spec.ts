import { expect, test } from "@playwright/test";
test("native parallax combines authored layers, opacity mask and emission in linear GPU space", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/native-parallax-fixture.ts";
    return (await import(path)).renderNativeParallaxFixture();
  });
  console.log(JSON.stringify(results));
  for (const result of results) {
    expect(result.error).toBe(0);
    for (let c = 0; c < 3; c++)
      expect(Math.abs(result.actual[c] - result.expected[c])).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("native parallax follows tangent-space angle and preserves authored roughness mips", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/native-parallax-fixture.ts",
      m = await import(path);
    return {
      angles: m.renderNativeParallaxAngleFixture(),
      mips: m.renderNativeParallaxMipFixture(),
    };
  });
  console.log(JSON.stringify(results));
  for (const r of [...results.angles, ...results.mips]) {
    expect(r.error).toBe(0);
    expect(Math.abs(r.actual - r.expected)).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("native parallax HDR cube faces compose with directional native lightmap hooks", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-parallax-fixture.ts";
    return (await import(path)).renderNativeParallaxCubeFixture();
  });
  console.log(JSON.stringify(result));
  expect(result.activeSamplers).toBeLessThanOrEqual(result.maxTextures);
  expect(result.error).toBe(0);
  for (let c = 0; c < 3; c++)
    expect(Math.abs(result.actual[c] - result.expected[c])).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("native material address modes preserve half-texel filtering and independent default samplers", async ({
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
    const path = "/tests/native-parallax-fixture.ts";
    return (await import(path)).renderNativeParallaxAddressFixture();
  });
  for (const result of results) {
    expect(result.error).toBe(0);
    for (let c = 0; c < 3; c++)
      expect(Math.abs(result.actual[c] - result.expected[c])).toBeLessThanOrEqual(1);
  }
  expect(results).toHaveLength(32);
  expect(errors).toEqual([]);
});
