import { expect, test } from "@playwright/test";
import { joinLobby } from "./multiplayer-helpers";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}
test.use({ actionTimeout: 15000 });

for (const online of [false, true]) {
  test(`${online ? "multiplayer" : "local"} C4 plants on the A-site boxes`, async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (online) {
      await joinLobby(page, `box-plant-${Date.now()}`, "t");
      const room = await page.locator("#match-room").inputValue();
      const result = await request.post("http://127.0.0.1:3004", {
        data: { room, op: "plant-box" },
      });
      expect(result.ok()).toBe(true);
      await page.waitForFunction(
        () => window.__game.carryingBomb && window.__game.position.y > 3.8,
      );
    } else {
      await page.goto("/");
      await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
      await page.locator("#home-play").click();
      await page.locator("#play").click();
      await expect(page.locator("#team-select")).toBeVisible({ timeout: 100000 });
      await page.locator('#team-select [data-team="t"]').click();
      await page.waitForFunction(() => window.__game.locked);
      await page.evaluate(() => {
        const g = window.__game;
        g.freezeTime = 0;
        g.invulnerable = 100;
        g.bomb!.carrier = "player";
        g.position.set(26, g.dust!.collision.floor(26, -64, 8), -64);
        g.velocity.x = g.velocity.z = g.vertical = 0;
        g.grounded = true;
        g.bots.forEach((bot) => {
          bot.health = 0;
          bot.respawn = Infinity;
          bot.group.visible = false;
        });
      });
    }
    await page.waitForFunction(() => window.__game.grounded && window.__game.position.y > 3.8);
    await page.keyboard.press("5");
    await page.waitForFunction(
      () => window.__game.bombSelected && window.__game.bombDrawTime === 0,
    );
    await page.mouse.down();
    await page.waitForFunction(() => window.__game.bomb!.plantProgress > 0.5);
    await page.screenshot({ path: `artifacts/box-plant-${online ? "online" : "local"}.png` });
    await page.waitForFunction(() => window.__game.bomb!.planted);
    await page.mouse.up();
    const position = await page.evaluate(() => window.__game.bomb!.position.toArray());
    expect(position[0]).toBeCloseTo(26, 1);
    expect(position[1]).toBeGreaterThan(3.8);
    expect(position[2]).toBeCloseTo(-64, 1);
    expect(errors).toEqual([]);
  });
}
