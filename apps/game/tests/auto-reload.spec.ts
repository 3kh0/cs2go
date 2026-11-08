import { expect, test } from "@playwright/test";

test("one final shot starts reloading, and exhausted ammunition clicks once", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.updateBots = () => {};
    g.moveBots = () => {};
    g.bots.forEach((bot) => {
      bot.health = 0;
      bot.respawn = Infinity;
    });
  });
  for (const index of [0, 7, 3, 8, 10]) {
    await page.evaluate((index) => {
      const g = window.__game;
      g.buy(index);
      g.reload = g.cooldown = g.drawTime = 0;
      g.weaponCooldowns.fill(0);
      g.ammo = 1;
      g.reserve = 7;
    }, index);
    await page.mouse.click(700, 300);
    await page.waitForFunction(() => window.__game.reload > 0, undefined, { timeout: 5000 });
    const loaded = await page.evaluate(() => {
      const g = window.__game;
      for (let i = 0; i < 2000 && g.reload; i++) g.simulate(1 / 128);
      return { ammo: g.ammo, reserve: g.reserve };
    });
    expect(loaded.ammo, String(index)).toBeGreaterThan(0);
    expect(loaded.ammo + loaded.reserve).toBe(7);
  }
  await page.evaluate(() => {
    const g = window.__game;
    g.buy(7);
    g.reload = g.cooldown = g.drawTime = 0;
    g.weaponCooldowns.fill(0);
    g.ammo = 1;
    g.reserve = 0;
    const play = g.soundscape.play.bind(g.soundscape);
    Object.assign(window, { emptyClicks: [] });
    g.soundscape.play = (...args) => {
      const voice = play(...args);
      if (args[0] === "dry-fire")
        (window as unknown as { emptyClicks: boolean[] }).emptyClicks.push(!!voice);
      return voice;
    };
  });
  await page.mouse.click(700, 300);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { emptyClicks: boolean[] }).emptyClicks))
    .toEqual([true]);
  await page.waitForTimeout(800);
  expect(
    await page.evaluate(() => ({
      clicks: (window as unknown as { emptyClicks: boolean[] }).emptyClicks,
      ammo: window.__game.ammo,
      reserve: window.__game.reserve,
      reload: window.__game.reload,
    })),
  ).toEqual({ clicks: [true], ammo: 0, reserve: 0, reload: 0 });
  expect(errors).toEqual([]);
});
