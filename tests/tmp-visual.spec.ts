import { test } from "@playwright/test";
test.setTimeout(90000);
test("visual casual", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await page.waitForFunction(() => (window as any).__game.locked);
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.invulnerable = 999;
    const enemies = g.bots.filter((b: any) => b.team !== g.team);
    const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw);
    enemies.slice(0, 2).forEach((b: any, i: number) => {
      b.group.position.copy(g.position);
      b.group.position.x += fx * 4 + (i ? 1.2 : -1.2) * fz;
      b.group.position.z += fz * 4 - (i ? 1.2 : -1.2) * fx;
      b.group.userData.groundY = b.group.position.y;
      b.navArea = g.dust.navigation.nearest(b.group.position);
      b.path = [];
    });
    enemies[1].health = 0; enemies[1].respawn = Infinity;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/perf-visual-fall.png" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "artifacts/perf-visual-corpse.png" });
});
