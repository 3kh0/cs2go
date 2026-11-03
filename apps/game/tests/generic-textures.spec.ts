import { expect, test } from "@playwright/test";

test("native generic normals decode after filtering and preserve perceptual roughness", async ({
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
    const path = "/tests/source-generic-fixture.ts";
    return (await import(path)).renderSourceGenericTextures();
  });
  // Native normal references: RG=(180,100) and bilinearly filtered RG=(150,150).
  for (const [actual, expected] of [
    [result.neutral, [128, 128, 255]],
    [result.flattened, [128, 128, 255]],
    [result.oblique, [145, 68, 239]],
    [result.filtered, [154, 128, 252]],
  ] as const)
    actual.forEach((value: number, channel: number) =>
      expect(Math.abs(value - expected[channel])).toBeLessThanOrEqual(1),
    );
  expect(result.filteredRoughness).toEqual([128, 128, 128]);
  expect(result.roughness).toEqual([51, 51, 51]);
  expect(errors).toEqual([]);
});
