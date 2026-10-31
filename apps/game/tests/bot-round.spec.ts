import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
import { weapons } from "../src/physics";
declare global {
  interface Window {
    __game: Game;
  }
}

test("casual bot rounds progress with finite combat state and reset cleanly", async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible()) {
    await page.locator('#team-select [data-team="ct"]').click();
  }
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.locked = false;
    window.__game.dead = Infinity;
  });
  const samples = [];
  for (let batch = 0; batch < 26; batch++) {
    const sample = await page.evaluate(() => {
      const game = window.__game;
      for (let frame = 0; frame < 1280; frame++) {
        // Spectate the entire fight; no invulnerable player biases the result.
        game.dead = Infinity;
        game.simulate(1 / 128);
      }
      return {
        round: game.round,
        deaths: game.bots.reduce((total, bot) => total + bot.deaths, 0),
        alive: game.bots.filter((bot) => bot.health > 0).length,
        planted: game.bomb?.planted,
        teams: [
          game.bots.filter((bot) => bot.health > 0 && bot.team === "t").length,
          game.bots.filter((bot) => bot.health > 0 && bot.team === "ct").length,
        ],
        scores: game.teamScores,
        stuck: game.bots.filter((bot) => bot.health > 0 && bot.moving && bot.stuck > 3).length,
        invalid: game.bots.some(
          (bot) =>
            !Number.isFinite(bot.group.position.lengthSq()) ||
            bot.ammo < 0 ||
            bot.reserve < 0 ||
            !Number.isFinite(bot.reloadTime),
        ),
      };
    });
    samples.push(sample);
    if (sample.invalid)
      console.log(
        "INVALID BOT",
        await page.evaluate(() =>
          window.__game.bots.map((bot) => ({
            name: bot.name,
            position: bot.group.position.toArray(),
            ammo: bot.ammo,
            reserve: bot.reserve,
            reload: bot.reloadTime,
            weapon: bot.rig.weaponIndex,
            health: bot.health,
          })),
        ),
      );
    expect(sample.invalid).toBe(false);
    if (sample.round >= 3) break;
  }
  console.log("Bot round samples", JSON.stringify(samples));
  expect(samples.some((sample) => sample.deaths > 0)).toBe(true);
  expect(samples.at(-1)!.round).toBeGreaterThanOrEqual(2);
  const reset = await page.evaluate(
    (capacities) => {
      const game = window.__game;
      const expectedWeapons = game.bots.map((bot) =>
        bot.health > 0 && game.round > 1 ? bot.rig.weaponIndex : bot.team === "t" ? 7 : 2,
      );
      game.startRound();
      return game.bots.every((bot, index) => {
        const weapon = expectedWeapons[index]!;
        return (
          bot.health === 100 &&
          bot.rig.weaponIndex === weapon &&
          bot.ammo === capacities[weapon]!.mag &&
          bot.reserve === capacities[weapon]!.reserve &&
          bot.armor === 100 &&
          bot.helmet &&
          bot.defuseKit === (bot.team === "ct") &&
          bot.reloadTime === 0 &&
          bot.burst === 0 &&
          bot.report === 0 &&
          !bot.reposition
        );
      });
    },
    weapons.map(({ mag, reserve }) => ({ mag, reserve })),
  );
  expect(reset).toBe(true);
  const carrier = await page.evaluate(() => {
    const game = window.__game;
    game.round = 2;
    game.dead = 0;
    const bot = game.bots[0];
    game.bots.slice(1).forEach((other) => {
      other.health = 0;
    });
    const nav = game.dust!.navigation;
    const oldGoal = nav.site(0, -2, 0);
    const center = oldGoal.clone().fromArray(nav.data.sites[0]);
    // Reproduce the old early-stop point outside A's plant trigger.
    const away = oldGoal.clone().sub(center).setY(0).normalize();
    bot.group.position.copy(oldGoal).addScaledVector(away, 1.15);
    bot.health = 100;
    bot.team = "t";
    bot.alert = 0;
    bot.target = null;
    bot.nav = 0;
    bot.navArea = nav.nearest(bot.group.position);
    game.bomb!.carrier = 0;
    game.bomb!.planted = false;
    game.bomb!.plantProgress = 0;
    game.updateCasualBots(1 / 16, 0);
    const advances = bot.moving;
    const initiallyOutside =
      Math.hypot(bot.group.position.x - center.x, bot.group.position.z - center.z) > 3.6;
    for (let step = 0; step < 128 * 14 && !game.bomb!.planted; step++) {
      game.updateCasualBots(1 / 16, step % 8);
      game.moveBots(1 / 128);
      game.updateRound(1 / 128);
    }
    return { advances, initiallyOutside, planted: game.bomb!.planted };
  });
  expect(carrier).toEqual({ advances: true, initiallyOutside: true, planted: true });
  await page.screenshot({ path: "artifacts/bots-round.png" });
  expect(errors).toEqual([]);
});
