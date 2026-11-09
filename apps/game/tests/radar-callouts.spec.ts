import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

for (const map of ["dust2", "mirage"] as const)
  test(`${map} radar callout changes while walking between native place volumes`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
    await expect(page.locator("#startup")).toHaveCount(0);
    await page.locator("#home-play").click();
    await page.locator('[data-mode="practice"]').click();
    await page.locator(`[data-map="${map}"]`).click();
    await page.locator("#play").click();
    await page.locator('#team-select [data-team="ct"]').click();
    await page.waitForFunction(() => window.__game.locked);
    const lane = await page.evaluate(async () => {
      const module = "/src/map-callouts.ts";
      const { mapCalloutAt } = (await import(module)) as typeof import("../src/map-callouts");
      const g = window.__game;
      const nav = g.world.navigation;
      const locations = nav.data.locations!;
      for (const area of nav.areas) {
        const from = g.position.clone().fromArray(area.center);
        if (!g.world.collision!.followGround(from, 0.4064, 1.8288)) continue;
        const start = mapCalloutAt(locations, from);
        if (!start) continue;
        for (const id of area.links) {
          const linked = nav.areas[nav.index.get(id)!];
          if (!linked) continue;
          const to = from.clone().fromArray(linked.center);
          if (!g.world.collision!.followGround(to, 0.4064, 1.8288)) continue;
          const end = mapCalloutAt(locations, to);
          const distance = from.distanceTo(to);
          if (
            !end ||
            end.name === start.name ||
            distance < 0.7 ||
            distance > 5 ||
            Math.abs(to.y - from.y) > 0.15
          )
            continue;
          let clear = true;
          for (let step = 0; step <= 20; step++) {
            const point = from.clone().lerp(to, step / 20);
            if (g.world.collision!.blocked(point.x, point.z, point.y + 0.03, 0.4064, 1.8288)) {
              clear = false;
              break;
            }
          }
          if (!clear) continue;
          for (const bot of g.bots) {
            bot.health = 0;
            bot.respawn = Infinity;
            bot.group.visible = false;
          }
          g.position.copy(from);
          g.velocity.x = g.velocity.z = g.vertical = 0;
          g.grounded = true;
          g.invulnerable = 999;
          g.keys.clear();
          g.yaw = Math.atan2(from.x - to.x, from.z - to.z);
          g.pitch = 0;
          return { from: from.toArray(), start: start.name, end: end.name };
        }
      }
      throw new Error("No clear walking lane across native place boundaries");
    });
    await expect(page.locator("#location")).toHaveText(lane.start);
    await page.keyboard.down("w");
    try {
      await expect(page.locator("#location")).toHaveText(lane.end, { timeout: 5_000 });
    } finally {
      await page.keyboard.up("w");
    }
    const distance = await page.evaluate(
      (from) => window.__game.position.distanceTo(window.__game.position.clone().fromArray(from)),
      lane.from,
    );
    expect(distance).toBeGreaterThan(0.2);
    await page.screenshot({ path: `artifacts/${map}-dynamic-radar-callout.png` });
    expect(errors).toEqual([]);
  });
