import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

async function enterMirage(page: Page) {
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.bringToFront();
  await page.locator("#home-play").click();
  await page.locator('.match-maps [data-map="mirage"]').click();
  await page.locator("#play").click();
  await expect(page.locator('#team-select [data-team="t"]')).toBeVisible({ timeout: 120_000 });
  await page.locator('#team-select [data-team="t"]').click();
  await page.waitForFunction(() => window.__game.locked && window.__game.dust?.id === "mirage");
}

test("Mirage squads physically traverse native routes, plant both sites and retake to defuse", async ({
  page,
}) => {
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await enterMirage(page);
  const journeys = await page.evaluate(async () => {
    const modulePath = "/src/bot-strategy-routes.ts";
    const { buildBotStrategyRoutes } = (await import(
      modulePath
    )) as typeof import("../src/bot-strategy-routes");
    const g = window.__game;
    g.simulate = () => {};
    g.visible = () => false;
    g.botCombat = () => {};
    g.utility.botInventories.clear();
    g.botStrategySeed = 0;
    const squad = g.bots.filter((bot) => bot.team === "t");
    g.bots
      .filter((bot) => bot.team === "ct")
      .forEach((bot) => {
        bot.health = 0;
        bot.group.visible = false;
      });
    const routes = buildBotStrategyRoutes(g.dust!.navigation);
    const results = [];
    for (let round = 1; round <= 6; round++) {
      g.round = round;
      g.time = g.rules.roundTime;
      g.roundElapsed = g.freezeTime = g.roundPause = 0;
      g.bomb!.carrier = "player";
      g.bomb!.planted = false;
      g.bomb!.defuser = null;
      squad.forEach((bot) => g.spawnBot(bot, g.bots.indexOf(bot)));
      const starts = squad.map((bot) => bot.group.position.clone());
      g.resetBotStrategies();
      const strategy = g.botStrategies!.t;
      const snapshots = [];
      for (let tick = 0; tick < 128 * 60; tick++) {
        g.time -= 1 / 128;
        g.roundElapsed += 1 / 128;
        g.updateCasualBots(1 / 16, tick % 8);
        g.moveBots(1 / 128);
        if (tick % 1280 === 0) snapshots.push(squad.map((bot) => bot.group.position.toArray()));
      }
      const site = g.dust!.navigation.site(strategy.site === "a" ? 0 : 1);
      results.push({
        round,
        plan: strategy.plan,
        site: strategy.site,
        distances: squad.map((bot, index) => bot.group.position.distanceTo(starts[index])),
        nearSite: squad.filter((bot) => bot.group.position.distanceTo(site) < 20).length,
        finishedStaging: squad.map((bot) => {
          const order = strategy.order(g.bots.indexOf(bot));
          return !!order && order.stage >= routes.lanes[order.lane].length;
        }),
        positions: squad.map((bot) => bot.group.position.toArray()),
        snapshots,
      });
    }
    return results;
  });
  await test.info().attach("mirage-squad-journeys", {
    body: JSON.stringify(journeys, null, 2),
    contentType: "application/json",
  });
  expect(new Set(journeys.map((play) => play.plan)).size).toBe(6);
  expect(new Set(journeys.map((play) => play.site)).size).toBe(2);
  for (const play of journeys) {
    expect(play.distances.filter((distance) => distance > 15).length, JSON.stringify(play)).toBe(9);
    expect(play.nearSite, JSON.stringify(play)).toBeGreaterThanOrEqual(8);
    expect(play.finishedStaging.every(Boolean), JSON.stringify(play)).toBe(true);
    expect(play.positions.flat().every(Number.isFinite)).toBe(true);
  }
  const lowPassage = await page.evaluate(() => {
    const g = window.__game;
    g.bots.forEach((bot) => {
      bot.health = 0;
      bot.group.visible = false;
    });
    const bot = g.bots.find((candidate) => candidate.team === "t")!;
    g.spawnBot(bot, g.bots.indexOf(bot));
    // Native NAV area 2096 is the short ledge under the B-side overhang.
    // Its actual imported collision admits a crouched hull and blocks standing.
    const nav = g.dust!.navigation,
      area = nav.areas[nav.index.get(2096)!];
    const start = bot.group.position.fromArray(area.center);
    start.x -= 0.8;
    start.y = g.world.collision.floor(start.x, start.z, start.y + 0.4, start.y - 1);
    const target = start.clone();
    target.x += 1.6;
    bot.navArea = nav.index.get(area.id)!;
    bot.path = [target];
    bot.goal.copy(target);
    bot.moving = true;
    bot.tracking = false;
    bot.navCrouch = false;
    bot.rig.crouch = 0;
    bot.vertical = 0;
    const startPosition = start.clone();
    const standingBlocked = g.isBlocked(start.x, start.z, start.y, 0.35, 1.65);
    const crouchClear = !g.isBlocked(start.x, start.z, start.y, 0.35, 1.1);
    for (let tick = 0; tick < 128 * 2; tick++) g.moveBots(1 / 128);
    const lowered = bot.navCrouch && bot.rig.crouch > 0.9;
    const travelled = bot.group.position.distanceTo(startPosition);
    const targetDistance = bot.group.position.distanceTo(target);
    const crouchedHull = g.botHullHeight(bot);
    bot.group.position.fromArray(nav.data.spawns.t[0]);
    bot.group.position.y = g.world.collision.floor(
      bot.group.position.x,
      bot.group.position.z,
      bot.group.position.y + 0.5,
    );
    bot.navArea = nav.nearest(bot.group.position);
    bot.path = [];
    bot.moving = false;
    for (let tick = 0; tick < 128; tick++) g.moveBots(1 / 128);
    return {
      standingBlocked,
      crouchClear,
      lowered,
      travelled,
      targetDistance,
      crouchedHull,
      stoodAfterClear: !bot.navCrouch && bot.rig.crouch < 0.01 && g.botHullHeight(bot) > 1.64,
    };
  });
  expect(lowPassage, JSON.stringify(lowPassage)).toMatchObject({
    standingBlocked: true,
    crouchClear: true,
    lowered: true,
    stoodAfterClear: true,
    crouchedHull: 1.1,
  });
  expect(lowPassage.travelled).toBeGreaterThan(1);
  expect(lowPassage.targetDistance).toBeLessThan(0.5);
  const takeover = await page.evaluate(async () => {
    const path = "/src/physics.ts";
    const { movement } = (await import(path)) as typeof import("../src/physics");
    const g = window.__game;
    const bot = g.bots.find((candidate) => candidate.team === g.team)!;
    const nav = g.dust!.navigation;
    const area = nav.areas[nav.index.get(2096)!];
    g.spawnBot(bot, g.bots.indexOf(bot));
    bot.group.position.fromArray(area.center);
    bot.group.position.y = g.world.collision.floor(
      bot.group.position.x,
      bot.group.position.z,
      bot.group.position.y + 0.4,
      bot.group.position.y - 1,
    );
    bot.navCrouch = true;
    bot.rig.crouch = 1;
    bot.velocity.set(0, 0);
    bot.vertical = 0;
    const feet = bot.group.position.clone();
    g.dead = Infinity;
    g.health = 0;
    g.roundPause = g.freezeTime = 0;
    g.spectated = bot;
    g.spectatorMode = "first";
    const accepted = g.takeOverBot();
    const initialEye = g.eye;
    const positionPreserved = g.position.distanceTo(feet) < 0.001;
    // Run real player movement, without advancing this route fixture's round
    // controller. No crouch key is held: clearance alone must preserve posture.
    const updateRound = g.updateRound.bind(g);
    g.updateRound = () => {};
    const prototype = Object.getPrototypeOf(g) as Game;
    try {
      for (let tick = 0; tick < 128; tick++) prototype.simulate.call(g, 1 / 128);
      const stayedCrouched = g.crouching;
      const hullClear = !g.isBlocked(
        g.position.x,
        g.position.z,
        g.position.y,
        movement.hullRadius,
        g.hullHeight,
      );
      const eyeUnderCeiling = g.eye;
      g.position.fromArray(nav.data.spawns.t[0]);
      g.position.y = g.world.collision.floor(g.position.x, g.position.z, g.position.y + 0.5);
      for (let tick = 0; tick < 128; tick++) prototype.simulate.call(g, 1 / 128);
      return {
        accepted,
        positionPreserved,
        initialEye,
        eyeUnderCeiling,
        stayedCrouched,
        hullClear,
        stoodAfterClear: !g.crouching && Math.abs(g.eye - movement.standingEye) < 0.001,
      };
    } finally {
      g.updateRound = updateRound;
    }
  });
  expect(takeover, JSON.stringify(takeover)).toMatchObject({
    accepted: true,
    positionPreserved: true,
    stayedCrouched: true,
    hullClear: true,
    stoodAfterClear: true,
  });
  expect(takeover.initialEye).toBeLessThan(1.2);
  expect(takeover.eyeUnderCeiling).toBeCloseTo(takeover.initialEye, 3);
  const objectives = await page.evaluate(() => {
    const g = window.__game;
    const squad = g.bots.filter((bot) => bot.team === "t");
    const defenders = g.bots.filter((bot) => bot.team === "ct");
    const results = [];
    for (const wanted of ["a", "b"] as const) {
      g.bomb!.planted = false;
      g.bomb!.carrier = g.bots.indexOf(squad[0]);
      g.bomb!.defuser = null;
      g.roundElapsed = g.freezeTime = g.roundPause = 0;
      g.time = g.rules.roundTime;
      let round = 1;
      for (; round <= 6; round++) {
        g.round = round;
        g.resetBotStrategies();
        if (g.botStrategies!.t.plan === (wanted === "a" ? "longA" : "rushB")) break;
      }
      g.round = round;
      g.time = g.rules.roundTime;
      g.roundElapsed = g.freezeTime = g.roundPause = 0;
      g.bomb!.carrier = g.bots.indexOf(squad[0]);
      g.bomb!.planted = false;
      g.bomb!.defuser = null;
      g.bomb!.progress = g.bomb!.plantProgress = 0;
      defenders.forEach((bot) => {
        bot.health = 0;
        bot.group.visible = false;
      });
      squad.forEach((bot) => g.spawnBot(bot, g.bots.indexOf(bot)));
      g.resetBotStrategies();
      let plantSeconds = 0;
      for (let tick = 0; tick < 128 * 75 && !g.bomb!.planted; tick++) {
        g.time -= 1 / 128;
        g.roundElapsed += 1 / 128;
        g.updateCasualBots(1 / 16, tick % 8);
        g.moveBots(1 / 128);
        g.updateBombPlant(1 / 128);
        plantSeconds = (tick + 1) / 128;
      }
      const planted = g.bomb!.planted;
      const plantPosition = g.bomb!.position.toArray();
      const site = g.dust!.navigation.site(wanted === "a" ? 0 : 1);
      squad.forEach((bot) => {
        bot.health = 0;
        bot.group.visible = false;
      });
      defenders.forEach((bot) => {
        g.spawnBot(bot, g.bots.indexOf(bot));
        bot.defuseKit = true;
      });
      const starts = defenders.map((bot) => bot.group.position.clone());
      g.bomb!.timer = 40;
      g.roundPause = 0;
      g.resetBotStrategies();
      let defuseSeconds = 0;
      for (let tick = 0; tick < 128 * 60 && !g.roundPause; tick++) {
        g.updateCasualBots(1 / 16, tick % 8);
        g.moveBots(1 / 128);
        g.updateRound(1 / 128);
        defuseSeconds = (tick + 1) / 128;
      }
      results.push({
        site: wanted,
        planted,
        plantSeconds,
        plantPosition,
        plantSiteDistance: site.distanceTo(g.bomb!.position),
        defused: g.roundPause > 0 && g.bomb!.timer > 0,
        defuseSeconds,
        ctDistances: defenders.map((bot, index) => bot.group.position.distanceTo(starts[index])),
      });
    }
    g.dead = Infinity;
    g.spectated = defenders[0];
    g.spectatorMode = "third";
    g.spectate();
    return results;
  });
  await test.info().attach("mirage-objective-journeys", {
    body: JSON.stringify(objectives, null, 2),
    contentType: "application/json",
  });
  for (const objective of objectives) {
    expect(objective.planted, JSON.stringify(objective)).toBe(true);
    expect(objective.plantSiteDistance, JSON.stringify(objective)).toBeLessThan(12);
    expect(objective.defused, JSON.stringify(objective)).toBe(true);
    expect(
      objective.ctDistances.some((distance) => distance > 5),
      JSON.stringify(objective),
    ).toBe(true);
  }
  await page.screenshot({ path: "artifacts/mirage-bot-retake.png" });
  expect(errors).toEqual([]);
});
