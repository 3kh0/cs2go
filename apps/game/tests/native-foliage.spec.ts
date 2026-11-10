import { expect, test } from "@playwright/test";

test("native foliage transmission, alpha depth and smoke remain separate", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-foliage-fixture.ts";
    return (await import(path)).renderNativeFoliageFixture();
  });
  expect(errors).toEqual([]);
  expect(result.glError).toBe(0);
  // Native backside cosine1 × explicit radiance.5 × albedo(.2,.4,.1).
  expect(result.opaquePixel.slice(0, 3)).toEqual([26, 51, 13]);
  expect(result.holePixel.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.transmissionAoDifference).toBe(0);
  expect(result.motionDifference).toBeGreaterThan(0);
  expect(result.occluded).toBe(0);
  expect(result.hidden).toBe(0);
  expect(result.resetDifference).toBe(0);
  expect(result.depthSeen).toBe(true);
  expect(result.smokeLeaf).toEqual([26, 51, 13]);
  expect(result.smokeHole.reduce((sum: number, value: number) => sum + value, 0)).toBeGreaterThan(
    20,
  );
  // Deliberately omitting foliage from the offscreen depth seed must fail visibly.
  expect(result.smokeLeafWithoutDepth).not.toEqual(result.smokeLeaf);
});

test("native foliage coverage follows actual multisampling and explicit color matrix", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const fixturePath = "/tests/native-foliage-fixture.ts",
      sourcePath = "/tests/native-foliage-source-fixture.ts";
    const fixture = await import(fixturePath),
      source = structuredClone((await import(sourcePath)).nativeFoliageSource);
    source.resolvedMaterialInputs.g_flAlphaBoostStrength = [1, 1, 1, 1];
    source.resolvedMaterialInputs.g_flAlphaTestReference = [0.5, 0.5, 0.5, 0.5];
    const off = fixture.renderNativeFoliageFixture(source, { samples: 0, alpha: 0.5 }),
      on = fixture.renderNativeFoliageFixture(source, { samples: 4, alpha: 0.5 });
    source.resolvedMaterialInputs.g_flAlphaTestReference = [0.3, 0.3, 0.3, 0.3];
    source.FloatParams.g_fTextureColorBrightness = 1.2;
    source.colorCorrectionMatrix = [1.2, 0, 0, 0, 1.2, 0, 0, 0, 1.2];
    const corrected = fixture.renderNativeFoliageFixture(source);
    return {
      off: off.opaquePixel,
      on: on.opaquePixel,
      corrected: corrected.opaquePixel,
      errors: [off.glError, on.glError, corrected.glError],
    };
  });
  expect(errors).toEqual([]);
  expect(result.errors).toEqual([0, 0, 0]);
  expect(result.off.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.on[0]).toBeGreaterThan(0);
  expect(result.on[0]).toBeLessThan(26);
  // Source-qualified MatrixColorCorrect2 brightness1.2, applied after tint.
  expect(result.corrected.slice(0, 3)).toEqual([31, 61, 15]);
});

test("native advanced wind keeps independent fields, unclamped wind and three-point frame", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-foliage-advanced-fixture.ts";
    return (await import(path)).renderNativeFoliageAdvanced();
  });
  expect(errors).toEqual([]);
  for (const row of result) expect(row.glError).toBe(0);
  const near = (actual: number[], expected: number[]) =>
    actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 4));
  // dot(noise,wind)=-1 makes mix(.33,1,-1)=-.34; clamping reverses this displacement.
  near(result[0].position, [10.595, 20.595, 30.595]);
  near(result[1].position, [2.75, 2.25, 0.75]);
  near(result[1].tangent, [0.9, 0, 0]);
  near(result[1].normal, [0, 0, 0.99]);
  near(result[2].position, [0.75, 0.75, 0.75]);
});

test("native foliage own-source coordinates survive baked rotated scale16 placement", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-foliage-fixture.ts";
    return (await import(path)).renderNativeFoliageFrameControl();
  });
  expect(errors).toEqual([]);
  expect(result.glError).toBe(0);
  expect(result.bakedDifference).toBeLessThan(10);
  expect(result.instanceDifference).toBe(0);
  expect(result.wrongFrameDifference).toBeGreaterThan(20);
});
