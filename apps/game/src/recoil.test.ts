import { expect, test } from "vitest";
import {
  advanceAimPunch,
  advanceWeaponRecoil,
  applyWeaponRecoil,
  createAimPunch,
  createWeaponRecoil,
  recoilImpulse,
  recoilParameters,
  RecoilRandom,
} from "./recoil";

test("uniform stream reproduces the shuffled Park–Miller seed-one reference sequence", () => {
  const random = new RecoilRandom(1);
  const sequence = [0.4159993569, 0.09196489076, 0.7564104859, 0.5297001933, 0.9304364947];
  for (const expected of sequence) expect(random.next()).toBeCloseTo(expected, 6);
});

test("a recovered first shot is on aim, subsequent shots climb and eventually recover without moving mouse aim", () => {
  const punch = createAimPunch();
  const state = createWeaponRecoil();
  expect(punch.pitch).toBe(0);
  applyWeaponRecoil(punch, state, 0);
  expect(punch.pitch).toBe(0);
  expect(state.index).toBe(1);
  for (let step = 0; step < 12; step++) {
    advanceAimPunch(punch, 1 / 128);
    advanceWeaponRecoil(state, 0, 1 / 128);
  }
  expect(punch.pitch).toBeGreaterThan(0);
  expect(state.index).toBe(1);
  for (let step = 0; step < 128 * 6; step++) {
    advanceAimPunch(punch, 1 / 128);
    advanceWeaponRecoil(state, 0, 1 / 128);
  }
  expect(Math.abs(punch.pitch)).toBeLessThan(1e-6);
  expect(Math.abs(punch.yaw)).toBeLessThan(1e-6);
  expect(Math.hypot(punch.pitchVelocity, punch.yawVelocity)).toBeLessThan(1e-6);
  expect(state.index).toBe(0);
});

test("per-weapon indices survive switches and decay only after the last mode's cycle grace", () => {
  const punch = createAimPunch();
  const rifle = createWeaponRecoil();
  const pistol = createWeaponRecoil();
  applyWeaponRecoil(punch, rifle, 0);
  applyWeaponRecoil(punch, rifle, 0);
  applyWeaponRecoil(punch, pistol, 17, 1);
  advanceWeaponRecoil(rifle, 0, 0.1);
  advanceWeaponRecoil(pistol, 17, 0.1);
  expect(rifle.index).toBe(2);
  expect(pistol.index).toBe(1);
  advanceWeaponRecoil(rifle, 0, 0.51);
  // AK grace ends at 0.11 sec; 0.50 sec recovery removes exactly 90%.
  expect(rifle.index).toBeCloseTo(0.2, 10);
  expect(pistol.mode).toBe(1);
  advanceWeaponRecoil(pistol, 17, recoilParameters[17]!.cycleTime[1]! * 1.1 - 0.1);
  expect(pistol.index).toBeCloseTo(1, 10);
  expect(pistol.index).toBeGreaterThan(rifle.index);
});

test("all firearms have deterministic bounded per-mode impulses, and knives never kick", () => {
  for (const weapon of recoilParameters) {
    for (const mode of [0, 1] as const) {
      for (let shot = 0; shot < 64; shot++) {
        const value = recoilImpulse(weapon.id, shot, mode);
        expect(Number.isFinite(value.pitch)).toBe(true);
        expect(Number.isFinite(value.yaw)).toBe(true);
        expect(recoilImpulse(weapon.id, shot + 64, mode)).toEqual(value);
        if (weapon.slug === "knife") expect(Math.hypot(value.pitch, value.yaw)).toBe(0);
      }
    }
  }
  expect(recoilImpulse(0, 8)).not.toEqual(recoilImpulse(9, 8));
  // AUG scope and R8 fan-fire use their distinct shipped alternate parameters.
  expect(recoilImpulse(21, 8, 0)).not.toEqual(recoilImpulse(21, 8, 1));
  expect(recoilImpulse(17, 0, 0)).not.toEqual(recoilImpulse(17, 0, 1));
});

test("a long spray is deterministic under render batching and recovery cannot cross through zero", () => {
  function run(batch: number) {
    const punch = createAimPunch();
    const state = createWeaponRecoil();
    for (let start = 0; start < 512; start += batch) {
      for (let step = start; step < Math.min(512, start + batch); step++) {
        if (step % 13 === 0) applyWeaponRecoil(punch, state, 0);
        advanceAimPunch(punch, 1 / 128);
        advanceWeaponRecoil(state, 0, 1 / 128);
      }
    }
    return { punch, state };
  }
  expect(run(1)).toEqual(run(7));
  const punch = { ...createAimPunch(), pitch: 1e-4, yaw: -1e-4 };
  advanceAimPunch(punch, 1 / 128);
  expect(punch.pitch).toBe(0);
  expect(punch.yaw).toBe(0);
});
