import { test, expect } from "@playwright/test";

test("native fog uses Source axes, authored height, blend attenuation and gradient-before-cube ordering", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-fog-fixture.ts";
    return (await import(path)).renderNativeFog();
  });
  console.log(JSON.stringify(result));
  expect(errors).toEqual([]);
  expect(result.errors).toEqual([]);
  expect(result.glError).toBe(0);
  const near = (name: string, rgb: number[]) => {
    expect(result.cases[name][3]).toBe(255);
    rgb.forEach((v, i) => expect(Math.abs(result.cases[name][i] - v)).toBeLessThanOrEqual(1));
  };
  near("gradient", [112, 51, 41]);
  near("actorGradient", [112, 51, 41]);
  near("vertical3DDistance", [112, 51, 41]);
  near("height", [82, 51, 46]);
  near("additive", [31, 31, 31]);
  near("mod2x", [82, 82, 82]);
  near("cubeSourcePositiveY", [31, 31, 133]);
  near("cubeYaw90", [133, 31, 31]);
  near("orderedGradientThenCube", [67, 31, 126]);
  expect(result.cases.cubeDisabledHeightAtDifferentElevation).toEqual(
    result.cases.cubeSourcePositiveY,
  );
});
