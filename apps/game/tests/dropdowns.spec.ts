import { expect, test } from "@playwright/test";

test("styled dropdowns retain keyboard selection and the scenery icon is centered", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  const centers = await page.locator("#home-scenery-button").evaluate((button) => {
    const outer = button.getBoundingClientRect();
    const icon = button.querySelector("svg")!.getBoundingClientRect();
    return {
      x: icon.x + icon.width / 2 - outer.x - outer.width / 2,
      y: icon.y + icon.height / 2 - outer.y - outer.height / 2,
    };
  });
  expect(Math.abs(centers.x)).toBeLessThan(1);
  expect(Math.abs(centers.y)).toBeLessThan(1);
  await page.locator("#home-scenery-button").focus();
  await page.screenshot({ path: "artifacts/home-scenery-alignment.png" });
  await page.locator("#settings-button").click();
  const quality = page.locator("#quality");
  await quality.click();
  await expect.poll(() => quality.evaluate((select) => select.matches(":open"))).toBe(true);
  await page.screenshot({ path: "artifacts/settings-dropdown.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings")).toBeVisible();
  await quality.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(quality).toHaveValue("quality");
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(quality).toHaveValue("quality");
  await page.locator("#settings-button").click();
  await expect(page.locator("#settings .hint")).toHaveCount(0);
  const scale = page.locator("#resolutionScale");
  await scale.hover();
  const tip = page.getByRole("tooltip").filter({ hasText: "Render scale adjusts" });
  await expect(tip).toBeVisible();
  const bounds = await tip.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
  await page.screenshot({ path: "artifacts/settings-tooltip.png" });
  await page.mouse.move(20, 80);
  await expect(tip).toBeHidden();
  await scale.focus();
  await expect(tip).toBeVisible();
  await page.getByRole("tab", { name: "Audio", exact: true }).click();
  await expect(tip).toBeHidden();
});
