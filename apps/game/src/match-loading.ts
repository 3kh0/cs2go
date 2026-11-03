import type { AgentTeam } from "./soldier";

/** Match setup has real stage milestones; GPU work has no meaningful byte percentage. */
export function openMatchLoading(team: AgentTeam) {
  const menu = document.getElementById("menu")!;
  const overlay = document.createElement("section");
  const controller = new AbortController();
  overlay.id = "match-loading";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "match-loading-title");
  overlay.setAttribute("aria-busy", "true");
  overlay.innerHTML = `<div class="match-loading-content"><span class="match-loading-map">DUST II</span><h1 id="match-loading-title">JOINING ${team === "ct" ? "COUNTER-TERRORISTS" : "TERRORISTS"}</h1><p role="status" aria-live="polite">Preparing your team…</p><progress max="3" value="0" aria-label="Match preparation"></progress><div class="match-loading-stages"><span>PLAYERS</span><span>GRAPHICS</span><span>READY</span></div><button class="text-button" type="button">CANCEL · ESC</button></div>`;
  const status = overlay.querySelector<HTMLElement>('[role="status"]')!;
  const progress = overlay.querySelector("progress")!;
  const button = overlay.querySelector("button")!;
  menu.inert = true;
  document.getElementById("app")!.append(overlay);
  button.focus();
  let closed = false,
    hadLock = false,
    failed = false;
  const cancel = () => {
    if (failed) {
      close();
      document.getElementById("home-play")?.focus();
      return;
    }
    if (controller.signal.aborted) return;
    controller.abort();
    status.textContent = "Returning to the menu…";
    button.disabled = true;
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
    if (event.key === "Tab") {
      event.preventDefault();
      button.focus();
    }
    event.stopPropagation();
  };
  const pointerlock = () => {
    if (failed) return;
    if (document.pointerLockElement) hadLock = true;
    else if (hadLock) cancel();
  };
  button.onclick = cancel;
  document.addEventListener("keydown", keydown, true);
  document.addEventListener("pointerlockchange", pointerlock);
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", keydown, true);
    document.removeEventListener("pointerlockchange", pointerlock);
    overlay.remove();
    menu.inert = false;
  };
  return {
    signal: controller.signal,
    // Two animation frames allow the new overlay/status to actually paint before
    // the next preparation stage submits CPU/GPU work.
    async stage(label: string, completed: number) {
      controller.signal.throwIfAborted();
      status.textContent = label;
      progress.value = completed;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      controller.signal.throwIfAborted();
    },
    close,
    error() {
      failed = true;
      overlay.setAttribute("aria-busy", "false");
      status.textContent = "The match could not be prepared. Return to the menu and try again.";
      button.disabled = false;
      button.textContent = "BACK TO MENU";
      button.onclick = () => {
        close();
        document.getElementById("home-play")?.focus();
      };
      button.focus();
    },
  };
}
