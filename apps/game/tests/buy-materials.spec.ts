import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("every firearm preview renders a lit surface instead of a black silhouette", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.health = 1_000_000;
  });
  await page.keyboard.press("b");
  await expect(page.locator("#loadout")).toBeVisible();
  await page.waitForTimeout(100);
  const checked = new Set<string>();
  const measurements: { id: string; count: number; mean: number; visibleFraction: number }[] = [];
  for (const team of ["t", "ct"] as const) {
    await page.evaluate((side) => {
      window.__game.team = side;
      window.__game.updateBuyMenu();
    }, team);
    const cards = await page
      .locator("#loadout [data-weapon]:visible")
      .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.weapon!));
    for (const id of cards) {
      if (checked.has(id)) continue;
      await page.locator(`#loadout [data-weapon="${id}"]`).hover();
      await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-item", id);
      const measured = await page.evaluate(async () => {
        const path = "/tests/buy-material-fixture.ts";
        const { measureBuyMaterial } = await import(path);
        return measureBuyMaterial(window.__game);
      });
      expect(measured.count, `weapon ${id} visible pixels`).toBeGreaterThan(100);
      measurements.push({ id, ...measured });
      checked.add(id);
      if (["2", "13", "20", "22", "24"].includes(id))
        await page.screenshot({ path: `artifacts/buy-material-${id}.png` });
    }
  }
  expect(checked.size).toBe(34);
  await test.info().attach("firearm-surface-measurements", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json",
  });
  for (const measured of measurements) {
    expect(measured.mean, `weapon ${measured.id} luminance`).toBeGreaterThan(4);
    expect(measured.visibleFraction, `weapon ${measured.id} lit surface`).toBeGreaterThan(0.2);
  }
});
