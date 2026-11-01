import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("owned grenades show icons and counts and cycle in both wheel directions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  const purchased = await page.evaluate(() => {
    const g = window.__game;
    g.mode = "competitive";
    g.money = 16000;
    g.freezeTime = 100;
    g.invulnerable = 100;
    const bought = [
      g.utility.buy("he"),
      g.utility.buy("flash"),
      g.utility.buy("flash"),
      g.utility.buy("smoke"),
    ];
    g.equip(g.knife);
    return bought;
  });
  expect(purchased).toEqual([true, true, true, true]);
  const icons = page.locator("#inventory [data-grenade-kind]");
  await expect(icons).toHaveCount(3);
  await expect(page.locator('#inventory [data-grenade-kind="flash"]')).toHaveAttribute(
    "data-count",
    "2",
  );
  const selected = () => page.evaluate(() => window.__game.utility.selected);
  const wheel = async (delta: number) => {
    await page.waitForTimeout(120);
    await page.mouse.wheel(0, delta);
  };
  await wheel(120);
  await expect.poll(selected).toBe("he");
  await expect(page.locator("#gun-name")).toHaveText("HE Grenade");
  await expect(page.locator('#inventory [data-grenade-kind="he"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.locator("#inventory [data-weapon-index].active")).toHaveCount(0);
  await wheel(120);
  await expect.poll(selected).toBe("flash");
  await expect(page.locator("#ammo")).toHaveText("2");
  await page.screenshot({ path: "artifacts/grenade-inventory.png" });
  await wheel(120);
  await expect.poll(selected).toBe("smoke");
  await wheel(120);
  await expect.poll(selected).toBe(null);
  expect(await page.evaluate(() => window.__game.selected === window.__game.secondary)).toBe(true);
  await wheel(-120);
  await expect.poll(selected).toBe("smoke");
  await wheel(-120);
  await expect.poll(selected).toBe("flash");
  await page.keyboard.press("4");
  await expect.poll(selected).toBe("smoke");
  await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.utility.select("flash");
    g.utility.throwSelected();
  });
  await expect(page.locator('#inventory [data-grenade-kind="flash"]')).toHaveAttribute(
    "data-count",
    "1",
  );
  await page.evaluate(() => {
    const g = window.__game;
    g.roundPause = 0;
    g.utility.cooldown = 0;
    g.utility.select("flash");
    g.utility.throwSelected();
    g.freezeTime = 100;
  });
  await expect(page.locator('#inventory [data-grenade-kind="flash"]')).toHaveCount(0);
  await page.evaluate(() => {
    const g = window.__game;
    g.roundPause = 0;
    g.utility.refund("smoke");
  });
  await expect(page.locator('#inventory [data-grenade-kind="smoke"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
