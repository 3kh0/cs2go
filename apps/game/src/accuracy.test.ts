import { expect, it } from "vitest";
import { isKnife } from "./physics";
import {
  accuracyRecovery,
  accuracyDefaults,
  airborneInaccuracy,
  applyLandingInaccuracy,
  spreadRadiusSample,
  weaponShotSpread,
  accuracyParameters,
  advanceWeaponAccuracy,
  applyFiringInaccuracy,
  createWeaponAccuracy,
  weaponInaccuracy,
  spreadOffset,
} from "./accuracy";
it("recovers a crouched AK faster and sustained fire slower than tapping", () => {
  expect(accuracyRecovery(0, 0, true)).toBeLessThan(accuracyRecovery(0, 0, false));
  expect(accuracyRecovery(0, 20, false)).toBeGreaterThan(accuracyRecovery(0, 0, false));
  expect(accuracyRecovery(0, 200, false)).toBe(accuracyRecovery(0, 20, false));
});
it("keeps all diagonal samples within the circular cone", () => {
  for (let i = 0; i < 100; i++) {
    const p = spreadOffset(0.068, i / 100, 1);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(0.068);
  }
});

it("treats negative final recovery values as the starting recovery", () => {
  for (let weapon = 0; weapon < accuracyParameters.length; weapon++) {
    if (isKnife(weapon)) continue;
    for (const crouched of [false, true]) {
      expect(accuracyRecovery(weapon, 100, crouched)).toBeGreaterThan(0);
    }
  }
  expect(accuracyRecovery(4, 100, false)).toBe(accuracyRecovery(4, 0, false));
});

it("uses each weapon's stance/mode data and retains accuracy below counter-strafe threshold", () => {
  const state = createWeaponAccuracy();
  const pose = { mode: 0 as const, speed: 0, crouch: 0, grounded: true };
  const stationary = weaponInaccuracy(0, state, pose);
  expect(stationary).toBeCloseTo(0.00641);
  expect(weaponInaccuracy(0, state, { ...pose, crouch: 1 })).toBeCloseTo(0.00481);
  expect(weaponInaccuracy(0, state, { ...pose, speed: 215 * 0.0254 * 0.34 })).toBe(stationary);
  expect(weaponInaccuracy(0, state, { ...pose, speed: 215 * 0.0254 })).toBeCloseTo(0.18147);
  expect(weaponInaccuracy(3, state, { ...pose, mode: 1 })).toBeLessThan(
    weaponInaccuracy(3, state, pose),
  );
  expect(weaponInaccuracy(0, state, { ...pose, grounded: false })).toBeGreaterThan(stationary);
});

it("recovers continuously and independently with identical results across step subdivisions", () => {
  const state = createWeaponAccuracy();
  const secondWeapon = createWeaponAccuracy();
  applyFiringInaccuracy(state, 0, 0);
  expect(state.penalty).toBeCloseTo(0.0078);
  expect(secondWeapon.penalty).toBe(0);
  const stepped = { ...state };
  const interval = accuracyRecovery(0, 1, false);
  advanceWeaponAccuracy(state, 0, 1, false, interval);
  for (let i = 0; i < 128; i++) advanceWeaponAccuracy(stepped, 0, 1, false, interval / 128);
  expect(state.penalty).toBeCloseTo(0.00078);
  expect(stepped.penalty).toBeCloseTo(state.penalty, 12);
});

it("uses radial rather than area-uniform sampling for the reconstructed Source cone", () => {
  let meanRadius = 0;
  for (let i = 0; i < 1000; i++) {
    const offset = spreadOffset(1, i / 1000, (i + 0.5) / 1000);
    meanRadius += Math.hypot(offset.x, offset.y) / 1000;
  }
  expect(meanRadius).toBeCloseTo(0.5, 8);
});

it("retains an airborne baseline after landing and recovers it instead of snapping accurate", () => {
  const state = createWeaponAccuracy();
  const pose = { mode: 0 as const, speed: 0, crouch: 1, grounded: false, verticalSpeed: 0 };
  advanceWeaponAccuracy(state, 0, 0, true, 1 / 128, pose);
  const air = weaponInaccuracy(0, state, pose);
  const ground = { ...pose, grounded: true };
  advanceWeaponAccuracy(state, 0, 0, true, 1 / 128, ground);
  expect(weaponInaccuracy(0, state, ground)).toBeLessThan(air);
  expect(weaponInaccuracy(0, state, ground)).toBeGreaterThan(accuracyParameters[0].crouch[0]);
  expect(accuracyRecovery(0, 20, false, false)).toBe(accuracyRecovery(0, 0, true) * 4);
});

it("keeps scoped baseline transitions continuous without a separate authored settle timer", () => {
  const state = createWeaponAccuracy();
  const pose = { mode: 0 as const, speed: 0, crouch: 0, grounded: true };
  advanceWeaponAccuracy(state, 3, 0, false, 1 / 128, pose);
  const before = weaponInaccuracy(3, state, pose);
  const scoped = { ...pose, mode: 1 as const };
  expect(weaponInaccuracy(3, state, scoped)).toBe(before);
  advanceWeaponAccuracy(state, 3, 0, false, 1 / 128, scoped);
  expect(weaponInaccuracy(3, state, scoped)).toBeLessThan(before);
  expect(weaponInaccuracy(3, state, scoped)).toBeGreaterThan(accuracyParameters[3].stand[1]);
});

it("scales landing by impact velocity and jump dispersion by vertical speed", () => {
  const state = createWeaponAccuracy();
  applyLandingInaccuracy(state, 0, 0, 5.08);
  expect(state.penalty).toBeCloseTo(accuracyParameters[0].land[0] * 200);
  const before = state.penalty;
  applyLandingInaccuracy(state, 0, 0, -5);
  expect(state.penalty).toBe(before);
  expect(airborneInaccuracy(0, 0)).toBe(accuracyParameters[0].jumpApex);
  expect(airborneInaccuracy(0, accuracyDefaults.sv_jump_impulse * 0.0254)).toBeCloseTo(
    accuracyParameters[0].jumpInitial,
  );
  expect(airborneInaccuracy(0, -5)).toBe(airborneInaccuracy(0, 5));
});

it("applies R8 secondary and early Negev radial transforms only to their applicable modes", () => {
  const negev = accuracyParameters.findIndex((weapon) => weapon.slug === "negev");
  expect(spreadRadiusSample(17, 0, 0, 0.5)).toBe(0.5);
  expect(spreadRadiusSample(17, 1, 0, 0.5)).toBe(0.75);
  expect(spreadRadiusSample(negev, 0, 0, 0.5)).toBe(1 - 0.5 ** 8);
  expect(spreadRadiusSample(negev, 0, 2, 0.5)).toBe(0.75);
  expect(spreadRadiusSample(negev, 0, 3, 0.5)).toBe(0.5);
});

it("shares one inaccuracy displacement across every pellet of a trigger pull", () => {
  let calls = 0;
  const random = () => [0.5, 0, 0, 0.25, 0, 0.75][calls++]!;
  const offsets = weaponShotSpread(0, 0, 0, 0.1, 2, random);
  expect(offsets).toEqual([
    { x: 0.05, y: 0 },
    { x: 0.05, y: 0 },
  ]);
  expect(calls).toBe(6);
});
