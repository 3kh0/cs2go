import "./inventory-page.css";
import { assetUrl } from "./asset-url";
import {
  skinCatalog,
  skinChoices,
  setSkin,
  type Skin,
  type SkinChoice,
  skinRarityColor,
} from "./skins";
import { weapons as definitions, isKnife } from "./physics";

const weapons = definitions.map((weapon) => weapon.name);
export function setupSkinMenu(selectKnife: (index: number) => void) {
  const overlay = document.createElement("div");
  overlay.id = "skin-menu";
  overlay.className = "overlay hidden inventory-page";
  overlay.innerHTML = `<section class="skin-dialog"><div class="dialog-heading"><div><div class="eyebrow">YOUR LOADOUT</div><h2>INVENTORY</h2><button id="add-inventory-item" type="button">＋ ADD ITEM</button><button id="steam-owned-button" type="button">STEAM INVENTORY</button></div><button class="close" id="close-skins" aria-label="Close skins">×</button></div><div class="inventory-toolbar"><label>Filter <select id="inventory-weapon"><option value="all">All equipment</option><option value="knives">Knives</option>${weapons.map((name, id) => `<option value="${id}">${name}</option>`).join("")}</select></label><span id="inventory-count"></span><label>Sort <select id="inventory-sort"><option value="name">Name</option><option value="weapon">Weapon</option></select></label></div><div class="skin-layout"><div class="skin-browser"><label class="skin-search">Find a finish<input id="skin-search" type="search" placeholder="Search skins…" autocomplete="off"></label><div id="skin-grid" role="group" aria-label="Finishes"></div></div><form id="skin-form" class="skin-details"><button type="button" id="close-item-details" aria-label="Close item details">×</button><div class="eyebrow" id="skin-rarity">DEFAULT FINISH</div><h3 id="skin-title">Default</h3><img id="skin-image" alt="Catalog preview"/><p class="skin-preview-note">Catalog preview - apply to see your wear and pattern in game.</p><label for="skin-wear">Wear <output id="skin-condition">Factory New</output></label><input id="skin-wear" type="range" min="0" max="1" step="0.000001"/><label class="skin-number">Wear float<input id="skin-float" type="number" min="0" max="1" step="0.000001" required/></label><label class="skin-number">Paint seed<input id="skin-seed" type="number" min="0" max="1000" step="1" required/></label><button type="button" id="random-seed" class="secondary">RANDOMIZE SEED</button><p class="hint">The same seed keeps the same pattern. Some finishes have fixed artwork; their seed changes wear placement.</p><button type="submit" class="deploy" id="apply-skin">APPLY FINISH</button><button type="button" id="equip-knife" class="secondary hidden">EQUIP KNIFE</button><p id="skin-status" role="status" aria-live="polite"></p></form></div></section>`;
  document.body.append(overlay);
  const sections = document.createElement("nav");
  sections.className = "inventory-sections";
  sections.setAttribute("aria-label", "Inventory category");
  sections.innerHTML = `<button type="button" aria-current="page">EVERYTHING</button><button type="button" id="inventory-agents">AGENTS</button><button type="button" id="inventory-gloves">GLOVES</button>`;
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
  apply.textContent = "EQUIP FINISH";
  let catalog: Skin[] = [],
    weapon = 0,
    draft: SkinChoice = { ...skinChoices[0] },
    busy = false;
  let adding = false;
  let filter = "all";
  const weaponFilter = get<HTMLSelectElement>("inventory-weapon");
  weaponFilter.onchange = () => {
    filter = weaponFilter.value;
    list();
  };
  get<HTMLSelectElement>("inventory-sort").onchange = list;
  get("close-item-details").onclick = () => {
    delete overlay.dataset.inspect;
  };
  document.addEventListener("cs2go-inventory-filter", (event) => {
    filter = (event as CustomEvent<string>).detail;
    weaponFilter.value = filter;
    list();
  });
  type InventoryItem = SkinChoice & { weapon: number };
  let items: InventoryItem[] = [];
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("cs2go-local-inventory") || "[]");
    if (Array.isArray(saved))
      items = saved.filter(
        (item): item is InventoryItem =>
          !!item &&
          Number.isInteger(item.weapon) &&
          !!definitions[item.weapon] &&
          typeof item.id === "string" &&
          Number.isFinite(item.wear) &&
          item.wear >= 0 &&
          item.wear <= 1 &&
          Number.isInteger(item.seed) &&
          item.seed >= 0 &&
          item.seed <= 1000,
      );
  } catch {
    /* Use an empty collection if storage is unavailable. */
  }
  // Keep previously equipped finishes available when migrating from the catalog UI.
  skinChoices.forEach((choice, weapon) => {
    if (choice.id && !items.some((item) => item.weapon === weapon && item.id === choice.id))
      items.push({ weapon, ...choice });
  });
  get("add-inventory-item").onclick = () => {
    if (busy) return;
    adding = !adding;
    delete overlay.dataset.inspect;
    get("add-inventory-item").textContent = adding ? "BACK TO INVENTORY" : "＋ ADD ITEM";
    apply.textContent = adding ? "ADD TO INVENTORY" : "EQUIP FINISH";
    status.textContent = "";
    refresh();
  };
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
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.skin === draft.id && Number(button.dataset.itemWeapon) === weapon),
      );
    });
  }
  function list() {
    grid.replaceChildren();
    const matches = (id: number) =>
      filter === "all" || (filter === "knives" ? isKnife(id) : id === Number(filter));
    const entries = [
      ...definitions.flatMap((_, id) =>
        matches(id)
          ? [
              {
                id: "",
                name: "Default",
                weapon: id,
                image: `/skins/defaults/${id}.webp`,
                rarity: "Default",
              },
            ]
          : [],
      ),
      ...catalog.filter(
        (skin) =>
          matches(skin.weapon) &&
          (adding || items.some((item) => item.weapon === skin.weapon && item.id === skin.id)),
      ),
    ].filter((item) =>
      `${weapons[item.weapon]} ${item.name}`
        .toLowerCase()
        .includes(search.value.toLowerCase().trim()),
    );
    const sort = get<HTMLSelectElement>("inventory-sort").value;
    entries.sort((a, b) =>
      sort === "weapon"
        ? a.weapon - b.weapon || a.name.localeCompare(b.name)
        : `${weapons[a.weapon]} ${a.name}`.localeCompare(`${weapons[b.weapon]} ${b.name}`),
    );
    get("inventory-count").textContent = `${entries.length} items`;
    for (const item of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.skin = item.id;
      button.dataset.itemWeapon = String(item.weapon);
      button.disabled = busy;
      button.style.setProperty(
        "--item-rarity",
        item.id ? skinRarityColor(item.id) || "#b9bdc0" : "#b9bdc0",
      );
      button.setAttribute("aria-label", `${weapons[item.weapon]} | ${item.name}`);
      button.setAttribute("aria-pressed", String(weapon === item.weapon && draft.id === item.id));
      const image = document.createElement("img");
      image.loading = "lazy";
      image.decoding = "async";
      image.src = assetUrl(item.image);
      image.alt = "";
      const name = document.createElement("b");
      name.textContent = weapons[item.weapon];
      const finish = document.createElement("span");
      finish.textContent = item.name;
      button.append(image, name, finish);
      button.onclick = () => {
        weapon = item.weapon;
        const owned = items.find((entry) => entry.weapon === weapon && entry.id === item.id);
        draft =
          !adding && owned
            ? { id: owned.id, wear: owned.wear, seed: owned.seed }
            : { ...skinChoices[weapon], id: item.id };
        overlay.dataset.inspect = "true";
        status.textContent = "";
        selection();
        detail();
      };
      grid.append(button);
    }
    if (!entries.length)
      grid.textContent = "No matching items. Use Add item to grow your collection.";
  }
  function refresh(rebuild = true) {
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
    if (adding) {
      const item = { weapon, ...draft };
      const existing = items.findIndex((other) => other.weapon === weapon && other.id === draft.id);
      if (existing >= 0) items[existing] = item;
      else items.push(item);
      try {
        localStorage.setItem("cs2go-local-inventory", JSON.stringify(items));
      } catch {
        status.textContent = "Added for this session. Browser storage is unavailable.";
        return;
      }
      adding = false;
      delete overlay.dataset.inspect;
      get("add-inventory-item").textContent = "＋ ADD ITEM";
      apply.textContent = "EQUIP FINISH";
      status.textContent = "Added to your inventory. Equip it when ready.";
      refresh();
      return;
    }
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
      if (overlay.dataset.inspect) delete overlay.dataset.inspect;
      else overlay.classList.add("hidden");
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
