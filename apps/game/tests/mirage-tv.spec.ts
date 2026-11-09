import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("native Mirage TV keeps its cabinet material separate from the screen", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/mirage-tv-fixture.ts";
    return ((await import(path)) as typeof import("./mirage-tv-fixture")).renderMirageTelevisions();
  });
  await mkdir("artifacts", { recursive: true });
  for (const capture of result.captures)
    await writeFile(
      `artifacts/mirage-tv-${capture.name}.png`,
      Buffer.from(capture.image.split(",")[1], "base64"),
    );
  await writeFile(
    "artifacts/mirage-tv-render.json",
    JSON.stringify({ ...result, captures: undefined }, null, 2),
  );
  expect(result.glError).toBe(0);
  expect(result.televisionMaterials.tv).toBeGreaterThan(0);
  expect(result.televisionMaterials.tvebstest).toBeGreaterThan(0);
  expect(result.televisionMaterials.tvanimstatic).toBeGreaterThan(0);
  expect(result.emission.tv).toBe(0);
  expect(result.emission.tvebstest).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
