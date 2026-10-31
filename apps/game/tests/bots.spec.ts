import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("bots react to visible contacts, remember lost contacts, and conserve reload ammunition", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("deathmatch");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    const team = await page.evaluate(() => window.__game.team);
    await page.locator(`#team-select [data-team="${team}"]`).click();
  }
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const game = window.__game;
    game.locked = false;
    const bot = game.bots[0];
    game.bots.slice(1).forEach((other) => {
      other.health = 0;
    });
    // The spawn corridor is clear, making visibility independent of props.
    bot.group.position.set(-17, 0, 10);
    bot.facing = 0;
    bot.target = null;
    bot.alert = 0;
    bot.aim.copy(bot.group.position);
    bot.buyTime = Infinity;
    bot.speed = 0;
    game.position.set(-17, 0, 16);
    game.velocity.x = game.velocity.z = 0;
    game.shotTime = 0;
    game.firing = false;
    game.dead = 0;
    const contact = game.perceiveBot(bot, 1 / 16);
    const reaction = bot.reaction;
    const remembered = bot.memory.clone();
    game.position.set(-17, 0, -16);
    const behind = game.perceiveBot(bot, 1 / 16);
    const memoryUnchanged = bot.memory.equals(remembered);
    bot.ammo = 0;
    bot.reserve = 5;
    game.botCombat(bot, undefined, 1 / 16);
    const reloading = bot.reloadTime > 0;
    game.botCombat(bot, undefined, 10);
    const ammunition = { loaded: bot.ammo, reserve: bot.reserve };
    game.position.set(-17, 0, 16);
    game.health = 100;
    game.armor = 0;
    game.invulnerable = 0;
    bot.aim.copy(game.position).y += 1.2;
    bot.reaction = bot.shot = 0;
    bot.speed = 0;
    game.botCombat(bot, contact, 1 / 16);
    const hitHealth = game.health;
    const roundsAfterShot = bot.ammo;
    // A teammate crossing the lane blocks the shot before ammunition is spent.
    game.mode = "casual";
    const buddy = game.bots[1];
    buddy.health = 100;
    buddy.team = bot.team;
    buddy.group.position.set(-17, 0, 13);
    bot.shot = 0;
    game.botCombat(bot, contact, 1 / 16);
    const friendlyRounds = bot.ammo;
    const laneReposition = bot.reposition && bot.tactic > 0 && bot.nav === 0;
    game.mode = "deathmatch";
    bot.rig.weaponIndex = 10;
    bot.ammo = 0;
    bot.reserve = 3;
    bot.reloadTime = 0;
    game.botCombat(bot, undefined, 1 / 16);
    game.botCombat(bot, undefined, 1);
    const shellLoaded = { ammo: bot.ammo, reserve: bot.reserve, continuing: bot.reloadTime > 0 };
    game.botCombat(bot, contact, 1);
    const shellInterrupted = { ammo: bot.ammo, reserve: bot.reserve, reload: bot.reloadTime };
    return {
      acquired: contact?.id,
      reaction,
      behind: behind?.id ?? null,
      memoryUnchanged,
      reloading,
      ammunition,
      hitHealth,
      roundsAfterShot,
      friendlyRounds,
      laneReposition,
      shellLoaded,
      shellInterrupted,
    };
  });
  expect(result.acquired).toBe("player");
  expect(result.reaction).toBeGreaterThan(0);
  expect(result.behind).toBeNull();
  expect(result.memoryUnchanged).toBe(true);
  expect(result.reloading).toBe(true);
  expect(result.ammunition).toEqual({ loaded: 5, reserve: 0 });
  expect(result.hitHealth).toBeLessThan(100);
  expect(result.roundsAfterShot).toBe(4);
  expect(result.friendlyRounds).toBe(4);
  expect(result.laneReposition).toBe(true);
  expect(result.shellLoaded).toEqual({ ammo: 1, reserve: 2, continuing: true });
  expect(result.shellInterrupted).toEqual({ ammo: 2, reserve: 1, reload: 0 });
  expect(errors).toEqual([]);
});
