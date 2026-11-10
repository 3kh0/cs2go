import { expect, test } from "@playwright/test";

test("native modern environment bands and selected Cache/Inferno branches compile on WebGL2", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/native-modern-environment-fixture.ts";
    return (await import(path)).renderModernEnvironment();
  });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  expect(results).toHaveLength(11);
  for (const result of results) {
    expect(result.error).toBe(0);
    expect(result.actual[3]).toBe(255);
    if (result.expected !== undefined)
      expect(Math.abs(result.actual[0] - result.expected)).toBeLessThanOrEqual(1);
    else expect(result.banks).toBeGreaterThan(0);
    if (result.expectedRoughness !== undefined)
      expect(Math.abs(result.actual[2] - result.expectedRoughness)).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("native biplanar projection follows absolute Source-world units and the final import basis", async ({
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
    const path = "/tests/native-modern-environment-fixture.ts";
    return (await import(path)).renderEnvironmentProjection();
  });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  for (const result of results) {
    expect(result.error).toBe(0);
    result.actual.forEach((value: number, i: number) =>
      expect(Math.abs(value - result.expected[i])).toBeLessThanOrEqual(1),
    );
  }
});

test("native array banks retain depth and authored mip pixels through High Low High settings", async ({
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
    const path = "/tests/native-modern-environment-fixture.ts";
    return (await import(path)).renderEnvironmentBankQuality();
  });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  expect(results.map((r: any) => r.mips)).toEqual([3, 1, 3]);
  for (const result of results) {
    expect(result.depth).toBe(2);
    expect(result.noLod).toEqual([256, 256, 1]);
    expect(result.error).toBe(0);
    for (const value of result.actual.slice(0, 3))
      expect(Math.abs(value - result.expected)).toBeLessThanOrEqual(1);
    expect(result.actual[3]).toBe(255);
  }
});

test("plain native Inferno VMAT preserves linear color packed normals roughness and AO", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const directory = process.env.CS2GO_NATIVE_ENV_DIR ?? "/models/maps/inferno-environment/";
  const results = await page.evaluate(async (directory) => {
    const path = "/tests/native-modern-environment-fixture.ts";
    return (await import(path)).renderPlainNativeEnvironment(directory);
  }, directory);
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  for (const result of results) {
    expect(result.error).toBe(0);
    result.actual.forEach((value: number, i: number) =>
      expect(Math.abs(value - result.expected[i])).toBeLessThanOrEqual(1),
    );
  }
});

test("own-sky material projection undoes nonzero origins reference rotation and scales1/16", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const frames = await page.evaluate(async () => {
    const path = "/tests/native-modern-environment-fixture.ts";
    return (await import(path)).renderEnvironmentSkyProjection();
  });
  console.log(JSON.stringify({ frames, errors }));
  expect(errors).toEqual([]);
  for (const frame of frames)
    for (const result of frame.results) {
      expect(result.error).toBe(0);
      result.actual.forEach((value: number, i: number) =>
        expect(Math.abs(value - result.expected[i])).toBeLessThanOrEqual(1),
      );
    }
});
