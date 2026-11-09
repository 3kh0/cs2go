import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

async function startDeathmatch(page: Page) {
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-play").click();
  await page.locator('[data-mode="deathmatch"]').click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked && window.__game.active);
}

async function clickFire(page: Page) {
  await page.mouse.down();
  await page.mouse.up();
}

test("Deathmatch F3 uses the team loadout once per protected life and G claims a timed bonus", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/PropertyBinding|No target node/.test(message.text())) errors.push(message.text());
  });
  const missing: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 404) missing.push(response.url());
  });
  await startDeathmatch(page);
  expect(await page.evaluate(() => window.__game.deathmatchRandomWeapons)).toBe(true);
  await page.keyboard.press("F3");
  await expect(page.locator("#deathmatch-status")).toContainText("Random Weapons OFF");
  const first = await page.evaluate(() => {
    const g = window.__game;
    g.updateBots = () => {};
    g.moveBots = () => {};
    g.primary = 3;
    g.spawnPlayer();
    return { primary: g.primary, secondary: g.secondary, randomBought: g.deathmatchRandomBought };
  });
  expect(first.primary).toBe(3);
  expect(first.randomBought).toBe(false);
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await page.keyboard.press("F3");
  await expect(page.locator("#deathmatch-status")).toContainText("Random Weapons ON");
  const random = await page.evaluate(() => {
    const g = window.__game;
    return {
      primary: g.primary,
      secondary: g.secondary,
      bought: g.deathmatchRandomBought,
      allowed: g.groundInventory.loadouts[g.team],
      persisted: localStorage.getItem("cs2go-dm-random-weapons"),
    };
  });
  expect(random.bought).toBe(true);
  expect(random.allowed).toContain(random.primary);
  expect(random.allowed).toContain(random.secondary);
  expect(random.primary).not.toBe(3);
  expect(random.persisted).toBe("true");
  await page.keyboard.press("F3");
  await page.evaluate(() => window.__game.buy(3));
  await page.keyboard.press("F3");
  // Native sv_limit_buyrandom_per_life blocks a second random purchase.
  expect(await page.evaluate(() => window.__game.primary)).toBe(3);
  await page.keyboard.press("F3");
  const retained = await page.evaluate(() => {
    const g = window.__game;
    g.spawnPlayer();
    g.deathmatch.untilBonus = 0;
    g.simulate(1 / 128);
    g.updateUI();
    return { primary: g.primary, bonus: g.deathmatch.bonus?.weapon };
  });
  expect(retained.primary).toBe(3);
  expect(retained.bonus).toBeDefined();
  await expect(page.locator("#deathmatch-bonus")).toBeVisible();
  await expect(page.locator("#deathmatch-bonus small")).toContainText("[G] Switch to bonus weapon");
  await page.keyboard.press("g");
  expect(await page.evaluate(() => window.__game.selected)).toBe(retained.bonus);
  await page.screenshot({ path: "artifacts/deathmatch-bonus-random-weapons.png" });
  // The native live probe switched Glock to a bonus Deagle after buy protection
  // expired, without healing, respawning or moving the player. Cross-faction
  // bonus weapons also bypass the ordinary faction-specific loadout filter.
  const beforeUnprotectedClaim = await page.evaluate(() => {
    const g = window.__game;
    g.invulnerable = 0;
    g.health = 37;
    g.deathmatch.bonus = { weapon: 0, remaining: 30, duration: 30 };
    g.updateUI();
    return g.position.toArray();
  });
  await page.keyboard.press("g");
  const unprotectedClaim = await page.evaluate((position) => {
    const g = window.__game;
    return {
      selected: g.selected,
      health: g.health,
      immunity: g.invulnerable,
      dead: g.dead,
      displacement: g.position.distanceTo(g.position.clone().fromArray(position)),
    };
  }, beforeUnprotectedClaim);
  expect(unprotectedClaim.selected).toBe(0);
  expect(unprotectedClaim.health).toBe(37);
  expect(unprotectedClaim.immunity).toBe(0);
  expect(unprotectedClaim.dead).toBe(0);
  expect(unprotectedClaim.displacement).toBeLessThan(0.1);
  await expect(page.locator("#health")).toHaveText("37");
  const ended = await page.evaluate(() => {
    const g = window.__game;
    for (let tick = 0; tick < 128 * 31; tick++) g.simulate(1 / 128);
    g.updateUI();
    return { bonus: g.deathmatch.bonus, time: g.time };
  });
  expect(ended.bonus).toBeNull();
  expect(ended.time).toBeLessThan(571);
  await expect(page.locator("#deathmatch-bonus")).toBeHidden();
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});

test("real shots earn assist points and a healthshot whose native injection heals gradually and cancels cleanly", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/PropertyBinding|No target node/.test(message.text())) errors.push(message.text());
  });
  await startDeathmatch(page);
  await page.keyboard.press("F3");
  const location = await page.evaluate(async () => {
    const g = window.__game;
    const position = g.position.toArray();
    const path = "/tests/weapon-lane-fixture.ts";
    const { weaponLaneFixture, placeWeaponTarget, aimWeaponAt, weaponHitboxPoint } = (await import(
      path
    )) as typeof import("./weapon-lane-fixture");
    weaponLaneFixture(g);
    g.updateBots = () => {};
    g.invulnerable = 0;
    g.buy(13);
    g.cooldown = g.drawTime = 0;
    placeWeaponTarget(g, 0, -17, 0, 13);
    aimWeaponAt(g, weaponHitboxPoint(g, 0, 2));
    return position;
  });
  await clickFire(page);
  await expect.poll(() => page.evaluate(() => window.__game.bots[0].health)).toBeLessThan(75);
  const assist = await page.evaluate(async () => {
    const g = window.__game;
    const path = "/tests/weapon-lane-fixture.ts";
    const { placeWeaponTarget } = (await import(path)) as typeof import("./weapon-lane-fixture");
    const soldierModule = "/src/soldier.ts";
    const { setSoldierWeapon } = (await import(soldierModule)) as typeof import("../src/soldier");
    placeWeaponTarget(g, 1, -20, 0, 15);
    const killer = g.bots[1],
      victim = g.bots[0];
    setSoldierWeapon(killer.rig, 0);
    killer.ammo = 30;
    killer.speed = killer.reloadTime = 0;
    killer.aim.copy(victim.group.position).y += 1.2;
    for (let shot = 0; shot < 10 && victim.health > 0; shot++) {
      killer.shot = killer.reaction = killer.burst = 0;
      g.botCombat(
        killer,
        {
          id: 0,
          position: victim.group.position,
          distance: killer.group.position.distanceTo(victim.group.position),
          score: 1,
        },
        1 / 16,
      );
    }
    g.updateUI();
    return {
      victim: victim.health,
      score: g.deathmatchScore,
      assists: g.deathmatchCombat.life("player").assists,
      killerScore: killer.deathmatchScore,
    };
  });
  expect(assist).toEqual({ victim: 0, score: 5, assists: 1, killerScore: 10 });
  await expect(page.locator("#deathmatch-award")).toContainText("5 points for assisting");
  await expect(page.locator("#killfeed .feed").first()).toContainText("+");
  await page.keyboard.down("Tab");
  await expect(page.locator("#scoreboard .score-row.you .score-assists")).toHaveText("1");
  await page.keyboard.up("Tab");
  await page.evaluate(() => {
    const g = window.__game;
    g.buy(3);
    g.cooldown = g.drawTime = 0;
  });
  for (let kill = 0; kill < 3; kill++) {
    await page.evaluate(async () => {
      const g = window.__game;
      const path = "/tests/weapon-lane-fixture.ts";
      const { placeWeaponTarget, aimWeaponAt, weaponHitboxPoint } = (await import(
        path
      )) as typeof import("./weapon-lane-fixture");
      placeWeaponTarget(g, 0, -17, 0, 13);
      aimWeaponAt(g, weaponHitboxPoint(g, 0, 2));
    });
    await expect.poll(() => page.evaluate(() => window.__game.cooldown)).toBe(0);
    await clickFire(page);
    await expect.poll(() => page.evaluate(() => window.__game.bots[0].health)).toBe(0);
  }
  expect(await page.evaluate(() => window.__game.deathmatchCombat.life("player").healthshots)).toBe(
    1,
  );
  await page.evaluate((position) => {
    const g = window.__game;
    g.world = g.dust!;
    g.position.fromArray(position);
    g.velocity.x = g.velocity.z = g.vertical = 0;
    g.grounded = true;
    g.health = 40;
    g.updateAimCamera();
  }, location);
  await page.keyboard.press("x");
  await expect(page.locator('#inventory [data-healthshot="1"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect.poll(() => page.evaluate(() => window.__game.healthshotAction.phase)).toBe("idle");
  await page.screenshot({ path: "artifacts/deathmatch-healthshot-held.png" });
  await clickFire(page);
  await expect
    .poll(() => page.evaluate(() => window.__game.deathmatchCombat.life("player").healthshots))
    .toBe(0);
  const earlyHealth = await page.evaluate(() => window.__game.health);
  expect(earlyHealth).toBeGreaterThanOrEqual(40);
  expect(earlyHealth).toBeLessThan(90);
  await page.screenshot({ path: "artifacts/deathmatch-healthshot-injection.png" });
  await expect.poll(() => page.evaluate(() => window.__game.health), { timeout: 6_000 }).toBe(90);
  expect(await page.evaluate(() => window.__game.healthshotAction.selected)).toBe(false);
  // Isolate another granted item to test cancellation on the actual input path.
  // The three actual eliminations above prove the native grant path separately.
  await page.evaluate(() => {
    const g = window.__game;
    g.deathmatchCombat.life("player").healthshots = 1;
    g.health = 50;
  });
  await page.keyboard.press("x");
  await expect.poll(() => page.evaluate(() => window.__game.healthshotAction.phase)).toBe("idle");
  await clickFire(page);
  await page.keyboard.press("Digit3");
  await page.waitForTimeout(900);
  expect(
    await page.evaluate(() => ({
      health: window.__game.health,
      stock: window.__game.deathmatchCombat.life("player").healthshots,
      selected: window.__game.healthshotAction.selected,
    })),
  ).toEqual({ health: 50, stock: 1, selected: false });
  // Exercise the other faction's actual view-hands and native full-health use.
  // The three eliminations above establish the grant; this item isolates poses.
  const teams = await page.evaluate(() => {
    const g = window.__game;
    g.switchTeam("t");
    g.deathmatchCombat.life("player").healthshots = 1;
    return {
      ct: g.bots.filter((bot) => bot.team === "ct").length,
      t: g.bots.filter((bot) => bot.team === "t").length,
      health: g.health,
    };
  });
  expect(teams).toEqual({ ct: 5, t: 5, health: 100 });
  await page.keyboard.press("x");
  await expect.poll(() => page.evaluate(() => window.__game.healthshotAction.phase)).toBe("idle");
  await page.screenshot({ path: "artifacts/deathmatch-healthshot-t-held.png" });
  await clickFire(page);
  await expect
    .poll(() => page.evaluate(() => window.__game.deathmatchCombat.life("player").healthshots))
    .toBe(0);
  await page.screenshot({ path: "artifacts/deathmatch-healthshot-t-injection.png" });
  await expect.poll(() => page.evaluate(() => window.__game.healthshotAction.selected)).toBe(false);
  expect(await page.evaluate(() => window.__game.health)).toBe(100);
  expect(errors).toEqual([]);
});
