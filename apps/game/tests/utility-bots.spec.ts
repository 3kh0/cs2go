import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("bots coordinate flash entries, trade observed contacts, and abandon impossible defuses", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toBeHidden({ timeout: 10000 });
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.start("competitive");
    g.freezeTime = 0;
    g.active = false;
    g.bots.forEach((b) => {
      b.health = 0;
      b.alert = 0;
    });
    const throwerIndex = g.bots.findIndex((b) => b.team === "t");
    const buddyIndex = g.bots.findIndex((b, i) => i !== throwerIndex && b.team === "t");
    const thrower = g.bots[throwerIndex],
      buddy = g.bots[buddyIndex];
    thrower.health = buddy.health = 100;
    buddy.group.position.copy(thrower.group.position).x += 1;
    thrower.memory.copy(thrower.group.position).z -= 12;
    thrower.alert = 5;
    thrower.tracking = false;
    thrower.reloadTime = 0;
    g.utility.botInventories.clear();
    g.utility.botInventories.set(throwerIndex, {
      he: 0,
      smoke: 0,
      flash: 1,
      molotov: 0,
      incendiary: 0,
      decoy: 0,
    });
    g.utility.botCooldown.clear();
    g.utility.botTactics();
    const threwFlash = g.utility.projectiles.at(-1)?.kind === "flash";
    const entryScheduled = g.utility.entries.has(buddyIndex);
    const normal = buddy.group.position.clone();
    const waitsForFlash = g.utility.botGoal(buddyIndex, normal) === normal;
    g.utility.clock += 1.8;
    const entryGoal = g.utility.botGoal(buddyIndex, normal);
    const entersAfterFlash = entryGoal.distanceTo(thrower.memory) < 0.01 && buddy.reposition;
    // The real team navigation step consumes the coordinated entry objective.
    buddy.nav = 0;
    buddy.alert = 0;
    buddy.target = null;
    buddy.suppressTime = 0;
    g.updateCasualBots(0.0625, buddyIndex % 8);
    const entryNavigates = buddy.moving && buddy.path.length > 0;
    g.utility.entries.clear();
    g.utility.lastAlive.set(throwerIndex, true);
    thrower.health = 0;
    thrower.alert = 4;
    g.utility.botTactics();
    const tradesLastContact =
      g.utility.entries.get(buddyIndex)?.position.distanceTo(thrower.memory) === 0;
    buddy.team = "ct";
    buddy.defuseKit = true;
    g.bomb!.planted = true;
    g.bomb!.timer = 2;
    g.bomb!.position.copy(buddy.group.position).x += 20;
    g.bomb!.defuser = null;
    g.bomb!.progress = 0;
    const before = buddy.group.position.distanceTo(g.bomb!.position);
    const saveGoal = g.utility.botGoal(buddyIndex, normal);
    const savesAwayFromBomb = saveGoal.distanceTo(g.bomb!.position) > before;
    g.utility.entries.clear();
    g.bomb!.timer = 30;
    const attemptsReachableRetake = g.utility.botGoal(buddyIndex, normal) === normal;
    g.utility.reset();
    g.invulnerable = 0;
    g.health = 100;
    g.armor = 0;
    const decoyPosition = g.position.clone();
    decoyPosition.y += 0.2;
    g.utility.launch(
      "decoy",
      "player",
      g.team,
      decoyPosition,
      decoyPosition.clone().set(0, 0, 0),
      g.selected,
    );
    const decoy = g.utility.projectiles.at(-1)!;
    g.utility.detonate(decoy);
    g.utility.effects.at(-1)!.age = 14.9;
    g.utility.update(0.2);
    const decoyHarmsNearbyAtExpiry = g.health < 100 && g.health >= 95;

    return {
      threwFlash,
      entryScheduled,
      waitsForFlash,
      entersAfterFlash,
      entryNavigates,
      tradesLastContact,
      savesAwayFromBomb,
      attemptsReachableRetake,
      decoyHarmsNearbyAtExpiry,
    };
  });
  expect(result).toEqual({
    threwFlash: true,
    entryScheduled: true,
    waitsForFlash: true,
    entersAfterFlash: true,
    entryNavigates: true,
    tradesLastContact: true,
    savesAwayFromBomb: true,
    attemptsReachableRetake: true,
    decoyHarmsNearbyAtExpiry: true,
  });
  expect(errors).toEqual([]);
});
