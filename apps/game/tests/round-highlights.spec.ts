import { expect, test } from "@playwright/test";

test("round banners use native fun facts and the reason earned by the actual MVP", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  const duration = await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.freezeTime = 1;
    g.updateRound(0.5);
    const duringFreeze = g.roundElapsed;
    g.freezeTime = 0;
    g.bots.forEach((b) => {
      b.nav = Infinity;
      b.group.position.set(100, 0, 100);
    });
    g.position.set(0, 0, 0);
    for (let tick = 0; tick < 32 * 128; tick++) g.updateRound(1 / 128);
    g.kills += 2;
    g.endRound("ct", "Terrorists eliminated");
    return { duringFreeze, elapsed: g.roundElapsed };
  });
  expect(duration).toEqual({ duringFreeze: 0, elapsed: 32 });
  await expect(page.locator("#round-banner-title")).toHaveText("ROUND WON");
  await expect(page.locator("#round-banner-reason")).toHaveText("That round took only 32 seconds!");
  await expect(page.locator("#round-mvp-reason")).toHaveText("MVP for most eliminations");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "artifacts/round-native-fact.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.roundPause = 0;
    g.roundElapsed = 76;
    g.bomb!.defuser = "player";
    g.endRound("ct", "Bomb defused");
  });
  await expect(page.locator("#round-mvp-reason")).toHaveText("MVP for defusing the bomb");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "artifacts/round-native-defuse-mvp.png" });
  expect(errors).toEqual([]);
});
