import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
async function start(page: Page, mode: "competitive" | "casual") {
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await page.locator("#home-play").click();
  await page.locator(`[data-mode="${mode}"]`).click();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
}

test("heavy rear knife hits kill armored targets and use the native heavy hit cue", async ({
  page,
}) => {
  await start(page, "competitive");
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.roundPause = 1000;
    g.updateBots = () => {};
    g.moveBots = () => {};
    g.health = 1000000;
    g.bots.forEach((bot) => {
      bot.group.position.x += 100;
    });
    const victim = g.bots.find((bot) => bot.team !== g.team)!;
    const index = g.bots.indexOf(victim);
    victim.health = victim.armor = 100;
    victim.helmet = true;
    victim.group.visible = true;
    victim.group.position.copy(g.position).z -= 0.6;
    victim.group.rotation.y = Math.PI;
    // AI wants to turn toward the attacker; the visible back still faces them.
    victim.facing = 0;
    victim.group.updateMatrixWorld(true);
    g.yaw = g.pitch = 0;
    g.equip(g.knife);
    g.drawTime = g.cooldown = 0;
    const cues: string[] = [];
    g.soundscape.play = (cue) => {
      cues.push(cue);
    };
    g.meleeHit(true);
    return { health: victim.health, cues, index, contact: g.knifeContact };
  });
  expect(result.contact).toBe(true);
  expect(result.health).toBe(0);
  expect(result.cues).toContain("knife-stab");
  const second = await page.evaluate((index) => {
    const g = window.__game,
      victim = g.bots.find(
        (bot, other) => other !== index && bot.team !== g.team && bot.health > 0,
      )!;
    victim.group.position.copy(g.position).z -= 0.6;
    victim.health = victim.armor = 100;
    victim.group.visible = true;
    victim.facing = victim.group.rotation.y = Math.PI;
    g.cooldown = g.drawTime = g.knifeTime = 0;
    g.yaw = g.pitch = 0;
    return g.bots.indexOf(victim);
  }, result.index);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect
    .poll(() => page.evaluate((index) => window.__game.bots[index].health, second))
    .toBe(0);
});

for (const mode of ["competitive", "casual"] as const)
  test(`${mode} spectator policy follows the allowed teams and camera modes`, async ({ page }) => {
    await start(page, mode);
    await page.evaluate(() => {
      const g = window.__game;
      g.dead = Infinity;
      g.health = 0;
      g.roundPause = 1000;
      g.spectate();
    });
    if (mode === "casual") {
      const teams = await page.evaluate(() => {
        const g = window.__game,
          teams = new Set<string>();
        for (let i = 0; i < g.bots.length; i++) {
          g.spectate(1);
          if (g.spectated) teams.add(g.spectated.team);
        }
        g.cycleSpectatorMode(1);
        const chase = g.spectatorMode;
        g.cycleSpectatorMode(1);
        const free = g.spectatorMode;
        return { teams: [...teams].sort(), chase, free };
      });
      expect(teams).toEqual({ teams: ["ct", "t"], chase: "third", free: "free" });
      return;
    }
    await page.mouse.wheel(0, 100);
    expect(
      await page.evaluate(() => [window.__game.spectatorMode, window.__game.spectated?.team]),
    ).toEqual(["first", "ct"]);
    const position = await page.evaluate(() => {
      const g = window.__game;
      g.bots
        .filter((bot) => bot.team === g.team)
        .forEach((bot) => {
          bot.health = 0;
        });
      g.bomb!.planted = true;
      g.bomb!.carrier = g.bots.findIndex((bot) => bot.team !== g.team);
      g.bomb!.position.copy(g.position);
      g.spectate();
      return g.camera.position.toArray();
    });
    await page.keyboard.down("w");
    await page.keyboard.down("Space");
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(200);
    await page.keyboard.up("w");
    await page.keyboard.up("Space");
    expect(await page.evaluate(() => window.__game.camera.position.toArray())).toEqual(position);
    expect(await page.evaluate(() => window.__game.spectated)).toBeUndefined();
    const aim = await page.evaluate(() => {
      const g = window.__game;
      g.spectatorPitch = 1.55;
      g.spectate();
      return {
        dot: g.camera
          .getWorldDirection(g.position.clone())
          .dot(g.spectatorFocus.clone().sub(g.camera.position).normalize()),
        height: g.camera.position.y - g.spectatorFocus.y,
        mode: g.spectatorMode,
      };
    });
    expect(aim.dot).toBeCloseTo(1, 6);
    expect(aim.height).toBeGreaterThan(0);
    expect(aim.mode).toBe("first");
    await page.screenshot({ path: "artifacts/competitive-bomb-spectator.png" });
  });
