import { expect, test } from "@playwright/test";

test("separate team loadouts filter, accept drops and persist spawned skins", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto("/");
  await page.waitForFunction(
    () => document.querySelector<HTMLButtonElement>("#play")?.disabled === false,
    undefined,
    { timeout: 100_000 },
  );
  await page.locator("#inventory-button").click();
  await expect(page.locator(".loadout-team")).toHaveCount(1);
  await expect(page.locator("#inventory-button")).toHaveAttribute("aria-current", "page");
  const header = await page.locator(".home-header").boundingBox();
  expect(header!.height).toBeCloseTo((64 * 1200) / 1080, 0);
  const cosmeticSlot = await page
    .locator('.loadout-team [data-loadout-cosmetic="agents"]')
    .boundingBox();
  expect(cosmeticSlot!.width).toBeCloseTo((64 * 1200) / 1080, 0);
  await page.locator('.loadout-opponent [data-inventory-team="t"]').click();
  await expect(page.locator(".loadout-team")).toHaveAttribute("data-team", "t");
  await page.locator('[data-filter-category="Rifles"]').click();
  await expect(page.locator("#loadout-category")).toHaveValue("Rifles");
  const weaponCard = await page
    .locator('[data-category="Rifles"][data-inventory-slot="0"]')
    .boundingBox();
  expect(weaponCard!.width).toBeCloseTo((160 * 1200) / 1080, 0);
  expect(weaponCard!.height).toBeCloseTo((98 * 1200) / 1080, 0);
  const card = page.locator('[data-loadout-weapon="3"]');
  await card.dragTo(page.locator('[data-category="Rifles"][data-inventory-slot="0"]'));
  await expect(page.locator('[data-category="Rifles"][data-inventory-slot="0"]')).toHaveAttribute(
    "data-weapon",
    "3",
  );
  await page
    .locator('[data-loadout-weapon="3"]')
    .dragTo(page.locator('[data-category="Pistols"][data-inventory-slot="0"]'));
  await expect(page.locator('[data-category="Pistols"][data-inventory-slot="0"]')).toHaveAttribute(
    "data-weapon",
    "7",
  );
  await page.locator('.loadout-opponent [data-inventory-team="ct"]').click();
  await expect(page.locator('[data-category="Rifles"][data-inventory-slot="0"]')).toHaveAttribute(
    "data-weapon",
    "1",
  );
  await page.locator('.loadout-opponent [data-inventory-team="t"]').click();
  await expect(page.locator("#loadout-agent-t")).toHaveAttribute("data-agent", /.+/);
  await expect(page.locator("#home-scenery-button")).toBeHidden();
  const bounds = await page.locator("#loadout-editor").boundingBox();
  const rail = await page.locator(".home-social").boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(rail!.x + 1);
  await expect(page.locator(".loadout-team .loadout-cosmetics button")).toHaveCount(3);
  await page.screenshot({ path: "artifacts/loadout-one-team.png" });
  await page.locator('.loadout-team [data-loadout-cosmetic="agents"]').click();
  await expect(page.locator("#loadout-category")).toHaveValue("Agents");
  await expect(page.locator("[data-cosmetic-choice]")).not.toHaveCount(0);
  await page.locator('.loadout-team [data-loadout-cosmetic="gloves"]').click();
  await expect(page.locator("#loadout-category")).toHaveValue("Gloves");
  await page.locator('.loadout-team [data-loadout-cosmetic="knives"]').click();
  await expect(page.locator("#loadout-category")).toHaveValue("Knives");
  await page
    .locator('[data-cosmetic-choice="5"]')
    .dragTo(page.locator('.loadout-team [data-loadout-cosmetic="knives"]'));
  await expect(page.locator('.loadout-team [data-loadout-cosmetic="knives"] img')).toHaveAttribute(
    "alt",
    "Butterfly Knife",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  const compact = await page.locator("#loadout-editor").boundingBox();
  const compactRail = await page.locator(".home-social").boundingBox();
  expect(compact!.x + compact!.width).toBeLessThanOrEqual(compactRail!.x + 1);
  await page.locator('[data-filter-category="Rifles"]').click();
  const wideCard = await page
    .locator('[data-category="Rifles"][data-inventory-slot="0"]')
    .boundingBox();
  expect(wideCard!.width).toBeCloseTo((160 * 900) / 1080, 0);
  await page.screenshot({ path: "artifacts/loadout-widescreen.png" });
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.locator("#close-loadout-editor").click();
  await page.locator("#skins-button").click();
  await expect(page.locator("#skins-button")).toHaveAttribute("aria-current", "page");
  const animation = await page
    .locator("#skins-button")
    .evaluate((button) => getComputedStyle(button, "::before").animationName);
  expect(animation).not.toBe("none");
  const initialTransform = await page
    .locator("#skins-button")
    .evaluate((button) => getComputedStyle(button, "::before").transform);
  await page.waitForFunction(
    (initial) =>
      getComputedStyle(document.getElementById("skins-button")!, "::before").transform !== initial,
    initialTransform,
  );
  await page.screenshot({
    path: "artifacts/menu-header-motion.png",
    clip: { x: 0, y: 0, width: 1600, height: 72 },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator("#skins-button")
      .evaluate((button) => getComputedStyle(button, "::before").animationName),
  ).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const defaults = await page.locator("#skin-grid [data-skin]").count();
  await page.locator("#inventory-weapon").selectOption("0");
  await page.locator("#add-inventory-item").click();
  const skin = page.locator('#skin-grid [data-skin]:not([data-skin=""])').first();
  await expect(skin).toBeVisible();
  const id = await skin.getAttribute("data-skin");
  await skin.click();
  await page.locator("#apply-skin").click();
  await expect(page.locator("#skin-status")).toContainText("Added to your inventory");
  await expect(page.locator("#skin-grid [data-skin]")).toHaveCount(2);
  await page.locator("#inventory-weapon").selectOption("all");
  await expect(page.locator("#skin-grid [data-skin]")).toHaveCount(defaults + 1);
  const boxes = await page.locator("#skin-grid button").evaluateAll((cards) =>
    cards.slice(0, 14).map((card) => ({
      top: card.getBoundingClientRect().top,
      bottom: card.getBoundingClientRect().bottom,
    })),
  );
  expect(boxes[7].top).toBeGreaterThanOrEqual(boxes[0].bottom);
  const tile = await page.locator("#skin-grid button").first().boundingBox();
  expect(tile!.width).toBeCloseTo((192 * 1200) / 1080, 0);
  expect(tile!.height).toBeCloseTo((190 * 1200) / 1080, 0);
  await page.screenshot({ path: "artifacts/inventory-collection.png" });
  await page.reload();
  await page.locator("#skins-button").click();
  await expect(page.locator(`#skin-grid [data-skin="${id}"]`)).toBeVisible();
  expect(errors).toEqual([]);
});
