import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("native draw durations, revolver trigger cancellation and knife mechanical cues", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__game);
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game?.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    g.buy(17);
    const revolverDraw = g.drawTime;
    const initial = g.ammo;
    g.fire();
    const drawBlocks = g.ammo === initial && g.revolverCharge === 0;
    g.drawTime = g.cooldown = 0;
    g.fire();
    const cocked = g.revolverCharge > 0 && g.ammo === initial;
    document.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    const cancelled = g.revolverCharge === 0;
    g.fire(false, true);
    const alternate = g.ammo === initial - 1 && g.alternateShot;
    g.cooldown = 0;
    g.fire();
    g.firing = true;
    for (let i = 0; i < 30; i++) g.simulate(1 / 128);
    g.firing = false;
    const primary = g.ammo === initial - 2 && !g.alternateShot;
    g.cooldown = 0;
    g.fire();
    g.beginReload();
    const reloadCancelled = g.revolverCharge === 0 && g.reload > 0;
    g.reload = g.cooldown = 0;
    g.fire();
    const switchWasCharging = g.revolverCharge > 0;
    g.equip(g.knife);
    const switchCancelled = switchWasCharging && g.revolverCharge === 0;
    g.buy(5);
    const butterflyDraw = g.drawTime;
    const mechanical = g.soundscape.lastCue;
    g.cooldown = g.drawTime = 0;
    g.inspectVariant = 0;
    g.inspectTime = g.inspectDuration();
    g.simulate(0.06);
    const inspectCue = g.soundscape.lastCue;
    g.animateWeapon();
    return {
      revolverDraw,
      butterflyDraw,
      drawBlocks,
      cocked,
      cancelled,
      alternate,
      primary,
      switchCancelled,
      reloadCancelled,
      mechanical,
      inspectCue,
    };
  });
  expect(result.revolverDraw).toBeCloseTo(1.134291648864746 / 0.9, 3);
  expect(result.butterflyDraw).toBeCloseTo(1, 3);
  for (const key of [
    "drawBlocks",
    "cocked",
    "cancelled",
    "alternate",
    "primary",
    "switchCancelled",
    "reloadCancelled",
  ] as const)
    expect(result[key], key).toBe(true);
  expect(result.mechanical).toBe("butterfly-draw");
  expect(result.inspectCue).toBe("butterfly-look1-a");
  await page.screenshot({ path: "artifacts/combat-butterfly-inspect.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.buy(17);
    g.drawTime *= 0.5;
    g.animateWeapon();
  });
  await page.screenshot({ path: "artifacts/combat-revolver-draw.png" });
  for (const fraction of [0.05, 0.25, 0.75, 0.98]) {
    await page.evaluate((fraction) => {
      const g = window.__game;
      g.equip(17);
      g.drawTime *= 1 - fraction;
      g.animateWeapon();
    }, fraction);
    await page.screenshot({ path: `artifacts/combat-revolver-draw-${fraction}.png` });
  }
  expect(errors).toEqual([]);
});
