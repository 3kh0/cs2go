import { expect, test } from "@playwright/test";

test("loadout opens with owned cosmetics only and independent default knives", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  const requested: string[] = [];
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));
  await page.locator("#inventory-button").click();
  await expect(page.locator("#loadout-editor")).toBeVisible();
  await expect(page.locator("[data-cosmetic-choice]")).toHaveCount(3);
  await expect(page.locator('.loadout-team [data-loadout-cosmetic="knives"] img')).toHaveAttribute(
    "alt",
    "CT Knife",
  );
  await expect(
    page.locator('.loadout-opponent [data-loadout-cosmetic="knives"] img'),
  ).toHaveAttribute("alt", "T Knife");
  await page.locator("#loadout-category").selectOption("Knives");
  await expect(page.locator("[data-cosmetic-choice]")).toHaveCount(1);
  await expect(page.locator('[data-cosmetic-choice="37"]')).toBeVisible();
  await page.locator('.loadout-opponent [data-inventory-team="t"]').click();
  await expect(page.locator('[data-cosmetic-choice="38"]')).toBeVisible();
  expect(requested.filter((path) => path.endsWith("catalog.json"))).toEqual([]);
  await page.screenshot({ path: "artifacts/loadout-owned-defaults.png" });
  await page.locator("#loadout-editor").press("Escape");
  await page.locator("#skins-button").click();
  await expect(page.locator('[data-item-weapon="4"]')).toHaveCount(0);
  await page.locator("#add-inventory-item").click();
  await page.locator("#inventory-weapon").selectOption("4");
  await page.locator('[data-item-weapon="4"][data-skin=""]').click();
  await page.locator("#apply-skin").click();
  await expect(page.locator("#add-inventory-item")).toHaveText("＋ ADD ITEM");
  await page.locator("#close-skins").click();
  await page.locator("#inventory-button").click();
  await page.locator("#loadout-category").selectOption("Knives");
  await expect(page.locator('[data-cosmetic-choice="4"]')).toBeVisible();
  await page.locator('[data-cosmetic-choice="4"]').click();
  await expect(page.locator('.loadout-team [data-loadout-cosmetic="knives"] img')).toHaveAttribute(
    "alt",
    "Bayonet",
  );
  await expect(
    page.locator('.loadout-opponent [data-loadout-cosmetic="knives"] img'),
  ).toHaveAttribute("alt", "T Knife");
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#inventory-button").click();
  await expect(page.locator('.loadout-team [data-loadout-cosmetic="knives"] img')).toHaveAttribute(
    "alt",
    "Bayonet",
  );
  await expect(
    page.locator('.loadout-opponent [data-loadout-cosmetic="knives"] img'),
  ).toHaveAttribute("alt", "T Knife");
  expect(errors).toEqual([]);
});
