import data from "./data/recoil.json";
import { isKnife, weapons } from "./physics";

/** Shipped CS2 inputs. RecoveryTime* describe accuracy recovery, not aim-punch decay. */
export const recoilParameters = weapons.map((_, id) => ({
  ...data.weapons[isKnife(id) ? 4 : id],
  id,
}));

/**
 * Reconstruction constants, NOT verified current CS2 convars. The October 2026
 * binary/convar dumps expose the weapon inputs and aim-punch state, but do not
 * expose this algorithm. See docs/recoil-provenance.md for evidence boundaries.
 */
export const RECOIL_VIEW_SCALE = 0.45;
const SCALE = 2;
const TABLE_SIZE = 64;
const SMOOTHING = 0.55;
const SUPPRESSION = 0.75;
const SUPPRESSION_SHOTS = 4;
const ANGLE_DECAY = 8;
const VELOCITY_DECAY = 4.5;
const ANGLE_LINEAR_DECAY = 18;
const INDEX_DECAY = Math.LN10 * 2;
const DEG = Math.PI / 180;

export interface AimPunch {
  /** Full ballistic radians: positive pitch looks up; yaw follows Three.js yaw. */
  pitch: number;
  yaw: number;
  pitchVelocity: number;
  yawVelocity: number;
}
export interface WeaponRecoilState {
  index: number;
  timeSinceShot: number;
  mode: 0 | 1;
}
export function createAimPunch(): AimPunch {
  return { pitch: 0, yaw: 0, pitchVelocity: 0, yawVelocity: 0 };
}
export function createWeaponRecoil(): WeaponRecoilState {
  return { index: 0, timeSinceShot: 1e9, mode: 0 };
}

/** Park–Miller generator with the 32-entry shuffle used by Source's uniform stream. */
export class RecoilRandom {
  private seed: number;
  private previous = 0;
  private shuffle = new Int32Array(32);
  constructor(seed: number) {
    this.seed = -Math.max(1, Math.abs(Math.trunc(seed)));
  }
  next(): number {
    const advance = () => {
      const high = Math.trunc(this.seed / 127773);
      this.seed = 16807 * (this.seed - high * 127773) - 2836 * high;
      if (this.seed < 0) this.seed += 2147483647;
    };
    if (this.seed <= 0 || this.previous === 0) {
      this.seed = Math.max(1, -this.seed);
      for (let i = 39; i >= 0; i--) {
        advance();
        if (i < 32) this.shuffle[i] = this.seed;
      }
      this.previous = this.shuffle[0]!;
    }
    advance();
    const index = Math.trunc(this.previous / 67108864);
    this.previous = this.shuffle[index]!;
    this.shuffle[index] = this.seed;
    return Math.min(Math.fround(this.previous / 2147483647), 1 - 1.2e-7);
  }
  range(min: number, max: number): number {
    return Math.fround(min + Math.fround(this.next() * Math.fround(max - min)));
  }
}

export interface RecoilImpulse {
  pitch: number;
  yaw: number;
}
const tables = recoilParameters.map((weapon) =>
  ([0, 1] as const).map((mode) => {
    const random = new RecoilRandom(weapon.seed);
    let angle = 0;
    let magnitude = 0;
    return Array.from({ length: TABLE_SIZE }, (_, shot): RecoilImpulse => {
      const nextAngle = Math.fround(
        weapon.angle[mode]! +
          random.range(-weapon.angleVariance[mode]!, weapon.angleVariance[mode]!),
      );
      const nextMagnitude = Math.fround(
        weapon.magnitude[mode]! +
          random.range(-weapon.magnitudeVariance[mode]!, weapon.magnitudeVariance[mode]!),
      );
      if (weapon.fullAuto && shot > 0) {
        angle = Math.fround(
          angle + Math.fround(Math.fround(SMOOTHING) * Math.fround(nextAngle - angle)),
        );
        magnitude = Math.fround(
          magnitude + Math.fround(Math.fround(SMOOTHING) * Math.fround(nextMagnitude - magnitude)),
        );
      } else {
        angle = nextAngle;
        magnitude = nextMagnitude;
      }
      const suppression =
        weapon.fullAuto && shot < SUPPRESSION_SHOTS
          ? SUPPRESSION + ((1 - SUPPRESSION) * shot) / SUPPRESSION_SHOTS
          : 1;
      magnitude = Math.fround(magnitude * Math.fround(suppression));
      const strength = magnitude * SCALE * DEG;
      return { pitch: Math.cos(angle * DEG) * strength, yaw: -Math.sin(angle * DEG) * strength };
    });
  }),
);

/** Returns a velocity impulse; it is NOT a precomputed final bullet position. */
export function recoilImpulse(weapon: number, shot: number, mode: 0 | 1 = 0): RecoilImpulse {
  return tables[weapon]![mode]![Math.max(0, Math.trunc(shot)) % TABLE_SIZE]!;
}

/** Apply AFTER resolving a shot, so the first bullet of a recovered weapon stays on aim. */
export function applyWeaponRecoil(
  punch: AimPunch,
  state: WeaponRecoilState,
  weapon: number,
  mode: 0 | 1 = 0,
): void {
  const impulse = recoilImpulse(weapon, state.index, mode);
  punch.pitchVelocity += impulse.pitch;
  punch.yawVelocity += impulse.yaw;
  state.index += 1;
  state.timeSinceShot = 0;
  state.mode = mode;
}

/** Advance the shooter's shared punch at the fixed simulation step, even while switching. */
export function advanceAimPunch(punch: AimPunch, dt: number): void {
  if (!(dt > 0)) return;
  const decayedMagnitude = Math.hypot(punch.pitch, punch.yaw) * Math.exp(-ANGLE_DECAY * dt);
  const linear = ANGLE_LINEAR_DECAY * SCALE * DEG * dt;
  const angleRatio =
    decayedMagnitude > linear ? Math.exp(-ANGLE_DECAY * dt) * (1 - linear / decayedMagnitude) : 0;
  const velocityRatio = Math.exp(-VELOCITY_DECAY * dt);
  // Legacy hybrid angle decay, then trapezoidal integration of decaying velocity.
  punch.pitch = punch.pitch * angleRatio + punch.pitchVelocity * (1 + velocityRatio) * 0.5 * dt;
  punch.yaw = punch.yaw * angleRatio + punch.yawVelocity * (1 + velocityRatio) * 0.5 * dt;
  punch.pitchVelocity *= velocityRatio;
  punch.yawVelocity *= velocityRatio;
  if (Math.abs(punch.pitch) < 1e-7) punch.pitch = 0;
  if (Math.abs(punch.yaw) < 1e-7) punch.yaw = 0;
}

/** Advance each owned weapon independently; switching never resets its pattern index. */
export function advanceWeaponRecoil(state: WeaponRecoilState, weapon: number, dt: number): void {
  if (!(dt > 0)) return;
  const oldTime = state.timeSinceShot;
  state.timeSinceShot += dt;
  const grace = recoilParameters[weapon]!.cycleTime[state.mode]! * 1.1;
  const recoveryStep = Math.max(0, state.timeSinceShot - Math.max(grace, oldTime));
  state.index *= Math.exp(-INDEX_DECAY * recoveryStep);
  if (state.index < 1e-7) state.index = 0;
}
