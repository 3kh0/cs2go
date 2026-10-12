import { test } from "@playwright/test";
test("errors", async ({ page }) => {
  page.on("pageerror", (e) =>
    console.log("PAGEERROR", e.message, e.stack?.split("\n").slice(0, 4).join(" | ")),
  );
  await page.goto("/");
  await page.locator("#play").click();
  await page.waitForFunction(() => (window as any).__game.locked);
  await page.waitForTimeout(3000);
});
