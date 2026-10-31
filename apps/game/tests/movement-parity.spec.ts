import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";

test("rapid crouch presses cannot bypass posture recovery", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(
    () => !(document.querySelector("#play") as HTMLButtonElement).disabled,
  );
  const result = await page.evaluate(() => {
    const game = (window as unknown as { __game: Game }).__game;
    game.start("practice");
    // Exercise fixed-step input without wall-clock/frame scheduling variance.
    // Leave pointer lock to the existing real-pointer-lock integration test.
    game.locked = false;
    const advance = (ticks: number) => {
      for (let i = 0; i < ticks; i++) game.simulate(1 / 128);
    };
    game.keys.add("KeyC");
    advance(32);
    const first = game.crouching;
    game.keys.delete("KeyC");
    advance(1);
    game.keys.add("KeyC");
    advance(64);
    const spam = game.crouching,
      rate = game.duckTransitionRate;
    game.keys.delete("KeyC");
    advance(1);
    game.keys.add("KeyC");
    advance(32);
    return { first, spam, recovered: game.crouching, rate, recoveredRate: game.duckTransitionRate };
  });
  expect(result).toMatchObject({ first: true, spam: true, recovered: true, recoveredRate: 15 });
  expect(result.rate).toBeLessThan(15);
});

test("native Dust II jump/unduck landings keep feet above the floor", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  const result = await page.evaluate(
    async (root) => {
      const game = window.__game;
      // Exercise prediction/authority against the rendered map's native collision.
      const movementPath = `${root}simulation/src/movement.ts`;
      const matchPath = `${root}simulation/src/match.ts`;
      const protocolPath = `${root}protocol/src/index.ts`;
      const { movePlayer } = await import(movementPath);
      const { createPlayer } = await import(matchPath);
      const { neutralInput } = await import(protocolPath);
      const dust = game.dust!;
      const map = { collision: dust.collision, spawns: dust.navigation.data.spawns };
      const errors: number[] = [];
      for (const team of ["ct", "t"] as const) {
        const [x, y, z] = map.spawns[team][0];
        const floor = map.collision.floor(x, z, y + 0.5);
        const p = createPlayer(team, team, team);
        Object.assign(p, { x, y: floor - 0.06, z, grounded: false, vertical: -1 });
        movePlayer(p, neutralInput(), 1 / 128, map);
        errors.push(Math.max(0, floor - p.y));
        for (let tick = 0; tick < 768; tick++) {
          movePlayer(
            p,
            { ...neutralInput(), jump: tick % 96 === 0, duck: tick % 32 < 16 },
            1 / 128,
            map,
          );
          if (p.y < floor - 0.001) errors.push(floor - p.y);
        }
      }
      return errors;
    },
    `/@fs${new URL("../../../packages/", import.meta.url).pathname}`,
  );
  expect(result.filter((error) => error >= 0.001)).toEqual([]);
});
