import data from "./data/accuracy.json";
import { SOURCE_UNIT, isKnife, weapons } from "./physics";
import { recoilParameters } from "./recoil";

export const accuracyParameters = weapons.map((_, id) => ({
  ...data.weapons[isKnife(id) ? 4 : id],
  id,
}));
export const accuracyDefaults = data.defaults;

/** Shipped recovery endpoints; historical Source truncates the recoil index. */
export function accuracyRecovery(
  weapon: number,
  shots: number,
  crouched: boolean,
  grounded = true,
  ladder = false,
) {
  const p = recoilParameters[weapon];
  if (ladder) return p.recoveryStand;
  if (!grounded) return p.recoveryCrouch * 4;
  const progress = Math.max(
    0,
    Math.min(
      1,
      (Math.trunc(shots) - p.recoveryTransitionStart) /
        Math.max(1, p.recoveryTransitionEnd - p.recoveryTransitionStart),
    ),
  );
  const start = crouched ? p.recoveryCrouch : p.recoveryStand;
  const final = crouched ? p.recoveryCrouchFinal : p.recoveryStandFinal;
  return start + ((final >= 0 ? final : start) - start) * progress;
}

export interface WeaponAccuracy {
  /** Excess above the last baseline; retained per owned weapon. */
  penalty: number;
  baseline?: number;
  mode: 0 | 1;
}
export function createWeaponAccuracy(): WeaponAccuracy {
  return { penalty: 0, mode: 0 };
}
export interface AccuracyPose {
  mode: 0 | 1;
  speed: number;
  crouch: number;
  grounded: boolean;
  verticalSpeed?: number;
  walking?: boolean;
  reloading?: boolean;
  ladder?: boolean;
  /** Number of players below this shooter in a boost stack. */
  stackDepth?: number;
}
function onLadder(pose: AccuracyPose) {
  return (
    !!pose.ladder || (pose.stackDepth ?? 0) >= accuracyDefaults.weapon_accuracy_stack_boost_limit
  );
}
function accuracyBaseline(weapon: number, pose: AccuracyPose) {
  const p = accuracyParameters[weapon];
  const mode = pose.mode;
  const crouch = Math.max(0, Math.min(1, pose.crouch));
  const stance = onLadder(pose)
    ? p.ladder[mode] + p.ladder[0]
    : !pose.grounded
      ? p.stand[mode] + p.jump[mode] * accuracyDefaults.weapon_air_spread_scale
      : p.stand[mode] + (p.crouch[mode] - p.stand[mode]) * crouch;
  return stance + (pose.reloading ? p.reload : 0);
}

/**
 * Historical Source raises the whole penalty to a new floor immediately, then
 * exponentially approaches lower floors. This preserves landing/stance/zoom
 * recovery instead of deleting those penalties when a posture flag changes.
 */
export function advanceWeaponAccuracy(
  state: WeaponAccuracy,
  weapon: number,
  shots: number,
  crouched: boolean,
  dt: number,
  pose?: AccuracyPose,
) {
  if (!(dt > 0)) return;
  const baseline = pose ? accuracyBaseline(weapon, pose) : (state.baseline ?? 0);
  const previous = (state.baseline ?? baseline) + state.penalty;
  const recovery = accuracyRecovery(
    weapon,
    shots,
    crouched,
    pose?.grounded ?? true,
    pose ? onLadder(pose) : false,
  );
  const total = Math.max(
    baseline,
    baseline + (previous - baseline) * (recovery > 0 ? Math.exp((-Math.LN10 * dt) / recovery) : 0),
  );
  state.baseline = baseline;
  state.penalty = Math.max(0, total - baseline);
  if (state.penalty < 1e-8) state.penalty = 0;
  if (pose) state.mode = pose.mode;
}

/** Apply after the shot, using its pose so a recovered first bullet stays clean. */
export function applyFiringInaccuracy(
  state: WeaponAccuracy,
  weapon: number,
  mode: 0 | 1,
  pose?: AccuracyPose,
) {
  const baseline = pose ? accuracyBaseline(weapon, pose) : accuracyParameters[weapon].stand[mode];
  const previous = (state.baseline ?? baseline) + state.penalty;
  state.penalty = Math.max(
    0,
    Math.max(previous, baseline) + accuracyParameters[weapon].fire[mode] - baseline,
  );
  state.baseline = baseline;
  state.mode = mode;
}

/** Impact velocity is in meters/sec; the shipped land coefficient uses Source units/sec. */
export function applyLandingInaccuracy(
  state: WeaponAccuracy,
  weapon: number,
  mode: 0 | 1,
  downwardSpeed: number,
) {
  state.penalty +=
    (accuracyParameters[weapon].land[mode] * Math.max(0, downwardSpeed)) / SOURCE_UNIT;
}

/** Current shipped endpoints with a documented historical square-root speed curve. */
export function airborneInaccuracy(weapon: number, verticalSpeed: number) {
  const p = accuracyParameters[weapon];
  const ratio = Math.sqrt(Math.abs(verticalSpeed) / SOURCE_UNIT / accuracyDefaults.sv_jump_impulse);
  const progress = Math.max(0, Math.min(2, (ratio - 0.25) / 0.75));
  return (
    Math.max(0, Math.min(2 * p.jumpInitial, p.jumpApex + (p.jumpInitial - p.jumpApex) * progress)) *
    accuracyDefaults.weapon_air_spread_scale
  );
}

export function weaponInaccuracy(weapon: number, state: WeaponAccuracy, pose: AccuracyPose) {
  const p = accuracyParameters[weapon];
  const maxSpeed = p.maxSpeed[pose.mode] * SOURCE_UNIT;
  let moving = maxSpeed > 0 ? Math.max(0, Math.min(1, (pose.speed / maxSpeed - 0.34) / 0.61)) : 0;
  if (!pose.walking) moving **= 0.25;
  const baseline = accuracyBaseline(weapon, pose);
  return Math.min(
    1,
    Math.max(baseline, (state.baseline ?? baseline) + state.penalty) +
      p.move[pose.mode] * moving +
      (!pose.grounded ? airborneInaccuracy(weapon, pose.verticalSpeed ?? 0) : 0),
  );
}

/** Source-style radial sampling: uniform radius, denser impacts near center. */
export function spreadOffset(radius: number, angleSample: number, radiusSample: number) {
  const angle = angleSample * Math.PI * 2;
  const distance = radiusSample * radius;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}
/** Historical R8 secondary and first-three-shot Negev distributions, not a CS2 seed claim. */
export function spreadRadiusSample(
  weapon: number,
  mode: 0 | 1,
  recoilIndex: number,
  sample: number,
) {
  let radius = Math.max(0, Math.min(1, sample));
  const slug = accuracyParameters[weapon].slug;
  if (slug === "revolver" && mode === 1) radius = 1 - radius * radius;
  if (slug === "negev" && recoilIndex < 3) {
    for (let shot = 3; shot > Math.max(0, recoilIndex); shot--) radius *= radius;
    radius = 1 - radius;
  }
  return radius;
}

/** One shared aim displacement per trigger pull, plus each pellet's intrinsic spread. */
export function weaponShotSpread(
  weapon: number,
  mode: 0 | 1,
  recoilIndex: number,
  inaccuracy: number,
  pellets: number,
  random: () => number = Math.random,
) {
  const radius = spreadRadiusSample(weapon, mode, recoilIndex, random());
  const shared = spreadOffset(inaccuracy, random(), radius);
  return Array.from({ length: pellets }, () => {
    const pelletRadius = spreadRadiusSample(weapon, mode, recoilIndex, random());
    const offset = spreadOffset(accuracyParameters[weapon].spread[mode], random(), pelletRadius);
    return { x: shared.x + offset.x, y: shared.y + offset.y };
  });
}
