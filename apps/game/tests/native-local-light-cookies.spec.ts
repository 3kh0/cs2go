import { expect, test } from "@playwright/test";
function decode(v: number) {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
test("native planar cookie RGB uses decoded linear black-border taps, independent layers and original local-light compositing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result: ReturnType<
    typeof import("./native-local-light-cookies-fixture").renderNativeCookieControls
  > = await page.evaluate(async () => {
    const p = "/tests/native-local-light-cookies-fixture.ts";
    return (await import(p)).renderNativeCookieControls();
  });
  console.log(
    JSON.stringify({ result: { rows: result.rows, integration: result.integration }, errors }),
  );
  expect(errors).toEqual([]);
  for (const row of result.rows) {
    expect(row.error).toBe(0);
    const p = row.uv.map((v, i) => v * [result.width, result.height][i] - 0.5),
      lo = p.map(Math.floor),
      t = p.map((v, i) => v - lo[i]);
    const expected = [0, 0, 0];
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const x = lo[0] + dx,
          y = lo[1] + dy;
        if (x < 0 || x >= result.width || y < 0 || y >= result.height) continue;
        const w = (dx ? t[0] : 1 - t[0]) * (dy ? t[1] : 1 - t[1]);
        for (let c = 0; c < 3; c++)
          expected[c] +=
            result.decodedTexels[(row.layer * result.height + y) * result.width + x][c] * w;
      }
    row.pixel.slice(0, 3).forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6));
  }
  for (const row of result.coordinates) {
    expect(row.error).toBe(0);
    const inside = Math.abs(row.q[0]) < 1 && Math.abs(row.q[1]) < 1 && row.q[2] > 0 && row.q[2] < 1;
    const expected = inside
      ? [row.q[0] * 0.5 + 0.5, -row.q[1] * 0.5 + 0.5, 1, 1]
      : [-2, -2, -2, -2];
    row.pixel.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6));
  }
  // GPU sRGB8 transfer uses implementation precision. Independently verify
  // each texel against IEC within one 16-bit linear step, then use hardware
  // decoded centers for exact independent CPU filtering/compositing controls.
  result.decodedTexels.forEach((pixel, index) =>
    pixel
      .slice(0, 3)
      .forEach((v, c) =>
        expect(Math.abs(v - decode(result.data[index * 4 + c]))).toBeLessThanOrEqual(1 / 65535),
      ),
  );
  const mask = result.decodedTexels[2 * result.width * result.height][0];
  for (const row of result.integration) {
    expect(row.error).toBe(0);
    row.pixel
      .slice(0, 3)
      .forEach((v, i) =>
        expect(v).toBeCloseTo(
          [0.5, 1, 1.5][i] * (1 - row.shadow) * (1 + (row.direct ? 0.01 * row.ao : 0)) * mask,
          5,
        ),
      );
  }
});
