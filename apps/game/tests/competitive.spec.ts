import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("competitive purchases, armor parity, friendly fire, round economy, kits and halftime", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator('[data-mode="competitive"]').click();
  await expect(page.locator("#mode-title")).toHaveText("COMPETITIVE");
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  // Pause render-driven simulation so each assertion exercises exact round state.
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !window.__game.locked);
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      return {
        mode: g.mode,
        bots: g.bots.length,
        ct: g.bots.filter((b) => b.team === "ct").length,
        armor: g.armor,
        helmet: g.helmet,
        money: g.money,
        kit: g.defuseKit,
      };
    }),
  ).toEqual({
    mode: "competitive",
    bots: 9,
    ct: 4,
    armor: 0,
    helmet: false,
    money: 800,
    kit: false,
  });

  expect(
    await page.evaluate(() => {
      const g = window.__game;
      const rifle = g.buy(9),
        vest = g.buyEquipment("kevlar"),
        afterVest = g.money,
        helmet = g.buyEquipment("helmet");
      g.money = 16000;
      const wrongFaction = g.buy(0),
        m4 = g.buy(9),
        afterM4 = g.money;
      g.buyRemaining = 0;
      const expired = g.buy(3);
      g.buyRemaining = 20;
      g.position.set(10000, 0, 10000);
      const outside = g.buy(3);
      g.spawnPlayer(true);
      return { rifle, vest, afterVest, helmet, wrongFaction, m4, afterM4, expired, outside };
    }),
  ).toEqual({
    rifle: false,
    vest: true,
    afterVest: 150,
    helmet: false,
    wrongFaction: false,
    m4: true,
    afterM4: 13100,
    expired: false,
    outside: false,
  });

  expect(
    await page.evaluate(() => {
      const g = window.__game,
        bot = g.bots.find((b) => b.team === "ct")!;
      const outcomes = [];
      for (const hit of [
        { damage: 132, data: { head: true, height: 1.6 } },
        { damage: 33, data: { height: 1.1 } },
        { damage: 24.75, data: { height: 0.5 } },
      ]) {
        g.health = bot.health = 100;
        g.armor = bot.armor = 100;
        g.helmet = bot.helmet = true;
        g.damageActor("player", hit.damage, hit.data, 9, "t");
        g.damageActor(bot, hit.damage, hit.data, 9, "t");
        outcomes.push({ player: g.health, bot: bot.health, armorEqual: g.armor === bot.armor });
      }
      g.health = 100;
      g.armor = 0;
      g.damageActor("player", 100, { height: 1.1 }, 0, "ct");
      const friendly = g.health;
      g.mode = "casual";
      g.health = 100;
      g.damageActor("player", 100, { height: 1.1 }, 0, "ct");
      const casual = g.health;
      g.mode = "competitive";
      g.money = 1000;
      g.rewardKill("player", "t", 3);
      const awp = g.money;
      g.rewardKill("player", "ct", 0);
      const teamkill = g.money;
      return { outcomes, friendly, casual, awp, teamkill };
    }),
  ).toEqual({
    outcomes: [
      { player: 8, bot: 8, armorEqual: true },
      { player: 77, bot: 77, armorEqual: true },
      { player: 76, bot: 76, armorEqual: true },
    ],
    friendly: 67,
    casual: 100,
    awp: 1100,
    teamkill: 800,
  });

  const projectiles = await page.evaluate(() => {
    const g = window.__game,
      friend = g.bots.find((b) => b.team === g.team)!;
    g.bots.forEach((b, i) => b.group.position.set(50 + i, 500, 50));
    friend.group.position.set(0, 500, -4);
    friend.group.visible = true;
    friend.armor = 0;
    g.position.set(0, 500, 0);
    g.velocity = { x: 0, z: 0 };
    g.eye = 1.65;
    g.grounded = true;
    g.yaw = 0;
    g.pitch = Math.atan2(1.1 - 1.65, 4);
    g.freezeTime = 0;
    g.roundPause = 0;
    g.equip(9);
    g.drawTime = 0;
    g.cooldown = 0;
    g.reload = 0;
    g.ammo = 30;
    g.locked = true;
    friend.health = 100;
    g.fire();
    const competitive = friend.health;
    g.mode = "casual";
    g.cooldown = 0;
    g.pitch = Math.atan2(1.1 - 1.65, 4);
    friend.health = 100;
    g.fire();
    const casual = friend.health;
    g.mode = "competitive";
    g.locked = false;
    g.spawnPlayer(true);
    return { competitive, casual };
  });
  expect(projectiles.competitive).toBeLessThan(100);
  expect(projectiles.casual).toBe(100);
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      g.health = 100;
      g.money = 1000;
      g.armor = 67;
      g.helmet = true;
      g.defuseKit = true;
      g.primary = 9;
      g.endRound("ct", "Terrorists eliminated");
      const winMoney = g.money;
      g.round = 2;
      g.startRound();
      const saved = { primary: g.primary, armor: g.armor, helmet: g.helmet, kit: g.defuseKit };
      g.dead = Infinity;
      g.round = 3;
      g.startRound();
      const deadGear = { primary: g.primary, armor: g.armor, helmet: g.helmet, kit: g.defuseKit };
      g.money = 1000;
      g.lossStreak.ct = 1;
      g.endRound("t", "Counter-Terrorists eliminated");
      const lossMoney = g.money;
      g.round = 13;
      g.teamScores = { ct: 8, t: 4 };
      g.startRound();
      return {
        winMoney,
        saved,
        deadGear,
        lossMoney,
        halftime: {
          team: g.team,
          scores: g.teamScores,
          money: g.money,
          armor: g.armor,
          bots: g.bots.length,
        },
      };
    }),
  ).toEqual({
    winMoney: 4250,
    saved: { primary: 9, armor: 67, helmet: true, kit: true },
    deadGear: { primary: null, armor: 0, helmet: false, kit: false },
    lossMoney: 2900,
    halftime: { team: "t", scores: { ct: 4, t: 8 }, money: 800, armor: 0, bots: 9 },
  });

  expect(
    await page.evaluate(() => {
      const g = window.__game;
      g.money = 1000;
      g.endRound("ct", "Time expired");
      const survived = g.money;
      g.roundPause = 0;
      g.money = 1000;
      g.dead = Infinity;
      g.lossStreak.t = 1;
      g.endRound("ct", "Time expired");
      return { survived, dead: g.money };
    }),
  ).toEqual({ survived: 1000, dead: 2900 });
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      g.team = "ct";
      g.configureBots(true);
      g.round = 2;
      g.startRound();
      g.freezeTime = 0;
      g.keys.add("KeyE");
      g.bomb!.planted = true;
      g.bomb!.carrier = -1;
      g.bomb!.position.copy(g.position);
      g.bomb!.timer = 40;
      g.bots.forEach((b, i) => b.group.position.set(30 + i, 0, 30));
      g.defuseKit = false;
      g.updateRound(5.01);
      const noKit = g.roundPause;
      g.updateRound(5.01);
      const tenSecond = g.roundPause > 0;
      g.round = 3;
      g.startRound();
      g.freezeTime = 0;
      g.defuseKit = true;
      g.bomb!.planted = true;
      g.bomb!.carrier = -1;
      g.bomb!.position.copy(g.position);
      g.bomb!.timer = 40;
      g.updateRound(5.01);
      const kit = g.roundPause > 0;
      g.keys.clear();
      return { noKit, tenSecond, kit };
    }),
  ).toEqual({ noKit: 0, tenSecond: true, kit: true });

  expect(
    await page.evaluate(() => {
      const g = window.__game;
      g.roundPause = 0;
      g.round = 24;
      g.teamScores = { ct: 11, t: 12 };
      g.endRound("ct", "Terrorists eliminated");
      return {
        active: g.active,
        result: document.getElementById("result")!.classList.contains("hidden"),
        scores: g.teamScores,
      };
    }),
  ).toEqual({ active: false, result: false, scores: { ct: 12, t: 12 } });
  await expect(page.locator("#result-title")).toHaveText("DRAW.");
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      g.active = true;
      g.roundPause = 0;
      g.round = 22;
      g.teamScores = { ct: 12, t: 9 };
      g.endRound("ct", "Terrorists eliminated");
      const won = !g.active && g.teamScores.ct === 13;
      g.mode = "casual";
      g.configureBots(true);
      g.round = 1;
      g.startRound();
      return {
        won,
        casual: { armor: g.armor, helmet: g.helmet, kit: g.defuseKit, bots: g.bots.length },
      };
    }),
  ).toEqual({ won: true, casual: { armor: 100, helmet: true, kit: true, bots: 19 } });
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      g.mode = "competitive";
      g.active = true;
      g.round = 2;
      g.teamScores = { ct: 0, t: 0 };
      g.configureBots(true);
      g.startRound();
      g.freezeTime = 0;
      // Plant inside the actual expanded A-site bounds; exact native sample0
      // is lethal at A while sample50 is sheltered/zero-damage from A.
      g.position.set(1535 * 0.0254, 95 * 0.0254 - g.eye * 0.5, -2655 * 0.0254);
      g.bomb!.position.set(1100 * 0.0254, 140 * 0.0254, -2500 * 0.0254);
      g.bomb!.planted = true;
      g.primary = 9;
      g.armor = 100;
      g.helmet = true;
      g.money = 1000;
      g.kills = 5;
      g.bots.forEach((b) => {
        b.health = 100;
        b.armor = 100;
        b.group.position.set(-1635 * 0.0254, 35 * 0.0254 - 1.65 * 0.5, -1065 * 0.0254);
        b.rig.crouch = 0;
      });
      const near = g.bots[0]!,
        far = g.bots[1]!;
      near.group.position.copy(g.position);
      far.group.position.set(-1635 * 0.0254, 35 * 0.0254 - 1.65 * 0.5, -1065 * 0.0254);
      const botKills = near.kills,
        botMoney = near.money;
      g.detonateBomb();
      const blast = {
        playerDead: !!g.dead,
        nearDead: near.health === 0,
        farHealth: far.health,
        money: g.money,
        kills: g.kills,
        botCreditUnchanged: near.kills === botKills && near.money === botMoney,
      };
      g.endRound("t", "Bomb detonated");
      g.round = 3;
      g.startRound();
      return {
        blast,
        respawn: {
          primary: g.primary,
          armor: g.armor,
          helmet: g.helmet,
          nearWeapon: near.rig.weaponIndex,
        },
      };
    }),
  ).toEqual({
    blast: {
      playerDead: true,
      nearDead: true,
      farHealth: 100,
      money: 1000,
      kills: 5,
      botCreditUnchanged: true,
    },
    respawn: { primary: null, armor: 0, helmet: false, nearWeapon: 7 },
  });
  const posture = await page.evaluate(() => {
    const g = window.__game;
    g.bomb!.position.set(1100 * 0.0254, 140 * 0.0254, -2500 * 0.0254);
    // Native sample4 is sublethal and carries its baked flow direction.
    const sample = { x: 1015 * 0.0254, y: 5 * 0.0254, z: -845 * 0.0254 };
    const hit = g.dust!.bombDamage.lookup(g.bomb!.position, sample)!;
    const toward = hit.direction,
      away = { x: -toward.x, y: -toward.y, z: -toward.z };
    const field = g.dust!.bombDamage;
    return {
      raw: hit.damage,
      toward: field.playerDamage(hit, toward, false),
      away: field.playerDamage(hit, away, false),
      ducked: field.playerDamage(hit, toward, true),
    };
  });
  expect(posture.raw).toBeGreaterThan(0);
  expect(posture.raw).toBeLessThan(100);
  expect(posture.toward).toBeLessThan(posture.away);
  expect(posture.ducked).toBeLessThan(posture.toward);
  expect(
    await page.evaluate(() => {
      const g = window.__game;
      const bot = g.bots.find((b) => b.team === "t")!;
      bot.rig.weaponIndex = 13;
      bot.armor = 100;
      bot.helmet = true;
      bot.money = 300;
      bot.ammo = 4;
      bot.reserve = 13;
      bot.buyTime = 0.01;
      g.updateBotPurchases(0.02, g.bots.indexOf(bot) % 8);
      return {
        money: bot.money,
        weapon: bot.rig.weaponIndex,
        ammo: bot.ammo,
        reserve: bot.reserve,
      };
    }),
  ).toEqual({ money: 300, weapon: 13, ammo: 4, reserve: 13 });
  // Knives live in Inventory; the buy screen contains the 34 firearms only.
  await expect(page.locator("[data-weapon]")).toHaveCount(34);
  expect(
    await page
      .locator("[data-weapon] img")
      .evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
