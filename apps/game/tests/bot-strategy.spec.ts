import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

async function enterMatch(page: Page, team: "t" | "ct") {
  await page.goto("/");
  await page.waitForFunction(() => !!window.__game);
  await page.bringToFront();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator(`#team-select [data-team="${team}"]`).click();
  await page.waitForFunction(() => window.__game?.locked);
}

test("T round plans physically use different lanes and finish staging with the full squad", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterMatch(page, "t");
  const plays = await page.evaluate(async () => {
    const routeModulePath = "/src/bot-strategy-routes.ts";
    const { buildBotStrategyRoutes } = (await import(
      routeModulePath
    )) as typeof import("../src/bot-strategy-routes");
    const g = window.__game;
    const routes = buildBotStrategyRoutes(g.dust!.navigation);
    g.simulate = () => {};
    g.utility.botInventories.clear();
    g.botStrategySeed = 0;
    g.bots.forEach((b) => {
      if (b.team === "ct") {
        b.health = 0;
        b.group.visible = false;
      }
    });
    const squad = g.bots.filter((b) => b.team === "t");
    const start = g.position.clone();
    const plays = [];
    const laneMarkers = {
      longA: [39.745, -30.277],
      shortA: [8, -37],
      tunnelsB: [-42, -21],
      midB: [-9, -54],
    };
    for (let round = 1; round <= 6; round++) {
      g.round = round;
      g.time = g.rules.roundTime;
      g.roundElapsed = g.freezeTime = 0;
      g.bomb!.carrier = "player";
      g.bomb!.planted = false;
      g.bomb!.defuser = null;
      squad.forEach((b) => g.spawnBot(b, g.bots.indexOf(b)));
      g.resetBotStrategies();
      const strategy = g.botStrategies!.t;
      const laneVisits: Record<string, Set<number>> = Object.fromEntries(
        Object.keys(laneMarkers).map((lane) => [lane, new Set<number>()]),
      );
      const snapshots = [];
      for (let tick = 0; tick < 128 * 60; tick++) {
        g.time -= 1 / 128;
        g.roundElapsed += 1 / 128;
        g.updateCasualBots(1 / 16, tick % 8);
        g.moveBots(1 / 128);
        squad.forEach((b, member) => {
          for (const [lane, [x, z]] of Object.entries(laneMarkers))
            if (Math.hypot(b.group.position.x - x, b.group.position.z - z) < 8)
              laneVisits[lane].add(member);
        });
        if (tick % 640 === 0)
          snapshots.push({
            seconds: tick / 128,
            orders: squad.map((b) => strategy.order(g.bots.indexOf(b))),
            positions: squad.map((b) => b.group.position.toArray()),
          });
      }
      const site = g.dust!.navigation.site(strategy.site === "a" ? 0 : 1);
      plays.push({
        round,
        plan: strategy.plan,
        site: strategy.site,
        orders: squad.map((b) => strategy.order(g.bots.indexOf(b))),
        finishedStaging: squad.map((b) => {
          const order = strategy.order(g.bots.indexOf(b));
          return !!order && order.stage >= routes.lanes[order.lane].length;
        }),
        knownWatchpoints: squad.map((b) => {
          const order = strategy.order(g.bots.indexOf(b));
          return (
            !!order?.watch &&
            Object.values(routes.lanes)
              .flat()
              .some(
                (waypoint) =>
                  Math.hypot(
                    waypoint.position[0] - order.watch![0],
                    waypoint.position[2] - order.watch![2],
                  ) < 0.01,
              )
          );
        }),
        distances: squad.map((b) => b.group.position.distanceTo(start)),
        nearSite: squad.filter((b) => b.group.position.distanceTo(site) < 30).length,
        laneVisits: Object.fromEntries(
          Object.entries(laneVisits).map(([lane, members]) => [lane, [...members]]),
        ),
        snapshots,
      });
    }
    g.dead = Infinity;
    g.spectated = squad[1];
    g.spectatorMode = "third";
    g.spectate();
    return plays;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/bot-round-strategy.png" });
  expect(new Set(plays.map((play) => play.plan)).size).toBeGreaterThanOrEqual(4);
  expect(new Set(plays.map((play) => play.site)).size).toBe(2);
  for (const play of plays) {
    expect(play.distances.filter((distance) => distance > 20).length, JSON.stringify(play)).toBe(9);
    expect(play.nearSite, JSON.stringify(play)).toBeGreaterThanOrEqual(8);
    expect(play.finishedStaging.every(Boolean), JSON.stringify(play)).toBe(true);
    expect(
      new Set(play.orders.map((order) => JSON.stringify(order?.goal))).size,
    ).toBeGreaterThanOrEqual(4);
    expect(play.knownWatchpoints.every(Boolean), JSON.stringify(play)).toBe(true);
  }
  const plan = (name: string) => plays.find((play) => play.plan === name)!;
  expect(plan("longA").laneVisits.longA.length).toBeGreaterThanOrEqual(6);
  expect(plan("shortA").laneVisits.shortA.length).toBeGreaterThanOrEqual(6);
  expect(plan("rushB").laneVisits.tunnelsB.length).toBeGreaterThanOrEqual(6);
  expect(plan("splitA").laneVisits.longA.length).toBeGreaterThanOrEqual(3);
  expect(plan("splitA").laneVisits.shortA.length).toBeGreaterThanOrEqual(3);
  expect(plan("midB").laneVisits.midB.length).toBeGreaterThanOrEqual(4);
  expect(plan("midB").laneVisits.tunnelsB.length).toBeGreaterThanOrEqual(2);
  expect(plan("defaultRotate").laneVisits.longA.length).toBeGreaterThanOrEqual(2);
  expect(plan("defaultRotate").laneVisits.midB.length).toBeGreaterThanOrEqual(6);
  expect(plan("defaultRotate").site).toBe("b");
  expect(errors).toEqual([]);
});

test("CT strategy uses contact reports and a public plant without tracking hidden enemies", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterMatch(page, "t");
  const response = await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    // Suppress sight and noise, making enemy coordinates private information.
    g.visible = () => false;
    g.botCombat = () => {};
    g.botStrategySeed = 0;
    g.velocity.x = g.velocity.z = 0;
    g.firing = false;
    g.shotTime = 0;
    g.utility.botInventories.clear();
    g.bots.forEach((b) => {
      if (b.team === "t") {
        b.health = 0;
        b.group.visible = false;
      }
    });
    const defenders = g.bots.filter((b) => b.team === "ct");
    const sites = [g.dust!.navigation.site(0), g.dust!.navigation.site(1)];
    const orders = () => defenders.map((b) => g.botStrategies!.ct.order(g.bots.indexOf(b)));
    const think = () => {
      for (let phase = 0; phase < 8; phase++) g.updateCasualBots(1 / 16, phase);
    };
    const reset = (hiddenSite: number) => {
      g.round = 1;
      g.time = g.rules.roundTime;
      g.roundElapsed = g.freezeTime = 0;
      g.bomb!.planted = false;
      g.bomb!.carrier = "player";
      g.bomb!.defuser = null;
      g.position.copy(sites[hiddenSite]);
      defenders.forEach((b) => g.spawnBot(b, g.bots.indexOf(b)));
      g.resetBotStrategies();
      think();
      return orders();
    };
    const hiddenA = reset(0);
    defenders.forEach((b, index) => {
      const order = hiddenA[index]!;
      b.group.position.fromArray(order.goal);
      b.navArea = g.dust!.navigation.nearest(b.group.position);
      b.facing = 123;
    });
    think();
    const watchAngles = defenders.flatMap((b) => {
      const order = g.botStrategies!.ct.order(g.bots.indexOf(b));
      if (!order?.watch) return [];
      const expected = Math.atan2(
        order.watch[0] - b.group.position.x,
        order.watch[2] - b.group.position.z,
      );
      return [Math.abs(Math.atan2(Math.sin(b.facing - expected), Math.cos(b.facing - expected)))];
    });
    const hiddenB = reset(1);
    const beforeReport = defenders.map((b) => b.group.position.distanceTo(sites[0]));
    const reporter = defenders[0];
    reporter.memory.copy(sites[0]);
    reporter.report = 1.5;
    reporter.alert = 5;
    for (let tick = 0; tick < 128 * 5; tick++) {
      reporter.report = 1.5;
      reporter.memory.copy(sites[0]);
      g.time -= 1 / 128;
      g.roundElapsed += 1 / 128;
      g.updateCasualBots(1 / 16, tick % 8);
      g.moveBots(1 / 128);
    }
    const reported = orders();
    const afterReport = defenders.map((b) => b.group.position.distanceTo(sites[0]));
    const beforePlant = defenders.map((b) => b.group.position.distanceTo(sites[1]));
    // A planted C4 is public, unlike the carrier's hidden position.
    g.bomb!.planted = true;
    g.bomb!.position.copy(sites[1]);
    g.bomb!.carrier = -1;
    for (let tick = 0; tick < 128 * 25; tick++) {
      g.time -= 1 / 128;
      g.roundElapsed += 1 / 128;
      g.updateCasualBots(1 / 16, tick % 8);
      g.moveBots(1 / 128);
    }
    return {
      hiddenA,
      hiddenB,
      watchAngles,
      reported,
      beforeReport,
      afterReport,
      planted: orders(),
      beforePlant,
      afterPlant: defenders.map((b) => b.group.position.distanceTo(sites[1])),
    };
  });
  expect(response.hiddenA).toEqual(response.hiddenB);
  expect(response.watchAngles.length).toBeGreaterThanOrEqual(4);
  expect(response.watchAngles.every((angle) => angle < 0.01)).toBe(true);
  expect(
    new Set(response.hiddenA.map((order) => JSON.stringify(order?.goal))).size,
  ).toBeGreaterThanOrEqual(4);
  expect(new Set(response.hiddenA.map((order) => order?.site)).size).toBe(2);
  expect(response.reported).not.toEqual(response.hiddenB);
  expect(
    response.reported.filter(
      (order, index) =>
        JSON.stringify(order?.goal) !== JSON.stringify(response.hiddenB[index]?.goal),
    ).length,
  ).toBeGreaterThanOrEqual(2);
  expect(
    response.afterReport.filter((distance, index) => distance < response.beforeReport[index] - 2)
      .length,
  ).toBeGreaterThanOrEqual(2);
  expect(
    response.afterPlant.filter((distance) => distance < 20).length,
    JSON.stringify(response),
  ).toBeGreaterThanOrEqual(8);
  expect(errors).toEqual([]);
});

test("a support bot spends real utility preparing its planned entry before contact", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterMatch(page, "t");
  const preparation = await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.freezeTime = 0;
    g.botStrategySeed = 0;
    g.round = 6;
    g.resetBotStrategies();
    const index = g.bots.findIndex(
      (b, index) => b.team === "t" && g.botStrategies!.t.order(index)?.role === "support",
    );
    const bot = g.bots[index];
    g.bots.forEach((b) => {
      b.health = b === bot ? 100 : 0;
    });
    const entry = g.botStrategies!.t.order(index)!;
    // Reach the first checkpoint, then prepare the last approach to B.
    bot.group.position.fromArray(entry.goal);
    g.updateBotStrategies(0.25);
    bot.group.position.copy(g.dust!.navigation.site(1)).x += 20;
    g.updateBotStrategies(0);
    const order = g.botStrategies!.t.order(index)!;
    if (!order.utility || !order.utilityTarget)
      throw new Error("Support order has no entry utility");
    bot.alert = 0;
    bot.tracking = false;
    bot.reloadTime = 0;
    g.utility.botInventories.clear();
    g.utility.botCooldown.clear();
    const inventory = { ...g.utility.inventory, smoke: 1, flash: 1 };
    g.utility.botInventories.set(index, inventory);
    const before = inventory[order.utility];
    g.utility.botTactics();
    const launched = g.utility.projectiles.find((projectile) => projectile.owner === index);
    const count = g.utility.projectiles.length;
    g.utility.botTactics();
    return {
      alert: bot.alert,
      planned: order.utility,
      before,
      after: inventory[order.utility],
      projectile: launched ? { kind: launched.kind, velocity: launched.velocity.toArray() } : null,
      cooldownPreserved: g.utility.projectiles.length === count,
    };
  });
  expect(preparation.alert).toBe(0);
  expect(preparation.before).toBe(1);
  expect(preparation.after).toBe(0);
  expect(preparation.projectile?.kind).toBe(preparation.planned);
  expect(preparation.projectile?.velocity.every(Number.isFinite)).toBe(true);
  expect(preparation.cooldownPreserved).toBe(true);
  expect(errors).toEqual([]);
});
