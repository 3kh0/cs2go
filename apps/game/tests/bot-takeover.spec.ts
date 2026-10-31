import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("spectator E takes over a teammate without duplicating lives or ammunition", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible())
    await page.locator('#team-select [data-team="t"]').click();
  await page.waitForFunction(() => window.__game.locked && window.__game.mode === "casual");
  await page.evaluate(() => {
    const g = window.__game;
    g.dead = Infinity;
    g.locked = false;
    g.spectate();
    g.updateUI();
  });
  await expect(page.locator("#toast")).toContainText("E: take control");
  await page.screenshot({ path: "artifacts/bot-takeover-prompt.png" });
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.locked = false;
    g.dead = Infinity;
    g.health = 0;
    const b = g.bots.find((bot) => bot.team === g.team)!;
    const index = g.bots.indexOf(b);
    b.health = 37;
    b.armor = 61;
    b.helmet = false;
    b.defuseKit = false;
    g.armor = 0;
    g.helmet = true;
    g.defuseKit = true;
    b.tracking = false;
    b.ammo = 4;
    b.reserve = 30;
    b.rig.weaponIndex = 9;
    b.shot = 0.7;
    b.reloadTime = 0.8;
    b.velocity.set(0.4, -0.6);
    b.vertical = 1.2;
    b.group.rotation.y = 0.75;
    g.spectated = b;
    g.spectatorMode = "first";
    g.bomb!.carrier = index;
    g.bomb!.plantProgress = 1.2;
    const before = g.bots.filter((bot) => bot.team === g.team && bot.health > 0).length;
    const position = b.group.position.toArray();
    const deaths = b.deaths;
    const paused = g.takeOverBot();
    g.locked = true;
    g.spectatorMode = "free";
    const free = g.takeOverBot();
    g.spectatorMode = "third";
    g.spectated = g.bots.find((bot) => bot.team !== g.team)!;
    const enemy = g.takeOverBot();
    g.spectated = b;
    g.roundPause = 2;
    const roundEnded = g.takeOverBot();
    g.roundPause = 0;
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", repeat: true }));
    g.locked = false;
    const after = {
      dead: g.dead,
      health: g.health,
      armor: g.armor,
      helmet: g.helmet,
      kit: g.defuseKit,
      position: g.position.toArray(),
      velocity: g.velocity,
      vertical: g.vertical,
      yaw: g.yaw,
      weapon: g.selected,
      ammo: g.ammo,
      reserve: g.reserve,
      cooldown: g.cooldown,
      reload: g.reload,
      invulnerable: g.invulnerable,
      alive: g.bots.filter((bot) => bot.team === g.team && bot.health > 0).length + Number(!g.dead),
      botVisible: b.group.visible,
      botHealth: b.health,
      botDeaths: b.deaths,
      carrier: g.bomb!.carrier,
      progress: g.bomb!.plantProgress,
      heldE: g.keys.has("KeyE"),
      bannerHidden: document.getElementById("death-banner")!.classList.contains("hidden"),
    };
    g.locked = true;
    g.invulnerable = 2;
    g.freezeTime = 0;
    g.simulate(0.81);
    g.locked = false;
    const reloaded = [g.ammo, g.reserve];
    g.dead = Infinity;
    g.spectated = b;
    g.locked = true;
    const reused = g.takeOverBot();
    const next = g.bots.find((bot) => bot.team === g.team && bot.health > 0)!;
    g.spectated = next;
    next.rig.weaponIndex = 10;
    next.ammo = 3;
    next.reserve = 9;
    next.reloadTime = 0.6;
    g.bomb!.planted = true;
    g.bomb!.carrier = -1;
    g.bomb!.defuser = g.bots.indexOf(next);
    g.bomb!.progress = 4;
    const second = g.takeOverBot();
    const defuse = [g.bomb!.defuser, g.bomb!.progress];
    const shell = [g.ammo, g.reserve, g.reload];
    g.startRound();
    g.locked = false;
    return {
      paused,
      free,
      enemy,
      roundEnded,
      before,
      position,
      deaths,
      after,
      reloaded,
      reused,
      second,
      defuse,
      shell,
      reset: [
        g.dead,
        g.bots.filter((bot) => bot.team === g.team && bot.health > 0).length,
        b.group.visible,
      ],
    };
  });
  expect([result.paused, result.free, result.enemy, result.roundEnded, result.reused]).toEqual([
    false,
    false,
    false,
    false,
    false,
  ]);
  expect(result.after).toMatchObject({
    dead: 0,
    health: 37,
    armor: 61,
    helmet: false,
    kit: false,
    position: result.position,
    velocity: { x: 0.4, z: -0.6 },
    vertical: 1.2,
    yaw: 0.75 + Math.PI,
    weapon: 9,
    ammo: 4,
    reserve: 30,
    cooldown: 0.7,
    reload: 0.8,
    invulnerable: 0,
    alive: result.before,
    botVisible: false,
    botHealth: 0,
    botDeaths: result.deaths,
    carrier: "player",
    progress: 0,
    heldE: false,
    bannerHidden: true,
  });
  expect(result.reloaded).toEqual([30, 0]);
  expect(result.second).toBe(true);
  expect(result.defuse).toEqual([null, 0]);
  expect(result.shell).toEqual([3, 9, 0]);
  expect(result.reset).toEqual([0, 9, true]);
  expect(errors).toEqual([]);
});
