import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("native Mirage A, B and Mid cameras render map-owned lighting without Dust II assets", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [],
    requests: string[] = [],
    failed: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/mirage-map-fixture.ts";
    return ((await import(path)) as typeof import("./mirage-map-fixture")).renderMirageMapFixture();
  });
  await mkdir("artifacts", { recursive: true });
  for (const view of result.captures) {
    await writeFile(
      `artifacts/mirage-${view.name}.png`,
      Buffer.from(view.image.split(",")[1], "base64"),
    );
    expect(view.meanLuminance).toBeGreaterThan(20);
    expect(view.meanLuminance).toBeLessThan(235);
    expect(view.blackFraction).toBeLessThan(0.1);
    expect(view.whiteFraction).toBeLessThan(0.35);
  }
  expect(result.meshes).toBeGreaterThan(100);
  expect(result.lightmappedMeshes).toBeGreaterThan(50);
  expect(result.floatingLightmapMeshes).toBe(result.lightmappedMeshes);
  expect(result.atlasFormats.nativeMapIrradiance.bytes).toBe(16777216);
  expect(result.atlasFormats.nativeMapDirectional.bytes).toBe(8388608);
  expect(result.glError).toBe(0);
  expect(requests.some((path) => /\/models\/maps\/(dust2|lighting\/)/.test(path))).toBe(false);
  expect(requests.some((path) => path.includes("/mirage-lighting/irradiance.exr"))).toBe(false);
  expect(requests.some((path) => new URL(path).origin !== new URL(page.url()).origin)).toBe(false);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(
    "artifacts/mirage-map-rendering.json",
    JSON.stringify(
      { ...result, captures: result.captures.map(({ image: _image, ...view }) => view), requests },
      null,
      2,
    ),
  );
});
