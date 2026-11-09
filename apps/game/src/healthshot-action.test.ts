import { expect, it } from "vitest";
import { HealthshotAction } from "./healthshot-action";

it("requires a drawn, owned healthshot and permits native full-health use", () => {
  const action = new HealthshotAction();
  expect(action.select()).toBe(false);
  action.configure({ draw: 1, use: 2, commit: 1.5 });
  expect(action.select()).toBe(true);
  expect(action.use(50, 1)).toBe(false);
  action.tick(1);
  expect(action.use(50, 0)).toBe(false);
  expect(action.use(100, 1)).toBe(true);
});

it("commits healing once at the native asset marker and restores the weapon at clip end", () => {
  const action = new HealthshotAction();
  action.configure({ draw: 1, use: 2, commit: 1.5 });
  action.select();
  action.tick(1);
  action.use(42, 1);
  let healed = 0,
    consumed = 0,
    finished = 0;
  for (let i = 0; i < 128 * 3; i++) {
    const result = action.tick(1 / 128);
    healed += result.heal;
    consumed += Number(result.consumed);
    finished += Number(result.finished);
  }
  expect({ healed, consumed, finished }).toEqual({ healed: 50, consumed: 1, finished: 1 });
  expect(action.selected).toBe(false);
});

it("switch/death cancellation cannot apply a delayed heal to the next life", () => {
  const action = new HealthshotAction();
  action.configure({ draw: 1, use: 2, commit: 1.5 });
  action.select();
  action.tick(1);
  action.use(50, 1);
  action.tick(1);
  action.cancel();
  expect(action.tick(10)).toEqual({ heal: 0, consumed: false, finished: false });
  action.select();
  action.tick(1);
  expect(action.phase).toBe("idle");
});

it("heals the player's budget at20HP/s over2.5 simulation seconds after injection", async () => {
  const { HealthshotHealing } = await import("./healthshot-action");
  const healing = new HealthshotHealing();
  healing.enqueue();
  let health = 40;
  for (let i = 0; i < 128; i++) health += healing.tick(1 / 128);
  expect(health).toBe(60);
  for (let i = 0; i < 128; i++) health += healing.tick(1 / 128);
  expect(health).toBe(80);
  for (let i = 0; i < 64; i++) health += healing.tick(1 / 128);
  expect(health).toBe(90);
  expect(healing.tick(1)).toBe(0);
});

it("clamps health at100 while draining a full-health shot, and clears pending healing on respawn", async () => {
  const { HealthshotHealing } = await import("./healthshot-action");
  const healing = new HealthshotHealing();
  healing.enqueue();
  let health = 100;
  for (let i = 0; i < 128; i++) health = Math.min(100, health + healing.tick(1 / 128));
  expect(health).toBe(100);
  health = 60;
  for (let i = 0; i < 128; i++) health = Math.min(100, health + healing.tick(1 / 128));
  expect(health).toBe(80);
  healing.clear();
  expect(healing.tick(10)).toBe(0);
});
