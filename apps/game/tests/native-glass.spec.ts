import { expect, test } from "@playwright/test";
test("native glass dust transmission custom blend fog and geometric depth clip follow independent equations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/native-glass-fixture.ts";
    return (await import(path)).renderNativeGlass();
  });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  expect(results).toHaveLength(8);
  for (const r of results) {
    expect(r.error).toBe(0);
    for (let i = 0; i < r.expected.length; i++)
      expect(Math.abs(r.pixel[i] - r.expected[i]), `${r.mode}/${i}`).toBeLessThan(3e-5);
  }
});
