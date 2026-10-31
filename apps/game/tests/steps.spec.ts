import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

for (const fixture of [
  {
    name: "T spawn ramps",
    routes: [
      [1020, 1019],
      [1019, 1031],
      [1031, 1032],
      [1032, 1103],
      [1100, 1104],
      [1104, 1193],
      [1193, 1227],
    ],
  },
  {
    name: "Short stairs",
    routes: [
      [782, 866],
      [790, 875],
      [866, 948],
      [875, 968],
    ],
  },
]) {
  test(`${fixture.name} can be walked uphill through the ramp and stair joins`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForFunction(() => (window as unknown as { __game: Game }).__game?.assetsReady);
    const results = await page.evaluate(({ routes }) => {
      const g = (window as unknown as { __game: Game }).__game;
      g.start("practice");
      g.locked = false;
      g.useWorld(true);
      g.updateBots = () => {};
      g.moveBots = () => {};
      g.equip(4);
      const nav = g.dust!.navigation.data.areas;
      const c = g.world.collision!;
      return routes.map(([from, to]) => {
        const a = nav.find((a) => a.id === from)!.center;
        const b = nav.find((a) => a.id === to)!.center;
        g.position.set(a[0], c.support(a[0], a[2], a[1] + 0.5, a[1] - 0.5), a[2]);
        const startY = g.position.y;
        g.velocity.x = g.velocity.z = g.vertical = 0;
        g.eye = 1.65;
        g.grounded = true;
        g.dead = 0;
        g.jumpQueued = false;
        g.keys.clear();
        g.keys.add("KeyW");
        g.keys.add("ShiftLeft");
        const distance = Math.hypot(b[0] - a[0], b[2] - a[2]);
        for (let i = 0; i < Math.ceil((distance / 2) * 128) + 128; i++) {
          const dx = b[0] - g.position.x,
            dz = b[2] - g.position.z;
          if (Math.hypot(dx, dz) < 0.12) break;
          g.yaw = Math.atan2(-dx, -dz);
          g.simulate(1 / 128);
        }
        return {
          from,
          to,
          remaining: Math.hypot(b[0] - g.position.x, b[2] - g.position.z),
          rise: g.position.y - startY,
          grounded: g.grounded,
        };
      });
    }, fixture);
    for (const result of results) {
      expect(result.remaining, `${result.from} → ${result.to}`).toBeLessThan(0.12);
      expect(result.rise).toBeGreaterThan(0.05);
      expect(result.grounded).toBe(true);
    }
    await page.addStyleTag({ content: "#startup { display: none !important }" });
    await page.evaluate(() => {
      (window as unknown as { __game: Game }).__game.camera.rotation.x = -0.65;
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `artifacts/steps-${fixture.name.replaceAll(" ", "-")}.png` });
  });
}
