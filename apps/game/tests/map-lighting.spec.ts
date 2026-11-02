import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("Dust II retains native light and shadow contrast with bounded static rendering", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const external: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const url = request.url();
    requests.push(url);
    if (!/^(http:\/\/127\.0\.0\.1:5173|blob:|data:)/.test(url)) external.push(url);
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/map-lighting-fixture.ts";
    const { renderMapLighting } = await import(path);
    return renderMapLighting();
  });
  const directory = new URL("../../../artifacts/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("dust2-native-long-doors.png", directory),
    Buffer.from(result.image.split(",")[1], "base64"),
  );
  const luma = (rgb: number[]) => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  expect(luma(result.sun)).toBeGreaterThan(luma(result.shade) * 1.25);
  expect(result.sun[0]).toBeGreaterThan(result.sun[2]);
  expect(result.shade[2]).toBeGreaterThan(result.shade[0]);
  expect(result.vertices).toBeLessThan(2500000);
  expect(result.invalid).toBe(0);
  expect(result.calls).toBeLessThan(350);
  expect(result.triangles).toBeLessThan(1400000);
  expect(
    requests.some((url) => /corner-uv|triangle-valid|fallback\.bin|confidence\.bin/.test(url)),
  ).toBe(false);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("Dust II loads bounded fallback lighting without native compression support", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/map-lighting-fixture.ts";
    return (await import(path)).renderMapLighting(true);
  });
  expect(requests.some((url) => url.includes("/lighting/irradiance.webp"))).toBe(true);
  expect(requests.some((url) => url.includes("/lighting/shadows.webp"))).toBe(true);
  expect(requests.some((url) => url.includes("/lighting/native/"))).toBe(false);
  expect(result.invalid).toBe(0);
  expect(result.sun[0] + result.sun[1] + result.sun[2]).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test("native cubemap fog preserves near surfaces, caps opacity and clears above its height range", async ({
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
    const path = "/tests/source-fog-fixture.ts";
    return (await import(path)).renderSourceFog();
  });
  expect(result.near.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.far[0]).toBeGreaterThanOrEqual(120);
  expect(result.far[0]).toBeLessThanOrEqual(135);
  expect(result.far.slice(1, 3)).toEqual([0, 0]);
  expect(result.high.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.disabled.slice(0, 3)).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});

test("baked native cables follow the supplied reference curves without exceeding map budgets", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/map-lighting-fixture.ts";
    return (await import(path)).renderMapLighting(false, true);
  });
  expect(result.referenceCables).toHaveLength(20);
  for (const sample of result.referenceCables)
    expect(sample.darkness, `Native cable at ${sample.expected.join(",")}`).toBeGreaterThan(15);
  expect(result.vertices).toBeLessThan(2500000);
  expect(result.invalid).toBe(0);
  const directory = new URL("../../../artifacts/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("dust2-native-reference-cables.png", directory),
    Buffer.from(result.image.split(",")[1], "base64"),
  );
  expect(errors).toEqual([]);
});
