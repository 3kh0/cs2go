import { writeFile, mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
test("selected parking material arithmetic and original geometry tint domains", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const report: Awaited<ReturnType<typeof import("./native-lightmapped-fixture").parkingProof>> =
    await page.evaluate(async () => {
      const p = "/tests/native-lightmapped-fixture.ts";
      return (await import(p)).parkingProof();
    });
  for (const r of report.results) {
    expect(r.error).toBe(0);
    if (r.mode === "color") {
      [0.06, 0.24, 0.12, 0.19].forEach((v, i) => expect(r.pixel[i]).toBeCloseTo(v, 3));
    }
    if (r.mode === "normal") {
      const n = [
          0.8 + 0.2 - 1.003921627998352,
          -(0.8 - 0.2),
          1 - Math.abs(0.8 + 0.2 - 1.003921627998352) - Math.abs(0.8 - 0.2),
        ],
        l = Math.hypot(...n);
      n.forEach((v, i) => expect(r.pixel[i]).toBeCloseTo((v / l) * 0.5 + 0.5, 3));
      expect(r.pixel[3]).toBeCloseTo(0.25, 3);
    }
    if (r.mode === "ao") expect(r.pixel[0]).toBeCloseTo(0.25, 3);
    if (r.mode === "blend") {
      [0.0924, 0.2076, 0.2658, 0.7].forEach((v, i) => expect(r.pixel[i]).toBeCloseTo(v, 3));
    }
  }
  await mkdir("artifacts/new-maps/lightmapped-proof", { recursive: true });
  await writeFile("artifacts/new-maps/lightmapped-proof/report.json", JSON.stringify(report));
  for (const r of report.actual) {
    await writeFile(
      `artifacts/new-maps/lightmapped-proof/actual-${r.domain}.png`,
      Buffer.from(r.image.split(",")[1], "base64"),
    );
    expect(r.error).toBe(0);
    await test.info().attach(`actual-${r.domain}`, {
      body: Buffer.from(r.image.split(",")[1], "base64"),
      contentType: "image/png",
    });
  }
  console.log(
    JSON.stringify({
      results: report.results,
      actual: report.actual.map((r) => ({ domain: r.domain, error: r.error })),
      errors,
    }),
  );
  expect(errors).toEqual([]);
});
