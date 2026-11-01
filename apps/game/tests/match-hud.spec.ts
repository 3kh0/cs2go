import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

async function start(page: Page, team: "t" | "ct") {
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator('[data-mode="competitive"]').click();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator(`#team-select [data-team="${team}"]`).click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.bots.forEach((bot, i) => bot.group.position.set(200 + i, 500, 200));
    g.velocity.x = g.velocity.z = 0;
    g.pitch = -0.7;
    g.yaw = 0;
  });
}

test("native defuse countdown, cancellation, kit variant, MVP and full competitive history", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== "http://127.0.0.1:5173")
      external.push(request.url());
  });
  await start(page, "ct");
  await page.evaluate(() => {
    const g = window.__game;
    g.bomb!.planted = true;
    g.bomb!.carrier = -1;
    g.bomb!.position.copy(g.position);
    g.bomb!.position.z -= 0.6;
    g.bombMesh.position.copy(g.bomb!.position);
    g.bombMesh.visible = true;
    g.bomb!.timer = 35;
    g.defuseKit = false;
    g.keys.add("KeyE");
    g.updateRound(1 / 128);
  });
  const action = page.locator("#bomb-action");
  await expect(action).toBeVisible();
  await expect(action).toHaveAttribute("data-kit", "false");
  await expect(page.locator("#bomb-action-label")).toHaveText("Defusing WITHOUT a defuse kit");
  const before = Number(await page.locator("#bomb-action-time").textContent());
  await expect
    .poll(async () => Number(await page.locator("#bomb-action-time").textContent()))
    .toBeLessThan(before - 0.1);
  await page.screenshot({ path: "artifacts/hud-defuse-no-kit.png" });
  await page.evaluate(() => window.__game.keys.delete("KeyE"));
  await expect(action).toHaveAttribute("data-state", "canceled");
  await expect(action).toBeHidden();
  await page.evaluate(() => {
    const g = window.__game;
    g.defuseKit = true;
    g.bomb!.progress = 0;
    g.keys.add("KeyE");
    g.updateRound(1 / 128);
  });
  await expect(action).toBeVisible();
  await expect(action).toHaveAttribute("data-kit", "true");
  await expect(page.locator("#bomb-action-label")).toHaveText("Defusing the bomb");
  expect(Number(await page.locator("#bomb-action-time").textContent())).toBeLessThanOrEqual(5);
  await page.screenshot({ path: "artifacts/hud-defuse-kit.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.bomb!.progress = 4.95;
    g.updateRound(0.1);
  });
  await expect(page.locator("#round-banner")).toHaveAttribute("data-result", "won");
  await expect(page.locator("#round-mvp-name")).toHaveText("YOU");
  await expect(page.locator("#round-mvp-reason")).toHaveText("MVP for defusing the bomb");
  await expect(action).toBeHidden();
  await page.screenshot({ path: "artifacts/hud-round-mvp-defuse.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.roundHistory = Array.from({ length: 17 }, (_, i) => ({
      winner: i % 2 ? "t" : "ct",
      reason: i % 2 ? "Time expired" : "Bomb defused",
    }));
    g.round = 18;
    g.updateUI();
  });
  await page.keyboard.down("Tab");
  await expect(page.locator(".round-slot")).toHaveCount(24);
  await expect(page.locator(".round-slot").nth(16)).toHaveAttribute(
    "aria-label",
    "Round 17: CT won - Bomb defused",
  );
  await expect(page.locator(".score-row.you .score-mvps")).toHaveText("1");
  expect(await page.locator(".score-team.t .score-cash").allTextContents()).toEqual([
    "",
    "",
    "",
    "",
    "",
  ]);
  await page.screenshot({ path: "artifacts/hud-scoreboard-competitive.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: "artifacts/hud-scoreboard-competitive-720.png" });
  await page.keyboard.up("Tab");
  await page.evaluate(() => window.__game.startRound());
  await expect(page.locator("#round-banner")).toBeHidden();
  await expect(action).toBeHidden();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("native planting progress and planted alert reset cleanly and credit the planter", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await start(page, "t");
  await page.evaluate(() => {
    const g = window.__game;
    g.position.set(1100 * 0.0254, 140 * 0.0254, -2500 * 0.0254);
    g.grounded = true;
    g.bomb!.carrier = "player";
    g.keys.add("KeyE");
    g.updateRound(0.1);
  });
  await expect(page.locator("#bomb-action")).toHaveAttribute("data-action", "plant");
  await expect(page.locator("#bomb-action-label")).toHaveText("Planting the bomb");
  await page.screenshot({ path: "artifacts/hud-planting.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.bomb!.plantProgress = 3.1;
    g.updateRound(0.2);
    g.keys.clear();
  });
  await expect(page.locator("#hud-alert")).toBeVisible();
  await expect(page.locator("#hud-alert-text")).toHaveText("The bomb has been planted");
  expect(await page.evaluate(() => window.__game.bomb!.planter)).toBe("player");
  await page.waitForTimeout(450);
  await page.screenshot({ path: "artifacts/hud-bomb-planted.png" });
  await page.evaluate(() => window.__game.endRound("t", "Bomb detonated"));
  await expect(page.locator("#hud-alert")).toBeHidden();
  await expect(page.locator("#round-mvp-name")).toHaveText("YOU");
  await expect(page.locator("#round-mvp-reason")).toHaveText("MVP for planting the bomb");
  await page.waitForTimeout(600);
  await page.screenshot({ path: "artifacts/hud-round-mvp-plant.png" });
  await page.evaluate(() => window.__game.menu());
  await expect(page.locator("#bomb-action")).toBeHidden();
  await expect(page.locator("#hud-alert")).toBeHidden();
});
