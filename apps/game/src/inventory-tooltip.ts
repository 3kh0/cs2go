import { wearCondition } from "./cosmetic-wear";
import { weapons } from "./physics";
import type { Skin } from "./skins";
import "./inventory-tooltip.css";

type InspectText = {
  weapons: string[];
  paints: Record<string, string>;
  collections: string[];
  finishCollections: Record<string, number>;
};

let textLoad: Promise<InspectText> | undefined;
const cardSelector = "#skin-grid [data-item-weapon][data-skin]";
// Native Panorama delegates opening to UiToolkitAPI; its engine-side delay is
// not in the exported tooltip XML. Keep a cancellable half-second hover dwell.
const hoverDelay = 500;

function description(host: HTMLElement, raw: string) {
  for (const paragraph of raw.replace(/<br\s*\/?>/gi, "\n").split(/\n\s*\n/)) {
    if (!paragraph.trim()) continue;
    const p = document.createElement("p");
    const stack: HTMLElement[] = [p];
    for (const token of paragraph.split(/(<[^>]*>)/)) {
      const parent = stack.at(-1)!;
      if (/^<\/(?:i|em|b|strong)\s*>$/i.test(token)) {
        if (stack.length > 1) stack.pop();
      } else if (/^<(?:i|em|b|strong)(?:\s[^>]*)?>$/i.test(token)) {
        const element = document.createElement(/^<(?:i|em)\b/i.test(token) ? "em" : "strong");
        parent.append(element);
        stack.push(element);
      } else if (!/^<[^>]*>$/.test(token)) {
        token.split("\n").forEach((line, index) => {
          if (index) parent.append(document.createElement("br"));
          parent.append(
            document.createTextNode(
              line.replace(
                /&(amp|lt|gt|quot|apos);/g,
                (_, entity: string) =>
                  ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity]!,
              ),
            ),
          );
        });
      }
    }
    host.append(p);
  }
}

/** Native inventory hover details, independent of the 3D inspection renderer.
 * Cards can provide data-wear for a real owned item's Exterior. Missing wear
 * stays absent, matching native faux/catalog items rather than inventing it.
 */
export function setupInventoryTooltip(overlay: HTMLElement): () => void {
  const tooltip = document.createElement("section");
  tooltip.className = "inventory-item-tooltip";
  tooltip.id = "inventory-item-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  let active: HTMLElement | undefined;
  let trigger: "pointer" | "focus" | undefined;
  let described: HTMLElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  const cardFrom = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(cardSelector) : null;
  const available = (card: HTMLElement) =>
    card.isConnected &&
    overlay.contains(card) &&
    !overlay.hidden &&
    !overlay.classList.contains("hidden") &&
    !overlay.dataset.inspect &&
    overlay.dataset.musicKits !== "true" &&
    !card.matches(":disabled") &&
    !overlay.querySelector("#weapon-inspect-context:not([hidden])") &&
    card.getClientRects().length > 0;

  function hide() {
    generation++;
    clearTimeout(timer);
    timer = undefined;
    active = undefined;
    trigger = undefined;
    tooltip.hidden = true;
    if (described) {
      const ids = (described.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter((id) => id && id !== tooltip.id);
      if (ids.length) described.setAttribute("aria-describedby", ids.join(" "));
      else described.removeAttribute("aria-describedby");
      described = undefined;
    }
  }

  function position() {
    if (!active || tooltip.hidden) return;
    const anchor = active.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const margin = 10;
    let left = anchor.right + margin;
    if (left + width > window.innerWidth - margin) left = anchor.left - width - margin;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    const top = Math.max(margin, Math.min(anchor.top, window.innerHeight - height - margin));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function render(card: HTMLElement, skin: Skin | undefined, text?: InspectText) {
    const weapon = Number(card.dataset.itemWeapon);
    const definition = weapons[weapon];
    if (!definition) return;
    const finish = skin?.name ?? card.querySelector("span")?.textContent ?? "";
    const name = card.dataset.skin ? `${definition.name} | ${finish}` : definition.name;
    const rarity = card.style.getPropertyValue("--item-rarity") || "#b0c3d9";
    tooltip.style.setProperty("--tooltip-rarity", rarity);
    tooltip.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = name;
    tooltip.append(heading);
    const collection = text?.finishCollections[card.dataset.skin ?? ""];
    if (collection !== undefined && text?.collections[collection]) {
      const label = document.createElement("p");
      label.className = "inventory-tooltip-collection";
      label.textContent = text.collections[collection];
      tooltip.append(label);
    }
    const facts = document.createElement("dl");
    const row = (label: string, value: string, color?: string) => {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = `${label}:`;
      dd.textContent = value;
      if (color) dd.style.color = color;
      facts.append(dt, dd);
    };
    const type =
      definition.label === "SIDEARM"
        ? "Pistol"
        : definition.label === "ASSAULT RIFLE"
          ? "Rifle"
          : definition.label.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
    row("Quality", skin ? `${skin.rarity} ${type}` : type, skin ? rarity : undefined);
    const wear = card.hasAttribute("data-wear") ? Number(card.dataset.wear) : NaN;
    if (skin && Number.isFinite(wear) && wear >= 0 && wear <= 1)
      row("Exterior", wearCondition(wear));
    // Gameplay shares knife rules across teams; the two native default
    // inventory definitions retain their own CT/T availability labels.
    const team = weapon === 37 ? "ct" : weapon === 38 ? "t" : definition.team;
    row("Team", team === "ct" ? "Counter-Terrorists" : team === "t" ? "Terrorists" : "Both Teams");
    tooltip.append(facts);
    const details = document.createElement("div");
    details.className = "inventory-tooltip-description";
    const weaponDescription = text?.weapons[weapon];
    if (weaponDescription) description(details, weaponDescription);
    const paintDescription = skin ? text?.paints[String(skin.paint)] : undefined;
    if (paintDescription) description(details, paintDescription);
    if (details.childElementCount) tooltip.append(details);
  }

  async function show(card: HTMLElement, version: number) {
    let text: InspectText | undefined;
    let skin: Skin | undefined;
    try {
      textLoad ??= import("./data/weapon-inspect-text.json")
        .then((module) => module.default)
        .catch((error: unknown) => {
          textLoad = undefined;
          throw error;
        });
      const [nativeText, skins] = await Promise.all([
        textLoad,
        import("./skins").then((module) => module.skinCatalog()),
      ]);
      text = nativeText;
      skin = skins.find(
        (entry) =>
          entry.id === card.dataset.skin && entry.weapon === Number(card.dataset.itemWeapon),
      );
    } catch {
      // Basic cached card details remain useful if optional text cannot load.
    }
    if (generation !== version || active !== card || !available(card)) return;
    render(card, skin, text);
    tooltip.hidden = false;
    described = card;
    const ids = new Set((card.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
    ids.add(tooltip.id);
    card.setAttribute("aria-describedby", [...ids].join(" "));
    position();
  }

  function schedule(card: HTMLElement | null, source: "pointer" | "focus") {
    if (!card || active === card) return;
    hide();
    if (!available(card)) return;
    active = card;
    trigger = source;
    const version = generation;
    timer = setTimeout(() => {
      timer = undefined;
      void show(card, version);
    }, hoverDelay);
  }
  const pointerOver = (event: PointerEvent) => schedule(cardFrom(event.target), "pointer");
  const pointerOut = (event: PointerEvent) => {
    const card = cardFrom(event.target);
    if (trigger === "pointer" && card && card !== cardFrom(event.relatedTarget) && active === card)
      hide();
  };
  const focusIn = (event: FocusEvent) => schedule(cardFrom(event.target), "focus");
  const focusOut = (event: FocusEvent) => {
    if (
      trigger === "focus" &&
      active === cardFrom(event.target) &&
      cardFrom(event.target) !== cardFrom(event.relatedTarget)
    )
      hide();
  };
  const scroll = () => {
    if (trigger === "focus" && active?.contains(document.activeElement)) position();
    else hide();
  };
  const keyDown = (event: KeyboardEvent) => {
    if (["Escape", "Enter", " ", "Tab"].includes(event.key)) hide();
  };
  overlay.addEventListener("pointerover", pointerOver);
  overlay.addEventListener("pointerout", pointerOut);
  overlay.addEventListener("focusin", focusIn);
  overlay.addEventListener("focusout", focusOut);
  overlay.addEventListener("keydown", keyDown);
  overlay.addEventListener("scroll", scroll, true);
  overlay.addEventListener("contextmenu", hide, true);
  document.addEventListener("pointerdown", hide, true);
  window.addEventListener("blur", hide);
  window.addEventListener("resize", position);
  const observer = new MutationObserver(() => {
    if (active && !available(active)) hide();
  });
  observer.observe(overlay, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "disabled", "data-inspect", "data-music-kits"],
  });
  return () => {
    hide();
    observer.disconnect();
    overlay.removeEventListener("pointerover", pointerOver);
    overlay.removeEventListener("pointerout", pointerOut);
    overlay.removeEventListener("focusin", focusIn);
    overlay.removeEventListener("focusout", focusOut);
    overlay.removeEventListener("keydown", keyDown);
    overlay.removeEventListener("scroll", scroll, true);
    overlay.removeEventListener("contextmenu", hide, true);
    document.removeEventListener("pointerdown", hide, true);
    window.removeEventListener("blur", hide);
    window.removeEventListener("resize", position);
    tooltip.remove();
  };
}
