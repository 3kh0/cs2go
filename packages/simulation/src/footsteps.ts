/** Distance cadence is reconstructed; native surface events and transport are
 * separate from the animation graph. Advance only on fixed simulation steps. */
export type FootstepSide = "left" | "right";
export interface FootstepSample {
  x: number;
  y: number;
  z: number;
  spawn: number;
  audible: boolean;
}
export class FootstepStride {
  private previous?: FootstepSample;
  private distance = 0;
  private next: FootstepSide = "left";
  reset() {
    this.previous = undefined;
    this.distance = 0;
    this.next = "left";
  }
  advance(sample: FootstepSample, dt: number): FootstepSide | undefined {
    const previous = this.previous;
    const sameSpawn = previous?.spawn === sample.spawn;
    const previouslyAudible = previous?.audible;
    const traveled = previous ? Math.hypot(sample.x - previous.x, sample.z - previous.z) : 0;
    // Reuse actor state at 128Hz; no per-step retained sample allocation.
    if (previous) Object.assign(previous, sample);
    else this.previous = { ...sample };
    if (!sameSpawn) {
      this.distance = 0;
      this.next = "left";
      return;
    }
    // Corrections/teleports and airborne/quiet travel never bank audible steps.
    if (
      !sample.audible ||
      !previouslyAudible ||
      !Number.isFinite(traveled) ||
      !Number.isFinite(sample.y) ||
      !Number.isFinite(dt) ||
      dt <= 0 ||
      traveled > 15 * dt + 0.01 ||
      traveled / dt <= 1.5
    ) {
      this.distance = 0;
      return;
    }
    this.distance += traveled;
    if (this.distance < 1.8) return;
    this.distance %= 1.8;
    const side = this.next;
    this.next = side === "left" ? "right" : "left";
    return side;
  }
}
