import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("auto bunnyhop is a persistent, keyboard-accessible opt-in setting", async ({ page }) => {
  await page.goto("/");
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  const toggle = page.getByRole("switch", { name: /Auto bunnyhop/ });
  await expect(toggle).not.toBeChecked();
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await page.reload();
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.reload();
  expect(await page.evaluate(() => window.__game.settings.autoBunnyhop)).toBe(false);
});

test("held jump hops on landing without friction, while manual jumping requires a new press", async ({
  page,
}) => {
  await page.goto("/");
  // Practice remains an isolated gameplay fixture outside the casual lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    g.equip(4);
    const sample = (automatic: boolean) => {
      g.settings.autoBunnyhop = automatic;
      g.position.set(100, 0, 100);
      g.velocity.x = 6.35;
      g.velocity.z = g.vertical = 0;
      g.grounded = true;
      g.keys.clear();
      g.keys.add("Space");
      g.jumpQueued = true;
      let jumps = 0,
        apex = 0;
      const speeds: number[] = [],
        intervals: number[] = [];
      let lastJump = 0;
      for (let i = 0; i < 384; i++) {
        const before = g.vertical;
        g.simulate(1 / 128);
        if (g.vertical > 5 && g.vertical > before + 5) {
          jumps++;
          speeds.push(Math.hypot(g.velocity.x, g.velocity.z));
          if (jumps > 1) intervals.push(i - lastJump);
          lastJump = i;
        }
        apex = Math.max(apex, g.position.y);
      }
      return { jumps, apex, speeds, intervals, grounded: g.grounded };
    };
    const manual = sample(false),
      automatic = sample(true);
    // A press consumed in mid-air is not kept as an indefinite landing buffer.
    g.settings.autoBunnyhop = false;
    g.keys.clear();
    g.position.set(100, 0.5, 100);
    g.velocity.x = g.velocity.z = g.vertical = 0;
    g.grounded = false;
    g.jumpQueued = true;
    for (let i = 0; i < 128; i++) g.simulate(1 / 128);
    return { manual, automatic, earlyPress: { grounded: g.grounded, y: g.position.y } };
  });
  expect(result.manual.jumps).toBe(1);
  expect(result.manual.grounded).toBe(true);
  expect(result.automatic.jumps).toBe(4);
  expect(result.automatic.apex).toBeCloseTo(1.4478, 3);
  for (const speed of result.automatic.speeds) expect(speed).toBeCloseTo(6.35, 8);
  for (const ticks of result.automatic.intervals) expect(ticks).toBe(97);
  expect(result.earlyPress).toEqual({ grounded: true, y: 0 });
});

test("real held Space repeats hops and pointer-lock loss clears it", async ({ page }) => {
  await page.goto("/");
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  await page.getByRole("switch", { name: /Auto bunnyhop/ }).check();
  await page.locator("#close-settings").click();
  // Practice remains an isolated gameplay fixture outside the casual lobby.
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.keyboard.down("Space");
  // Observe two actual jumps; wall-clock delays can land on a different
  // simulation phase when Chromium is busy compiling or rendering.
  await page.waitForFunction(() => window.__game.position.y > 0.9);
  await page.waitForFunction(() => window.__game.vertical < 0);
  await page.waitForFunction(() => window.__game.vertical > 0 && window.__game.position.y < 0.4);
  await page.waitForFunction(() => window.__game.position.y > 0.9);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__game.locked);
  const paused = await page.evaluate(() => ({
    y: window.__game.position.y,
    held: window.__game.keys.has("Space"),
    queued: window.__game.jumpQueued,
  }));
  expect(paused.held).toBe(false);
  expect(paused.queued).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__game.grounded)).toBe(true);
  expect(await page.evaluate(() => window.__game.position.y)).toBeLessThan(paused.y);
  await page.keyboard.up("Space");
});
