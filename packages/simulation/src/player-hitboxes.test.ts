import { expect, test } from "vitest";
import * as T from "three";
import { PlayerHitboxes, tracePlayerCapsules } from "./player-hitboxes";
import { createPlayer } from "./match";
import { movement } from "./physics";
import { rayCapsuleInterval } from "./ray-capsule";

function actor() {
  const player = createPlayer("p", "Player", "t");
  Object.assign(player, {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    weapon: 7,
    grounded: true,
    eye: movement.standingEye,
  });
  return { player, rig: new PlayerHitboxes() };
}
const ray = (x: number, y: number) => new T.Ray(new T.Vector3(x, y, 3), new T.Vector3(0, 0, -1));

test("capsule intervals retain exact entry/exit through sides, caps and inside starts", () => {
  const a = new T.Vector3(0, -1, 0),
    b = new T.Vector3(0, 1, 0);
  expect(rayCapsuleInterval(ray(0, 0), a, b, 0.5)).toEqual({ entry: 2.5, exit: 3.5 });
  expect(
    rayCapsuleInterval(new T.Ray(new T.Vector3(0, 4, 0), new T.Vector3(0, -1, 0)), a, b, 0.5),
  ).toEqual({ entry: 2.5, exit: 5.5 });
  expect(rayCapsuleInterval(new T.Ray(new T.Vector3(), new T.Vector3(1, 0, 0)), a, b, 0.5)).toEqual(
    { entry: 0, exit: 0.5 },
  );
  expect(rayCapsuleInterval(ray(0.51, 0), a, b, 0.5)).toBeNull();
});

test("capsule tracing preserves stable hitgroups, connected thickness and independent results", () => {
  const capsule = (entry: number, exit: number, group: number) => ({
    start: new T.Vector3(0, 0, -(entry + exit) / 2),
    end: new T.Vector3(0, 0, -(entry + exit) / 2),
    radius: (exit - entry) / 2,
    group,
  });
  const probe = new T.Ray(new T.Vector3(), new T.Vector3(0, 0, -1));
  const tied = [capsule(2, 3, 3), capsule(2, 3, 1)];
  expect(tracePlayerCapsules(tied, probe)?.group).toBe(3);
  expect(tracePlayerCapsules(tied.toReversed(), probe)?.group).toBe(1);
  const shapes = [
    capsule(8, 9, 4),
    capsule(3, 5, 2),
    capsule(2, 3, 1),
    capsule(5 + 0.5e-6, 6, 3),
    capsule(6 + 2e-6, 7, 6),
  ];
  const first = tracePlayerCapsules(shapes, probe)!;
  expect(first.distance).toBe(2);
  expect(first.thickness).toBeCloseTo(4, 12);
  // Range accepts the capsule entry, retaining its exit beyond the range.
  expect(tracePlayerCapsules([capsule(2, 4, 1)], probe, 2)?.thickness).toBe(2);
  expect(tracePlayerCapsules(shapes, probe, 1)).toBeNull();
  expect(tracePlayerCapsules(shapes, probe, NaN)).toBeNull();
  const second = tracePlayerCapsules([capsule(4, 5, 2)], probe)!;
  expect(second).not.toBe(first);
  expect(second.point).not.toBe(first.point);
  expect(first.point.toArray()).toEqual([0, 0, -2]);
  // The public helper also accepts more capsules than the native pose.
  expect(
    tracePlayerCapsules(
      Array.from({ length: 40 }, () => tied[0]),
      probe,
    )?.group,
  ).toBe(3);
  expect(tracePlayerCapsules([], probe)).toBeNull();
});

test("capsule interval output scratch preserves the allocating API", () => {
  const start = new T.Vector3(0, -1, 0),
    end = new T.Vector3(0, 1, 0),
    output = { entry: 0, exit: 0 };
  const expected = rayCapsuleInterval(ray(0, 0), start, end, 0.5);
  expect(rayCapsuleInterval(ray(0, 0), start, end, 0.5, output)).toBe(output);
  expect(output).toEqual(expected);
  expect(rayCapsuleInterval(ray(1, 0), start, end, 0.5, output)).toBeNull();
  expect(output).toEqual(expected);
});

test("native head, chest, stomach and limbs replace height slabs and empty movement hull corners", () => {
  const { player, rig } = actor();
  // Independent world-space probes from the exported idle_pistol pose. The
  // old AABB incorrectly accepted both the leg gap and x=.35 head-height corner.
  expect(rig.hit(player, ray(0.014, 1.646))?.region).toBe("head");
  expect(rig.hit(player, ray(-0.102, 1.198))?.region).toBe("chest");
  expect(rig.hit(player, ray(-0.119, 0.915))?.region).toBe("stomach");
  expect(rig.hit(player, ray(-0.178, 0.719))?.region).toBe("leg");
  expect(rig.hit(player, ray(0, 0.5))).toBeNull();
  expect(rig.hit(player, ray(0.35, 1.65))).toBeNull();
  const hand = new T.Ray(new T.Vector3(-3, 1.354, -0.487), new T.Vector3(1, 0, 0));
  expect(rig.hit(player, hand)?.region).toBe("arm");
  const hit = rig.hit(player, ray(0.014, 1.646))!;
  expect(hit.thickness).toBeGreaterThan(0.2);
  expect(hit.thickness).toBeLessThan(0.3);
  expect(rig.hit(player, ray(0.014, 1.646), hit.distance - 0.001)).toBeNull();
});

test("native crouch and player yaw transform all capsules instead of shrinking a box", () => {
  const { player, rig } = actor();
  const standing = rig.capsules(player)[0].start.clone();
  player.eye = movement.duckEye;
  const crouched = rig.capsules(player)[0].start.clone();
  expect(standing.y - crouched.y).toBeGreaterThan(0.35);
  expect(crouched.z - standing.z).not.toBeCloseTo(0, 2);
  expect(rig.hit(player, ray(0.014, 1.7))).toBeNull();
  player.yaw = Math.PI / 2;
  const rotated = rig.capsules(player)[0].start.clone();
  expect(rotated.y).toBeCloseTo(crouched.y, 6);
  expect(rotated.x).toBeCloseTo(crouched.z, 6);
  expect(rotated.z).toBeCloseTo(-crouched.x, 6);
});

test("weapon grips and native reload tracks move authoritative arm capsules", () => {
  const { player, rig } = actor();
  const arm = () =>
    rig
      .capsules(player)
      .find((c) => c.group === 4)!
      .start.clone();
  const pistol = arm();
  player.weapon = 0;
  rig.advance(player, 1);
  const rifle = arm();
  expect(rifle.distanceTo(pistol)).toBeGreaterThan(0.05);
  player.reloadTime = 2;
  rig.advance(player, 1 / 128);
  const start = arm();
  player.reloadTime -= 0.5;
  rig.advance(player, 0.5);
  expect(arm().distanceTo(start)).toBeGreaterThan(0.025);
});

test("native Glock draw at the hand-rotation regression phase survives locomotion switches", () => {
  const { player, rig: a } = actor(),
    b = new PlayerHitboxes();
  a.capsules(player);
  player.vx = 2;
  a.capsules(player);
  player.eye = movement.duckEye;
  a.capsules(player);
  player.vx = 0;
  player.eye = movement.standingEye;
  const clock = { phase: 0.7751984, air: 0, shot: null, draw: 0.7673859, reload: null };
  const prior = a.capsules(player, 0, clock),
    fresh = b.capsules(player, 0, clock);
  for (let i = 0; i < prior.length; i++) {
    expect(prior[i].start.distanceTo(fresh[i].start)).toBeLessThan(0.000001);
    expect(prior[i].end.distanceTo(fresh[i].end)).toBeLessThan(0.000001);
  }
});
