import { expect, test } from "@playwright/test";

test("inventory hover details cancel, support focus, stay on screen and do not load 3D inspections", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "cs2go-local-inventory",
      JSON.stringify([
        ...Array.from({ length: 56 }, (_, weapon) => ({ weapon, id: "", wear: 0.01, seed: 1 })),
        { weapon: 25, id: "11_712", wear: 0.22, seed: 948 },
      ]),
    ),
  );
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  // Inventory intentionally prewarms inspection lighting. Establish that
  // baseline before checking that merely hovering does not request more.
  const warmed = Promise.all(
    ["dust2-reflection.exr", "dust2-color-correction.bin", "dust2-profiles.json"].map((file) =>
      page
        .waitForResponse((response) => new URL(response.url()).pathname.endsWith(`/${file}`))
        .then((response) => response.finished()),
    ),
  );
  await page.locator("#skins-button").click();
  await warmed;
  await expect(page.locator("#skin-search")).toBeHidden();
  await expect(page.locator("#close-skins")).toHaveCount(0);
  await expect(page.locator("#inventory-everything")).toHaveAttribute("aria-current", "page");
  await page.locator("#inventory-search").click();
  await expect(page.locator("#skin-search")).toBeVisible();
  await expect(page.locator("#skin-search")).toBeFocused();
  await expect(page.locator("#inventory-search")).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(page.locator("#skin-menu")).toBeVisible();
  await expect(page.locator("#skin-search")).toBeHidden();
  await expect(page.locator("#inventory-everything")).toHaveAttribute("aria-current", "page");
  const toolbar = await page.locator("#skin-menu .inventory-toolbar").evaluate((element) => {
    const sort = element.querySelector("#inventory-sort")!.getBoundingClientRect();
    const buttons = [...element.querySelectorAll(".inventory-actions button")]
      .map((button) => button.getBoundingClientRect())
      .filter((rect) => rect.width && rect.height)
      .sort((a, b) => a.left - b.left);
    return {
      centers: buttons.map((rect) =>
        Math.abs(rect.top + rect.height / 2 - sort.top - sort.height / 2),
      ),
      gaps: buttons.map(
        (rect, index) => rect.left - (index ? buttons[index - 1].right : sort.right),
      ),
    };
  });
  expect(toolbar.centers.length).toBeGreaterThan(0);
  expect(toolbar.centers.every((distance) => distance <= 2)).toBe(true);
  expect(toolbar.gaps.every((gap) => gap >= 0)).toBe(true);
  const inspectionRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/(?:models\/inspection-lighting|models\/music-kit)\/|\.exr(?:\?|$)/.test(request.url()))
      inspectionRequests.push(request.url());
  });
  const tooltip = page.locator("#inventory-item-tooltip");
  const finish = page.locator('[data-item-weapon="25"][data-skin="11_712"]');
  await page.locator("#inventory-weapon").selectOption("25");
  // Leaving before the dwell expires must not create a delayed ghost tooltip.
  await finish.hover();
  await page.locator("#inventory-weapon").hover();
  await page.waitForTimeout(700);
  await expect(tooltip).toBeHidden();

  await finish.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator("h3")).toHaveText("G3SG1 | High Seas");
  await expect(tooltip).toContainText("The Horizon Collection");
  await expect(tooltip).toContainText("Restricted Sniper Rifle");
  await expect(tooltip).toContainText("Field-Tested");
  await expect(tooltip).toContainText("The pricy G3SG1 lowers movement speed");
  await expect(tooltip.locator("em")).toHaveText("Let dead reckoning be your guide");
  await expect(tooltip).not.toContainText("Wear Rating");
  await expect(tooltip).not.toContainText("Pattern Template");
  await expect(finish).toHaveAttribute("aria-describedby", "inventory-item-tooltip");
  await page.screenshot({ path: "artifacts/inventory-tooltip-native-details.png" });

  await finish.click();
  await expect(page.locator("#weapon-inspect-context")).toBeVisible();
  await expect(tooltip).toBeHidden();
  await expect(finish).not.toHaveAttribute("aria-describedby");
  await page.keyboard.press("Escape");

  for (const [weapon, team] of [
    [37, "Counter-Terrorists"],
    [38, "Terrorists"],
    [4, "Both Teams"],
  ] as const) {
    await page.locator("#inventory-weapon").selectOption(String(weapon));
    await page.locator(`[data-item-weapon="${weapon}"][data-skin=""]`).hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip.getByText(team, { exact: true })).toBeVisible();
  }

  await page.setViewportSize({ width: 900, height: 600 });
  await page.locator("#inventory-weapon").selectOption("all");
  const edgeCard = page.locator("#skin-grid [data-item-weapon][data-skin]").last();
  await edgeCard.scrollIntoViewIfNeeded();
  // Scrolling intentionally dismisses hover details; finish scrolling before
  // starting a new hover dwell at the viewport edge.
  await page.locator("#inventory-weapon").hover();
  await page.waitForTimeout(100);
  await edgeCard.hover();
  await expect(tooltip).toBeVisible();
  const onScreen = await tooltip.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
    );
  });
  expect(onScreen).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#skin-menu")).toBeHidden();
  await expect(tooltip).toBeHidden();
  expect(inspectionRequests).toEqual([]);
  expect(errors).toEqual([]);
});
