import { expect, test } from "@playwright/test";
test("native linear world blend precedes one actual VPOST with state and owned target restoration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/native-world-frame-fixture.ts";
    return (await import(path)).renderNativeWorldFrame();
  });
  console.log(JSON.stringify({ result, errors }));
  expect(errors).toEqual([]);
  expect(result.threw).toBe(true);
  expect(result.shadowResult.error).toBe(0);
  expect(result.shadowResult.first.needsUpdate).toBe(false);
  expect(result.shadowResult.second.needsUpdate).toBe(false);
  expect(result.shadowResult.first.calls).toBeGreaterThan(result.shadowResult.second.calls);
  expect(result.prepareResult.restored).toBe(true);
  expect(result.prepareResult.error).toBe(0);
  expect(result.prepareResult.renderedPrograms).toBe(result.prepareResult.preparedPrograms);
  expect(result.prepareResult.pixel).toEqual(result.oldOpaque);
  expect(result.after).toEqual(result.before);
  expect(result.afterException).toEqual(result.oldOpaque);
  expect(result.offscreenResult.error).toBe(0);
  expect(result.offscreenResult.after).toEqual(result.offscreenResult.before);
  expect(result.offscreenResult.inside).toEqual(result.oldOpaque);
  expect(result.offscreenResult.outside).toEqual([0, 255, 0, 255]);
  expect(result.disposed).toBe(2);
  expect(result.borrowedBeforeOwnerDispose).toBe(0);
  expect(result.borrowedDisposed).toBe(1);
  for (const sample of result.results) {
    expect(sample.error).toBe(0);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(sample.newOpaque[i] - result.oldOpaque[i])).toBeLessThanOrEqual(1);
      expect(Math.abs(sample.actual[i] - sample.expected[i])).toBeLessThanOrEqual(1);
    }
  }
  expect(
    Math.max(
      ...result.results[0].actual
        .slice(0, 3)
        .map((v: number, i: number) => Math.abs(v - result.wrongMixed[i])),
    ),
  ).toBeGreaterThan(5);
});
