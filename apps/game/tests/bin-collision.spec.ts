import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("native T-ramp trash bins allow retreat after crossing lids and contacting the bag pile", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 90000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.start("practice");
    g.useWorld(true);
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    g.freezeTime = 0;
    g.roundPause = 0;
    g.equip(4);
    g.drawTime = 0;
    const c = g.world.collision!;
    const paths = [];
    // Start on the accessible front bin lids, walk toward the complex pile,
    // then retreat toward the open street. No teleport/escape helper is used.
    for (const z of [-1.2, -0.6, 0, 0.6, 1.2, 1.8]) {
      g.position.set(-37, c.support(-37, z, 3, 0) + 0.001, z);
      g.velocity.x = g.velocity.z = g.vertical = 0;
      g.grounded = true;
      g.eye = 1.65;
      g.yaw = -Math.PI / 2;
      g.pitch = -0.3;
      g.keys.clear();
      g.keys.add("KeyW");
      for (let i = 0; i < 100; i++) g.simulate(1 / 128);
      const furthest = g.position.clone();
      g.keys.clear();
      g.keys.add("KeyS");
      for (let i = 0; i < 160; i++) g.simulate(1 / 128);
      paths.push({
        z,
        furthest: furthest.toArray(),
        end: g.position.toArray(),
        blocked: c.blocked(g.position.x, g.position.z, g.position.y, 0.3, g.eye),
      });
    }
    g.keys.clear();
    g.position.set(-38, 0.2271, 0);
    g.yaw = -Math.PI / 2;
    g.pitch = -0.2;
    g.updateAimCamera();
    return paths;
  });
  for (const path of result) {
    expect(path.blocked, JSON.stringify(path)).toBe(false);
    expect(path.end[0], JSON.stringify(path)).toBeLessThan(path.furthest[0] - 1.5);
  }
  await page.evaluate(() => {
    document.querySelectorAll(".overlay").forEach((n) => n.classList.add("hidden"));
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/trash-bin-traversal.png" });
  expect(errors).toEqual([]);
});
