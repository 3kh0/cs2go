import { expect, test } from "@playwright/test";

test("Mirage VPOST matches native filmic/LUT data without leaking into Dust II or adding an actor sampler", async ({
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
    const path = "/tests/native-map-color-fixture.ts";
    return (await import(path)).renderNativeMapColorFixture();
  });
  for (const sample of result.samples)
    for (let channel = 0; channel < 3; channel++) {
      expect(Math.abs(sample.native[channel] - sample.expected[channel])).toBeLessThanOrEqual(1);
      expect(sample.actor[channel]).toBe(sample.native[channel]);
    }
  expect(result.isolated).toEqual(result.plain);
  expect(result.restored).toEqual(result.samples[1].native);
  expect(Math.max(...result.samplerCounts)).toBe(1);
  expect(errors).toEqual([]);
});
