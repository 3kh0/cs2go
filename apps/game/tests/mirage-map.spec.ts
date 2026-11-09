import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

for (const fallback of [false, true])
  test(`native Mirage cameras render warm native props with ${fallback ? "decoded" : "compressed"} probes`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [],
      requests: string[] = [],
      failed: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => requests.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    });
    await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
    if (fallback)
      await page.route("**/mirage-lighting/gpu-probes/source.json", async (route) => {
        const response = await route.fetch();
        const source = await response.json();
        await route.fulfill({ json: { ...source, arrays: source.fallbacks } });
      });
    await page.goto("/audio/source/manifest.json");
    const result = await page.evaluate(async () => {
      const path = "/tests/mirage-map-fixture.ts";
      return (
        (await import(path)) as typeof import("./mirage-map-fixture")
      ).renderMirageMapFixture();
    });
    await mkdir("artifacts", { recursive: true });
    for (const view of result.captures) {
      await writeFile(
        `artifacts/mirage-${fallback ? "fallback-" : ""}${view.name}.png`,
        Buffer.from(view.image.split(",")[1], "base64"),
      );
      expect(view.meanLuminance).toBeGreaterThan(20);
      expect(view.meanLuminance).toBeLessThan(235);
      expect(view.blackFraction).toBeLessThan(0.1);
      expect(view.whiteFraction).toBeLessThan(0.35);
    }
    expect(result.meshes).toBeGreaterThan(100);
    expect(result.lightmappedMeshes).toBeGreaterThan(50);
    expect(result.floatingLightmapMeshes).toBe(result.lightmappedMeshes);
    expect(result.layerFamilies).toHaveLength(11);
    expect(result.blendMin).toBe(0);
    expect(result.blendMax).toBe(1);
    expect(result.emission.wall_lamp_bulb).toBe(4);
    expect(result.emission.lightbulb01a_on).toBeCloseTo(2 ** 1.585);
    expect(result.atlasFormats.nativeMapIrradiance.bytes).toBe(16777216);
    expect(result.atlasFormats.nativeMapDirectional.bytes).toBe(8388608);
    expect(result.glError).toBe(0);
    expect(requests.some((path) => /\/models\/maps\/(dust2|lighting\/)/.test(path))).toBe(false);
    expect(requests.some((path) => path.includes("/mirage-lighting/irradiance.exr"))).toBe(false);
    expect(requests.some((path) => new URL(path).origin !== new URL(page.url()).origin)).toBe(
      false,
    );
    expect(failed).toEqual([]);
    expect(errors).toEqual([]);
    const frame = result.captures.find((view) => view.name === "connector-props")!.frameColor!;
    expect(frame[0]).toBeGreaterThan(frame[2] * 1.4);
    expect(frame[0]).toBeGreaterThan(65);
    expect(
      requests.some((path) =>
        path.includes(
          fallback
            ? "/mirage-lighting/gpu-probes/irradiance-rgb16f.bin.gz"
            : "/mirage-lighting/gpu-probes/irradiance.bin.gz",
        ),
      ),
    ).toBe(true);
    await writeFile(
      `artifacts/mirage-map-rendering${fallback ? "-fallback" : ""}.json`,
      JSON.stringify(
        {
          ...result,
          captures: result.captures.map(({ image: _image, ...view }) => view),
          requests,
        },
        null,
        2,
      ),
    );
  });
