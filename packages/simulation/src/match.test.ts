import { expect, test } from "vitest";
import { neutralInput, type Input } from "@cs2go/protocol";
import { createPlayer, createMatch, joinMatch, endRound, STEP, stepMatch } from "./match";
import { movePlayer } from "./movement";
import { rulesFor } from "./economy";
import { testMap } from "./test-map";
import { dust2BombSites } from "./buy-zones";
function fixture(mode: "casual" | "competitive" = "casual") {
  const match = createMatch(mode, testMap());
  const ct = createPlayer("ct", "CT", "ct"),
    t = createPlayer("t", "T", "t");
  joinMatch(match, ct);
  joinMatch(match, t);
  stepMatch(match, new Map());
  return { match, ct, t };
}
function live(match: ReturnType<typeof createMatch>) {
  for (const player of match.players.values()) player.cooldown = 0;
  match.state.phase = "live";
  match.state.remaining = 100;
}
function advance(
  match: ReturnType<typeof createMatch>,
  seconds: number,
  inputs = new Map<string, Input>(),
) {
  for (let step = 0; step < Math.ceil(seconds / STEP); step++) stepMatch(match, inputs);
}
test("both teams are required; freeze time gates movement and fire; shared prediction agrees", () => {
  const { match, ct } = fixture();
  expect(match.state.phase).toBe("freeze");
  const z = ct.z;
  advance(match, 1, new Map([[ct.id, { ...neutralInput(), forward: 1, fire: true }]]));
  expect(ct.z).toBe(z);
  expect(ct.ammo).toBe(12);
  live(match);
  const predicted = structuredClone(ct),
    input = { ...neutralInput(), forward: 1 };
  for (let i = 0; i < 64; i++) {
    movePlayer(predicted, input, STEP, match.map);
    stepMatch(match, new Map([[ct.id, input]]));
  }
  expect(ct.z).toBe(predicted.z);
});
test("deaths wait for round reset; post-round combat remains live and scores pay once", () => {
  const { match, ct, t } = fixture();
  live(match);
  t.health = 0;
  t.deaths++;
  stepMatch(match, new Map());
  expect(match.state.phase).toBe("post");
  expect(match.state.scores.ct).toBe(1);
  const z = ct.z,
    money = ct.money;
  advance(match, 1, new Map([[ct.id, { ...neutralInput(), forward: 1, fire: true }]]));
  expect(ct.z).toBeLessThan(z);
  expect(ct.ammo).toBeLessThan(12);
  expect(t.health).toBe(0);
  expect(ct.money).toBe(money);
  advance(match, 10);
  expect(match.state.round).toBe(2);
  expect(t.health).toBe(100);
  expect(match.state.scores.ct).toBe(1);
});
test("timeout penalizes surviving terrorists and halftime swaps teams, scores and economy", () => {
  const { match, ct, t } = fixture("competitive");
  live(match);
  match.state.remaining = STEP / 2;
  const money = t.money;
  stepMatch(match, new Map());
  expect(match.state.result?.reason).toBe("Time expired");
  expect(t.money).toBe(money);
  match.state.round = 12;
  live(match);
  endRound(match, "t", "elimination");
  const z = ct.z;
  advance(match, 1, new Map([[ct.id, { ...neutralInput(), forward: 1, fire: true }]]));
  expect(match.state.phase).toBe("halftime");
  expect(ct.z).toBe(z);
  match.state.pause = STEP / 2;
  stepMatch(match, new Map());
  expect(match.state.round).toBe(13);
  expect(ct.team).toBe("t");
  expect(t.team).toBe("ct");
  expect(ct.money).toBe(rulesFor("competitive").startMoney);
});
test("planting and defusing require held use; cancellation resets progress; objective MVP is correct", () => {
  const { match, ct, t } = fixture();
  live(match);
  const box = dust2BombSites.sites[0].hulls[0];
  const position = { x: (box.min[0] + box.max[0]) / 2, y: 0, z: (box.min[2] + box.max[2]) / 2 };
  // Rule fixture floor sits at the native site's elevation.
  position.y = box.min[1];
  Object.assign(t, position);
  match.state.bomb.carrier = t.id;
  const use = new Map([[t.id, { ...neutralInput(), use: true }]]);
  // Keep a fixed location: this test isolates trigger/action rules from terrain tests.
  match.map.collision.floor = () => position.y;
  match.map.collision.support = () => position.y;
  match.map.collision.followGround = () => true;
  advance(match, 1, use);
  expect(match.state.bomb.plantProgress).toBeGreaterThan(0.9);
  stepMatch(match, new Map());
  expect(match.state.bomb.plantProgress).toBe(0);
  advance(match, 3.3, use);
  expect(match.state.bomb.planted).toBe(true);
  t.health = 0;
  Object.assign(ct, position);
  ct.kit = true;
  const defuse = new Map([[ct.id, { ...neutralInput(), use: true }]]);
  advance(match, 2, defuse);
  expect(match.state.phase).toBe("live");
  expect(match.state.bomb.progress).toBeGreaterThan(1.9);
  stepMatch(match, new Map());
  expect(match.state.bomb.progress).toBe(0);
  advance(match, 5.1, defuse);
  expect(match.state.result?.reason).toBe("Bomb defused");
  expect(match.state.result?.mvp?.name).toBe("CT");
});
test("planted bomb keeps the round alive after T elimination; explosion and match completion settle once", () => {
  const { match, t } = fixture();
  live(match);
  Object.assign(match.state.bomb, { planted: true, timer: STEP / 2, planter: t.id });
  t.health = 0;
  stepMatch(match, new Map());
  expect(match.state.result?.reason).toBe("Bomb detonated");
  expect(match.state.scores.t).toBe(1);
  match.state.scores.t = 7;
  live(match);
  endRound(match, "t", "bomb");
  expect(match.state.phase).toBe("finished");
  advance(match, 20);
  expect(match.state.scores.t).toBe(8);
});

test("holstering preserves shot/reload lockouts and empty teams cannot farm round wins", () => {
  const { match, ct, t } = fixture();
  live(match);
  ct.primary = 3;
  ct.weapon = 3;
  ct.ammo = 5;
  ct.reserve = 15;
  ct.magazines[3] = { ammo: 5, reserve: 15 };
  stepMatch(match, new Map([[ct.id, { ...neutralInput(), fire: true }]]));
  const original = ct.cooldown;
  stepMatch(match, new Map([[ct.id, { ...neutralInput(), select: ct.secondary }]]));
  advance(match, 0.1);
  stepMatch(match, new Map([[ct.id, { ...neutralInput(), select: 3 }]]));
  expect(ct.cooldown).toBeGreaterThanOrEqual(original - 0.15);
  const ammo = ct.ammo;
  stepMatch(match, new Map([[ct.id, { ...neutralInput(), fire: true }]]));
  expect(ct.ammo).toBe(ammo);
  t.health = 0;
  stepMatch(match, new Map());
  const score = match.state.scores.ct;
  match.players.delete(t.id);
  advance(match, 30);
  expect(match.state.phase).toBe("waiting");
  expect(match.state.scores.ct).toBe(score);
});

test("waiting players can move and fire without starting a round", () => {
  const match = createMatch("casual", testMap());
  const ct = createPlayer("ct", "CT", "ct");
  joinMatch(match, ct);
  ct.cooldown = 0;
  const predicted = structuredClone(ct);
  const input = { ...neutralInput(), forward: 1, jump: true, fire: true };
  const start = ct.z;
  for (let i = 0; i < 64; i++) {
    movePlayer(predicted, input, STEP, match.map);
    stepMatch(match, new Map([[ct.id, input]]));
  }
  expect(ct.z).toBeLessThan(start);
  expect(ct.z).toBe(predicted.z);
  expect(ct.ammo).toBeLessThan(12);
  expect(match.state.phase).toBe("waiting");
  expect(match.state.elapsed).toBe(0);
  joinMatch(match, createPlayer("t", "T", "t"));
  stepMatch(match, new Map());
  expect(match.state.phase).toBe("freeze");
});

test("both sidearms fire in waiting; knives emit melee events and never bullet tracers", () => {
  for (const team of ["ct", "t"] as const) {
    const match = createMatch("casual", testMap());
    const player = createPlayer("p", "Player", team);
    joinMatch(match, player);
    player.cooldown = 0;
    const ammo = player.ammo;
    const events = stepMatch(match, new Map([[player.id, { ...neutralInput(), fire: true }]]));
    expect(events.some((event) => event.kind === "shot")).toBe(true);
    expect(player.ammo).toBe(ammo - 1);
    stepMatch(match, new Map([[player.id, { ...neutralInput(), select: 4 }]]));
    advance(match, 2);
    const swing = stepMatch(match, new Map([[player.id, { ...neutralInput(), fire: true }]]));
    expect(swing).toEqual([{ kind: "melee", shooter: player.id, stab: false, hit: false }]);
    advance(match, 1);
    const stab = stepMatch(match, new Map([[player.id, { ...neutralInput(), stab: true }]]));
    expect(stab).toEqual([{ kind: "melee", shooter: player.id, stab: true, hit: false }]);
    expect(player.weapon).toBe(4);
  }
});
test("sidearm drops preserve ammo, leave the knife usable and can be picked up by another player", () => {
  const match = createMatch("casual", testMap());
  const player = createPlayer("p", "Player", "ct");
  joinMatch(match, player);
  player.ammo = 3;
  stepMatch(match, new Map([[player.id, { ...neutralInput(), drop: true }]]));
  expect(player.weapon).toBe(4);
  expect(player.magazines[2]).toBeUndefined();
  expect(match.state.drops).toHaveLength(1);
  expect(match.state.drops[0]).toMatchObject({ weapon: 2, ammo: 3, owner: "p" });
  advance(match, 1);
  expect(player.weapon).toBe(4);
  const other = createPlayer("other", "Other", "ct");
  joinMatch(match, other);
  Object.assign(other, {
    x: match.state.drops[0].x,
    y: match.state.drops[0].y,
    z: match.state.drops[0].z,
  });
  stepMatch(match, new Map([[other.id, { ...neutralInput(), pickup: true }]]));
  expect(other.weapon).toBe(2);
  expect(other.ammo).toBe(3);
  expect(match.state.drops.some((drop) => drop.owner === "other")).toBe(true);
  expect(match.state.drops.some((drop) => drop.owner === "p")).toBe(false);
});
