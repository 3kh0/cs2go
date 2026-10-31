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
