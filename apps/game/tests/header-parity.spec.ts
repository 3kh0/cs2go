import { expect, test } from "@playwright/test";

test("navigation press lights briefly, repeats, and respects reduced motion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  const visiblePressPixels = () =>
    page.locator(".header-navigation-particles").evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) return true;
      return false;
    });
  await page.locator("#home-play").click();
  await expect.poll(visiblePressPixels, { intervals: [10, 20, 50] }).toBe(true);
  await expect.poll(visiblePressPixels).toBe(false);
  await page.locator("#home-play").click();
  await expect.poll(visiblePressPixels, { intervals: [10, 20, 50] }).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#home-play").click();
  await expect.poll(visiblePressPixels).toBe(false);
  await expect(page.locator("#home-play")).toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});
