import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("fixed faction HUD, alive counts, and planted bomb countdown", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => window.__game.assetsReady);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 20000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  for (const team of ["ct", "t"] as const) {
    await page.evaluate((team) => {
      const g = window.__game;
      g.active = false;
      g.setTeam(team);
      g.start("casual");
      g.active = false;
      g.locked = false;
      g.teamScores = { ct: 4, t: 1 };
      g.time = 86;
      g.freezeTime = 0;
      g.bots.forEach((b) => {
        b.health = 0;
      });
      g.bots
        .filter((b) => b.team === "ct")
        .slice(0, team === "ct" ? 2 : 3)
        .forEach((b) => {
          b.health = 100;
        });
      if (team === "ct") g.bots.find((b) => b.team === "t")!.health = 100;
      g.updateUI();
    }, team);
    await expect(page.locator("#ct-alive")).toHaveText("3");
    await expect(page.locator("#t-alive")).toHaveText("1");
    await expect(page.locator("#score")).toHaveText("4");
    await expect(page.locator("#enemy-score")).toHaveText("1");
    await expect(page.locator("#clock")).toHaveText("1:26");
    await expect(page.locator("#score")).toHaveCSS("color", "rgb(161, 201, 224)");
    await expect(page.locator("#enemy-score")).toHaveCSS("color", "rgb(230, 203, 125)");
  }
  await page.locator(".match-top").screenshot({ path: "artifacts/hud-round.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.position.set(-15, 0, 10);
    g.yaw = Math.PI / 3;
    g.drawMap(document.querySelector<HTMLCanvasElement>("#radar")!, true);
  });
  await page.locator("#radar").screenshot({ path: "artifacts/radar-focused.png" });
  await page.evaluate(() => {
    document.querySelector(".radar-wrap")!.classList.add("expanded");
    window.__game.drawMap(document.querySelector<HTMLCanvasElement>("#radar")!, true);
  });
  await page.locator("#radar").screenshot({ path: "artifacts/radar-overview.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.bomb!.planted = true;
    g.bomb!.timer = 12.4;
    g.updateUI();
  });
  await expect(page.locator("#clock")).toHaveText("0:13");
  await expect(page.locator("#clock")).toHaveCSS("color", "rgb(255, 92, 78)");
  await page.locator(".match-top").screenshot({ path: "artifacts/hud-bomb.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.startRound();
    g.updateUI();
  });
  await expect(page.locator("#clock")).not.toHaveClass(/bomb-planted/);
  expect(errors).toEqual([]);
});

test("death banner shows the killer and weapon and clears on respawn", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForFunction(() => window.__game.assetsReady);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 20000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.evaluate(() => {
    const g = window.__game;
    g.start("casual");
    g.active = false;
    const killer = g.bots.find((b) => b.team !== g.team)!;
    killer.name = "oat";
    g.health = 0;
    g.dead = Infinity;
    g.feed(killer.name, "YOU", false, 0);
    g.updateUI();
  });
  await expect(page.locator("#death-banner")).toBeVisible();
  await expect(page.locator("#death-killer")).toHaveText("oat");
  await expect(page.locator("#death-weapon")).toHaveText("AK-47");
  await expect(page.locator("#death-weapon-icon")).toHaveAttribute("src", "/icons/ak-47.png");
  await page.locator("#death-banner").screenshot({ path: "artifacts/death-banner.png" });
  await page.evaluate(() => window.__game.feed("another bot", "other victim", false, 2));
  await expect(page.locator("#death-killer")).toHaveText("oat");
  await page.evaluate(() => window.__game.startRound());
  await expect(page.locator("#death-banner")).toBeHidden();
  await page.evaluate(() => {
    const g = window.__game;
    g.feed("rifle bot", "YOU", false, 1);
  });
  await expect(page.locator("#death-weapon")).toHaveText("M4A1-S");
  await page.evaluate(() => window.__game.spawnPlayer());
  await expect(page.locator("#death-banner")).toBeHidden();
  expect(errors).toEqual([]);
});

test("HUD hue persists and lower HUD stays aligned", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 20000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  await page.locator("#hudHue").fill("280");
  await expect(page.locator("#hudHue-value")).toHaveText("280°");
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 20000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Gameplay", exact: true }).click();
  await expect(page.locator("#hudHue")).toHaveValue("280");
  await page.locator("#hudHue").fill("110");
  await page.locator("#close-settings").click();
  await page.evaluate(() => {
    const g = window.__game;
    g.start("casual");
    g.active = false;
    g.buy(3);
    g.health = 72;
    g.armor = 85;
    g.updateUI();
  });
  expect(
    await page
      .locator("#health-fill")
      .evaluate(
        (e) => e.getBoundingClientRect().width / e.parentElement!.getBoundingClientRect().width,
      ),
  ).toBeCloseTo(0.72, 2);
  const bounds = await page.evaluate(() => {
    const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect().toJSON();
    return {
      vitals: rect(".vitals"),
      team: rect(".hud-team"),
      ammo: rect(".ammo"),
      inventory: rect("#inventory"),
    };
  });
  expect(bounds.vitals.right).toBeLessThan(bounds.team.left);
  expect(bounds.team.right).toBeLessThan(bounds.ammo.left);
  expect(bounds.inventory.bottom).toBeLessThan(bounds.ammo.top);
  await page.screenshot({ path: "artifacts/hud-cs2-green.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.settings.hudHue = 280;
    g.saveSettings();
  });
  await expect(page.locator(".vitals")).toHaveCSS("color", "rgb(191, 90, 242)");
  await expect(page.locator("#score")).toHaveCSS("color", "rgb(161, 201, 224)");
  await expect(page.locator("#enemy-score")).toHaveCSS("color", "rgb(230, 203, 125)");
  await page.screenshot({ path: "artifacts/hud-cs2-purple.png" });
  expect(errors).toEqual([]);
});
