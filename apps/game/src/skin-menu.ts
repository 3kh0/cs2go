import { assetUrl } from "./asset-url";
import { skinCatalog, skinChoices, setSkin, type Skin, type SkinChoice } from "./skins";
import { weapons as definitions, isKnife } from "./physics";

const weapons = definitions.map((weapon) => weapon.name);
export function setupSkinMenu(selectKnife: (index: number) => void) {
  const overlay = document.createElement("div");
  overlay.id = "skin-menu";
  overlay.className = "overlay hidden";
  overlay.innerHTML = `<section class="skin-dialog"><div class="dialog-heading"><div><div class="eyebrow">YOUR LOADOUT</div><h2>WEAPON SKINS</h2><button id="steam-owned-button" type="button">STEAM INVENTORY</button></div><button class="close" id="close-skins" aria-label="Close skins">×</button></div><div class="skin-tabs" role="group" aria-label="Weapon">${weapons.map((w, i) => `<button data-skin-weapon="${i}">${w}</button>`).join("")}</div><div class="skin-layout"><div class="skin-browser"><label class="skin-search">Find a finish<input id="skin-search" type="search" placeholder="Search skins…" autocomplete="off"></label><div id="skin-grid" role="group" aria-label="Finishes"></div></div><form id="skin-form" class="skin-details"><div class="eyebrow" id="skin-rarity">DEFAULT FINISH</div><h3 id="skin-title">Default</h3><img id="skin-image" alt="Catalog preview"/><p class="skin-preview-note">Catalog preview - apply to see your wear and pattern in game.</p><label for="skin-wear">Wear <output id="skin-condition">Factory New</output></label><input id="skin-wear" type="range" min="0" max="1" step="0.000001"/><label class="skin-number">Wear float<input id="skin-float" type="number" min="0" max="1" step="0.000001" required/></label><label class="skin-number">Paint seed<input id="skin-seed" type="number" min="0" max="1000" step="1" required/></label><button type="button" id="random-seed" class="secondary">RANDOMIZE SEED</button><p class="hint">The same seed keeps the same pattern. Some finishes have fixed artwork; their seed changes wear placement.</p><button type="submit" class="deploy" id="apply-skin">APPLY FINISH</button><button type="button" id="equip-knife" class="secondary hidden">EQUIP KNIFE</button><p id="skin-status" role="status" aria-live="polite"></p></form></div></section>`;
  document.body.append(overlay);
  const sections = document.createElement("nav");
  sections.className = "inventory-sections";
  sections.setAttribute("aria-label", "Inventory category");
  sections.innerHTML = `<button type="button" aria-current="page">WEAPONS</button><button type="button" id="inventory-agents">AGENTS</button><button type="button" id="inventory-gloves">GLOVES</button>`;
  overlay.querySelector(".dialog-heading")!.after(sections);
  for (const category of ["agents", "gloves"])
    sections.querySelector<HTMLButtonElement>(`#inventory-${category}`)!.onclick = () => {
      overlay.classList.add("hidden");
      document.dispatchEvent(new CustomEvent("cs2go-cosmetic-menu", { detail: category }));
    };
  const get = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
  get("steam-owned-button").onclick = () => {
    overlay.classList.add("hidden");
    document.dispatchEvent(new Event("steam-account-open"));
  };
  const grid = get<HTMLDivElement>("skin-grid"),
    search = get<HTMLInputElement>("skin-search"),
    wear = get<HTMLInputElement>("skin-wear"),
    float = get<HTMLInputElement>("skin-float"),
    seed = get<HTMLInputElement>("skin-seed"),
    status = get<HTMLParagraphElement>("skin-status"),
    apply = get<HTMLButtonElement>("apply-skin");
  let catalog: Skin[] = [],
    weapon = 0,
    draft: SkinChoice = { ...skinChoices[0] },
    busy = false;
  const condition = (n: number) =>
    n < 0.07
      ? "Factory New"
      : n < 0.15
        ? "Minimal Wear"
        : n < 0.38
          ? "Field-Tested"
          : n < 0.45
            ? "Well-Worn"
            : "Battle-Scarred";
  function detail() {
    get("equip-knife").classList.toggle("hidden", !isKnife(weapon));
    const skin = catalog.find((s) => s.id === draft.id && s.weapon === weapon);
    get("skin-title").textContent = skin?.name ?? "Default";
    get("skin-rarity").textContent = skin?.rarity ?? "Default finish";
    const img = get<HTMLImageElement>("skin-image");
    const image = assetUrl(skin?.image ?? `/skins/defaults/${weapon}.webp`);
    if (img.getAttribute("src") !== image) img.src = image;
    img.alt = `${weapons[weapon]} ${skin?.name ?? "default finish"}`;
    wear.value = float.value = String(draft.wear);
    seed.value = String(draft.seed);
    get("skin-condition").textContent = condition(draft.wear);
    wear.disabled =
      float.disabled =
      seed.disabled =
      get<HTMLButtonElement>("random-seed").disabled =
        !skin || busy;
  }
  get("equip-knife").onclick = () => {
    if (!isKnife(weapon)) return;
    selectKnife(weapon);
    status.textContent = `${weapons[weapon]} equipped.`;
  };
  function selection() {
    grid.querySelectorAll<HTMLButtonElement>("[data-skin]").forEach((button) => {
      button.disabled = busy;
      button.setAttribute("aria-pressed", String(button.dataset.skin === draft.id));
    });
  }
  function list() {
    grid.replaceChildren();
    const entries: [string, string, string][] = [
      ["", "Default", `/skins/defaults/${weapon}.webp`],
      ...catalog
        .filter((s) => s.weapon === weapon)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => [s.id, s.name, s.image] as [string, string, string]),
    ];
    for (const [id, name, image] of entries.filter(([, name]) =>
      name.toLowerCase().includes(search.value.toLowerCase().trim()),
    )) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.skin = id;
      button.disabled = busy;
      button.setAttribute("aria-pressed", String(draft.id === id));
      if (image) {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.src = assetUrl(image);
        img.alt = "";
        button.append(img);
      }
      const label = document.createElement("span");
      label.textContent = name;
      button.append(label);
      button.onclick = () => {
        draft.id = id;
        status.textContent = "";
        selection();
        detail();
      };
      grid.append(button);
    }
    if (!grid.children.length) grid.textContent = "No matching finishes.";
  }
  overlay.querySelectorAll<HTMLButtonElement>("[data-skin-weapon]").forEach(
    (button) =>
      (button.onclick = () => {
        if (busy) return;
        weapon = Number(button.dataset.skinWeapon);
        draft = { ...skinChoices[weapon] };
        search.value = "";
        status.textContent = "";
        refresh();
      }),
  );
  function refresh(rebuild = true) {
    overlay.querySelectorAll<HTMLButtonElement>("[data-skin-weapon]").forEach((b) => {
      b.setAttribute("aria-pressed", String(Number(b.dataset.skinWeapon) === weapon));
      b.disabled = busy;
    });
    if (rebuild) list();
    else selection();
    detail();
  }
  wear.oninput = () => {
    draft.wear = Number(wear.value);
    float.value = wear.value;
    get("skin-condition").textContent = condition(draft.wear);
    status.textContent = "";
  };
  float.oninput = () => {
    if (float.validity.valid) {
      draft.wear = Number(float.value);
      wear.value = float.value;
      get("skin-condition").textContent = condition(draft.wear);
    }
    status.textContent = "";
  };
  seed.oninput = () => {
    if (seed.validity.valid) draft.seed = Number(seed.value);
    status.textContent = "";
  };
  get("random-seed").onclick = () => {
    draft.seed = Math.floor(Math.random() * 1001);
    seed.value = String(draft.seed);
    status.textContent = "";
  };
  search.oninput = list;
  get<HTMLFormElement>("skin-form").onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    apply.disabled = true;
    status.textContent = "Preparing your finish…";
    refresh(false);
    try {
      await setSkin(weapon, draft);
      status.textContent = "Applied and saved. Equip this weapon to inspect your finish.";
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : "The finish could not load. Try again.";
    } finally {
      busy = false;
      apply.disabled = false;
      refresh(false);
    }
  };
  get("close-skins").onclick = () => overlay.classList.add("hidden");
  overlay.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      event.stopPropagation();
      overlay.classList.add("hidden");
    }
  });
  for (const id of ["skins-button", "pause-skins"])
    get(id).onclick = async () => {
      overlay.classList.remove("hidden");
      status.textContent = "Loading finishes…";
      try {
        catalog = await skinCatalog();
        draft = { ...skinChoices[weapon] };
        status.textContent = "";
        refresh();
        search.focus();
      } catch {
        status.textContent = "Skin catalog could not load. Close and reopen to retry.";
      }
    };
}
