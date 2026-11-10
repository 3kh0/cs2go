import { expect, test } from "@playwright/test";
test("legacy vertexlit and simple preserve distinct packed normal roughness metalness and AO response", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results: ReturnType<typeof import("./native-legacy-fixture").renderNativeLegacy> =
    await page.evaluate(async () => {
      const path = "/tests/native-legacy-fixture.ts";
      return (await import(path)).renderNativeLegacy();
    });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  for (const row of results) {
    expect(row.error).toBe(0);
    if (row.mode === "metalness")
      expect(Math.abs(row.pixel[0] - (row.family === "vertexlit" ? 0.7 : 0.31))).toBeLessThan(
        0.001,
      );
    if (row.mode === "ao")
      expect(Math.abs(row.pixel[0] - (row.family === "vertexlit" ? 0.625 : 0.25))).toBeLessThan(
        0.001,
      );
    if (row.mode === "constant") {
      for (const [i, value] of (row.family === "vertexlit"
        ? [0.25, 0.7, 0.625]
        : [0.25, 0.31, 0.25]
      ).entries())
        expect(Math.abs(row.pixel[i] - value)).toBeLessThan(0.001);
    }
    if (row.mode.endsWith("-uv")) {
      const ao = 0.9;
      const expected = row.family === "vertexlit" ? Math.min(1, 0.25 + 1.5 * ao) : ao;
      expect(Math.abs(row.pixel[0] - expected)).toBeLessThan(0.001);
    }
    if (row.mode === "tint-gate" || row.mode === "detail") {
      const color = [0.3, 0.6, 0.2],
        tint = [0.2, 0.4, 0.6],
        detail = [0.6, 0.7, 0.8];
      const expected = color.map((c, i) =>
        row.mode === "tint-gate"
          ? c * (row.family === "vertexlit" ? 1 + (tint[i] - 1) * 0.31 : tint[i])
          : c * (row.family === "vertexlit" ? 1 + ((detail[i] * 508) / 255 - 1) * 0.4 * 0.837 : 1),
      );
      expected.forEach((value, i) => expect(Math.abs(row.pixel[i] - value)).toBeLessThan(0.001));
    }
    if (row.mode === "normal") {
      const n = [
          0.8 + 0.2 - 256 / 255,
          -(0.8 - 0.2),
          1 - Math.abs(0.8 + 0.2 - 256 / 255) - Math.abs(0.8 - 0.2),
        ],
        length = Math.hypot(...n);
      for (const [i, v] of n.entries())
        expect(Math.abs(row.pixel[i] - ((v / length) * 0.5 + 0.5))).toBeLessThan(0.001);
      expect(row.pixel[3]).toBe(0.25);
    }
    if (row.family === "vertexlit" && row.mode === "specular-off")
      expect(row.pixel.slice(0, 3)).toEqual([0, 0, 0]);
    if (row.mode === "specular-on") expect(row.pixel[0]).toBeGreaterThan(0);
  }
});

test("foliage sway samples an actual3D volume and preserves Source control falloff and independent gravity", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results: ReturnType<typeof import("./native-legacy-fixture").renderFoliageSway> =
    await page.evaluate(async () => {
      const path = "/tests/native-legacy-fixture.ts";
      return (await import(path)).renderFoliageSway();
    });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  for (const r of results) {
    expect(r.error).toBe(0);
    const controls = r.mode === "zero-controls" ? [0.001, 0.001, 0.001] : [0.25, 0.7, 0.5],
      noise = [-0.6, -0.2, 0.6],
      dir = [-0.3, -0.1, -0.05],
      mask = 0.8 * 0.8 * 1.5;
    const sway = dir.map(
      (d, i) =>
        (d * mask + (i === 1 ? -1 : 0)) *
        Math.pow(controls[0], 2.867) *
        0.5 *
        (r.mode === "flutter" || r.mode === "rigid" ? 0 : 45) *
        mask,
    );
    const flutter = noise.map(
      (n, i) =>
        (n * (i === 1 ? -1 : 0) + n * dir[i]) *
        0.5 *
        (r.mode === "rigid" ? 0 : 3.75) *
        Math.pow(controls[2], 3.4),
    );
    const expected = sway.map(
      (v, i) =>
        v +
        flutter[i] -
        (i === 2 ? 0.314 * (Math.hypot(sway[0], sway[1]) + Math.hypot(flutter[0], flutter[1])) : 0),
    );
    for (const [i, value] of expected.entries())
      expect(Math.abs(r.pixel[i] - value)).toBeLessThan(0.001);
  }
});

test("independent native resources share one program while retaining their own sampler uniforms in either draw order", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const passes: ReturnType<
    typeof import("./native-legacy-fixture").renderNativeLegacySharedPrograms
  > = await page.evaluate(async () => {
    const path = "/tests/native-legacy-fixture.ts";
    return (await import(path)).renderNativeLegacySharedPrograms();
  });
  console.log(JSON.stringify({ passes, errors }));
  expect(errors).toEqual([]);
  for (const pass of passes) {
    expect(pass.error).toBe(0);
    expect(pass.programs).toBe(1);
    [0.9, 0.1, 0.2, 1, 0.1, 0.8, 0.3, 1].forEach((v, i) =>
      expect(Math.abs(v - pass.pixel[i])).toBeLessThan(0.001),
    );
  }
});
