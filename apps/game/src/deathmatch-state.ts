import { deathmatchKillPoints } from "./deathmatch-scoring";

// Exact installed server table: CZ75 appears twice, intentionally retaining its
// native selection weight; USP-S and MP5-SD are absent from this table.
export const deathmatchBonusWeapons = [
  8, 17, 18, 14, 16, 7, 0, 21, 3, 19, 25, 20, 35, 9, 1, 26, 30, 29, 32, 31, 33, 36, 34, 15, 16, 12,
  27, 11, 10, 13, 24, 22, 23,
] as const;

export type DeathmatchActor = number | "player";
export type DeathmatchBonus = { weapon: number; remaining: number; duration: number };

// Installed build2000942: mp_dm_bonus_length_min/max30, interval min30/max40,
// mp_dm_bonus_percent50. The client samples the same rules locally; Valve's
// selection RNG is not reproduced. The weapon pool is supplied by the caller.
export class DeathmatchState {
  bonus: DeathmatchBonus | null = null;
  untilBonus = 30;
  private random: () => number;
  constructor(random: () => number = Math.random) {
    this.random = random;
  }
  private sample() {
    return Math.min(0.999999, Math.max(0, this.random()));
  }
  reset() {
    this.bonus = null;
    this.untilBonus = 30 + this.sample() * 10;
  }
  tick(dt: number, weapons: readonly number[]) {
    if (!(dt > 0) || !Number.isFinite(dt)) return null;
    if (this.bonus) {
      this.bonus.remaining = Math.max(0, this.bonus.remaining - dt);
      if (!this.bonus.remaining) {
        this.bonus = null;
        this.untilBonus = 30 + this.sample() * 10;
        return "ended" as const;
      }
    } else {
      this.untilBonus -= dt;
      if (this.untilBonus <= 0 && weapons.length) {
        const weapon = weapons[Math.floor(this.sample() * weapons.length)];
        this.bonus = { weapon, remaining: 30, duration: 30 };
        return "started" as const;
      }
    }
    return null;
  }
  bonusPoints(weapon: number) {
    return this.bonus?.weapon === weapon ? Math.trunc(deathmatchKillPoints(weapon) * 0.5) : 0;
  }
}

export type DeathmatchLife = { killProgress: number; healthshots: number; assists: number };
export class DeathmatchCombat {
  private lives = new Map<DeathmatchActor, DeathmatchLife>();
  private damage = new Map<DeathmatchActor, Map<DeathmatchActor, number>>();
  readonly assistDamage: number;
  readonly healthshotLimit: number;
  constructor(assistDamage: number, healthshotLimit: number) {
    this.assistDamage = assistDamage;
    this.healthshotLimit = healthshotLimit;
  }
  reset() {
    this.lives.clear();
    this.damage.clear();
  }
  life(actor: DeathmatchActor) {
    let life = this.lives.get(actor);
    if (!life) {
      life = { killProgress: 0, healthshots: 0, assists: 0 };
      this.lives.set(actor, life);
    }
    return life;
  }
  spawn(actor: DeathmatchActor) {
    const life = this.life(actor);
    life.killProgress = life.healthshots = 0;
    this.damage.delete(actor);
  }
  record(victim: DeathmatchActor, attacker: DeathmatchActor, amount: number) {
    if (victim === attacker || !Number.isFinite(amount) || amount < 1) return;
    let contributions = this.damage.get(victim);
    if (!contributions) this.damage.set(victim, (contributions = new Map()));
    contributions.set(attacker, (contributions.get(attacker) ?? 0) + Math.floor(amount));
  }
  kill(killer: DeathmatchActor, victim: DeathmatchActor) {
    let assister: DeathmatchActor | undefined;
    let damage = this.assistDamage;
    for (const [actor, contribution] of this.damage.get(victim) ?? []) {
      if (actor === killer || actor === victim || contribution <= damage) continue;
      assister = actor;
      damage = contribution;
    }
    this.damage.delete(victim);
    this.life(victim).killProgress = 0;
    if (assister !== undefined) this.life(assister).assists++;
    let healthshotAwarded = false;
    if (killer !== victim) {
      const life = this.life(killer);
      life.killProgress++;
      // Native scorer keeps a per-life total and attempts at3/6/9... . Its
      // owned-item guard skips the grant when any healthshot is already held,
      // independently of the general carry limit of4.
      if (life.killProgress % 3 === 0 && life.healthshots === 0) {
        life.healthshots = 1;
        healthshotAwarded = true;
      }
    }
    return { assister, healthshotAwarded };
  }
}
