import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("CS2 buy menu previews items, filters teams, buys and refunds without customization controls", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    foreign: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith("http://127.0.0.1:5173"))
      foreign.push(request.url());
  });
  await page.goto("/");
  await page.waitForFunction(
    () => {
      const play = document.querySelector<HTMLButtonElement>("#play");
      return play && (!play.disabled || play.textContent?.includes("ARMORY UNAVAILABLE"));
    },
    undefined,
    { timeout: 100_000 },
  );
  await expect(page.locator("#play")).toBeEnabled();
  await page.locator("#home-play").click();
  await page.locator('[data-mode="competitive"]').click();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  expect(await page.evaluate(() => window.__game.mode)).toBe("competitive");
  await page.evaluate(() => {
    window.__game.money = 16000;
    window.__game.freezeTime = 100;
    window.__game.buyRemaining = 150;
  });
  await page.keyboard.press("b");
  await expect(page.locator("#loadout")).toBeVisible();
  await expect(page.locator("#loadout")).toHaveAttribute("data-layout", "columns");
  await expect(page.locator("#loadout [data-category]")).toHaveCount(5);
  await expect(page.locator("#loadout [data-weapon]")).toHaveCount(34);
  await expect(page.locator('[data-category="rifles"] [data-weapon="9"] b')).toHaveText("M4A4");
  await expect(page.locator('[data-category="mid-tier"] [data-weapon="10"] b')).toHaveText("Nova");
  await expect(page.locator('[data-weapon="0"]')).toBeHidden();
  await expect(page.locator('[data-weapon="1"]')).toBeVisible();
  await expect(page.locator('[data-equipment="kit"]')).toBeVisible();
  await expect(page.locator('[data-category="grenades"] [data-grenade]:visible')).toHaveCount(5);
  await expect(page.locator('[data-grenade="incendiary"]')).toBeVisible();
  await expect(page.locator('[data-grenade="molotov"]')).toBeHidden();
  await expect(page.locator("#buy-money")).toHaveText("$16,000");
  await expect(page.locator("#loadout .buy-refund:visible")).toHaveCount(0);
  await expect(
    page.locator(
      '#loadout [data-weapon="4"], #loadout [data-weapon="5"], #loadout [data-weapon="6"]',
    ),
  ).toHaveCount(0);
  const icons = await page
    .locator("#loadout [data-weapon]:visible img")
    .evaluateAll((images) =>
      images.every((image) =>
        (image as HTMLImageElement).getAttribute("src")?.startsWith("/icons/"),
      ),
    );
  expect(icons).toBe(true);
  await page.locator('[data-weapon="1"]').hover();
  await expect(page.locator("#buy-preview-name")).toHaveText("M4A1-S");
  await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-item", "1");
  const shop = await page.locator(".buy-columns").boundingBox();
  const preview = await page.locator("#buy-preview-stage").boundingBox();
  expect(shop!.x + shop!.width).toBeLessThanOrEqual(preview!.x + 20);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const crowded = await page.locator("#loadout .buy-card:visible").evaluateAll((cards) =>
      cards.flatMap((card) => {
        const icon = card.querySelector("img, svg")!.getBoundingClientRect();
        const name = card.querySelector("b")!.getBoundingClientRect();
        const price = card.querySelector("small")!.getBoundingClientRect();
        const bounds = card.getBoundingClientRect();
        return icon.top < name.bottom + 1 ||
          icon.bottom > price.top - 1 ||
          icon.width > bounds.width * 0.85
          ? [
              {
                name: card.querySelector("b")!.textContent,
                top: icon.top - name.bottom,
                bottom: price.top - icon.bottom,
                width: icon.width,
                cardWidth: bounds.width,
              },
            ]
          : [];
      }),
    );
    expect(crowded).toEqual([]);
    await page.screenshot({ path: `artifacts/buy-menu-icons-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({ path: "artifacts/buy-menu-columns-ct.png" });
  await page.locator('[data-grenade="smoke"]').hover();
  await expect(page.locator("#buy-preview-name")).toHaveText("Smoke Grenade");
  await page.screenshot({ path: "artifacts/buy-menu-preview-smoke.png" });
  await page.locator('[data-equipment="helmet"]').click();
  await expect(page.locator("#loadout")).toBeVisible();
  expect(
    await page.evaluate(() => ({
      armor: window.__game.armor,
      helmet: window.__game.helmet,
      money: window.__game.money,
    })),
  ).toEqual({ armor: 100, helmet: true, money: 15000 });
  await expect(page.locator('[data-equipment-refund="helmet"]')).toBeVisible();
  await expect(page.locator('[data-equipment-refund="helmet"]')).toHaveText("↶");
  await expect(page.locator("#buy-skins, #edit-loadout, #buy-layout")).toHaveCount(0);
  await expect(page.locator(".buy-dropped")).toBeVisible();
  await page.locator('[data-weapon="1"]').click();
  await page.waitForFunction(() => window.__game.locked);
  expect(await page.evaluate(() => window.__game.primary)).toBe(1);
  await page.keyboard.press("b");
  await expect(page.locator('[data-refund="1"]')).toBeVisible();
  await expect(page.locator('[data-refund="1"]')).toHaveText("↶");
  await expect(page.locator('[data-refund="9"]')).toBeHidden();
  const arrow = await page.locator('[data-refund="1"]').boundingBox();
  const rifle = await page.locator('[data-weapon="1"]').boundingBox();
  expect(arrow!.x - rifle!.x).toBeLessThan(10);
  expect(arrow!.y + arrow!.height).toBeGreaterThan(rifle!.y + rifle!.height - 10);
  await page.screenshot({ path: "artifacts/buy-menu-refund-arrow.png" });
  await page.locator('[data-refund="1"]').click();
  await expect(page.locator('[data-refund="1"]')).toBeHidden();
  expect(await page.evaluate(() => window.__game.primary)).toBeNull();
  await page.evaluate(() => {
    window.__game.team = "t";
    // Rebuild balanced sides and snapshot the new competitive round loadout.
    window.__game.configureBots(true);
    window.__game.startRound();
    window.__game.updateUI();
  });
  await expect(page.locator('[data-weapon="0"]')).toBeVisible();
  await expect(page.locator('[data-weapon="1"]')).toBeHidden();
  await expect(page.locator('[data-equipment="kit"]')).toBeHidden();
  await page.screenshot({ path: "artifacts/buy-menu-columns-t.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("#loadout")).toBeHidden();
  await page.waitForFunction(() => window.__game.locked);
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test("main menu Inventory replaces ordered buy slots for each side and persists them", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#inventory-button").click();
  await expect(page.locator(".inventory-slots button")).toHaveCount(15);
  await page.locator('[data-inventory-team="ct"]').click();
  await page.locator('[data-category="Pistols"][data-inventory-slot="1"]').click();
  await page.locator('[data-loadout-weapon="17"]').click();
  await expect(page.locator('[data-category="Pistols"][data-inventory-slot="1"]')).toContainText(
    "R8 Revolver",
  );
  await page.locator('[data-category="Pistols"][data-inventory-slot="0"]').click();
  await page.locator('[data-loadout-weapon="17"]').click();
  await expect(page.locator('[data-category="Pistols"][data-inventory-slot="0"]')).toContainText(
    "R8 Revolver",
  );
  await expect(page.locator('[data-category="Pistols"][data-inventory-slot="1"]')).toContainText(
    "USP-S",
  );
  await page.locator('[data-inventory-team="t"]').click();
  await expect(page.locator('[data-category="Pistols"][data-inventory-slot="0"]')).toContainText(
    "Glock-18",
  );
  await expect(page.locator('[data-loadout-weapon="12"]')).toHaveCount(0);
  await page.locator('[data-inventory-team="ct"]').click();
  await page.screenshot({ path: "artifacts/inventory-buy-slots.png" });
  await page.locator("#close-loadout-editor").click();
  await page.reload();
  await page.locator("#inventory-button").click();
  await page.locator('[data-inventory-team="ct"]').click();
  await expect(page.locator('[data-category="Pistols"][data-inventory-slot="0"]')).toContainText(
    "R8 Revolver",
  );
  await page.locator("#close-loadout-editor").click();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 100;
    window.__game.buyRemaining = 150;
  });
  await page.keyboard.press("b");
  await expect(page.locator('[data-category="pistols"] [data-weapon]:visible')).toHaveCount(5);
  await expect(page.locator('[data-weapon="17"]')).toBeVisible();
  await expect(page.locator('[data-weapon="8"]')).toBeHidden();
  await expect(page.locator('[data-weapon="17"]').locator("..")).toHaveCSS("order", "0");
  await page.evaluate(() => window.__game.groundInventory.showLoadout());
  await page.locator('[data-category="Pistols"][data-inventory-slot="0"]').click();
  await page.locator('[data-loadout-weapon="8"]').click();
  await page.locator("#close-loadout-editor").click();
  await expect(page.locator('[data-weapon="17"]')).toBeVisible();
  await expect(page.locator('[data-weapon="8"]')).toBeHidden();
  await page.evaluate(() => {
    window.__game.startRound();
    window.__game.updateBuyMenu();
  });
  await expect(page.locator('[data-weapon="17"]')).toBeHidden();
  await expect(page.locator('[data-weapon="8"]')).toBeVisible();
  expect(errors).toEqual([]);
});
