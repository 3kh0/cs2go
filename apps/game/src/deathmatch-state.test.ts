import { expect, it } from "vitest";
import { DeathmatchState } from "./deathmatch-state";

it("keeps the bonus window inactive between30-second awards and ends its score multiplier", () => {
  const state = new DeathmatchState(() => 0);
  state.reset();
  expect(state.bonusPoints(30)).toBe(0);
  state.tick(29, [30]);
  expect(state.bonus).toBeNull();
  expect(state.tick(1, [30])).toBe("started");
  expect(state.bonus?.weapon).toBe(30);
  // Native P90 costs2350:11 ordinary points, truncated50% adds5, not6.
  expect(state.bonusPoints(30)).toBe(5);
  expect(state.bonusPoints(0)).toBe(0);
  state.tick(29, [30]);
  expect(state.bonusPoints(30)).toBe(5);
  expect(state.tick(1, [30])).toBe("ended");
  expect(state.bonusPoints(30)).toBe(0);
  expect(state.tick(30, [0])).toBe("started");
  expect(state.bonusPoints(0)).toBe(5);
});

it("bounds the randomized interval and survives an empty weapon pool", () => {
  const state = new DeathmatchState(() => 1);
  state.reset();
  expect(state.untilBonus).toBeGreaterThan(39);
  expect(state.untilBonus).toBeLessThanOrEqual(40);
  state.tick(45, []);
  expect(state.bonus).toBeNull();
  expect(state.tick(1 / 128, [3])).toBe("started");
  expect(state.bonus?.weapon).toBe(3);
  expect(state.bonusPoints(3)).toBe(4);
});

it("attributes a single assist to the strongest eligible contributor and clears victim damage on respawn", async () => {
  const { DeathmatchCombat } = await import("./deathmatch-state");
  const combat = new DeathmatchCombat(25, 4);
  combat.record(0, "player", 42);
  combat.record(0, 1, 39);
  combat.record(0, 2, 80);
  expect(combat.kill(3, 0).assister).toBe(2);
  expect(combat.life(2).assists).toBe(1);
  combat.spawn(0);
  combat.record(0, "player", 25);
  expect(combat.kill(3, 0).assister).toBeUndefined();
  combat.record(0, "player", 26);
  expect(combat.kill(3, 0).assister).toBe("player");
  combat.record(0, "player", 80);
  expect(combat.kill("player", 0).assister).toBeUndefined();
});

it("awards bounded healthshots for three kills in one life without leaking progress across death", async () => {
  const { DeathmatchCombat } = await import("./deathmatch-state");
  const combat = new DeathmatchCombat(25, 4);
  for (let victim = 0; victim < 2; victim++)
    expect(combat.kill("player", victim).healthshotAwarded).toBe(false);
  expect(combat.kill("player", 2).healthshotAwarded).toBe(true);
  expect(combat.life("player").healthshots).toBe(1);
  for (let victim = 0; victim < 3; victim++) combat.kill("player", victim);
  expect(combat.life("player").healthshots).toBe(1);
  expect(combat.life("player").killProgress).toBe(6);
  combat.life("player").healthshots = 0;
  expect(combat.kill("player", 0).healthshotAwarded).toBe(false);
  expect(combat.kill("player", 1).healthshotAwarded).toBe(false);
  expect(combat.kill("player", 2).healthshotAwarded).toBe(true);
  expect(combat.life("player").killProgress).toBe(9);
  combat.spawn("player");
  expect(combat.life("player")).toEqual({ killProgress: 0, healthshots: 0, assists: 0 });
});

it("allows consecutive bonus windows to select the same weapon from the native weighted pool", () => {
  const state = new DeathmatchState(() => 0);
  state.reset();
  state.tick(30, [30, 3]);
  expect(state.bonus?.weapon).toBe(30);
  state.tick(30, [30, 3]);
  expect(state.bonus).toBeNull();
  state.tick(30, [30, 3]);
  expect(state.bonus?.weapon).toBe(30);
  expect(state.bonusPoints(30)).toBe(5);
});
