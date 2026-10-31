import { expect, test } from "vitest";
import { neutralInput, type Input } from "@cs2go/protocol";
import { createPlayer, respawn, STEP, stepMatch } from "./match";
import { movePlayer } from "./movement";
import { movement, weapons } from "./physics";
import { yardWalls } from "./yard";

test("prediction and authority produce identical movement from the same inputs", () => {
  const server = createPlayer("a", "A", "ct");
  Object.assign(server, { x: -17, z: 17 });
  const predicted = { ...server };
  const players = new Map([[server.id, server]]);
  for (let seq = 1; seq <= 256; seq++) {
    const input = { ...neutralInput(seq), forward: 1, jump: seq === 65, right: seq > 100 ? 1 : 0 };
    movePlayer(predicted, input, STEP);
    stepMatch(players, new Map([[server.id, input]]));
    for (const field of ["x", "y", "z", "vx", "vz", "eye", "grounded"] as const)
      expect(predicted[field]).toBe(server[field]);
  }
  expect(server.z).toBeLessThan(17);
});

test("movement slides along yard walls without crossing them; crouch and counter-strafing work", () => {
  const player = createPlayer("a", "A", "ct");
  Object.assign(player, { x: -19, z: 17 });
  for (let seq = 0; seq < 300; seq++)
    movePlayer(player, { ...neutralInput(), right: -1, forward: 1 }, STEP);
  expect(player.x).toBeGreaterThanOrEqual(-21 + movement.hullRadius);
  expect(player.z).toBeLessThan(17);
  for (let seq = 0; seq < 128; seq++) movePlayer(player, { ...neutralInput(), duck: true }, STEP);
  expect(player.eye).toBeCloseTo(movement.duckEye, 4);
  expect(Math.hypot(player.vx, player.vz)).toBe(0);
  expect(yardWalls).toHaveLength(16);
});

test("the server owns firing cadence, health, reloads and respawn", () => {
  const shooter = createPlayer("a", "A", "ct"),
    victim = createPlayer("b", "B", "t");
  Object.assign(shooter, { x: 17, z: 17 });
  Object.assign(victim, { x: 17, z: 10 });
  const players = new Map([
    [shooter.id, shooter],
    [victim.id, victim],
  ]);
  const inputs = new Map<string, Input>([
    [shooter.id, { ...neutralInput(), fire: true, pitch: 0.05 }],
  ]);
  const events = stepMatch(players, inputs);
  expect(events.some((event) => event.kind === "shot")).toBe(true);
  expect(shooter.ammo).toBe(weapons[0].mag - 1);
  expect(victim.health).toBe(100 - weapons[0].damage);
  stepMatch(players, inputs);
  expect(shooter.ammo).toBe(weapons[0].mag - 1);
  for (let seq = 0; seq < 60; seq++) stepMatch(players, inputs);
  expect(victim.health).toBe(0);
  expect(victim.deaths).toBe(1);
  expect(shooter.kills).toBe(1);
  inputs.set(shooter.id, { ...neutralInput(), reload: true });
  stepMatch(players, inputs);
  inputs.clear();
  for (let seq = 0; seq < 500; seq++) stepMatch(players, inputs);
  expect(shooter.ammo).toBe(weapons[0].mag);
  expect(victim.health).toBe(100);
  expect(victim.spawn).toBe(1);
  expect(victim.deaths).toBe(1);
});

test("solid cover stops bullets and respawns choose distance from living players", () => {
  const shooter = createPlayer("a", "A", "ct"),
    victim = createPlayer("b", "B", "t");
  Object.assign(shooter, { x: 8, z: 17 });
  Object.assign(victim, { x: 8, z: 0 });
  const players = new Map([
    [shooter.id, shooter],
    [victim.id, victim],
  ]);
  stepMatch(players, new Map([[shooter.id, { ...neutralInput(), fire: true }]]));
  expect(victim.health).toBe(100);
  Object.assign(shooter, { x: -17, z: 17 });
  respawn(victim, players.values());
  expect(victim.x).toBe(17);
  expect(victim.z).toBe(-17);
});
