import { expect, test } from "@playwright/test";

test("skin normals reuse decoded pixels, evict within budget, and retry failed loads", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90000);
  // Isolate the customization loader from the world's startup workload.
  await page.route(`${baseURL}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Skin loading</title>" }),
  );
  const first = "/skins/textures/09b440dd79c2bfd3.rgba.gz";
  const retry = "/skins/textures/649f3321b6b14237.rgba.gz";
  const requests = new Map<string, number>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    requests.set(path, (requests.get(path) ?? 0) + 1);
  });
  let failed = false;
  await page.route(`**${retry}`, (route) => {
    if (!failed) {
      failed = true;
      return route.fulfill({ status: 503, body: "Retry this asset" });
    }
    return route.continue();
  });
  await page.goto("/");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const apply = (id: string, wear: number) =>
    page.evaluate(
      async ({ id, wear }) => {
        const path = "/src/skins.ts";
        const { setSkin } = (await import(path)) as typeof import("../src/skins");
        await setSkin(0, { id, wear, seed: 661 });
      },
      { id, wear },
    );
  await apply("7_1466", 0.01);
  await apply("7_1466", 0.2);
  await apply("7_1466", 0.4);
  expect(requests.get(first)).toBe(1);
  for (const id of ["7_1449", "7_1425", "7_1397", "7_1352"]) await apply(id, 0.01);
  await apply("7_1466", 0.01);
  expect(requests.get(first)).toBe(2);
  await expect(apply("7_1309", 0.01)).rejects.toThrow("Skin asset could not load");
  await apply("7_1309", 0.01);
  expect(requests.get(retry)).toBe(2);
  expect(errors).toEqual([]);
});

test("superseded selections skip paint downloads and queued GPU work", async ({
  page,
  baseURL,
}) => {
  await page.route(`${baseURL}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Skin loading</title>" }),
  );
  const paints: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/skins/paints/")) paints.push(new URL(request.url()).pathname);
  });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const path = "/src/skins.ts";
    const { setSkin, skinChoices } = (await import(path)) as typeof import("../src/skins");
    await Promise.all(
      ["7_1466", "7_1449", "7_44"].map((id) => setSkin(0, { id, wear: 0.01, seed: 1 })),
    );
    const bakerPath = "/src/skin-baker.ts";
    const { bakeSkin } = (await import(bakerPath)) as typeof import("../src/skin-baker");
    const skipped = await bakeSkin({ targets: [] } as never, 1, 0.01, () => false);
    return { id: skinChoices[0].id, skipped };
  });
  expect(result).toEqual({ id: "7_44", skipped: [] });
  expect(paints).toEqual(["/skins/paints/7_44.json"]);
});
