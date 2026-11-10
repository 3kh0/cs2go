import { test, expect } from "@playwright/test";
test("native silo detail UV, raw secondary mask and primary AO remain separate from atlas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const rows = await page.evaluate(async () => {
    const path = "/tests/native-complex-secondary-fixture.ts";
    const m = await import(/* @vite-ignore */ path);
    return m.renderNativeSiloUv();
  });
  expect(errors).toEqual([]);
  for (const r of rows) expect(r.error).toBe(0);
  const correct = rows[0].pixel;
  for (const [v, i] of [
    [0.73, 0],
    [0.1375, 1],
    [0.48, 2],
    [0.2, 3],
  ])
    expect(correct[i]).toBeCloseTo(v, 3);
  for (const r of rows.slice(1)) expect(r.pixel).not.toEqual(correct);
});
