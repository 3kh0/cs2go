import { expect, test } from "@playwright/test";
test("native material clone chains retain their shader tangent-frame declarations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/native-material-clone-fixture.ts";
    return (await import(path)).nativeMaterialCloneFrames();
  });
  console.log(JSON.stringify({ results, errors }));
  expect(errors).toEqual([]);
  const baseline = results[0];
  if (!("pixel" in baseline)) throw Error("Missing original control");
  for (const row of results) {
    if (row.path === "lost-defines-control") {
      expect(row.missing).toBe(true);
      continue;
    }
    expect(row.error).toBe(0);
    expect(row.defines).toHaveProperty("USE_NORMALMAP_TANGENTSPACE");
    expect(row.defines).toHaveProperty("USE_TANGENT");
    if (row.path !== "original") expect(row.cloned).toBe(true);
    for (let i = 0; i < 4; i++)
      expect(Math.abs(row.pixel![i] - baseline.pixel![i])).toBeLessThan(0.00001);
  }
});
