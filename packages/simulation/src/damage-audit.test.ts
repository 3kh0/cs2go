import { expect, test, vi } from "vitest";
import * as T from "three";
import { createMatch, createPlayer, joinMatch, stepMatch } from "./match";
import { shoot } from "./combat";
import { weaponShotSpread } from "./accuracy";
import { MapCollision } from "./map-collision";
import { testMap } from "./test-map";
import { isKnife, movement, weapons } from "./physics";

// Isolate damage from aiming error; the actual trace, penetration, hit-region,
// armor, health and feedback dispatch still run through authoritative combat.
vi.mock("./accuracy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./accuracy")>()),
  weaponShotSpread: vi.fn(() => [{ x: 0, y: 0 }]),
}));

// Golden one-pellet values at 500 Source units, independently audited against
// pinned weapons.vdata: id, unarmored chest/head, armored chest/head.
const golden = [
  [0, 35.28, 141.12, 27.342, 109.368],
  [1, 35.72, 124.127, 25.004, 86.8889],
  [2, 31.85, 127.4, 16.08425, 64.337],
  [3, 113.85, 455.4, 111.00375, 444.015],
  [7, 25.5, 102, 11.985, 47.94],
  [8, 45.05, 175.695, 41.9866, 163.74774],
  [9, 32.01, 128.04, 22.407, 89.628],
  [10, 18.2, 72.8, 9.1, 36.4],
  [11, 22.62, 90.48, 13.572, 54.288],
  [12, 31.85, 127.4, 16.08425, 64.337],
  [13, 34.2, 136.8, 21.888, 87.552],
  [14, 25.92, 103.68, 23.62608, 94.50432],
  [15, 26.07, 104.28, 23.61942, 94.47768],
  [16, 26.35, 105.4, 20.460775, 81.8431],
  [17, 80.84, 323.36, 75.34288, 301.37152],
  [18, 30.02, 120.08, 17.2615, 69.046],
  [19, 28.8, 115.2, 20.16, 80.64],
  [20, 29.4, 117.6, 22.785, 91.14],
  [21, 27.44, 109.76, 24.696, 98.784],
  [22, 29.4, 117.6, 29.4, 117.6],
  [23, 86.24, 344.96, 73.304, 293.216],
  [24, 78.4, 313.6, 64.68, 258.72],
  [25, 78.4, 313.6, 64.68, 258.72],
  [26, 23.2, 92.8, 13.34, 53.36],
  [27, 26.1, 104.4, 16.3125, 65.25],
  [28, 24.36, 97.44, 15.225, 60.9],
  [29, 26.25, 105, 17.0625, 68.25],
  [30, 22.36, 89.44, 15.4284, 61.7136],
  [31, 21.6, 86.4, 13.608, 54.432],
  [32, 14, 56, 11.2, 44.8],
  [33, 13.5, 54, 10.125, 40.5],
  [34, 14.4, 57.6, 10.8, 43.2],
  [35, 31.04, 124.16, 24.832, 99.328],
  [36, 33.95, 135.8, 24.1045, 96.418],
];
function fixture(weapon: number, distance = 12.7) {
  const match = createMatch("competitive", testMap());
  const shooter = createPlayer("s", "Shooter", "ct"),
    victim = createPlayer("v", "Victim", "t");
  joinMatch(match, shooter);
  joinMatch(match, victim);
  stepMatch(match, new Map());
  Object.assign(shooter, {
    x: 0,
    y: 0,
    z: distance + movement.hullRadius,
    yaw: 0,
    pitch: 0,
    weapon,
  });
  Object.assign(victim, { x: 0, y: 0, z: 0, health: 10000, armor: 1000, helmet: true });
  return { match, shooter, victim };
}
for (const [id, chest, head, armoredChest, armoredHead] of golden)
  test(`${weapons[id].name}: standing/crouched region and armor damage match audited values`, () => {
    for (const crouched of [false, true])
      for (const armored of [false, true]) {
        for (const [height, raw, protectedDamage] of [
          [0.5, chest * 0.75, chest * 0.75],
          [1, chest * 1.25, armoredChest * 1.25],
          [1.25, chest, armoredChest],
          [1.65, head, armoredHead],
        ]) {
          const { match, shooter, victim } = fixture(id);
          const scale = crouched ? 1.1 / 1.65 : 1;
          victim.eye = 1.65 * scale;
          shooter.eye = height * scale;
          victim.armor = armored ? 1000 : 0;
          const events = shoot(match, shooter);
          expect(events[0]).toMatchObject({
            kind: "shot",
            hits: [{ victim: victim.id, headshot: height === 1.65 }],
          });
          // Tiny FP differences at an exact integer must not alter the audit.
          const expected = Math.floor((armored ? protectedDamage : raw) + 1e-9);
          expect(10000 - victim.health, `${id}/${height}/${crouched}/${armored}`).toBe(expected);
          if (height === 0.5) expect(victim.armor).toBe(armored ? 1000 : 0);
        }
      }
    const { match, shooter, victim } = fixture(id);
    victim.helmet = false;
    shooter.eye = 1.65;
    shoot(match, shooter);
    expect(10000 - victim.health).toBe(Math.floor(head + 1e-9));
  });

test("AK clear helmet headshots kill at A-site distances; range and cover can legitimately reduce them", () => {
  for (const [distance, lethal] of [
    [10, true],
    [20, true],
    [80, false],
  ] as const) {
    const { match, shooter, victim } = fixture(0, distance);
    victim.health = 100;
    victim.armor = 100;
    const events = shoot(match, shooter);
    expect(events[0]).toMatchObject({ kind: "shot", headshot: true });
    expect(victim.health === 0).toBe(lethal);
  }
  const { match, shooter, victim } = fixture(0, 10);
  victim.health = 100;
  victim.armor = 100;
  const wall = new T.Mesh(new T.BoxGeometry(3, 3, 0.12), new T.MeshBasicMaterial());
  wall.position.set(0, 1.5, 5);
  wall.userData.bulletMaterial = "wood";
  wall.updateMatrixWorld();
  match.map.collision = new MapCollision([wall]);
  const events = shoot(match, shooter);
  expect(events[0]).toMatchObject({ kind: "shot", headshot: true, hits: [{ passed: true }] });
  expect(victim.health).toBeGreaterThan(0);
});

test("shotguns dispatch every pellet and overlapping body surfaces never duplicate one pellet", () => {
  for (const id of [10, 32, 33, 34]) {
    const { match, shooter, victim } = fixture(id);
    vi.mocked(weaponShotSpread).mockReturnValueOnce(
      Array.from({ length: weapons[id].pellets }, () => ({ x: 0, y: 0 })),
    );
    shooter.eye = 1.25;
    const shots = shoot(match, shooter).filter((event) => event.kind === "shot");
    const goldenDamage = golden.find((entry) => entry[0] === id)![3];
    expect(shots).toHaveLength(weapons[id].pellets);
    expect(10000 - victim.health).toBe(Math.floor(goldenDamage) * weapons[id].pellets);
  }
});

test("competitive knife team damage uses the same other-damage scale as offline", () => {
  const { match, shooter, victim } = fixture(4, 0.6);
  victim.team = shooter.team;
  victim.health = 100;
  victim.armor = 100;
  victim.yaw = 0;
  shoot(match, shooter, true);
  expect(victim.health).toBe(39);
});

test("the damage audit covers the complete firearm roster", () => {
  expect(golden.map((row) => row[0])).toEqual(
    weapons.flatMap((_, id) => (isKnife(id) ? [] : [id])),
  );
});
