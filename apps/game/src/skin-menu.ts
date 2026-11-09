import { appendInspectText, loadInspectText } from "./native-inspect-text";
import type { Game } from "./game";
import finishStyles from "./data/paint-finish-styles.json";
import { setupInventoryTooltip } from "./inventory-tooltip";
import { equippedKnives } from "./equipped-knives";
import { wearCondition } from "./cosmetic-wear";
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
export function setupSkinMenu(selectKnife: (index: number) => void, getGame: () => Game) {
  const overlay = document.createElement("div");
  overlay.id = "skin-menu";
  overlay.className = "overlay hidden inventory-page";
  overlay.innerHTML = `<section class="skin-dialog"><div class="dialog-heading inventory-actions"><div><div class="eyebrow">YOUR LOADOUT</div><h2>INVENTORY</h2><button id="add-inventory-item" type="button">＋ ADD ITEM</button></div></div><div class="inventory-toolbar"><label><img class="menu-control-icon" src="${assetUrl("/icons/menu/filter.svg")}" alt="Filter"> <select id="inventory-weapon"><option value="all">All equipment</option><option value="knives">Knives</option>${weapons.map((name, id) => `<option value="${id}">${name}</option>`).join("")}</select></label><span id="inventory-count"></span><label><img class="menu-control-icon" src="${assetUrl("/icons/menu/sort.svg")}" alt="Sort"> <select id="inventory-sort"><option value="name">Name</option><option value="weapon">Weapon</option></select></label></div><div class="skin-layout"><div class="skin-browser"><label class="skin-search" hidden><span class="visually-hidden">Search inventory</span><input id="skin-search" type="search" placeholder="Search inventory…" autocomplete="off"></label><div id="skin-grid" role="group" aria-label="Finishes"></div></div><form id="skin-form" class="skin-details" role="dialog" aria-modal="true" aria-labelledby="skin-title"><h3 id="skin-title">Default</h3><p id="weapon-inspect-collection"></p><div id="weapon-inspect-stage" tabindex="0" role="img" aria-label="3D weapon. Drag to rotate; scroll to zoom; arrow keys rotate; Home resets."><span id="weapon-inspect-loading" role="status"></span></div><div class="weapon-inspect-caption"><div class="eyebrow" id="skin-rarity">DEFAULT FINISH</div><div id="weapon-inspect-description" class="weapon-inspect-description"></div><p id="skin-status" role="status" aria-live="polite"></p></div><footer class="weapon-inspect-footer"><div class="weapon-inspect-info"><button id="weapon-inspect-info" type="button" aria-label="Item information" aria-describedby="weapon-inspect-certificate" aria-expanded="false"><img src="${assetUrl("/ui/inspect/info.svg")}" alt=""></button><div id="weapon-inspect-certificate" role="tooltip" hidden></div></div><div class="weapon-inspect-customizer"><button id="weapon-inspect-customize" type="button" aria-expanded="false" aria-controls="weapon-inspect-options" aria-label="Item actions" title="Item actions"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg></button><div id="weapon-inspect-options" hidden><div id="weapon-inspect-parameters"><label for="skin-wear">Wear <output id="skin-condition">Factory New</output></label><input id="skin-wear" type="range" min="0" max="1" step="0.000001"/><label class="skin-number">Wear rating<input id="skin-float" type="number" min="0" max="1" step="0.000001" required/></label><label class="skin-number">Pattern template<input id="skin-seed" type="number" min="0" max="1000" step="1" required/></label><button type="button" id="random-seed" class="secondary">RANDOMIZE PATTERN</button></div><button type="submit" class="deploy" id="apply-skin">APPLY FINISH</button><button type="button" id="equip-knife" class="secondary hidden">EQUIP KNIFE</button></div></div><button type="button" id="close-item-details" aria-label="Close item details">CLOSE</button></footer></form><div id="weapon-inspect-context" role="menu" aria-label="Item actions" hidden><button id="weapon-action-inspect" type="button" role="menuitem">Inspect</button><button id="weapon-action-customize" type="button" role="menuitem">Edit finish…</button><button id="weapon-action-equip" type="button" role="menuitem">Equip Finish</button></div></div></section>`;
  document.getElementById("app")!.append(overlay);
  const sections = document.createElement("nav");
  sections.className = "inventory-sections";
  sections.setAttribute("aria-label", "Inventory category");
  sections.innerHTML = `<button type="button" id="inventory-search" aria-label="Search inventory"><img src="${assetUrl("/icons/menu/search.svg")}" alt=""></button><button type="button" id="inventory-everything" aria-current="page">EVERYTHING</button><button type="button" id="inventory-agents">AGENTS</button><button type="button" id="inventory-gloves">GLOVES</button><button type="button" id="inventory-music-kits">MUSIC KITS</button>`;
  overlay.querySelector(".dialog-heading")!.after(sections);
  overlay.querySelector(".inventory-toolbar")!.append(overlay.querySelector(".dialog-heading")!);
  overlay.querySelector("#inventory-sort")!.closest("label")!.classList.add("inventory-sort");
  setupInventoryTooltip(overlay);
  for (const category of ["agents", "gloves"])
    sections.querySelector<HTMLButtonElement>(`#inventory-${category}`)!.onclick = () => {
      overlay.classList.add("hidden");
      document.dispatchEvent(new CustomEvent("cs2go-cosmetic-menu", { detail: category }));
    };
  const get = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
  const grid = get<HTMLDivElement>("skin-grid"),
    search = get<HTMLInputElement>("skin-search"),
    wear = get<HTMLInputElement>("skin-wear"),
    float = get<HTMLInputElement>("skin-float"),
    seed = get<HTMLInputElement>("skin-seed"),
    status = get<HTMLParagraphElement>("skin-status"),
    apply = get<HTMLButtonElement>("apply-skin");
  function prewarmInspection() {
    return import("./inspection-lighting").then(({ prepareInspectionLighting }) =>
      prepareInspectionLighting(getGame().renderer),
    );
  }
  function setSearch(open: boolean) {
    overlay.dataset.inventorySearch = String(open);
    search.closest<HTMLElement>(".skin-search")!.hidden = !open;
    for (const [id, active] of [
      ["inventory-search", open],
      ["inventory-everything", !open],
    ] as const) {
      if (active) get(id).setAttribute("aria-current", "page");
      else get(id).removeAttribute("aria-current");
    }
    if (open) search.focus();
    else {
      search.value = "";
      list();
    }
  }
  get("inventory-search").onclick = () => setSearch(true);
  get("inventory-everything").onclick = () => setSearch(false);
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
  const context = get("weapon-inspect-context");
  const options = get("weapon-inspect-options");
  const customize = get<HTMLButtonElement>("weapon-inspect-customize");
  const infoButton = get<HTMLButtonElement>("weapon-inspect-info");
  const certificate = get("weapon-inspect-certificate");
  const infoHost = infoButton.parentElement!;
  let infoPinned = false;
  function closeInfo() {
    infoPinned = false;
    certificate.hidden = true;
    infoButton.setAttribute("aria-expanded", "false");
  }
  function showInfo() {
    if (infoButton.hidden) return;
    certificate.hidden = false;
    infoButton.setAttribute("aria-expanded", "true");
  }
  infoHost.onpointerenter = showInfo;
  infoHost.onpointerleave = () => {
    if (!infoPinned) closeInfo();
  };
  infoButton.onfocus = showInfo;
  infoHost.addEventListener("focusout", (event) => {
    if (!infoHost.contains(event.relatedTarget as Node | null) && !infoPinned) closeInfo();
  });
  infoButton.onclick = () => {
    infoPinned = !infoPinned;
    if (infoPinned) showInfo();
    else closeInfo();
  };
  function certificateFields() {
    const skin = catalog.find((entry) => entry.id === draft.id && entry.weapon === weapon);
    infoButton.hidden = !skin;
    certificate.replaceChildren();
    if (!skin) {
      closeInfo();
      return;
    }
    const styles = finishStyles.styles as Record<string, number>;
    const labels = finishStyles.labels as Record<string, string>;
    const rows = [
      ["Finish Style", labels[String(styles[String(skin.paint)])] ?? labels.Unknown],
      ["Finish Catalog", String(skin.paint)],
      ["Pattern Template", String(draft.seed)],
      ["Wear Rating", Math.fround(draft.wear).toFixed(9)],
      ["Exterior", wearCondition(draft.wear)],
    ];
    for (const [label, value] of rows) {
      const row = document.createElement("p");
      const title = document.createElement("b");
      title.textContent = `${label}: `;
      row.append(title, value);
      certificate.append(row);
    }
  }
  let textGeneration = 0;
  const title = get("skin-title");
  let titleWidth = 0;
  let titleHostHeight = 0;
  let titleText = "";
  function fitTitle() {
    if (!overlay.dataset.inspect || overlay.classList.contains("hidden")) return;
    const width = title.clientWidth;
    if (
      !width ||
      (width === titleWidth &&
        overlay.clientHeight === titleHostHeight &&
        title.textContent === titleText)
    )
      return;
    titleWidth = width;
    titleHostHeight = overlay.clientHeight;
    titleText = title.textContent ?? "";
    title.style.fontSize = "calc(50 * var(--menu-unit))";
    const preferred = Number.parseFloat(getComputedStyle(title).fontSize);
    if (title.scrollWidth > width)
      title.style.fontSize = `${Math.max(preferred * 0.4, (preferred * width) / title.scrollWidth)}px`;
  }
  const titleResize = new ResizeObserver(fitTitle);
  titleResize.observe(title);
  titleResize.observe(overlay);
  async function updateDescription() {
    if (!overlay.dataset.inspect) return;
    const version = ++textGeneration;
    const selectedWeapon = weapon;
    const selectedFinish = draft.id;
    get("weapon-inspect-description").replaceChildren();
    get("weapon-inspect-collection").textContent = "";
    try {
      const text = await loadInspectText();
      if (
        version !== textGeneration ||
        !overlay.dataset.inspect ||
        overlay.classList.contains("hidden")
      )
        return;
      const skin = catalog.find(
        (entry) => entry.id === selectedFinish && entry.weapon === selectedWeapon,
      );
      const collection = text.finishCollections[selectedFinish];
      get("weapon-inspect-collection").textContent =
        collection === undefined ? "" : text.collections[collection];
      const weaponDescription = text.weapons[selectedWeapon];
      if (weaponDescription)
        appendInspectText(get("weapon-inspect-description"), weaponDescription);
      const paintDescription = skin ? text.paints[String(skin.paint)] : "";
      if (paintDescription) appendInspectText(get("weapon-inspect-description"), paintDescription);
    } catch {
      // A missing optional description never prevents inspecting or equipping.
    }
  }
  let previewLoad: Promise<void> | undefined;
  let previewGeneration = 0;
  let inspectionIntent = 0;
  function ensurePreview() {
    return (previewLoad ??= import("./weapon-inspect-preview")
      .then(({ WeaponInspectPreview }) => {
        getGame().weaponInspectPreview = new WeaponInspectPreview(get("weapon-inspect-stage"));
      })
      .catch((error: unknown) => {
        previewLoad = undefined;
        throw error;
      }));
  }
  const closeOptions = () => {
    options.hidden = true;
    customize.setAttribute("aria-expanded", "false");
  };
  function closeInspect() {
    inspectionIntent++;
    previewGeneration++;
    textGeneration++;
    delete overlay.dataset.inspect;
    closeOptions();
    closeInfo();
    getGame().weaponInspectPreview?.hide();
    grid
      .querySelector<HTMLButtonElement>(`[data-item-weapon="${weapon}"][data-skin="${draft.id}"]`)
      ?.focus();
  }
  async function updatePreview() {
    if (!overlay.dataset.inspect || overlay.classList.contains("hidden")) return;
    const version = ++previewGeneration;
    certificateFields();
    get("weapon-inspect-loading").textContent = "Loading item…";
    try {
      await ensurePreview();
      if (
        version !== previewGeneration ||
        !overlay.dataset.inspect ||
        overlay.classList.contains("hidden")
      )
        return;
      await getGame().weaponInspectPreview!.show(weapon, { ...draft });
      if (version === previewGeneration) get("weapon-inspect-loading").textContent = "";
    } catch {
      if (version === previewGeneration)
        get("weapon-inspect-loading").textContent =
          "This item could not load. Close and inspect again to retry.";
    }
  }
  async function inspectSelected(edit = false) {
    const intent = ++inspectionIntent;
    const selectedWeapon = weapon;
    const selectedFinish = draft.id;
    const selectedChoice = { ...draft };
    context.hidden = true;
    status.textContent = "Preparing inspection…";
    try {
      await Promise.all([prewarmInspection(), ensurePreview()]);
      await getGame().weaponInspectPreview!.prepare(
        getGame().renderer,
        selectedWeapon,
        selectedChoice,
      );
    } catch {
      status.textContent = "Inspection could not load. Please try again.";
      return;
    }
    if (
      intent !== inspectionIntent ||
      overlay.classList.contains("hidden") ||
      weapon !== selectedWeapon ||
      draft.id !== selectedFinish
    )
      return;
    context.hidden = true;
    overlay.dataset.inspect = "true";
    status.textContent = "";
    closeOptions();
    if (edit) {
      options.hidden = false;
      customize.setAttribute("aria-expanded", "true");
    }
    detail();
    get("weapon-inspect-stage").focus();
  }
  get("close-item-details").onclick = closeInspect;
  customize.onclick = () => {
    const opening = options.hidden;
    closeOptions();
    options.hidden = !opening;
    customize.setAttribute("aria-expanded", String(opening));
  };
  get("weapon-action-inspect").onclick = () => {
    void inspectSelected();
  };
  get("weapon-action-customize").onclick = () => {
    void inspectSelected(true);
  };
  get("weapon-action-equip").onclick = () => {
    context.hidden = true;
    get<HTMLFormElement>("skin-form").requestSubmit();
  };
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node;
    if (!context.contains(target)) context.hidden = true;
    if (!customize.parentElement!.contains(target)) closeOptions();
    if (!infoHost.contains(target)) closeInfo();
  });
  new MutationObserver(() => {
    if (
      !overlay.dataset.inspect ||
      overlay.classList.contains("hidden") ||
      overlay.dataset.musicKits
    ) {
      ++inspectionIntent;
      ++previewGeneration;
      getGame().weaponInspectPreview?.hide();
      closeInfo();
      context.hidden = true;
      closeOptions();
    }
  }).observe(overlay, {
    attributes: true,
    attributeFilter: ["class", "data-inspect", "data-music-kits"],
  });
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
  get("add-inventory-item").onclick = async () => {
    if (busy) return;
    adding = !adding;
    delete overlay.dataset.inspect;
    get("add-inventory-item").textContent = adding ? "BACK TO INVENTORY" : "＋ ADD ITEM";
    apply.textContent = adding ? "ADD TO INVENTORY" : "EQUIP FINISH";
    status.textContent = "";
    if (adding) {
      status.textContent = "Loading finishes...";
      try {
        await loadCatalog();
        status.textContent = "";
      } catch {
        status.textContent = "Skin catalog could not load. Try again.";
      }
    }
    refresh();
  };
  function detail() {
    get("equip-knife").classList.toggle("hidden", !isKnife(weapon));
    const skin = catalog.find((s) => s.id === draft.id && s.weapon === weapon);
    get("skin-title").textContent = weapons[weapon] + (skin ? ` | ${skin.name}` : "");
    get("skin-rarity").textContent = skin?.rarity ?? "Default finish";
    get("weapon-inspect-parameters").hidden = !skin;
    get("skin-title").style.setProperty(
      "--item-rarity",
      draft.id ? skinRarityColor(draft.id) || "#b9bdc0" : "#b9bdc0",
    );
    get("skin-form").style.setProperty(
      "--item-rarity",
      draft.id ? skinRarityColor(draft.id) || "#b9bdc0" : "#b9bdc0",
    );
    fitTitle();
    void updateDescription();
    certificateFields();
    void updatePreview();
    wear.value = float.value = String(draft.wear);
    seed.value = String(draft.seed);
    get("skin-condition").textContent = wearCondition(draft.wear);
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
    context.hidden = true;
    grid.replaceChildren();
    const matches = (id: number) =>
      filter === "all" || (filter === "knives" ? isKnife(id) : id === Number(filter));
    const entries = [
      ...definitions.flatMap((_, id) =>
        matches(id) &&
        (adding ||
          !isKnife(id) ||
          id === 37 ||
          id === 38 ||
          Object.values(equippedKnives).includes(id) ||
          items.some((item) => item.weapon === id))
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
      const tooltipChoice =
        items.find((entry) => entry.weapon === item.weapon && entry.id === item.id) ??
        (skinChoices[item.weapon].id === item.id ? skinChoices[item.weapon] : undefined);
      if (tooltipChoice) button.dataset.wear = String(tooltipChoice.wear);
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
      const art = document.createElement("div");
      art.className = "inventory-item-art";
      art.append(image);
      const name = document.createElement("b");
      name.textContent = weapons[item.weapon];
      const finish = document.createElement("span");
      finish.textContent = item.name;
      button.append(art, name, finish);
      const choose = (event?: MouseEvent) => {
        inspectionIntent++;
        weapon = item.weapon;
        const owned = items.find((entry) => entry.weapon === weapon && entry.id === item.id);
        draft =
          !adding && owned
            ? { id: owned.id, wear: owned.wear, seed: owned.seed }
            : { ...skinChoices[weapon], id: item.id };
        status.textContent = "";
        selection();
        detail();
        context.hidden = false;
        get("weapon-action-equip").textContent = adding ? "Add to Inventory" : "Equip Finish";
        const rect = overlay.getBoundingClientRect();
        const card = button.getBoundingClientRect();
        const sx = rect.width / overlay.clientWidth;
        const sy = rect.height / overlay.clientHeight;
        context.style.left = `${Math.max(0, Math.min((event?.clientX ?? card.left) - rect.left, rect.width - context.offsetWidth * sx)) / sx}px`;
        context.style.top = `${Math.max(0, Math.min((event?.clientY ?? card.bottom) - rect.top, rect.height - context.offsetHeight * sy)) / sy}px`;
        get("weapon-action-inspect").focus();
      };
      button.setAttribute("aria-haspopup", "menu");
      button.onclick = (event) => choose(event.detail ? event : undefined);
      button.oncontextmenu = (event) => {
        event.preventDefault();
        choose(event);
      };
      grid.append(button);
    }
    if (!entries.length)
      grid.textContent = "No matching items. Use Add item to grow your collection.";
    document.dispatchEvent(
      new CustomEvent("cs2go-inventory-render", { detail: { adding, filter } }),
    );
  }
  function refresh(rebuild = true) {
    if (rebuild) list();
    else selection();
    detail();
  }
  wear.oninput = () => {
    draft.wear = Number(wear.value);
    float.value = wear.value;
    get("skin-condition").textContent = wearCondition(draft.wear);
    status.textContent = "";
    void updatePreview();
  };
  float.oninput = () => {
    if (float.validity.valid) {
      draft.wear = Number(float.value);
      wear.value = float.value;
      get("skin-condition").textContent = wearCondition(draft.wear);
    }
    status.textContent = "";
    void updatePreview();
  };
  seed.oninput = () => {
    if (seed.validity.valid) draft.seed = Number(seed.value);
    status.textContent = "";
    void updatePreview();
  };
  get("random-seed").onclick = () => {
    draft.seed = Math.floor(Math.random() * 1001);
    seed.value = String(draft.seed);
    status.textContent = "";
    void updatePreview();
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
    status.textContent = "Preparing your finish...";
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
  overlay.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      event.stopPropagation();
      if (!certificate.hidden) closeInfo();
      else if (!context.hidden) context.hidden = true;
      else if (!options.hidden) closeOptions();
      else if (overlay.dataset.inspect) closeInspect();
      else if (overlay.dataset.inventorySearch === "true") setSearch(false);
      else overlay.classList.add("hidden");
    }
  });
  async function loadCatalog() {
    catalog = (await skinCatalog()).flatMap((skin) => {
      const family = /^(Gamma Doppler|Doppler) \| (.+)$/.exec(skin.name);
      if (!family) return [skin];
      return family[2] === "Phase 1" ? [{ ...skin, name: family[1] }] : [];
    });
  }
  for (const id of ["skins-button", "pause-skins"])
    get(id).onclick = async () => {
      overlay.classList.remove("hidden");
      void prewarmInspection().catch(() => {});
      status.textContent = "Loading finishes...";
      try {
        if (adding || items.some((item) => item.id)) await loadCatalog();
        draft = { ...skinChoices[weapon] };
        status.textContent = "";
        setSearch(false);
        refresh();
      } catch {
        status.textContent = "Skin catalog could not load. Close and reopen to retry.";
      }
    };
}
