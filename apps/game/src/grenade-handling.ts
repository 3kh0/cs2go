/** Fixed-step authored grenade handling; holding the pin does not cook the fuse. */
export class GrenadeHandling {
  // Defaults from pinned HE clips; the loaded grenade overrides these lengths.
  pinDuration = 0.9667;
  releaseDuration = 0.7667;
  primary = false;
  secondary = false;
  phase: "idle" | "pin" | "held" | "release" = "idle";
  elapsed = 0;
  strength = 1;
  released = false;
  press(button: number) {
    if (this.phase === "release" || (button !== 0 && button !== 2)) return;
    if (button === 0) this.primary = true;
    else this.secondary = true;
    this.strength = this.primary ? (this.secondary ? 0.5 : 1) : 0;
    if (this.phase === "idle") {
      this.phase = "pin";
      this.elapsed = 0;
    }
  }
  release(button: number) {
    if (button !== 0 && button !== 2) return;
    if (button === 0) this.primary = false;
    else this.secondary = false;
    // Keep the selected strength when releasing the last held button.
  }
  update(dt: number): number | null {
    if (this.phase === "idle") return null;
    this.elapsed += dt;
    if (this.primary || this.secondary)
      this.strength = this.primary ? (this.secondary ? 0.5 : 1) : 0;
    if (this.phase === "pin" && this.elapsed >= this.pinDuration) {
      this.phase = "held";
      this.elapsed = 0;
    }
    if (this.phase === "held" && !this.primary && !this.secondary) {
      this.phase = "release";
      this.elapsed = 0;
    }
    // Use the native HE throw-sound markers as browser release points. Native
    // gameplay event/animation-graph scheduling remains a reconstruction.
    if (
      this.phase === "release" &&
      this.elapsed >= (this.strength < 0.25 ? 0.133333 : 0.066667) &&
      !this.released
    ) {
      this.released = true;
      return this.strength;
    }
    if (this.phase === "release" && this.elapsed >= this.releaseDuration) this.cancel();
    return null;
  }
  cancel() {
    this.primary = this.secondary = this.released = false;
    this.phase = "idle";
    this.elapsed = 0;
  }
}
