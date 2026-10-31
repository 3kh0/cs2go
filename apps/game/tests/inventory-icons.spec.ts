import { expect, test } from "@playwright/test";

test("HUD finish thumbnails paint visibly and keep silhouettes while loading or failing", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  const choices = await page.evaluate(async () => {
    const path = "/src/skins.ts";
    const { skinCatalog, skinChoices } = (await import(path)) as typeof import("../src/skins");
    const catalog = await skinCatalog();
    return [0, 2, 4].map((weapon) => {
      const skin = catalog.find((skin) => skin.weapon === weapon && skin.body === "legacy")!;
      skinChoices[weapon] = { id: skin.id, wear: 0.1, seed: 1 };
      return { weapon, name: skin.name, image: skin.image };
    });
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/skins/thumbs/**", async (route) => {
    await gate;
    await route.continue();
  });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.invulnerable = 100;
    g.buy(0);
    g.utility.buy("flash");
    g.utility.buy("he");
  });
  for (const { weapon } of choices) {
    const art = page.locator(`#inventory [data-weapon-index="${weapon}"] .inventory-art`);
    await expect(art).not.toHaveClass(/inventory-finish/);
    await expect(art).toHaveCSS("mask-image", /\/icons\//);
  }
  await page.screenshot({ path: "artifacts/inventory-icons-loading.png" });
  release();
  for (const { weapon } of choices) {
    const art = page.locator(`#inventory [data-weapon-index="${weapon}"] .inventory-art`);
    await expect(art).toHaveClass(/inventory-finish/);
    await expect(art).toHaveCSS("mask-image", "none");
    await expect(art.locator("img")).toHaveCSS("opacity", "1");
    expect(
      await art.locator("img").evaluate((image) => (image as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
  }
  await page.screenshot({ path: "artifacts/inventory-icons-loaded.png" });
  const primary = choices[0];
  await page.route(`**${primary.image}?missing=1`, (route) => route.abort());
  await page.evaluate(async (image) => {
    const path = "/src/skins.ts";
    const { skinCatalog } = (await import(path)) as typeof import("../src/skins");
    const skin = (await skinCatalog()).find((skin) => skin.image === image)!;
    // A distinct URL avoids the already decoded successful image in Chromium's
    // memory cache, so this exercises a real failed network request.
    skin.image += "?missing=1";
    window.__game.updateInventory();
  }, primary.image);
  const fallback = page.locator('#inventory [data-weapon-index="0"] .inventory-art');
  await expect(fallback.locator("img")).toHaveAttribute("src", /\/icons\/ak-47\.png$/);
  await expect(fallback).not.toHaveClass(/inventory-finish/);
  await expect(fallback).toHaveCSS("mask-image", /\/icons\/ak-47\.png/);
  expect(
    await fallback.locator("img").evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.locator('#inventory [data-weapon-index="0"] .inventory-name')).toHaveText(
    `AK-47 | ${primary.name}`,
  );
  await expect(page.locator("#inventory [data-grenade-kind]")).toHaveCount(2);
  await page.screenshot({ path: "artifacts/inventory-icons-fallback.png" });
  expect(errors).toEqual([]);
});
