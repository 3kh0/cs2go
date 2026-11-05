import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("bomb carriers and retaking CTs commit to objectives through distant contact", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__game);
  await page.bringToFront();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game?.locked);
  const decisions = await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.freezeTime = 0;
    g.botCombat = () => {};
    const originalPerceive = g.perceiveBot.bind(g);
    let distance = 20;
    // Inject an already perceived contact so this scenario measures objective
    // decisions independently of spawn orientation and incidental sightlines.
    g.perceiveBot = (b) => {
      b.tracking = true;
      b.target = "player";
      b.alert = 5;
      b.memory.copy(g.position);
      return { id: "player", position: g.position, distance, score: distance };
    };
    const results = [];
    for (const team of ["t", "ct"] as const) {
      const index = g.bots.findIndex((b) => b.team === team);
      const bot = g.bots[index];
      g.bots.forEach((b) => {
        b.health = b === bot ? 100 : 0;
      });
      bot.group.position.fromArray(g.dust!.navigation.data.spawns[team][0]);
      bot.navArea = g.dust!.navigation.nearest(bot.group.position);
      g.bomb!.planted = team === "ct";
      g.bomb!.carrier = team === "t" ? index : -1;
      g.bomb!.defuser = null;
      g.bomb!.plantProgress = 0;
      g.bomb!.position.copy(g.dust!.navigation.site(1));
      const think = () => {
        bot.reposition = false;
        bot.tactic = 1;
        bot.nav = 0;
        g.updateCasualBots(1 / 16, index % 8);
        return bot.moving;
      };
      distance = 20;
      const distant = think();
      distance = 3;
      const close = think();
      distance = 20;
      if (team === "t") g.bomb!.plantProgress = 0.5;
      else g.bomb!.defuser = index;
      const interacting = think();
      let defuseStarted = false;
      if (team === "ct") {
        g.bomb!.defuser = null;
        bot.group.position.copy(g.bomb!.position);
        bot.memory.copy(g.position);
        g.updateRound(0.1);
        defuseStarted = g.bomb!.defuser === index && g.bomb!.progress > 0;
      }
      results.push({ team, distant, close, interacting, defuseStarted });
    }
    const terrorists = g.bots.flatMap((b, i) => (b.team === "t" ? [i] : []));
    const leader = terrorists[0];
    const escortIndex = terrorists[1];
    const escort = g.bots[escortIndex];
    g.bots.forEach((b, i) => {
      b.health = i === leader || i === escortIndex ? 100 : 0;
    });
    escort.group.position.fromArray(g.dust!.navigation.data.spawns.t[0]);
    escort.navArea = g.dust!.navigation.nearest(escort.group.position);
    g.round = 6;
    g.botStrategySeed = 0;
    g.time = g.rules.roundTime;
    g.bomb!.planted = false;
    g.bomb!.carrier = leader;
    g.bomb!.defuser = null;
    g.bomb!.plantProgress = 0;
    g.resetBotStrategies();
    const push = g
      .dust!.navigation.site(g.botStrategies!.t.site === "a" ? 0 : 1)
      .sub(escort.group.position)
      .setY(0)
      .normalize();
    g.bots[leader].group.position.copy(escort.group.position).addScaledVector(push, 20);
    g.bots[leader].moving = true;
    g.bots[leader].speed = 3;
    escort.nav = 0;
    escort.tactic = 1;
    g.updateCasualBots(1 / 16, escortIndex % 8);
    const regrouping = { moving: escort.moving, regrouping: escort.regrouping };
    g.perceiveBot = originalPerceive;
    return { results, regrouping };
  });
  expect(decisions.results).toEqual([
    { team: "t", distant: true, close: false, interacting: false, defuseStarted: false },
    { team: "ct", distant: true, close: false, interacting: false, defuseStarted: true },
  ]);
  expect(decisions.regrouping).toEqual({ moving: true, regrouping: true });
  const search = await page.evaluate(() => {
    const g = window.__game;
    const index = g.bots.findIndex((b) => b.team === "ct");
    const bot = g.bots[index];
    g.bots.forEach((b) => {
      b.health = b === bot ? 100 : 0;
    });
    const nav = g.dust!.navigation;
    g.spawnBot(bot, index);
    g.bomb!.planted = false;
    g.bomb!.carrier = -1;
    g.bomb!.defuser = null;
    g.dead = Infinity;
    g.botStrategySeed = 0;
    g.round = 1;
    g.time = g.rules.roundTime;
    g.resetBotStrategies();
    const assigned = g.botStrategies!.ct.order(index)!.goal;
    const goals = [];
    for (const elapsed of [20, 70]) {
      bot.quiet = elapsed;
      bot.nav = 0;
      g.updateCasualBots(1 / 16, index % 8);
      goals.push({
        position: bot.goal.toArray(),
        assigned: bot.goal.distanceTo(bot.goal.clone().fromArray(assigned)) < 0.001,
        legal: nav.areas.some(
          (area) => bot.goal.distanceToSquared(bot.goal.clone().fromArray(area.center)) < 0.001,
        ),
        hasRoute: bot.path.length > 0,
        moving: bot.moving,
      });
    }
    return goals;
  });
  expect(search.every((goal) => goal.legal && goal.moving && goal.hasRoute)).toBe(true);
  expect(search.every((goal) => goal.assigned)).toBe(true);
  expect(search[0].position).toEqual(search[1].position);
  expect(errors).toEqual([]);
});

test("an unopposed Dust II bomb carrier makes sustained progress from spawn to the site", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__game);
  await page.bringToFront();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game?.locked);
  const journeys = await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.freezeTime = 0;
    g.dead = Infinity;
    const index = g.bots.findIndex((b) => b.team === "t");
    const bot = g.bots[index];
    g.bots.forEach((b) => {
      b.health = b === bot ? 100 : 0;
      b.group.visible = b === bot;
    });
    g.utility.botInventories.clear();
    g.bomb!.carrier = index;
    g.botStrategySeed = 0;
    const journeys = [];
    for (const spawn of [0, 5, -1]) {
      for (const site of spawn < 0 ? [1] : [1, 0]) {
        g.spawnBot(bot, index);
        const nav = g.dust!.navigation;
        bot.group.position.fromArray(
          spawn < 0 ? [-25.48573, 3.3274, 17.14024] : nav.data.spawns.t[spawn],
        );
        const floor = g.dust!.collision.floor(
          bot.group.position.x,
          bot.group.position.z,
          bot.group.position.y + 0.5,
        );
        if (Number.isFinite(floor)) bot.group.position.y = floor;
        bot.navArea = nav.nearest(bot.group.position);
        bot.progressPosition.copy(bot.group.position);
        bot.goal.copy(bot.group.position);
        // Seed zero chooses longA in round one and rushB in round six.
        g.round = site === 0 ? 1 : 6;
        g.time = g.rules.roundTime;
        g.roundElapsed = 0;
        g.resetBotStrategies();
        const strategy = g.botStrategies!.t;
        const goal = nav.site(strategy.site === "a" ? 0 : 1);
        const start = bot.group.position.clone();
        if (spawn < 0) {
          // Native dumpster/rock shortcut: take off from area496 and land on
          // area472, then continue to the bomb site instead of camping on it.
          bot.path = [
            [-25.8572, 4.3688, 15.7734],
            [-25.83815, 4.572, 15.2019],
            [-25.8191, 4.7752, 14.6304],
          ].map((point) => start.clone().fromArray(point));
          bot.goal.fromArray(strategy.order(index)!.goal);
          bot.nav = 3;
        }
        let maxHeight = start.y;
        let travelled = 0;
        let ticks = 0;
        const samples = [];
        for (; ticks < 128 * 60; ticks++) {
          const before = bot.group.position.clone();
          g.updateCasualBots(1 / 16, ticks % 8);
          g.moveBots(1 / 128);
          travelled += before.distanceTo(bot.group.position);
          maxHeight = Math.max(maxHeight, bot.group.position.y);
          if (ticks % 640 === 0)
            samples.push({
              seconds: ticks / 128,
              position: bot.group.position.toArray(),
              remaining: bot.group.position.distanceTo(goal),
              next: bot.path.slice(0, 3).map((p) => p.toArray()),
              navArea: bot.navArea,
              stuck: bot.stuck,
              recoveries: bot.recoveries,
              blockedAreas: [...bot.blockedAreas],
            });
          if (bot.group.position.distanceTo(goal) < 1) break;
        }
        journeys.push({
          spawn,
          site,
          plan: strategy.plan,
          elapsed: ticks / 128,
          maxHeight,
          remaining: bot.group.position.distanceTo(goal),
          displacement: bot.group.position.distanceTo(start),
          travelled,
          samples,
          position: bot.group.position.toArray(),
        });
      }
    }
    g.spectated = bot;
    g.spectatorMode = "third";
    g.spectate();
    return journeys;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/bot-objective-progress.png" });
  for (const journey of journeys) {
    expect(journey.position.every(Number.isFinite)).toBe(true);
    expect(journey.displacement).toBeGreaterThan(15);
    if (journey.spawn < 0) expect(journey.maxHeight).toBeGreaterThan(4.3);
    expect(journey.remaining, JSON.stringify(journey)).toBeLessThan(2);
  }
  expect(errors).toEqual([]);
});

test("the full T squad advances past a stationary player carrier and a parked teammate", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__game);
  await page.bringToFront();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="t"]').click();
  await page.waitForFunction(() => window.__game?.locked);
  const scenarios = await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.freezeTime = 0;
    g.bots.forEach((b) => {
      if (b.team === "ct") {
        b.health = 0;
        b.group.visible = false;
      }
    });
    g.utility.botInventories.clear();
    const squad = g.bots.filter((b) => b.team === "t");
    const playerSpawn = g.position.clone();
    const run = (parked: boolean) => {
      g.round = 6;
      g.botStrategySeed = 0;
      g.roundElapsed = 0;
      g.time = g.rules.roundTime;
      g.bomb!.carrier = "player";
      g.bomb!.planted = false;
      squad.forEach((b) => g.spawnBot(b, g.bots.indexOf(b)));
      const blocker = parked ? squad[0] : null;
      const park = playerSpawn.clone().set(-42.29735, 0.8636, -17.526);
      if (blocker) {
        blocker.group.position.copy(park);
        blocker.navArea = g.dust!.navigation.nearest(park);
      }
      g.resetBotStrategies();
      const advancing = squad.filter((b) => b !== blocker);
      const snapshots = [];
      for (let tick = 0; tick < 128 * 45; tick++) {
        g.time -= 1 / 128;
        g.updateCasualBots(1 / 16, tick % 8);
        if (blocker) {
          blocker.moving = false;
          blocker.velocity.set(0, 0);
        }
        g.moveBots(1 / 128);
        if (blocker) blocker.group.position.copy(park);
        if (tick % 640 === 0)
          snapshots.push({
            seconds: tick / 128,
            positions: advancing.map((b) => b.group.position.toArray()),
            distances: advancing.map((b) => b.group.position.distanceTo(playerSpawn)),
          });
      }
      return {
        parked,
        playerDisplacement: g.position.distanceTo(playerSpawn),
        count: advancing.length,
        advanced: advancing.filter((b) => b.group.position.distanceTo(playerSpawn) > 20).length,
        passed: advancing.filter((b) => b.group.position.z < park.z - 6).length,
        distances: advancing.map((b) => b.group.position.distanceTo(playerSpawn)),
        positions: advancing.map((b) => b.group.position.toArray()),
        snapshots,
      };
    };
    const scenarios = [run(false), run(true)];
    g.dead = Infinity;
    g.spectated = squad[1];
    g.spectatorMode = "third";
    g.spectate();
    return scenarios;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/bot-full-squad-progress.png" });
  for (const scenario of scenarios) {
    expect(scenario.playerDisplacement).toBeLessThan(0.001);
    for (const snapshot of scenario.snapshots.slice(-3))
      expect(
        snapshot.distances.filter((distance) => distance > 20).length,
        JSON.stringify(scenario),
      ).toBeGreaterThan(scenario.count / 2);
    expect(scenario.advanced, JSON.stringify(scenario)).toBe(scenario.count);
    if (scenario.parked) expect(scenario.passed, JSON.stringify(scenario)).toBe(scenario.count);
  }
  expect(errors).toEqual([]);
});
