import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("Bayonet follows native seconds while attacks retain independent recovery deadlines", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.bots.forEach((bot) => {
      bot.health = 0;
      bot.respawn = Infinity;
      bot.group.visible = false;
    });
    g.firing = false;
    g.buy(4);
    const draw = g.drawTime;
    const step = (ticks: number) => {
      for (let i = 0; i < ticks; i++) g.simulate(1 / 128);
    };
    step(64);
    const drawHalf = g.drawTime;
    g.cooldown = g.drawTime = 0;
    g.pitch = -1.3;
    g.fireKnife();
    const slash = g.knifeDuration;
    step(64);
    const slashHalf = { animation: g.knifeTime, cooldown: g.cooldown };
    // The next ready attack interrupts a recovering pose, without speeding its timeline.
    g.fireKnife(true);
    const stab = g.knifeDuration;
    step(128);
    const stabSecond = { animation: g.knifeTime, cooldown: g.cooldown };
    g.inspectDraw = false;
    const inspect = g.inspectDuration();
    Object.defineProperty(g, "simulationRunning", { configurable: true, get: () => false });
    g.knifeTime = 0;
    g.drawTime = draw * 0.5;
    g.animateWeapon();
    return { draw, drawHalf, slash, slashHalf, stab, stabSecond, inspect };
  });
  expect(result.draw).toBeCloseTo(1.1667, 5);
  expect(result.drawHalf).toBeCloseTo(0.6667, 5);
  expect(result.slash).toBeCloseTo(1.1667, 5);
  expect(result.slashHalf.animation).toBeCloseTo(0.6667, 5);
  expect(result.slashHalf.cooldown).toBe(0);
  expect(result.stab).toBeCloseTo(1.1667, 5);
  expect(result.stabSecond.animation).toBeCloseTo(0.1667, 5);
  expect(result.stabSecond.cooldown).toBe(0);
  expect(result.inspect).toBe(6.2);
  await page.screenshot({ path: "artifacts/bayonet-native-draw-half.png" });
  for (const phase of [0.1, 0.3, 0.6, 0.9]) {
    await page.evaluate((phase) => {
      const g = window.__game;
      g.drawTime = 0;
      g.knifeStab = false;
      g.knifeTime = g.knifeDuration * (1 - phase);
      g.animateWeapon();
    }, phase);
    await page.screenshot({ path: `artifacts/bayonet-native-slash-${phase}.png` });
  }
  expect(errors).toEqual([]);
});
