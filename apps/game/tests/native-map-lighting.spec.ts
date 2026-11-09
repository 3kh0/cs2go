import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("native map atlases preserve diffuse energy, sun occlusion and independent PBR specular", async ({
  page,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/native-map-lighting-fixture.ts";
    const { renderNativeMapAtlasFixture } = await import(path);
    return [renderNativeMapAtlasFixture(false), renderNativeMapAtlasFixture(true)];
  });
  for (const result of results) {
    for (let channel = 0; channel < 3; channel++) {
      expect(
        Math.abs(result.diffuse[channel] - result.diffuseExpected[channel]),
      ).toBeLessThanOrEqual(1);
      expect(result.withoutAmbientDoubleCount[channel]).toBe(result.diffuse[channel]);
      expect(
        Math.abs(result.directShadow[channel] - result.referenceShadow[channel]),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(result.directSpecular[channel] - result.referenceSpecular[channel]),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(result.indirectSpecular[channel] - result.referenceIndirectSpecular[channel]),
      ).toBeLessThanOrEqual(1);
      expect(result.directClear[channel]).toBeGreaterThan(result.directShadow[channel]);
    }
    expect(result.indirectSpecular[2]).toBeGreaterThan(result.indirectSpecular[0]);
    expect(result.indirectSpecular[2]).toBeGreaterThan(20);
    expect(result.meshes).toBe(1);
    expect(result.isolated).toBe(true);
  }
  expect(requests.some((path) => path.includes("/models/maps/lighting/"))).toBe(false);
  expect(errors).toEqual([]);
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/native-map-atlas-fixture.png",
    Buffer.from(results[1].image.split(",")[1], "base64"),
  );
});

test("Mirage native compressed atlases upload without fetching decoded fallback images", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const native = await page.evaluate(async () => {
    const path = "/tests/native-map-lighting-fixture.ts";
    return (await import(path)).loadMirageMapAtlasFixture();
  });
  expect(native.irradianceFormat).toBe(native.bc6h);
  expect(native.directionalFormat).toBe(native.bc1);
  expect(native.irradianceSize).toEqual([4096, 4096]);
  expect(native.glError).toBe(0);
  expect(requests.some((path) => path.endsWith("irradiance.bin.gz"))).toBe(true);
  expect(requests.some((path) => path.endsWith("directional.bin.gz"))).toBe(true);
  expect(
    requests.some(
      (path) => path.endsWith("irradiance.exr") || /directional\.(png|webp)$/.test(path),
    ),
  ).toBe(false);
  requests.length = 0;
  const fallback = await page.evaluate(async () => {
    const path = "/tests/native-map-lighting-fixture.ts";
    return (await import(path)).loadMirageMapAtlasFixture(true);
  });
  expect(fallback.irradianceType).toBe(fallback.halfFloat);
  expect(fallback.irradianceSize).toEqual([4096, 4096]);
  expect(fallback.glError).toBe(0);
  expect(requests.some((path) => path.endsWith("irradiance.exr"))).toBe(true);
  expect(requests.some((path) => /directional\.(png|webp)$/.test(path))).toBe(true);
  expect(errors).toEqual([]);
});
