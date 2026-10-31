import uiCues from "./data/ui-cues.json";
export type UiInteraction = keyof typeof uiCues;
type Output = { unlock: () => void; ready: () => boolean; play: (kind: UiInteraction) => void };
const controls =
  'button, a[href], select, input[type="checkbox"], input[type="range"], input[type="color"]';
function control(target: EventTarget | null) {
  const node = target instanceof Element ? target.closest<HTMLElement>(controls) : null;
  return node && !node.matches(":disabled, [aria-disabled=true]") && !node.closest("[inert]")
    ? node
    : null;
}
export function uiActivation(node: HTMLElement): UiInteraction | undefined {
  const navigation: Record<string, UiInteraction> = {
    "home-button": "home",
    "quit-button": "quit",
    "settings-button": "settings",
    "pause-settings": "settings",
    "pause-skins": "inventory",
    "skins-button": "inventory",
    "home-collection": "inventory",
    "home-store-browse": "inventory",
    "inventory-button": "loadout",
    "home-loadout": "loadout",
    "home-play": "play",
    "store-button": "store",
    "news-button": "news",
    "watch-button": "watch",
    play: "go",
    "close-skins": "inspect-close",
  };
  if (node.id === "home-play" && document.getElementById("menu")?.dataset.page === "play")
    return undefined;
  if (navigation[node.id]) return navigation[node.id];
  if (
    node.matches(
      '[role="tab"][aria-selected="true"], [data-mode][aria-pressed="true"], [data-home-team][aria-pressed="true"]',
    )
  )
    return undefined;
  if (
    node.matches(
      '[role="tab"], [data-mode], [data-home-team], [data-inventory-team], [data-inventory-slot]',
    )
  )
    return "radio";
  if (node.matches("[data-weapon].owned")) return "buy-select";
  if (node.matches("[data-weapon], [data-equipment], [data-grenade]")) return "buy";
  if (
    node.matches(
      ".close, [data-refund], #home-button, #team-back, #resume, #leave, #result-menu, #close-loadout-editor",
    )
  )
    return "back";
  if (node.matches(".deploy, .team-choice, #apply-skin, #equip-knife, #home-panel-close"))
    return "confirm";
  if (node.matches("select, input")) return "change";
  return "select";
}
/** One delegated router covers dynamic dialogs and nested icon/label targets. */
export function setupUiAudio(output: Output) {
  let keyboardFocus = false;
  let lastHover = -Infinity;
  let lastChange = -Infinity;
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.isTrusted) keyboardFocus = false;
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.isTrusted &&
        ["Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        keyboardFocus = true;
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      if (!event.isTrusted || event.button !== 0) return;
      const node = control(event.target);
      if (!node) return;
      output.unlock();
      // Native select/checkbox/range changes have their own committed event below.
      if (!node.matches("select, input")) {
        const kind = uiActivation(node);
        if (kind) output.play(kind);
      }
    },
    true,
  );
  const hover = (node: HTMLElement) => {
    const now = performance.now();
    if (!output.ready() || now - lastHover < 40) return;
    lastHover = now;
    output.play(
      node.closest(".home-nav, .home-tools, .pause-toolbar")
        ? "main-hover"
        : node.closest("#loadout")
          ? "buy-hover"
          : "hover",
    );
  };
  document.addEventListener("pointerover", (event) => {
    if (!event.isTrusted) return;
    const node = control(event.target);
    if (node && control(event.relatedTarget) !== node) hover(node);
  });
  document.addEventListener("focusin", (event) => {
    if (keyboardFocus) {
      const node = control(event.target);
      if (node) hover(node);
    }
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.isTrusted &&
        event.key === "Escape" &&
        document.getElementById("skin-menu")?.classList.contains("hidden") === false
      )
        output.play("inspect-close");
    },
    true,
  );
  const changed = (event: Event) => {
    if (!event.isTrusted || !control(event.target)) return;
    const now = performance.now();
    if (now - lastChange < 80) return;
    lastChange = now;
    output.unlock();
    output.play("change");
  };
  document.addEventListener("change", (event) => {
    if (
      event.target instanceof Element &&
      event.target.matches('select, input[type="checkbox"], input[type="color"]')
    )
      changed(event);
  });
  document.addEventListener("input", (event) => {
    if (event.target instanceof Element && event.target.matches('input[type="range"]'))
      changed(event);
  });
}
