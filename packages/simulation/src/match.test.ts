import { afterEach, expect, test, vi } from "vitest";
afterEach(() => vi.restoreAllMocks());
import * as T from "three";
import { MapCollision } from "./map-collision";
import { neutralInput, type Input } from "@cs2go/protocol";
import {
  createPlayer,
  createMatch,
  joinMatch,
  endRound,
  STEP,
  stepMatch,
  switchTeam,
  startRound,
} from "./match";
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
  expect(t.eye).toBeLessThan(1.2);
  stepMatch(match, new Map());
  expect(match.state.bomb.plantProgress).toBe(0);
  advance(match, 0.4);
  expect(t.eye).toBeGreaterThan(1.6);
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

test("shot feedback distinguishes wall impacts, sky misses and confirmed player hits", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  const { match, ct, t } = fixture();
  live(match);
  Object.assign(ct, { x: 4, z: -61, y: 0, yaw: 0, pitch: 0, cooldown: 0 });
  Object.assign(t, { x: 4, z: -65, y: 0 });
  const wall = new T.Mesh(new T.BoxGeometry(4, 4, 0.2), new T.MeshBasicMaterial());
  wall.position.set(4, 2, -63);
  wall.updateMatrixWorld();
  match.map.collision = new MapCollision([wall]);
  const fire = (pitch = 0) =>
    stepMatch(match, new Map([[ct.id, { ...neutralInput(), pitch, fire: true }]])).find(
      (event) => event.kind === "shot",
    );
  const impact = fire();
  expect(impact?.normal?.z).toBeCloseTo(1);
  expect(impact?.victim).toBeUndefined();
  expect(t.health).toBe(100);
  match.map = testMap();
  ct.cooldown = 0;
  match.shotsHeld.clear();
  const hit = fire();
  expect(hit).toMatchObject({ victim: t.id, headshot: true });
  expect(hit?.normal).toBeUndefined();
  expect(t.health).toBeLessThan(100);
  t.x = 20;
  ct.cooldown = 0;
  match.shotsHeld.clear();
  const miss = fire(-0.25);
  expect(miss?.normal).toBeUndefined();
  expect(miss?.victim).toBeUndefined();
  expect(Math.hypot(miss!.to.x - ct.x, miss!.to.z - ct.z)).toBeLessThanOrEqual(90);
});

test("post-round planting continues and restarts without changing the settled result or payout", () => {
  for (const mode of ["casual", "competitive"] as const) {
    const { match, ct, t } = fixture(mode);
    live(match);
    const box = dust2BombSites.sites[0].hulls[0];
    const position = {
      x: (box.min[0] + box.max[0]) / 2,
      y: box.min[1],
      z: (box.min[2] + box.max[2]) / 2,
    };
    Object.assign(t, position);
    match.map.collision.floor = () => position.y;
    match.map.collision.support = () => position.y;
    match.map.collision.followGround = () => true;
    match.state.bomb.carrier = t.id;
    const use = new Map([[t.id, { ...neutralInput(), use: true }]]);
    advance(match, 0.5, use);
    const progress = match.state.bomb.plantProgress;
    ct.health = 0;
    stepMatch(match, use);
    expect(match.state.phase).toBe("post");
    expect(match.state.bomb.plantProgress).toBe(progress);
    const result = structuredClone(match.state.result);
    const scores = { ...match.state.scores };
    const money = t.money;
    stepMatch(match, new Map());
    expect(match.state.bomb.plantProgress).toBe(0);
    advance(match, 3.3, use);
    expect(match.state.bomb.planted).toBe(true);
    expect(match.state.bomb.planter).toBe(t.id);
    expect(match.state.result).toEqual(result);
    expect(match.state.scores).toEqual(scores);
    expect(t.money).toBe(money);
    const timer = match.state.bomb.timer;
    advance(match, 0.2);
    expect(match.state.bomb.timer).toBe(timer);
    advance(match, match.state.pause + STEP);
    expect(match.state.round).toBe(2);
    expect(match.state.phase).toBe("freeze");
    expect(match.state.bomb.planted).toBe(false);
  }
});

test("switching teams releases C4, retains identity and money, and waits for a fresh round", () => {
  const { match, ct, t } = fixture();
  live(match);
  t.money = 4321;
  t.kills = 3;
  Object.assign(match.state.bomb, { carrier: t.id, plantProgress: 1 });
  const position = { x: t.x, y: t.y, z: t.z };
  expect(switchTeam(match, t, "ct")).toBeNull();
  expect(match.players.get(t.id)).toBe(t);
  expect(t).toMatchObject({ team: "ct", money: 4321, kills: 3, health: 0, waiting: true });
  expect(match.state.bomb).toMatchObject({ ...position, carrier: null, plantProgress: 0 });
  const spawn = t.spawn;
  expect(switchTeam(match, t, "ct")).toBeNull();
  expect(t.spawn).toBe(spawn);
  expect(t.health).toBe(0);
  Object.assign(match.state.bomb, { planted: true, defuser: ct.id, progress: 1 });
  expect(switchTeam(match, ct, "t")).toBeNull();
  expect(match.state.bomb).toMatchObject({ planted: true, defuser: null, progress: 0 });
  startRound(match);
  expect(t).toMatchObject({ team: "ct", health: 100, waiting: false, money: 4321 });
});

test("team capacity rejects changes atomically, while waiting lobbies allow a fresh spawn", () => {
  const match = createMatch("competitive", testMap());
  const player = createPlayer("player", "Player", "ct");
  joinMatch(match, player);
  expect(switchTeam(match, player, "t")).toBeNull();
  expect(player).toMatchObject({ team: "t", health: 100, waiting: false, secondary: 7 });
  for (let i = 0; i < 5; i++) joinMatch(match, createPlayer(`ct${i}`, "CT", "ct"));
  match.state.bomb.carrier = player.id;
  const before = JSON.stringify(player);
  expect(switchTeam(match, player, "ct")).toBe("That team is full.");
  expect(JSON.stringify(player)).toBe(before);
  expect(match.state.bomb.carrier).toBe(player.id);
});
