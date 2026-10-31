import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("bounded utility and sleeping drops component performance", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toBeHidden({ timeout: 10000 });
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.start("practice");
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    g.utility.reset();
    g.groundInventory.clearDrops();
    g.freezeTime = 0;
    for (let i = 0; i < 12; i++) {
      const position = g.position.clone().set(-16 + (i % 3), 0.1, 9 - Math.floor(i / 3));
      g.utility.launch("smoke", "player", g.team, position, position.clone().set(0, 0, 0), 0);
      const projectile = g.utility.projectiles.pop()!;
      g.utility.detonate(projectile);
      g.utility.removeProjectile(projectile);
    }
    for (let i = 0; i < 64; i++)
      g.groundInventory.spawn(
        0,
        30,
        90,
        g.position.clone().set(13 + (i % 4) * 0.2, 0, 13),
        0,
        "player",
      );
    // Settle drops and warm JIT before timing equivalent fixed-step work.
    for (let i = 0; i < 128; i++) {
      g.utility.update(1 / 128);
      g.groundInventory.update(1 / 128);
    }
    const versions = g.utility.effects.map(
      (e) => (e.smoke?.batch ?? e.batch)?.instanceMatrix.version ?? 0,
    );
    const before = performance.now();
    for (let i = 0; i < 384; i++) {
      g.utility.update(1 / 128);
      g.groundInventory.update(1 / 128);
      if (i % 2 === 0) g.utility.renderSelection();
    }
    const ms = performance.now() - before;
    const staticMatrixUploads = g.utility.effects.reduce(
      (sum, e, i) => sum + ((e.smoke?.batch ?? e.batch)?.instanceMatrix.version ?? 0) - versions[i],
      0,
    );
    const clouds = g.utility.effects.filter((e) => e.kind === "smoke").length;
    const cells = g.utility.effects.reduce((sum, e) => sum + e.cells.length, 0);
    return {
      milliseconds: ms,
      millisecondsPerTick: ms / 384,
      simulatedSeconds: 3,
      clouds,
      cells,
      drops: g.groundInventory.drops.length,
      staticMatrixUploads,
    };
  });
  console.log("UTILITY_COMPONENT_PERFORMANCE", JSON.stringify(result));
  await test.info().attach("utility-component-performance", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result.staticMatrixUploads).toBe(0);
  expect(result.clouds).toBe(12);
  expect(result.drops).toBe(64);
  expect(result.cells).toBeGreaterThan(200);
});
