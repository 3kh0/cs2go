import { expect, test } from "@playwright/test";

test("native sky effects retain masks, tint, opacity, depth feathering and additive HDR blending", async ({
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
    const path = "/tests/native-sky-clouds-fixture.ts";
    return (
      (await import(path)) as typeof import("./native-sky-clouds-fixture")
    ).renderNativeSkyEffectFixture();
  });
  for (let i = 0; i < 3; i++) {
    expect(Math.abs(result.native[i] - result.expected[i])).toBeLessThan(0.00001);
    expect(Math.abs(result.feathered[i] - result.featherExpected[i])).toBeLessThan(0.00005);
    expect(Math.abs(result.scaledFeathered[i] - result.scaledFeatherExpected[i])).toBeLessThan(
      0.0000001,
    );
    expect(Math.abs(result.additive[i] - result.additiveExpected[i])).toBeLessThan(0.00001);
    expect(result.panned[i]).toBeGreaterThan(result.start[i]);
  }
  expect(result.glError).toBe(0);
  expect(errors).toEqual([]);
});
