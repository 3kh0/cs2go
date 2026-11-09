import { expect, test } from "@playwright/test";

test("loadout updates retain keyboard control and collection position", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#inventory-button").click();
  const collection = page.locator(".loadout-candidates");
  await expect(collection).toBeVisible();
  await expect(page.locator("#loadout-editor")).toBeFocused();

  const category = page.locator("#loadout-category");
  await category.focus();
  await category.selectOption("Rifles");
  await expect(category).toBeFocused();

  await category.selectOption("All Items");
  await collection.evaluate((element) => {
    element.scrollTop = 120;
  });
  const scrollTop = await collection.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  const awp = page.locator('[data-loadout-weapon="3"]');
  await awp.focus({ timeout: 10_000 });
  const positionBeforeEquip = await collection.evaluate((element) => element.scrollTop);
  await page.keyboard.press("Enter");
  await expect(awp).toBeFocused();
  expect(await collection.evaluate((element) => element.scrollTop)).toBe(positionBeforeEquip);

  await page.keyboard.press("Escape");
  await expect(page.locator("#loadout-editor")).toHaveCount(0);
  await expect(page.locator("#inventory-button")).toBeFocused();
});
