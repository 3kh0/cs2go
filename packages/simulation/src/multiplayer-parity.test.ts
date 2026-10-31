import { expect, test } from "vitest";
import { neutralInput, type Input } from "@cs2go/protocol";
import { configurePlayer, createMatch, createPlayer, joinMatch, STEP, stepMatch } from "./match";
import { testMap } from "./test-map";
import { dust2BuyZones } from "./buy-zones";
import { weapons } from "./physics";
import { emptyGrenades } from "./utility";
import { defaultLoadouts } from "./loadouts";
function fixture() {
  const match = createMatch("casual", testMap());
  const ct = createPlayer("ct", "CT", "ct"),
    t = createPlayer("t", "T", "t");
  joinMatch(match, ct);
  joinMatch(match, t);
  stepMatch(match, new Map());
  ct.money = t.money = 10000;
  const zone = dust2BuyZones.zones.find((zone) => zone.team === "ct")!;
  Object.assign(ct, {
    x: (zone.min[0] + zone.max[0]) / 2,
    y: (zone.min[1] + zone.max[1]) / 2,
    z: (zone.min[2] + zone.max[2]) / 2,
    cooldown: 0,
  });
  return { match, ct, t };
}
function command(match: ReturnType<typeof createMatch>, id: string, input: Partial<Input>) {
  return stepMatch(match, new Map([[id, { ...neutralInput(), ...input }]]));
}
function run(
  match: ReturnType<typeof createMatch>,
  time: number,
  id = "ct",
  input: Partial<Input> = {},
) {
  const events = [];
  for (let i = 0; i < Math.ceil(time / STEP); i++) events.push(...command(match, id, input));
  return events;
}
function live(match: ReturnType<typeof createMatch>) {
  match.state.phase = "live";
  match.state.remaining = 100;
  for (const [i, p] of [...match.players.values()].entries())
    Object.assign(p, { x: i * 20, y: 0, z: 0, vx: 0, vz: 0, cooldown: 0 });
}
function arm(player: ReturnType<typeof createPlayer>, index: number, ammo = weapons[index].mag) {
  player.weapon = index;
  player.ammo = ammo;
  player.reserve = weapons[index].reserve;
  player.cooldown = 0;
  player.magazines[index] = { ammo, reserve: player.reserve };
  if (weapons[index].slot === 1) player.primary = index;
  else player.secondary = index;
}

test("burst and revolver preserve their trigger timing instead of behaving as ordinary pistols", () => {
  const { match, t } = fixture();
  live(match);
  const burst = run(match, 0.5, t.id, { fire: true, burst: true }).filter(
    (event) => event.kind === "shot",
  );
  expect(burst).toHaveLength(3);
  expect(t.ammo).toBe(17);
  arm(t, 17);
  match.shotsHeld.clear();
  expect(
    run(match, 0.15, t.id, { fire: true }).filter((event) => event.kind === "shot"),
  ).toHaveLength(0);
  expect(
    run(match, 0.15, t.id, { fire: true }).filter((event) => event.kind === "shot"),
  ).toHaveLength(1);
});
test("magazines commit at imported insertion markers and remain loaded across a holster", () => {
  const { match, ct } = fixture();
  live(match);
  arm(ct, 0, 1);
  command(match, ct.id, { reload: true });
  let steps = 0;
  while (ct.ammo === 1 && steps++ < 500) command(match, ct.id, {});
  expect(ct.ammo).toBe(30);
  expect(ct.reloadTime).toBeGreaterThan(0);
  const remaining = ct.reloadTime;
  command(match, ct.id, { select: 4 });
  command(match, ct.id, { select: 0 });
  expect(ct.ammo).toBe(30);
  expect(ct.cooldown).toBeGreaterThanOrEqual(Math.min(remaining - 2 * STEP, weapons[0].deploy));
});
test("shell reloads insert one shell at a time and can be interrupted by firing", () => {
  const { match, ct } = fixture();
  live(match);
  arm(ct, 10, 0);
  command(match, ct.id, { reload: true });
  let steps = 0;
  while (ct.ammo === 0 && steps++ < 500) command(match, ct.id, {});
  expect(ct.ammo).toBe(1);
  expect(ct.reloadTime).toBeGreaterThan(0);
  const events = command(match, ct.id, { fire: true });
  expect(events.filter((event) => event.kind === "shot")).toHaveLength(weapons[10].pellets);
  expect(ct.ammo).toBe(0);
  expect(ct.reloadTime).toBe(0);
});
test("native suppressor markers commit the attachment and block attacks during the action", () => {
  const { match, ct } = fixture();
  live(match);
  command(match, ct.id, { toggleSuppressor: true });
  expect(ct.suppressorAction).toBe("silencer_detach");
  const events = run(match, 0.2, ct.id, { fire: true });
  expect(events.filter((event) => event.kind === "shot")).toHaveLength(0);
  run(match, 6);
  expect(ct.suppressed).toBe(false);
  expect(ct.suppressorAction).toBe("");
});
test("purchases and refunds belong to the server; using a weapon invalidates its receipt", () => {
  const { match, ct } = fixture();
  const initial = ct.money;
  command(match, ct.id, { buy: 8 });
  expect(ct.money).toBe(initial - 700);
  expect(ct.refundableWeapons).toContain(8);
  command(match, ct.id, { refund: 8 });
  expect(ct.money).toBe(initial);
  command(match, ct.id, { buy: 8 });
  live(match);
  command(match, ct.id, { fire: true });
  expect(ct.refundableWeapons).not.toContain(8);
});
test("captured paint and original creator survive drops, pickup and death", () => {
  const { match, ct, t } = fixture();
  configurePlayer(match, ct, {
    skins: { 2: { id: "test-skin", wear: 0.2, seed: 7 } },
    agents: { ct: "default-ct", t: "default-t" },
    loadouts: defaultLoadouts(),
  });
  const appearance = ct.appearances[2];
  live(match);
  command(match, ct.id, { drop: true });
  command(match, t.id, { drop: true });
  run(match, 0.6);
  const drop = match.state.drops.find((drop) => drop.owner === ct.id)!;
  Object.assign(t, { x: drop.x, y: drop.y, z: drop.z });
  command(match, t.id, { pickup: true });
  expect(t.appearances[2]).toEqual(appearance);
  expect(t.appearances[2].creator).toBe(ct.id);
  command(match, t.id, { drop: true });
  expect(match.state.drops.find((drop) => drop.weapon === 2)?.appearance).toEqual(appearance);
});
test("grenade buying enforces faction/carry limits and refund receipts", () => {
  const { match, ct } = fixture();
  const money = ct.money;
  command(match, ct.id, { grenadeBuy: "molotov" });
  expect(ct.grenades.molotov).toBe(0);
  command(match, ct.id, { grenadeBuy: "he" });
  command(match, ct.id, { grenadeBuy: "flash" });
  command(match, ct.id, { grenadeBuy: "smoke" });
  command(match, ct.id, { grenadeBuy: "decoy" });
  expect(ct.grenades.decoy).toBe(0);
  command(match, ct.id, { grenadeRefund: "he" });
  command(match, ct.id, { grenadeRefund: "flash" });
  command(match, ct.id, { grenadeRefund: "smoke" });
  expect(ct.grenades).toEqual(emptyGrenades());
  expect(ct.money).toBe(money);
});
test("throws are swept by shared physics, replicated, and require a purchased grenade", () => {
  const { match, ct } = fixture();
  live(match);
  command(match, ct.id, { throwKind: "he" });
  expect(match.state.projectiles).toHaveLength(0);
  ct.grenades.he = 1;
  run(match, 0.6, ct.id, { utility: "he" });
  command(match, ct.id, { throwKind: "he", throwStrength: 1 });
  expect(ct.grenades.he).toBe(0);
  expect(match.state.projectiles).toHaveLength(1);
  const first = { ...match.state.projectiles[0] };
  run(match, 0.1);
  const next = match.state.projectiles[0];
  expect(Math.hypot(next.x - first.x, next.y - first.y, next.z - first.z)).toBeGreaterThan(0.1);
  run(match, 1.5);
  expect(match.state.projectiles).toHaveLength(0);
  expect(match.state.effects.some((effect) => effect.kind === "he")).toBe(true);
});

test("flash exposure is authoritative and depends on facing the explosion", () => {
  const { match, ct, t } = fixture();
  live(match);
  Object.assign(ct, { x: 0, z: 0, yaw: 0 });
  Object.assign(t, { x: 0, z: -4, yaw: 0 });
  match.state.projectiles.push({
    id: 1,
    kind: "flash",
    owner: ct.id,
    team: ct.team,
    weapon: ct.weapon,
    x: 0,
    y: 1.5,
    z: -2,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 1.5,
    resting: true,
    lastBounce: 0,
  });
  command(match, ct.id, {});
  expect(ct.blind).toBeGreaterThan(1);
  expect(t.blind).toBeGreaterThan(0);
  expect(ct.blind).toBeGreaterThan(t.blind);
});
test("fire damages on its cells and a smoke grenade extinguishes that fire", () => {
  const { match, ct, t } = fixture();
  live(match);
  Object.assign(t, { x: 0.4, z: 0 });
  match.state.projectiles.push({
    id: 1,
    kind: "molotov",
    owner: ct.id,
    team: ct.team,
    weapon: ct.weapon,
    x: 0,
    y: 0.1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 2,
    resting: true,
    lastBounce: 0,
  });
  command(match, ct.id, {});
  const fire = match.state.effects.find((effect) => effect.kind === "molotov")!;
  expect(fire.cells.length).toBeGreaterThan(0);
  run(match, 0.3);
  expect(t.health).toBeLessThan(100);
  match.state.projectiles.push({
    id: 2,
    kind: "smoke",
    owner: ct.id,
    team: ct.team,
    weapon: ct.weapon,
    x: 0,
    y: 0.1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 1.5,
    resting: true,
    lastBounce: 0,
  });
  command(match, ct.id, {});
  expect(match.state.effects.some((effect) => effect.kind === "molotov")).toBe(false);
  expect(match.state.effects.some((effect) => effect.kind === "smoke")).toBe(true);
});
test("HE applies armor and temporarily clears nearby smoke", () => {
  const { match, ct, t } = fixture();
  live(match);
  match.state.effects.push({
    id: 1,
    kind: "smoke",
    owner: ct.id,
    team: ct.team,
    weapon: ct.weapon,
    x: 0,
    y: 0.1,
    z: 0,
    age: 1,
    pulse: 0,
    cleared: -1,
    cells: [],
    holes: [],
  });
  match.state.projectiles.push({
    id: 2,
    kind: "he",
    owner: ct.id,
    team: ct.team,
    weapon: ct.weapon,
    x: 0,
    y: 0.1,
    z: -2,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 1.5,
    resting: true,
    lastBounce: 0,
  });
  command(match, ct.id, {});
  expect(ct.health).toBe(100);
  Object.assign(t, { x: 0.4, z: 0 });
  match.state.projectiles.push({
    id: 3,
    kind: "he",
    owner: ct.id,
    team: ct.team,
    weapon: ct.weapon,
    x: 0,
    y: 0.1,
    z: -2,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 1.5,
    resting: true,
    lastBounce: 0,
  });
  command(match, ct.id, {});
  expect(t.health).toBeLessThan(100);
  expect(t.armor).toBeLessThan(100);
  expect(match.state.effects.find((effect) => effect.kind === "smoke")!.cleared).toBeGreaterThan(1);
});
test("decoys emit their weapon audio and expire with their small blast", () => {
  const { match, ct } = fixture();
  live(match);
  match.state.projectiles.push({
    id: 1,
    kind: "decoy",
    owner: ct.id,
    team: ct.team,
    weapon: ct.weapon,
    x: 0,
    y: 0.1,
    z: -0.5,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 1.5,
    resting: true,
    lastBounce: 0,
  });
  const born = command(match, ct.id, {});
  expect(born.some((event) => event.kind === "utility-sound" && event.sound === "decoy-shot")).toBe(
    true,
  );
  const events = run(match, 15.1);
  expect(
    events.some((event) => event.kind === "utility-sound" && event.sound === "decoy-explode"),
  ).toBe(true);
  expect(match.state.effects).toHaveLength(0);
});

test("the selected CT starting pistol and knife initialize from the configured loadout", () => {
  const { match, ct } = fixture();
  const loadouts = defaultLoadouts();
  loadouts.ct[0] = 12;
  configurePlayer(match, ct, {
    skins: {},
    agents: { ct: "default-ct", t: "default-t" },
    loadouts,
    knife: 5,
  });
  expect(ct.secondary).toBe(12);
  expect(ct.weapon).toBe(12);
  expect(ct.knife).toBe(5);
  expect(ct.magazines[12].ammo).toBe(weapons[12].mag);
  expect(ct.magazines[2]).toBeUndefined();
});

test("airborne unducking cannot extend feet through the floor, and shallow overlaps recover", () => {
  const { match, ct } = fixture();
  live(match);
  Object.assign(ct, { x: 0, y: 0.01, z: 0, eye: 1.1, grounded: false, vertical: 0 });
  // Expanding the hull used to lower the feet after the only landing query.
  command(match, ct.id, {});
  expect(ct.y).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < 1200; i++) {
    command(match, ct.id, { jump: i % 64 === 0, duck: i % 24 < 12, forward: 1 });
    expect(ct.y).toBeGreaterThanOrEqual(-0.000001);
  }
  Object.assign(ct, { y: -0.06, grounded: false, vertical: -1 });
  command(match, ct.id, {});
  expect(ct.y).toBeCloseTo(0, 6);
  expect(ct.grounded).toBe(true);
});
