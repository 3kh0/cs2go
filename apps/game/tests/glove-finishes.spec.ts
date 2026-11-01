import { expect, test } from "@playwright/test";
test("every native glove paint bakes locally and preserves seeded wear variation", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 150_000 });
  const result = await page.evaluate(async () => {
    const path = "/src/skin-baker.ts";
    const { bakeSkin } = (await import(path)) as typeof import("../src/skin-baker");
    const catalog = (await (
      await fetch("/skins/gloves/catalog.json")
    ).json()) as import("../src/gloves").GloveDefinition[];
    const failures: string[] = [];
    let count = 0,
      targets = 0;
    for (const item of catalog.filter((item) => item.paint)) {
      try {
        const paint = (await (
          await fetch(`/skins/gloves/paints/${item.id}.json`)
        ).json()) as import("../src/skin-paint").Paint;
        const baked = await bakeSkin(paint, 749, 0.123456);
        if (baked.length !== paint.targets.length) throw new Error("Missing native paint targets");
        for (const target of baked)
          for (const name of ["g_tColor", "g_tNormal", "g_tMetalness", "g_tAmbientOcclusion"]) {
            if (!target.maps[name]?.some((value) => value > 0)) throw new Error(`Empty ${name}`);
          }
        count++;
        targets += baked.length;
      } catch (error) {
        failures.push(`${item.id}: ${String(error)}`);
      }
    }
    const item = catalog.find((item) => /Pandora/.test(item.name))!;
    const paint = await (await fetch(`/skins/gloves/paints/${item.id}.json`)).json();
    const fresh = (await bakeSkin(paint, 749, 0.01))[0].maps.g_tColor;
    const worn = (await bakeSkin(paint, 749, 0.8))[0].maps.g_tColor;
    const another = (await bakeSkin(paint, 12, 0.01))[0].maps.g_tColor;
    const repeat = (await bakeSkin(paint, 749, 0.01))[0].maps.g_tColor;
    const difference = (a: Uint8Array, b: Uint8Array) =>
      a.reduce((n, value, i) => n + Number(value !== b[i]), 0);
    return {
      count,
      targets,
      expected: catalog.filter((item) => item.paint).length,
      failures,
      wear: difference(fresh, worn),
      seed: difference(fresh, another),
      repeat: difference(fresh, repeat),
    };
  });
  expect(result.failures).toEqual([]);
  expect(result.expected).toBe(94);
  expect(result.count).toBe(result.expected);
  expect(result.targets).toBeGreaterThanOrEqual(result.count);
  expect(result.wear).toBeGreaterThan(10000);
  expect(result.seed).toBeGreaterThan(1000);
  expect(result.repeat).toBe(0);
  expect(errors).toEqual([]);
});
