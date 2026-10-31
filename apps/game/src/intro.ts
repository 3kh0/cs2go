import { watchAssetLoads, watchLoadingWork } from "./loading";
import { DefaultLoadingManager } from "three";
export type LoadProgress = (completed: number, total: number, error?: boolean) => void;

/** Load behind the badge, then play the title sequence before revealing the menu. */
export function startIntro(): LoadProgress {
  const root = document.createElement("section");
  root.id = "startup";
  root.setAttribute("aria-label", "CS2GO loading");
  root.setAttribute("role", "status");
  root.innerHTML = `<div class="startup-stamp">3kh0.net</div><div class="startup-loading"><span class="startup-label">Preparing assets</span><span class="startup-separator" aria-hidden="true"> - </span><span class="startup-percent" role="progressbar" aria-label="Loading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">0%</span></div>`;
  const loading = root.querySelector<HTMLElement>(".startup-loading")!;
  const label = root.querySelector<HTMLElement>(".startup-label")!;
  const percent = root.querySelector<HTMLElement>(".startup-percent")!;
  document.body.append(root);
  const app = document.querySelector<HTMLElement>("#app")!;
  app.inert = true;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let closed = false;
  const showFile = (path: string) => {
    if (closed || playing || /^(?:blob|data):/.test(path)) return;
    const filename = path.split(/[?#]/)[0].split("/").at(-1);
    if (filename) label.textContent = filename;
  };
  const stopWatching = watchAssetLoads(showFile);
  let displayed = 0;
  function showPercent(value: number) {
    if (value <= displayed) return;
    displayed = value;
    percent.textContent = `${displayed}%`;
    percent.setAttribute("aria-valuenow", String(displayed));
  }
  const stopWork = watchLoadingWork((completed, total) => {
    if (!closed && !playing) showPercent(Math.min(99, Math.floor((completed / total) * 100)));
  });
  const previousProgress = DefaultLoadingManager.onProgress;
  const onProgress: typeof previousProgress = (url, completed, total) => {
    showFile(url);
    previousProgress?.(url, completed, total);
  };
  DefaultLoadingManager.onProgress = onProgress;
  let playing = false;
  let sequenceTimer: ReturnType<typeof setTimeout> | undefined;

  function onKey(event: KeyboardEvent) {
    if (!playing || !["Escape", "Space", "Enter"].includes(event.code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }
  document.addEventListener("keydown", onKey, true);

  function close(immediate = false) {
    if (closed) return;
    closed = true;
    stopWatching();
    stopWork();
    if (DefaultLoadingManager.onProgress === onProgress)
      DefaultLoadingManager.onProgress = previousProgress;
    clearTimeout(sequenceTimer);
    document.removeEventListener("keydown", onKey, true);
    root.classList.add("startup-exit");
    setTimeout(
      () => {
        root.remove();
        app.inert = false;
        document.querySelector<HTMLButtonElement>("#play:not(:disabled)")?.focus();
      },
      immediate || reducedMotion ? 0 : 240,
    );
  }

  // Failures reveal the menu's error message; audio and pointer lock still require Play.
  return (completed, total, error = false) => {
    if (closed) return;
    if (error) {
      close(true);
      return;
    }
    if (playing) return;
    if (completed !== total) return;
    showPercent(100);
    loading.hidden = true;
    if (reducedMotion) {
      close(true);
      return;
    }
    playing = true;
    root.setAttribute("aria-label", "CS2GO intro");
    root.insertAdjacentHTML(
      "beforeend",
      `
      <div class="startup-title" aria-hidden="true">
        <div class="startup-stripe stripe-one"></div><div class="startup-stripe stripe-two"></div>
        <div class="startup-wordmark"><span>CS</span><b>2</b><span>GO</span></div>
      </div>`,
    );
    sequenceTimer = setTimeout(() => close(), 3000);
  };
}
