import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("held movement climbs Mirage A stairs while pushing into the connector wall", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-play").click();
  await page.locator('[data-mode="practice"]').click();
  await page.locator('[data-map="mirage"]').click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked && window.__game.mapId === "mirage");
  await page.evaluate(() => {
    for (const bot of window.__game.bots) {
      bot.health = 0;
      bot.respawn = Infinity;
      bot.group.visible = false;
    }
  });
  for (const walk of [false, true]) {
    const start = await page.evaluate(async () => {
      const path = "/src/physics.ts";
      const { movement } = (await import(path)) as typeof import("../src/physics");
      const g = window.__game;
      // Only initial placement is synthetic. Actual keyboard input, fixed-step
      // simulation, gravity, stair support and full native collision stay live.
      const y = g.world.collision.support(-13.6, 34, -3, -5, movement.hullRadius);
      g.position.set(-13.6, y, 34);
      g.velocity.x = g.velocity.z = g.vertical = 0;
      g.grounded = true;
      g.eye = movement.standingEye;
      g.yaw = Math.PI;
      g.pitch = -0.3;
      g.keys.clear();
      g.jumpQueued = false;
      g.updateAimCamera(1);
      return { y };
    });
    if (!walk) await page.screenshot({ path: "artifacts/mirage-stairs-bottom.png" });
    if (walk) await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("KeyW");
    await page.keyboard.down("KeyA");
    await page.waitForFunction(
      () => window.__game.position.z > 39 && window.__game.position.y > -1.1,
      { timeout: 10_000 },
    );
    await page.keyboard.up("KeyW");
    await page.keyboard.up("KeyA");
    if (walk) await page.keyboard.up("ShiftLeft");
    const end = await page.evaluate(() => ({
      x: window.__game.position.x,
      y: window.__game.position.y,
      z: window.__game.position.z,
      grounded: window.__game.grounded,
      keys: [...window.__game.keys],
    }));
    expect(end.y - start.y).toBeGreaterThan(2.8);
    expect(end.grounded).toBe(true);
    expect(end.keys).not.toContain("Space");
    if (!walk) {
      await page.evaluate(() => {
        const g = window.__game;
        g.yaw = 0;
        g.pitch = -0.8;
        g.updateAimCamera(1);
      });
      await page.screenshot({ path: "artifacts/mirage-stairs-top.png" });
    }
  }
  expect(errors).toEqual([]);
});
