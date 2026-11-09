import { expect, test } from "@playwright/test";

test("private matchmaking keeps native-style actions, map selection and accessible PIN errors", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-play").click();
  await page.locator('[data-session="multi"]').click();
  await expect(page.locator("#multiplayer-options")).toBeVisible();
  await expect(page.locator('[data-mode="deathmatch"]')).toBeHidden();
  await page.locator("#match-join").click();
  await expect(page.locator("#match-room")).toBeFocused();
  await page.locator("#match-room").fill("123");
  await page.keyboard.press("Enter");
  await expect(page.locator("#match-status")).toContainText("six-digit");
  await page.locator('.match-maps [data-map="mirage"]').click();
  await expect(page.locator('.match-maps [data-map="mirage"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.locator("#app").evaluate((node) => Math.round(node.getBoundingClientRect().width)),
      )
      .toBe(width);
    const actions = await page.locator(".private-match-actions").boundingBox();
    const details = await page.locator(".private-match-details").boundingBox();
    const maps = await page.locator(".match-maps").boundingBox();
    expect(actions!.x + actions!.width).toBeLessThan(details!.x);
    expect(maps!.x).toBeCloseTo(details!.x, 0);
    expect(details!.x + details!.width).toBeLessThan(width - 20);
    await page.screenshot({ path: `artifacts/private-matchmaking-${width}.png` });
  }
  await page.locator('[data-session="single"]').click();
  await expect(page.locator("#multiplayer-options")).toBeHidden();
  await expect(page.locator('[data-mode="deathmatch"]')).toBeVisible();
  expect(errors).toEqual([]);
});
