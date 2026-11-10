import { test, expect } from "@playwright/test";
test("native opaque fence preserves distant AA, selected cutoff, static metal, clone and authored mip coverage", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const r: Record<
    string,
    {
      samples: number;
      scale: number;
      uvScale: number;
      alpha: number;
      pixel: number[];
      error: number;
    }[]
  > = await page.evaluate(async () => {
    const path = "/tests/native-alpha-fence-fixture.ts";
    return (await import(path)).renderNativeAlphaFence();
  });
  await test.info().attach("native-alpha-fence-controls.json", {
    body: JSON.stringify(r, null, 2),
    contentType: "application/json",
  });
  for (const rows of Object.values(r)) for (const row of rows) expect(row.error).toBe(0);
  const find = (rows: any[], samples: number, scale: number, uv: number, alpha: number) =>
    rows.find(
      (x) => x.samples === samples && x.scale === scale && x.uvScale === uv && x.alpha === alpha,
    )!;
  const far = find(r.native, 4, 16, 4, 0.25),
    old = find(r.hardMask, 4, 16, 4, 0.25);
  expect(far.pixel[0]).toBeGreaterThan(0);
  expect(far.pixel[0]).toBeLessThan(255);
  expect(old.pixel[0]).toBe(0);
  expect(find(r.native, 0, 1, 1, 0.49).pixel[0]).toBe(255);
  expect(find(r.wrongCutoff, 0, 1, 1, 0.49).pixel[0]).toBe(0);
  expect(find(r.metal, 0, 1, 1, 0.75).pixel[0]).toBe(255);
  for (let i = 0; i < r.native.length; i++) {
    expect(r.clone[i].pixel).toEqual(r.native[i].pixel);
    expect(r.withoutPrepass[i].pixel[0]).toBe(0);
  }
  for (const alpha of [0.25, 0.49, 0.5, 0.75])
    expect(find(r.native, 4, 1, 1, alpha).pixel).toEqual(find(r.native, 4, 16, 1, alpha).pixel);
  expect(find(r.mipBase, 4, 1, 1, 0.75).pixel[0]).toBe(255);
  const mip = find(r.mipFar, 4, 16, 4, 0.75);
  expect(mip.pixel[0]).toBeGreaterThan(0);
  expect(mip.pixel[0]).toBeLessThan(255);
  expect(errors).toEqual([]);
  await test.info().attach("native-alpha-fence-controls.json", {
    body: JSON.stringify(r, null, 2),
    contentType: "application/json",
  });
});
