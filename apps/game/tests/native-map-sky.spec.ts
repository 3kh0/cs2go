import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
test("native 3D sky composes behind foreground and survives gameplay far clipping", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-map-sky-fixture.ts";
    return (
      (await import(path)) as typeof import("./native-map-sky-fixture")
    ).nativeSkyCompositionFixture();
  });
  expect(result.withSky).toEqual(result.withoutSky);
  expect(result.withSky.slice(0, 3)).toEqual([0, 255, 0]);
  expect(result.farClippingSafe).toBe(true);
  expect(result.scale).toBe(16);
  expect(result.skyEffectMeshes).toBeGreaterThan(0);
  expect(result.glError).toBe(0);
  expect(errors).toEqual([]);
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/mirage-sky-composition-performance.json",
    JSON.stringify(result, null, 2),
  );
});
