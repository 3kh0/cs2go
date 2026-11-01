import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("native textured tracers travel, stay bounded, and render without external assets", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.bots.forEach((b) => {
      b.health = 0;
      b.group.visible = false;
    });
    g.position.set(-17, 0, 17);
    g.yaw = 0;
    g.pitch = 0;
    g.updateAimCamera();
    // Fixed particle ages make the side-on core/soft edge inspectable.
    const from = g.position.clone().add({ x: -2, y: 1.4, z: -4 });
    const to = from.clone().add({ x: 4, y: 0.2, z: -18 });
    g.trace(from, to, 0, false);
  });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__game.tracers.every((t) => !t.mesh.visible))).toBe(true);
  await page.evaluate(async () => {
    const path = "/src/tracers.ts";
    const { updateTracer } = await import(path);
    const g = window.__game;
    const from = g.position.clone().add({ x: -2, y: 1.4, z: -4 });
    const to = from.clone().add({ x: 4, y: 0.2, z: -18 });
    g.trace(from, to, 0, false);
    const tracer = g.tracers.find((t) => t.life > 0)!;
    updateTracer(tracer, tracer.flight);
    // Freeze only this fixture's render clock; production stays real-time.
    g.frame = () => {};
    g.renderer.clear();
    g.renderer.render(g.scene, g.camera);
  });
  await page.screenshot({ path: "artifacts/cs2-tracer-side.png" });
  const bounded = await page.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 100; i++)
      g.trace(
        g.position.clone().add({ x: 0, y: 1.4, z: 0 }),
        g.position.clone().add({ x: 0, y: 1.4, z: -50 }),
        0,
        false,
      );
    return g.tracers.length;
  });
  expect(bounded).toBeLessThanOrEqual(32);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
