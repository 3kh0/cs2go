import { expect, test } from "@playwright/test";

test("map native light and reflection groups retain both blocks and uint count across scopes and contexts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.route("**/__native-ubo-coexistence", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>UBO coexistence</title>",
    }),
  );
  await page.goto("/__native-ubo-coexistence");
  const result: ReturnType<
    typeof import("./native-ubo-coexistence-fixture").renderNativeUboCoexistence
  > = await page.evaluate(async () => {
    const path = "/tests/native-ubo-coexistence-fixture.ts";
    return (await import(path)).renderNativeUboCoexistence();
  });
  console.log("NATIVE_UBO_COEXISTENCE", JSON.stringify({ result, errors }));
  expect(errors).toEqual([]);
  expect(result.rows).toHaveLength(17);
  for (const row of result.rows) {
    const label = `${row.context}:${row.name}:${JSON.stringify(row.blocks)}`;
    expect.soft(row.error, label).toBe(0);
    expect.soft(row.pixel, label).toEqual(row.expected);
  }
});
