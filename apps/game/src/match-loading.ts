import type { MapId } from "@cs2go/protocol";
import type { Game } from "./game";
export function openMatchLoading(
  mode: Parameters<Game["start"]>[0] = "casual",
  map: MapId = "dust2",
) {
  const name = map === "dust2" ? "Dust II" : "Mirage";
  const title = {
    casual: "Casual",
    competitive: "Competitive",
    deathmatch: "Deathmatch",
    practice: "Practice",
  }[mode];
  const briefing =
    mode === "practice"
      ? "<strong>Practice</strong><p>Practice movement and weapon handling against stationary targets.</p><p>No round timer · Unlimited reserve ammunition</p>"
      : mode === "deathmatch"
        ? "<strong>Deathmatch</strong><p>Eliminate opponents and respawn after each death.</p><p>First to 20 eliminations · Five-minute match</p>"
        : `<strong>Bomb Scenario Mission</strong><p>Buy equipment at the beginning of each round with money earned.</p><p>${mode === "competitive" ? "5 vs 5 · Round economy<br>Friendly fire is ON" : "10 vs 10 · Free armor<br>Friendly fire is OFF"}</p>`;
  const menu = document.getElementById("menu")!;
  const overlay = document.createElement("section");
  const controller = new AbortController();
  overlay.id = "match-loading";
  overlay.dataset.map = map;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "match-loading-title");
  overlay.setAttribute("aria-busy", "true");
  overlay.innerHTML = `<div class="match-loading-scenery"><span>${name}</span></div><aside class="match-loading-panel"><div class="match-loading-content"><img class="map-badge" src="/ui/home/${map}-emblem.svg" alt=""><span class="match-loading-map">${name}</span><h1 id="match-loading-title">${title}</h1></div><div class="match-loading-brief">${briefing}</div><footer class="match-loading-footer"><div class="match-loading-progress"><p role="status" aria-live="polite">Preparing ${name}...</p><progress max="3" value="0" aria-label="Match preparation"></progress></div><button class="text-button" type="button">CANCEL · ESC</button></footer></aside>`;
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
    status.textContent = "Returning to the menu...";
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
