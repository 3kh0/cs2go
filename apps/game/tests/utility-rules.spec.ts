import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("native mode blast scales and fixed-rate inferno damage use the actual utility path", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible())
    await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.utility.reset();
    g.freezeTime = g.roundPause = g.dead = g.invulnerable = 0;
    g.bots.forEach((bot) => {
      bot.health = 0;
    });
    g.armor = 0;
    g.helmet = false;
    const position = g.position.clone();
    position.y += 0.16;
    g.utility.launch(
      "decoy",
      "player",
      g.team,
      position,
      position.clone().set(0, 0, 0),
      g.selected,
    );
    const projectile = g.utility.projectiles[0];
    g.utility.detonate(projectile);
    g.utility.removeProjectile(projectile);
    g.utility.projectiles.length = 0;
    const effect = g.utility.effects[0];
    effect.kind = "he";
    const damage = (mode: "casual" | "competitive", self: boolean) => {
      g.mode = mode;
      g.health = 1000;
      effect.owner = self ? "player" : 0;
      g.utility.areaDamage(effect, 100, 20);
      return 1000 - g.health;
    };
    const blast = {
      casualSelf: damage("casual", true),
      competitiveSelf: damage("competitive", true),
      competitiveTeam: damage("competitive", false),
      casualTeam: damage("casual", false),
    };
    effect.kind = "decoy";
    const decoyTeam = damage("competitive", false);
    effect.kind = "molotov";
    effect.owner = "player";
    effect.cells = [position.clone()];
    effect.age = 0;
    effect.pulse = 0.2;
    g.mode = "practice";
    g.health = 1000;
    for (let i = 0; i < 128; i++) g.utility.update(1 / 128);
    const firstSecond = 1000 - g.health;
    for (let i = 0; i < 256; i++) g.utility.update(1 / 128);
    const thirdSecond = 1000 - g.health;
    g.utility.reset();
    g.health = 1000;
    g.utility.launch(
      "incendiary",
      "player",
      g.team,
      position,
      position.clone().set(0, 0, 0),
      g.selected,
    );
    g.utility.detonate(g.utility.projectiles[0]);
    const fire = g.utility.effects[0];
    const nodes = fire.cells.length;
    const distances = fire.cells.flatMap((a, i) =>
      fire.cells.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.z - b.z)),
    );
    return { blast, decoyTeam, firstSecond, thirdSecond, nodes, closest: Math.min(...distances) };
  });
  expect(result.blast).toEqual({
    casualSelf: 0,
    competitiveSelf: 100,
    competitiveTeam: 85,
    casualTeam: 0,
  });
  expect(result.decoyTeam).toBe(0);
  expect(result.firstSecond).toBe(40);
  expect(result.thirdSecond).toBe(120);
  expect(result.nodes).toBeGreaterThan(0);
  expect(result.nodes).toBeLessThanOrEqual(16);
  expect(result.closest).toBeGreaterThanOrEqual(42 * 0.0254 - 1e-8);
  await page.screenshot({ path: "artifacts/utility-native-fire-bounds.png" });
  expect(errors).toEqual([]);
});
