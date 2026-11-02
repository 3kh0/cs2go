export function setupSettingsTooltips(host: HTMLElement) {
  let active: HTMLElement | undefined;
  let reposition: (() => void) | undefined;
  const hide = () => {
    active?.hidePopover();
    active = undefined;
    reposition = undefined;
  };
  const attach = (row: HTMLElement, text: string, index: number) => {
    const tip = document.createElement("div");
    tip.id = `settings-help-${index}`;
    tip.className = "settings-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.popover = "manual";
    tip.textContent = text;
    document.body.append(tip);
    const controls = row.matches("input, select, button")
      ? [row]
      : row.querySelectorAll("input, select, button");
    for (const control of controls)
      control.setAttribute(
        "aria-describedby",
        [control.getAttribute("aria-describedby"), tip.id].filter(Boolean).join(" "),
      );
    const show = () => {
      if (document.querySelector("select:open")) return;
      hide();
      active = tip;
      tip.showPopover();
      reposition = () => {
        const rect = row.getBoundingClientRect();
        const panel = row.closest(".settings-panel")?.getBoundingClientRect();
        if (panel && (rect.bottom < panel.top || rect.top > panel.bottom)) {
          hide();
          return;
        }
        const box = tip.getBoundingClientRect();
        tip.style.left = `${Math.max(12, Math.min(rect.right - box.width, innerWidth - box.width - 12))}px`;
        tip.style.top = `${Math.max(12, rect.bottom + box.height + 8 > innerHeight - 12 ? rect.top - box.height - 8 : rect.bottom + 8)}px`;
      };
      reposition();
    };
    row.addEventListener("pointerenter", show);
    row.addEventListener("pointerleave", hide);
    row.addEventListener("focusin", show);
    row.addEventListener("focusout", (event) => {
      if (!(event.relatedTarget instanceof Node) || !row.contains(event.relatedTarget)) hide();
    });
    row.addEventListener("pointerdown", hide);
  };
  let index = 0;
  for (const row of host.querySelectorAll<HTMLElement>("[data-settings-help]"))
    attach(row, row.dataset.settingsHelp!, index++);
  for (const hint of host.querySelectorAll<HTMLElement>(
    ".hint, .toggle-label small, .hud-hue-setting small",
  )) {
    const row = hint.closest<HTMLElement>("label") ?? hint.previousElementSibling;
    if (row instanceof HTMLElement) attach(row, hint.textContent ?? "", index++);
    hint.remove();
  }
  host.addEventListener("scroll", () => reposition?.(), true);
  window.addEventListener("resize", hide);
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") hide();
    },
    true,
  );
  new MutationObserver(hide).observe(host.closest("#settings")!, {
    attributes: true,
    attributeFilter: ["class", "data-category"],
  });
}
