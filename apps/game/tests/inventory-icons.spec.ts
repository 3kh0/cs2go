import { expect, test } from "@playwright/test";

test("HUD keeps default silhouettes and skin names for painted weapons", async ({ page }) => {
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
  for (const { weapon, name } of choices) {
    const row = page.locator(`#inventory [data-weapon-index="${weapon}"]`);
    await expect(row.locator("img")).toHaveAttribute("src", /\/icons\/[^/]+\.png$/);
    await expect
      .poll(() => row.locator("img").evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(row.locator(".inventory-name")).toContainText(`| ${name}`);
  }
  await expect(page.locator("#inventory img[src*='/skins/']")).toHaveCount(0);
  await expect(page.locator("#inventory [data-grenade-kind]")).toHaveCount(2);
  await page.screenshot({ path: "artifacts/inventory-icons-fallback.png" });
  expect(errors).toEqual([]);
});
