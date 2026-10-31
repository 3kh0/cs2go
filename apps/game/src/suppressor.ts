/** Per-item suppressor state. Native animation markers commit the attachment. */
export const removableSuppressor = (id: number) => id === 1 || id === 2;
export class SuppressorState {
  attached = true;
  action: "silencer_attach" | "silencer_detach" | null = null;
  elapsed = 0;
  duration = 0;
  commit = 1;
  get progress() {
    return this.duration ? Math.min(1, this.elapsed / this.duration) : 0;
  }
  start(duration: number, commit: number) {
    this.action = this.attached ? "silencer_detach" : "silencer_attach";
    this.elapsed = 0;
    this.duration = duration;
    this.commit = commit;
  }
  update(dt: number) {
    if (!this.action) return;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    if (this.progress >= this.commit) this.attached = this.action === "silencer_attach";
    if (this.elapsed >= this.duration) this.cancel();
  }
  cancel() {
    this.action = null;
    this.elapsed = 0;
  }
}
