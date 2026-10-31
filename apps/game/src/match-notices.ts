import { assetUrl } from "./asset-url";
import "./match-notices.css";

export function matchNoticesMarkup() {
  return `<div id="match-waiting" class="hidden" role="status">Waiting for players</div><div id="bomb-action" class="hidden" role="progressbar" aria-label="Bomb action" aria-valuemin="0" aria-valuemax="100"><i class="bomb-action-side"></i><div class="bomb-action-circle"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bomb-action-track" cx="50" cy="50" r="45"></circle><circle class="bomb-action-ring" cx="50" cy="50" r="45"></circle></svg><img id="bomb-action-icon" src="/icons/buy/defuser.svg" alt=""></div><div class="bomb-action-info"><strong id="bomb-action-label"></strong><span id="bomb-action-time" aria-hidden="true"></span></div><i class="bomb-action-side"></i></div><div id="hud-alert" class="hidden" role="status"><span id="hud-alert-text"></span><small id="hud-alert-detail"></small></div>`;
}
type Action = { kind: "plant" | "defuse"; elapsed: number; duration: number; kit: boolean };
export class MatchNotices {
  private action?: Action["kind"];
  private actionTime = 0;
  private alertTime = 0;
  private progress = document.getElementById("bomb-action")!;
  private alert = document.getElementById("hud-alert")!;
  private label = document.getElementById("bomb-action-label")!;
  private countdown = document.getElementById("bomb-action-time")!;
  private icon = document.getElementById("bomb-action-icon") as HTMLImageElement;
  setWaiting(waiting: boolean) {
    document.getElementById("match-waiting")!.classList.toggle("hidden", !waiting);
  }
  updateAction(action?: Action) {
    if (!action) {
      if (this.action) {
        this.action = undefined;
        this.progress.dataset.state = "canceled";
        this.actionTime = 0.3;
      }
      return;
    }
    this.action = action.kind;
    this.actionTime = 0;
    this.progress.classList.remove("hidden");
    this.progress.dataset.state = "active";
    this.progress.dataset.action = action.kind;
    this.progress.dataset.kit = String(action.kit);
    const text =
      action.kind === "plant"
        ? "Planting the bomb"
        : action.kit
          ? "Defusing the bomb"
          : "Defusing WITHOUT a defuse kit";
    if (this.label.textContent !== text) {
      this.label.textContent = text;
      this.progress.setAttribute("aria-label", text);
      this.icon.src = assetUrl(`/icons/buy/${action.kind === "plant" ? "c4" : "defuser"}.svg`);
    }
    const fraction = Math.max(0, Math.min(1, action.elapsed / action.duration));
    this.progress.style.setProperty("--action-remaining", String(1 - fraction));
    const value = String(Math.round(fraction * 100));
    if (this.progress.getAttribute("aria-valuenow") !== value)
      this.progress.setAttribute("aria-valuenow", value);
    const remaining = Math.max(0, action.duration - action.elapsed).toFixed(3);
    if (this.countdown.textContent !== remaining) this.countdown.textContent = remaining;
  }
  completeAction(kind: Action["kind"]) {
    if (this.action !== kind) return;
    this.action = undefined;
    this.progress.dataset.state = "finished";
    this.progress.style.setProperty("--action-remaining", "0");
    this.progress.setAttribute("aria-valuenow", "100");
    this.countdown.textContent = "0.000";
    this.actionTime = 0.4;
  }
  showAlert(text: string, detail = "", duration = 4) {
    this.alert.dataset.type = "message";
    document.getElementById("hud-alert-text")!.textContent = text;
    document.getElementById("hud-alert-detail")!.textContent = detail;
    this.alert.classList.remove("hidden");
    this.alertTime = duration;
  }
  showBombPlanted(time: number) {
    this.showAlert("The bomb has been planted");
    this.alert.dataset.type = "bomb-planted";
    this.updateBombTimer(time);
  }
  updateBombTimer(time: number) {
    if (this.alertTime <= 0 || this.alert.dataset.type !== "bomb-planted") return;
    const text = `${Math.max(0, Math.ceil(time))} seconds till detonation`;
    const detail = document.getElementById("hud-alert-detail")!;
    if (detail.textContent !== text) detail.textContent = text;
  }
  clearAlert() {
    this.alert.classList.add("hidden");
    this.alertTime = 0;
  }
  tick(dt: number) {
    if (this.actionTime > 0 && (this.actionTime -= dt) <= 0) this.progress.classList.add("hidden");
    if (this.alertTime > 0 && (this.alertTime -= dt) <= 0) this.clearAlert();
  }
  reset() {
    this.setWaiting(false);
    this.action = undefined;
    this.actionTime = 0;
    this.progress.classList.add("hidden");
    this.clearAlert();
  }
}
