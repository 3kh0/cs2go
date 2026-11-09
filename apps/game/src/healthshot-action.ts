export type HealthshotTimings = { draw: number; use: number; commit: number };

/** Native clip timing is supplied by the healthshot asset; this owns gameplay
 * cancellation and a single heal commit, independent of render frame rate. */
export class HealthshotAction {
  selected = false;
  phase: "draw" | "idle" | "use" = "idle";
  elapsed = 0;
  private committed = false;
  private timings?: HealthshotTimings;
  configure(timings: HealthshotTimings) {
    if (this.selected) return;
    if (
      ![timings.draw, timings.use, timings.commit].every(Number.isFinite) ||
      timings.draw <= 0 ||
      timings.use <= 0 ||
      timings.commit < 0 ||
      timings.commit > timings.use
    )
      throw new Error("Invalid healthshot animation timing");
    this.timings = timings;
  }
  get ready() {
    return !!this.timings;
  }
  get progress() {
    return this.phase === "use" && this.timings ? Math.min(1, this.elapsed / this.timings.use) : 0;
  }
  select() {
    if (!this.timings) return false;
    if (!this.selected) {
      this.selected = true;
      this.phase = "draw";
      this.elapsed = 0;
      this.committed = false;
    }
    return true;
  }
  use(health: number, stock: number) {
    if (!this.selected || this.phase !== "idle" || health <= 0 || stock < 1) return false;
    this.phase = "use";
    this.elapsed = 0;
    this.committed = false;
    return true;
  }
  tick(dt: number) {
    const result = { heal: 0, consumed: false, finished: false };
    if (!this.selected || !this.timings || !(dt > 0) || !Number.isFinite(dt)) return result;
    this.elapsed += dt;
    if (this.phase === "draw" && this.elapsed >= this.timings.draw) {
      this.phase = "idle";
      this.elapsed = 0;
    } else if (this.phase === "use") {
      if (!this.committed && this.elapsed >= this.timings.commit) {
        this.committed = true;
        result.heal = 50;
        result.consumed = true;
      }
      if (this.elapsed >= this.timings.use) {
        result.finished = true;
        this.cancel();
      }
    }
    return result;
  }
  cancel() {
    this.selected = false;
    this.phase = "idle";
    this.elapsed = 0;
    this.committed = false;
  }
}

/** Installed stock Deathmatch schedules50HP at20HP/s on the player, separate
 * from the injected item's animation and one-second boost expiration. */
export class HealthshotHealing {
  private remaining: number[] = [];
  enqueue(amount = 50) {
    if (Number.isFinite(amount) && amount > 0) this.remaining.push(amount);
  }
  tick(dt: number) {
    if (!(dt > 0) || !Number.isFinite(dt)) return 0;
    let health = 0;
    for (let i = this.remaining.length - 1; i >= 0; i--) {
      const before = this.remaining[i];
      const after = Math.max(0, before - 20 * dt);
      // Native helper0x9c06f0 takes the difference of floors, so the first
      // 128Hz step from50 to49.84375 already contributes one integer HP.
      health += Math.floor(before) - Math.floor(after);
      if (after <= 0) this.remaining.splice(i, 1);
      else this.remaining[i] = after;
    }
    return health;
  }
  clear() {
    this.remaining.length = 0;
  }
}
