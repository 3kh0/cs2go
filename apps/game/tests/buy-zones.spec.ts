import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("live purchases use native team triggers, actor contact and buy-time expiry", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__game.locked);

  const result = await page.evaluate(async () => {
    const path = "/src/physics.ts";
    const { movement, SOURCE_UNIT } = (await import(path)) as typeof import("../src/physics");
    const radius = movement.hullRadius;
    const game = window.__game;
    game.buyRemaining = 30;
    game.dead = game.roundPause = 0;
    game.eye = movement.standingEye;
    const check = (team: "t" | "ct", x: number, y: number, z: number) => {
      game.team = team;
      game.position.set(x, y, z);
      return game.canBuy();
    };
    const cases = {
      tInside: check("t", -19, 1, 20),
      ctInside: check("ct", 5, -2, -58),
      wrongFaction: check("ct", -19, 1, 20),
      // Keep the native faces exact; test hull contact and 1 mm separation
      // with the pinned 32-inch player width and actual standing hull height.
      tTouch: check("t", -312 * SOURCE_UNIT + radius, 1, 20),
      tOutside: check("t", -312 * SOURCE_UNIT + radius + 0.001, 1, 20),
      ctTouch: check("ct", -192 * SOURCE_UNIT - radius, -2, -58),
      ctOutside: check("ct", -192 * SOURCE_UNIT - radius - 0.001, -2, -58),
      rectangularCorner: check("t", -30, 1, 25),
      ctAbove: check("ct", 5, -32 * SOURCE_UNIT + 0.001, -58),
      ctBelowTouch: check("ct", 5, -128 * SOURCE_UNIT - movement.standingHeight, -58),
      ctBelowOutside: check("ct", 5, -128 * SOURCE_UNIT - movement.standingHeight - 0.001, -58),
    };
    const standingTouches = check(
      "ct",
      5,
      -128 * SOURCE_UNIT - (movement.standingHeight + movement.duckHeight) / 2,
      -58,
    );
    game.eye = movement.duckEye;
    const crouchingMisses = game.canBuy();
    game.eye = movement.standingEye;
    check("ct", 5, -2, -58);
    game.buyRemaining = 0;
    const expired = game.canBuy();
    game.buyRemaining = 30;
    game.money = 16000;
    check("ct", -192 * SOURCE_UNIT - radius - 0.001, -2, -58);
    const rejectedPurchase = game.buy(1);
    const moneyAfterRejection = game.money;
    check("ct", 5, -2, -58);
    const acceptedPurchase = game.buy(1);
    return {
      cases,
      standingTouches,
      crouchingMisses,
      expired,
      rejectedPurchase,
      moneyAfterRejection,
      acceptedPurchase,
      moneySpent: game.money < moneyAfterRejection,
    };
  });
  expect(result).toEqual({
    cases: {
      tInside: true,
      ctInside: true,
      wrongFaction: false,
      tTouch: true,
      tOutside: false,
      ctTouch: true,
      ctOutside: false,
      rectangularCorner: true,
      ctAbove: false,
      ctBelowTouch: true,
      ctBelowOutside: false,
    },
    standingTouches: true,
    crouchingMisses: false,
    expired: false,
    rejectedPurchase: false,
    moneyAfterRejection: 16000,
    acceptedPurchase: true,
    moneySpent: true,
  });
  expect(errors).toEqual([]);
});

test("buy shortcut stays locked outside the zone or after buy time", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  for (const state of ["outside", "expired", "both", "allowed"] as const) {
    await page.evaluate((state) => {
      const game = window.__game;
      game.freezeTime = 100;
      game.buyRemaining = state === "expired" || state === "both" ? 0 : 100;
      game.position.set(state === "outside" || state === "both" ? 30 : 5, -2, -58);
    }, state);
    await page.keyboard.press("b");
    if (state === "allowed") {
      await expect(page.locator("#loadout")).toBeVisible();
    } else {
      await expect(page.locator("#loadout")).toBeHidden();
      expect(await page.evaluate(() => window.__game.locked)).toBe(true);
    }
  }
});
