import { expect, test, vi } from "vitest";
import * as T from "three";
import { createMatch, createPlayer, joinMatch } from "./match";
import { shoot } from "./combat";
import { testMap } from "./test-map";
import { MapCollision } from "./map-collision";
import { MAX_REWIND_TICKS } from "./hitbox-history";
vi.mock("./accuracy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./accuracy")>()),
  weaponShotSpread: () => [{ x: 0, y: 0 }],
}));
function fixture() {
  const match = createMatch("competitive", testMap()),
    shooter = createPlayer("s", "S", "ct"),
    victim = createPlayer("v", "V", "t");
  joinMatch(match, shooter);
  joinMatch(match, victim);
  Object.assign(victim, { x: 0, y: 0, z: 0, yaw: 0, health: 1000, armor: 0, grounded: true });
  Object.assign(shooter, { x: 0, y: 0, z: 10, yaw: 0, pitch: 0, weapon: 0, grounded: true });
  const rig = match.combat.get(victim.id)!.hitboxes;
  const head = rig.capsules(victim).find((c) => c.group === 1)!;
  const target = head.start.clone().lerp(head.end, 0.85);
  Object.assign(shooter, { x: target.x, eye: target.y, z: target.z + 10 });
  const ray = new T.Ray(new T.Vector3(shooter.x, shooter.eye, shooter.z), new T.Vector3(0, 0, -1));
  const record = (tick: number) => {
    match.tick = tick;
    match.hitboxHistory.record(tick, match.players, match.combat, match.state.bomb);
  };
  return { match, shooter, victim, rig, ray, record };
}
test("bounded server history hits the visible old pose without rewinding live health, position or ammunition", () => {
  const { match, shooter, victim, rig, ray, record } = fixture();
  record(10);
  victim.x = 3;
  record(20);
  expect(rig.hit(victim, ray)).toBeNull();
  expect(match.hitboxHistory.hit(victim, rig, ray, 20, 10, 20)?.head).toBe(true);
  const from = shooter.ammo,
    position = victim.x;
  const events = shoot(match, shooter, false, false, false, 10);
  expect(events[0]).toMatchObject({ kind: "shot", hits: [{ victim: victim.id, headshot: true }] });
  expect(victim.health).toBeLessThan(1000);
  expect(victim.x).toBe(position);
  expect(shooter.ammo).toBe(from);
  // The caller, not tracing/history, commits weapon ammunition/cooldowns.
});
test("future and old requests are clamped, missing history falls back, and new lives never inherit old damage geometry", () => {
  const { match, victim, rig, ray, record } = fixture();
  expect(match.hitboxHistory.hit(victim, rig, ray, 20, 1, 1)).toBeUndefined();
  for (let tick = 1; tick <= 64; tick++) {
    victim.x = tick <= 64 - MAX_REWIND_TICKS ? 0 : 3;
    record(tick);
  }
  expect(match.hitboxHistory.hit(victim, rig, ray, 20, 0, 64)?.head).toBe(true);
  expect(match.hitboxHistory.hit(victim, rig, ray, 20, 1e9, 64)).toBeNull();
  expect(match.hitboxHistory.hit(victim, rig, ray, 20, NaN, 64)).toBeUndefined();
  victim.spawn++;
  victim.x = 0;
  expect(match.hitboxHistory.hit(victim, rig, ray, 20, 32, 65)).toBeNull();
  record(65);
  expect(match.hitboxHistory.hit(victim, rig, ray, 20, 64, 65)).toBeNull();
  expect(match.hitboxHistory.hit(victim, rig, ray, 20, 65, 65)?.head).toBe(true);
  match.players.delete(victim.id);
  record(66);
  expect(match.hitboxHistory.playerCount).toBe(1);
});
test("rewound poses remain blocked by current world cover", () => {
  const { match, shooter, victim, record } = fixture();
  record(10);
  victim.x = 3;
  record(20);
  const wall = new T.Mesh(new T.BoxGeometry(3, 3, 1), new T.MeshBasicMaterial());
  wall.position.set(0, 1.5, 5);
  wall.userData.bulletMaterial = "concrete";
  wall.updateMatrixWorld();
  match.map.collision = new MapCollision([wall]);
  const events = shoot(match, shooter, false, false, false, 10);
  expect(events[0]).toMatchObject({ kind: "shot", hits: [] });
  expect(victim.health).toBe(1000);
});

test("melee uses historical capsule position and facing for the same bounded backstab query", () => {
  const { match, shooter, victim, record } = fixture();
  shooter.weapon = 4;
  shooter.z -= 9.4;
  record(10);
  victim.x = 3;
  victim.yaw = Math.PI;
  record(20);
  const events = shoot(match, shooter, true, false, false, 10);
  expect(events[0]).toMatchObject({ kind: "melee", hit: true });
  expect(victim.health).toBe(820);
  expect(victim.x).toBe(3);
  expect(victim.yaw).toBe(Math.PI);
});

test("old requests at non-snapshot server ticks use the oldest complete in-budget bracket", () => {
  const { match, victim, rig, ray, record } = fixture();
  for (let tick = 1; tick <= 70; tick++) {
    victim.x = tick === 40 ? 0 : 3;
    record(tick);
  }
  // The250msboundary is38, whose lower snapshot36 is outside the budget.
  //40is the first complete visible frame; neither raw38 nor current70 hits.
  expect(rig.hit(victim, ray)).toBeNull();
  expect(match.hitboxHistory.hit(victim, rig, ray, 20, 0, 70)?.head).toBe(true);
});
