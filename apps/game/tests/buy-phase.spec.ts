import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
async function start(page: Page) {
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
}

test("freeze blocks movement and jumping, allows crouch and look, and fades team tint independently of buying", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  const before = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 100;
    g.buyRemaining = 120;
    return { position: g.position.toArray(), yaw: g.yaw, pitch: g.pitch };
  });
  await page.keyboard.down("w");
  await page.keyboard.down("Space");
  await page.keyboard.down("Control");
  await page.mouse.move(720, 450);
  await page.mouse.move(800, 490);
  await page.waitForFunction(() => window.__game.eye < 1.15);
  const crouched = await page.evaluate(() => ({
    position: window.__game.position.toArray(),
    eye: window.__game.eye,
    yaw: window.__game.yaw,
    pitch: window.__game.pitch,
    vertical: window.__game.vertical,
  }));
  expect(crouched.position).toEqual(before.position);
  expect(crouched.vertical).toBe(0);
  expect(crouched.yaw).not.toBe(before.yaw);
  expect(crouched.pitch).not.toBe(before.pitch);
  await page.keyboard.up("w");
  await page.keyboard.up("Space");
  await page.keyboard.up("Control");
  await page.waitForFunction(() => window.__game.eye > 1.6);
  const audio = await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    const general: string[] = [],
      weapon: string[] = [];
    const play = g.soundscape.play.bind(g.soundscape),
      clips = g.weaponAudio.play.bind(g.weaponAudio);
    g.soundscape.play = (...args) => {
      general.push(args[0]);
      return play(...args);
    };
    g.weaponAudio.play = (...args) => {
      const result = clips(...args);
      weapon.push(g.weaponAudio.lastClip);
      return result;
    };
    g.primary = 0;
    g.equip(0);
    const drawTicks = Math.ceil(g.drawTime * 128);
    for (let tick = 0; tick < drawTicks; tick++) g.simulate(1 / 128);
    g.soundscape.play = play;
    g.weaponAudio.play = clips;
    // Remaining assertions sample exact tint phases; live-menu ticking is
    // exercised separately below, so hold this staged visual fixture still.
    g.simulate = () => {};
    return { general, weapon, draw: g.drawTime };
  });
  expect(audio.general).not.toContain("gear");
  expect(audio.weapon.length).toBeGreaterThan(0);
  expect(audio.weapon.every(Boolean)).toBe(true);
  expect(audio.draw).toBe(0);
  for (const team of ["ct", "t"] as const) {
    await page.evaluate((team) => {
      const g = window.__game;
      g.team = team;
      g.freezeTime = 5;
      g.updateUI();
    }, team);
    await expect(page.locator("#buy-phase-tint")).toHaveCSS("opacity", "0.14");
    await expect(page.locator("#buy-phase-tint")).toHaveCSS(
      "background-color",
      team === "ct" ? "rgb(75, 166, 239)" : "rgb(238, 191, 57)",
    );
    await page.screenshot({ path: `artifacts/buy-phase-${team}.png` });
  }
  await page.evaluate(() => {
    window.__game.freezeTime = 1;
    window.__game.updateUI();
  });
  await expect(page.locator("#buy-phase-tint")).toHaveCSS("opacity", "0.07");
  await page.evaluate(() => {
    const g = window.__game;
    g.team = "ct";
    g.freezeTime = 0;
    g.updateUI();
  });
  await expect(page.locator("#buy-phase-tint")).toHaveCSS("opacity", "0");
  expect(await page.evaluate(() => window.__game.canBuy())).toBe(true);
  await expect(page.locator("#economy-hud")).toHaveText(/^\$[\d,]+$/);
  expect(errors).toEqual([]);
});

test("buy and Escape menus keep freeze, round, bomb and bots running", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await page.evaluate(() => {
    window.__game.freezeTime = 10;
    window.__game.buyRemaining = 100;
  });
  await page.keyboard.press("b");
  await expect(page.locator("#loadout")).toBeVisible();
  await page.waitForFunction(() => !window.__game.locked);
  const frozen = await page.evaluate(() => ({
    freeze: window.__game.freezeTime,
    buy: window.__game.buyRemaining,
  }));
  await page.waitForFunction(
    (previous) => window.__game.freezeTime < previous - 0.2,
    frozen.freeze,
  );
  expect(await page.evaluate(() => window.__game.buyRemaining)).toBeLessThan(frozen.buy - 0.2);
  const live = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    return { time: g.time, bots: g.bots.map((b) => b.group.position.toArray()) };
  });
  await page.waitForFunction((before) => window.__game.time < before - 0.2, live.time);
  await page.waitForFunction(
    (before) =>
      window.__game.bots.some(
        (b, i) =>
          Math.hypot(
            b.group.position.x - before[i][0],
            b.group.position.y - before[i][1],
            b.group.position.z - before[i][2],
          ) > 0.05,
      ),
    live.bots,
  );
  await page.evaluate(() => {
    const g = window.__game;
    g.bomb!.planted = true;
    g.bomb!.timer = 30;
    g.bomb!.position.set(28, 2.5, -64);
  });
  await page.waitForFunction(() => window.__game.bomb!.timer < 29.8);
  await expect(page.locator("#loadout")).toBeVisible();
  await page.locator("#close-loadout").click();
  await page.waitForFunction(() => window.__game.locked);
  // Browser Escape releases pointer lock. Explicit exit makes this deterministic in headless Chromium.
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
  const paused = await page.evaluate(() => ({
    time: window.__game.time,
    buy: window.__game.buyRemaining,
    bomb: window.__game.bomb!.timer,
  }));
  await page.waitForTimeout(300);
  const menuLive = await page.evaluate(() => ({
    time: window.__game.time,
    buy: window.__game.buyRemaining,
    bomb: window.__game.bomb!.timer,
  }));
  expect(menuLive.bomb).toBeLessThan(paused.bomb);
  expect(menuLive.buy).toBeLessThanOrEqual(paused.buy);
  await expect(page.locator("#scoreboard")).toBeVisible();
  expect(errors).toEqual([]);
});

test("right click closes the buy menu without buying or triggering weapon secondary fire", async ({
  page,
}) => {
  await start(page);
  const before = await page.evaluate(() => {
    const game = window.__game;
    game.freezeTime = 100;
    game.buyRemaining = 120;
    game.money = 10000;
    game.buy(3);
    return { money: game.money, ammo: game.ammo, selected: game.selected };
  });
  await page.waitForFunction(() => window.__game.drawTime === 0);
  await page.keyboard.press("b");
  await expect(page.locator("#loadout")).toBeVisible();
  await page.locator('#loadout [data-weapon="3"]').click({ button: "right" });
  await expect(page.locator("#loadout")).toBeHidden();
  await page.waitForFunction(() => window.__game.locked);
  expect(
    await page.evaluate(() => ({
      money: window.__game.money,
      ammo: window.__game.ammo,
      selected: window.__game.selected,
    })),
  ).toEqual(before);
  expect(await page.evaluate(() => window.__game.scopeLevel)).toBe(0);
  await page.mouse.click(720, 450, { button: "right" });
  await expect.poll(() => page.evaluate(() => window.__game.scopeLevel)).toBe(1);
});
