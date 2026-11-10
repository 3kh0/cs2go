import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("native four LMG detail UV, opaque alpha, static metal and no-spec response", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const rows: Awaited<
    ReturnType<typeof import("./native-lightmapped-four-fixture").fourLightmappedProof>
  > = await page.evaluate(async () => {
    const p = "/tests/native-lightmapped-four-fixture.ts";
    return (await import(p)).fourLightmappedProof();
  });
  await writeFile(
    "artifacts/new-maps/lightmapped-four-numeric-gpu.json",
    JSON.stringify({ rows, errors }, null, 2),
  );
  expect(errors).toEqual([]);
  expect(rows.length).toBe(17);
  for (const r of rows) {
    expect(r.error).toBe(0);
    expect(r.depthWrite).toBe(r.kind !== "nonspec-overlay");
    expect(r.transparent).toBe(r.kind === "nonspec-overlay");
    expect(r.polygonOffset).toBe(r.kind === "nonspec-overlay");
    if (r.mode === "color") {
      (r.kind === "detail1-opaque" ? [0.02808, 0.25344, 0.07056] : [0.054, 0.192, 0.084]).forEach(
        (v, i) => expect(r.pixel[i]).toBeCloseTo(v, 3),
      );
      expect(r.pixel[3]).toBeCloseTo(r.kind === "nonspec-overlay" ? 0.19 : 0.5, 3);
    }
    if (r.mode === "channels") {
      expect(r.pixel[0]).toBeCloseTo(r.metalness, 3);
      expect(r.pixel[1]).toBeCloseTo(0.25, 3);
      if (r.kind === "specular-opaque") expect(r.pixel[2]).toBeCloseTo(0.25, 3);
    }
    if (r.mode === "f0")
      [0.054, 0.192, 0.084].forEach((v, i) =>
        expect(r.pixel[i]).toBeCloseTo(0.04 * (1 - r.metalness) + v * r.metalness, 3),
      );
    if (r.mode === "specular") {
      if (r.kind === "specular-opaque") expect(r.pixel[0]).toBeGreaterThan(0);
      else expect(r.pixel.slice(0, 3)).toEqual([0, 0, 0]);
    }
    if (r.mode === "normal") {
      const n = [1 - 1.003921627998352, -0.6, 1 - Math.abs(1 - 1.003921627998352) - 0.6],
        l = Math.hypot(...n);
      n.forEach((v, i) => expect(r.pixel[i]).toBeCloseTo((v / l) * 0.5 + 0.5, 3));
    }
  }
});
