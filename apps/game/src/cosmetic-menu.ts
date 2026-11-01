import type { Game } from "./game";
import type { AgentTeam } from "./soldier";
import { assetUrl } from "./asset-url";
import {
  acquireAgentAppearance,
  defaultAgent,
  loadAgentCatalog,
  selectedAgentId,
  setSelectedAgent,
  type AgentDefinition,
} from "./agent-roster";
import { loadAgentAnimations, type AgentAnimationDefinition } from "./agent-animations";
import {
  gloveChoices,
  loadGloveCatalog,
  setGloves,
  type GloveChoice,
  type GloveDefinition,
} from "./gloves";
import "./cosmetic-menu.css";

type Category = "agents" | "gloves";
type AgentCard = AgentDefinition & { image?: string };
const teamName = (team: AgentTeam) => (team === "ct" ? "Counter-Terrorists" : "Terrorists");
const condition = (wear: number) =>
  wear < 0.07
    ? "Factory New"
    : wear < 0.15
      ? "Minimal Wear"
      : wear < 0.38
        ? "Field-Tested"
        : wear < 0.45
          ? "Well-Worn"
          : "Battle-Scarred";
const groups: Record<string, string> = {
  base: "Movement and poses",
  weapon: "Weapon actions",
  taunt: "Taunts",
  additive: "Additional poses",
};
const animationName = (name: string) =>
  name
    .replace(/(?:\.vnmclip)?\+non_additive$/, "")
    .replace(/_/g, " ")
    .replace(/\bbuymenu\b/g, "buy menu")
    .replace(/\s+/g, " ")
    .trim();

/** Optional cosmetics stay out of startup; inventory opens their local catalogs on demand. */
export function setupCosmeticMenu(game: Game) {
  const overlay = document.createElement("div");
  overlay.id = "cosmetic-menu";
  overlay.className = "overlay hidden";
  overlay.innerHTML = `<section class="cosmetic-dialog" role="dialog" aria-modal="true" aria-labelledby="cosmetic-title">
    <header><div><div class="eyebrow">YOUR LOADOUT</div><h2 id="cosmetic-title">AGENTS</h2></div><button id="close-cosmetics" class="close" aria-label="Close inventory">×</button></header>
    <nav class="inventory-sections" aria-label="Inventory category"><button type="button" id="cosmetic-weapons">WEAPONS</button><button type="button" data-cosmetic-category="agents">AGENTS</button><button type="button" data-cosmetic-category="gloves">GLOVES</button></nav>
    <aside class="cosmetic-browser"><label>Team<select id="cosmetic-team"><option value="ct">Counter-Terrorists</option><option value="t">Terrorists</option></select></label><label>Find an item<input id="cosmetic-search" type="search" placeholder="Search inventory…" autocomplete="off"></label><div id="cosmetic-items" class="cosmetic-items" role="group" aria-label="Available cosmetics"></div></aside>
    <div class="cosmetic-preview"><img id="cosmetic-preview-image" alt="" hidden><p id="cosmetic-preview-caption"></p></div>
    <aside class="cosmetic-details"><div class="eyebrow" id="cosmetic-team-name"></div><h3 id="cosmetic-item-name"></h3>
      <div id="glove-details"><label for="glove-wear">Wear <output id="glove-condition">Factory New</output></label><input id="glove-wear" type="range" min="0" max="1" step="0.000001"><label>Wear float<input id="glove-float" type="number" min="0" max="1" step="0.000001" required></label><label>Pattern seed<input id="glove-seed" type="number" min="0" max="1000" step="1" required></label><button id="glove-random-seed" type="button">RANDOMIZE SEED</button><p>Catalog preview. Your wear and pattern appear on the equipped gloves.</p></div>
      <div class="cosmetic-equip-actions"><button id="equip-cosmetic" class="deploy" type="button">EQUIP AGENT</button><button id="reset-cosmetic" type="button">RESTORE DEFAULT AGENT</button></div>
      <div id="agent-animation-controls" class="cosmetic-animation-controls"><label>Find an animation<input id="agent-animation-search" type="search" placeholder="Search animations…" autocomplete="off"></label><label>Category<select id="agent-animation-group"><option value="">All animations</option><option value="base">Movement and poses</option><option value="weapon">Weapon actions</option><option value="taunt">Taunts</option><option value="additive">Additional poses</option></select></label><label>Animation<select id="agent-animation" size="7"></select></label><p id="agent-animation-count"></p><div class="cosmetic-animation-actions"><button id="play-agent-animation" type="button">PLAY ANIMATION</button><button id="stop-agent-animation" type="button">RESTORE IDLE</button></div><p id="agent-animation-hint">Preview animations in the main menu.</p></div>
    </aside><footer id="cosmetic-status" role="status" aria-live="polite"></footer>
  </section>`;
  document.body.append(overlay);
  const get = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
  const teamSelect = get<HTMLSelectElement>("cosmetic-team"),
    search = get<HTMLInputElement>("cosmetic-search"),
    items = get<HTMLDivElement>("cosmetic-items"),
    status = get("cosmetic-status"),
    wear = get<HTMLInputElement>("glove-wear"),
    float = get<HTMLInputElement>("glove-float"),
    seed = get<HTMLInputElement>("glove-seed"),
    animationSearch = get<HTMLInputElement>("agent-animation-search"),
    animationGroup = get<HTMLSelectElement>("agent-animation-group"),
    animationSelect = get<HTMLSelectElement>("agent-animation");
  let category: Category = "agents",
    team: AgentTeam = game.team,
    agents: AgentCard[] = [],
    gloves: GloveDefinition[] = [],
    animations: AgentAnimationDefinition[] = [],
    draftAgent = selectedAgentId(team),
    draftGloves: GloveChoice = { ...gloveChoices[team] },
    busy = false,
    loading = false,
    generation = 0,
    returnFocus: HTMLElement | null = null;

  const message = (error: unknown) =>
    error instanceof Error ? error.message : "This item could not load. Please try again.";
  function close() {
    generation++;
    overlay.classList.add("hidden");
    if (!game.active) game.homeScene.stopAnimation(team);
    if (returnFocus?.getClientRects().length) returnFocus.focus();
    else document.getElementById(game.active ? "pause-skins" : "skins-button")?.focus();
  }
  function availableAgents() {
    const seen = new Set<string>();
    return agents.filter((agent) => {
      if (agent.team !== team) return false;
      const key = agent.model || agent.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function detail() {
    const agent =
      agents.find((agent) => agent.id === draftAgent && agent.team === team) ?? defaultAgent(team);
    const glove = gloves.find((glove) => glove.id === draftGloves.id);
    get("cosmetic-item-name").textContent =
      category === "agents" ? agent.name : (glove?.name ?? "Default gloves");
    get("cosmetic-team-name").textContent = teamName(team);
    get("glove-details").hidden = category !== "gloves";
    get("agent-animation-controls").hidden = category !== "agents";
    get("equip-cosmetic").textContent = category === "agents" ? "EQUIP AGENT" : "EQUIP GLOVES";
    get("reset-cosmetic").textContent =
      category === "agents" ? "RESTORE DEFAULT AGENT" : "RESTORE DEFAULT GLOVES";
    const image = get<HTMLImageElement>("cosmetic-preview-image");
    image.hidden = category !== "gloves" || !glove?.image;
    if (glove?.image && category === "gloves") {
      image.src = assetUrl(glove.image);
      image.alt = glove.name;
    } else image.removeAttribute("src");
    get("cosmetic-preview-caption").textContent =
      category === "gloves"
        ? "Equipped gloves appear on your hands in game."
        : game.active
          ? "Agent selection applies to future spawns."
          : draftAgent === selectedAgentId(team)
            ? agent.name
            : "Equip an agent to see it in the main menu.";
    wear.value = float.value = String(draftGloves.wear);
    seed.value = String(draftGloves.seed);
    get("glove-condition").textContent = condition(draftGloves.wear);
    for (const element of [wear, float, seed, get<HTMLButtonElement>("glove-random-seed")])
      element.disabled = busy || loading || !glove;
    get<HTMLButtonElement>("equip-cosmetic").disabled = busy || loading;
    get<HTMLButtonElement>("reset-cosmetic").disabled = busy || loading;
    teamSelect.disabled = busy || loading;
    overlay.querySelectorAll<HTMLButtonElement>("[data-cosmetic-category]").forEach((button) => {
      button.disabled = busy;
      if (button.dataset.cosmeticCategory === category) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    get<HTMLButtonElement>("cosmetic-weapons").disabled = busy;
    items.querySelectorAll<HTMLButtonElement>("[data-cosmetic-item]").forEach((button) => {
      button.disabled = busy;
      button.setAttribute(
        "aria-pressed",
        String(
          button.dataset.cosmeticItem === (category === "agents" ? draftAgent : draftGloves.id),
        ),
      );
    });
    for (const element of [
      animationSearch,
      animationGroup,
      animationSelect,
      get<HTMLButtonElement>("play-agent-animation"),
      get<HTMLButtonElement>("stop-agent-animation"),
    ])
      element.disabled = busy || loading || game.active;
    if (!animationSelect.value) get<HTMLButtonElement>("play-agent-animation").disabled = true;
    const needsEquip = draftAgent !== selectedAgentId(team);
    const legacyAgent = selectedAgentId(team) === "default-ct";
    if (needsEquip || legacyAgent) get<HTMLButtonElement>("play-agent-animation").disabled = true;
    get("agent-animation-hint").textContent = game.active
      ? "Animation previews are available from the main menu."
      : legacyAgent
        ? "Equip a CS2 agent to preview these animations."
        : needsEquip
          ? "Equip this agent to preview its animations."
          : "Animations preview here only. Match movement stays under your control.";
  }
  function list() {
    const query = search.value.toLocaleLowerCase().trim();
    const entries =
      category === "agents"
        ? availableAgents()
        : [{ id: "", name: "Default gloves", image: "" }, ...gloves];
    items.replaceChildren();
    for (const entry of entries.filter((entry) => entry.name.toLocaleLowerCase().includes(query))) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.cosmeticItem = entry.id;
      if (entry.image) {
        const image = document.createElement("img");
        image.loading = "lazy";
        image.decoding = "async";
        image.src = assetUrl(entry.image);
        image.alt = "";
        button.append(image);
      }
      const label = document.createElement("span");
      label.textContent = entry.name;
      button.append(label);
      button.onclick = () => {
        if (category === "agents") draftAgent = entry.id;
        else draftGloves.id = entry.id;
        status.textContent = "";
        detail();
      };
      items.append(button);
    }
    if (!items.childElementCount) items.textContent = "No matching items.";
    detail();
  }
  function listAnimations() {
    const selected = animationSelect.value || game.homeScene.selectedAnimation(team);
    const terms = animationSearch.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const eligible = animations.filter((animation) => !animation.team || animation.team === team);
    const filtered = eligible.filter(
      (animation) =>
        (!animationGroup.value || animation.group === animationGroup.value) &&
        terms.every((term) =>
          `${animation.name} ${animationName(animation.name)} ${animation.group} ${animation.source} ${animation.token ?? ""}`
            .toLocaleLowerCase()
            .includes(term),
        ),
    );
    animationSelect.replaceChildren();
    for (const group of ["base", "weapon", "taunt", "additive"]) {
      const entries = filtered.filter((animation) => animation.group === group);
      if (!entries.length) continue;
      const optionGroup = document.createElement("optgroup");
      optionGroup.label = groups[group];
      for (const animation of entries) {
        const option = new Option(
          `${animationName(animation.name)} · ${animation.duration < 0.1 ? "Pose" : `${animation.duration.toFixed(1)}s`}`,
          animation.id,
        );
        optionGroup.append(option);
      }
      animationSelect.append(optionGroup);
    }
    if (selected && filtered.some((animation) => animation.id === selected))
      animationSelect.value = selected;
    else if (animationSelect.options.length) animationSelect.selectedIndex = 0;
    get("agent-animation-count").textContent =
      `${filtered.length} of ${eligible.length} animations`;
    detail();
  }
  async function open(next: Category) {
    const current = ++generation;
    if (overlay.classList.contains("hidden")) returnFocus = document.activeElement as HTMLElement;
    category = next;
    team = game.team;
    teamSelect.value = team;
    draftAgent = selectedAgentId(team);
    draftGloves = { ...gloveChoices[team] };
    search.value = "";
    get("skin-menu")?.classList.add("hidden");
    overlay.classList.remove("hidden");
    get("cosmetic-title").textContent = category.toUpperCase();
    status.textContent = "Loading inventory…";
    items.replaceChildren();
    loading = true;
    detail();
    get("close-cosmetics").focus();
    try {
      if (category === "agents") {
        const [catalog, clips] = await Promise.all([loadAgentCatalog(), loadAgentAnimations()]);
        if (current !== generation) return;
        agents = catalog;
        animations = clips;
        listAnimations();
      } else {
        const catalog = await loadGloveCatalog();
        if (current !== generation) return;
        gloves = catalog;
      }
      list();
      status.textContent = "";
      search.focus();
    } catch (error) {
      if (current === generation)
        status.textContent = `${message(error)} Close and reopen to retry.`;
    } finally {
      if (current === generation) {
        loading = false;
        detail();
      }
    }
  }
  async function equip(reset = false) {
    if (busy) return;
    if (
      !reset &&
      category === "gloves" &&
      draftGloves.id &&
      (!float.reportValidity() || !seed.reportValidity())
    )
      return;
    const selectedTeam = team,
      selectedCategory = category,
      current = generation;
    const agentId = reset ? defaultAgent(selectedTeam).id : draftAgent;
    const gloveChoice = reset ? { id: "", wear: 0.01, seed: 1 } : { ...draftGloves };
    busy = true;
    status.textContent = "Preparing your selection…";
    detail();
    try {
      if (selectedCategory === "agents") {
        const appearance = await acquireAgentAppearance(agentId);
        try {
          if (current !== generation) return;
          setSelectedAgent(selectedTeam, agentId);
          if (current === generation) draftAgent = selectedAgentId(selectedTeam);
          if (!game.active) {
            game.homeScene.stopAnimation(selectedTeam);
            game.setTeam(selectedTeam);
            const settingsTeam = document.getElementById("agent-team") as HTMLSelectElement | null;
            if (settingsTeam) settingsTeam.value = selectedTeam;
          }
        } finally {
          appearance?.release();
        }
        const agent =
          agents.find((agent) => agent.id === selectedAgentId(selectedTeam)) ??
          defaultAgent(selectedTeam);
        if (current === generation)
          status.textContent = `${agent.name} equipped for ${teamName(selectedTeam)}.${game.active ? " Applies to future spawns." : ""}`;
      } else {
        await setGloves(selectedTeam, gloveChoice);
        if (current === generation) {
          draftGloves = { ...gloveChoices[selectedTeam] };
          status.textContent = `${gloves.find((glove) => glove.id === draftGloves.id)?.name ?? "Default gloves"} equipped for ${teamName(selectedTeam)}.`;
        }
      }
    } catch (error) {
      if (current === generation) status.textContent = message(error);
    } finally {
      busy = false;
      detail();
    }
  }
  get("equip-cosmetic").onclick = () => {
    void equip();
  };
  get("reset-cosmetic").onclick = () => {
    void equip(true);
  };
  get("close-cosmetics").onclick = close;
  get("cosmetic-weapons").onclick = () => {
    close();
    get("skin-menu").classList.remove("hidden");
  };
  overlay.querySelectorAll<HTMLButtonElement>("[data-cosmetic-category]").forEach((button) => {
    button.onclick = () => {
      void open(button.dataset.cosmeticCategory as Category);
    };
  });
  teamSelect.onchange = () => {
    if (!game.active) game.homeScene.stopAnimation(team);
    team = teamSelect.value as AgentTeam;
    if (!game.active) game.setTeam(team);
    draftAgent = selectedAgentId(team);
    draftGloves = { ...gloveChoices[team] };
    status.textContent = "";
    list();
    listAnimations();
  };
  search.oninput = list;
  animationSearch.oninput = listAnimations;
  animationGroup.onchange = listAnimations;
  animationSelect.onchange = detail;
  wear.oninput = () => {
    draftGloves.wear = Number(wear.value);
    float.value = wear.value;
    get("glove-condition").textContent = condition(draftGloves.wear);
    status.textContent = "";
  };
  float.oninput = () => {
    if (float.validity.valid) {
      draftGloves.wear = Number(float.value);
      wear.value = float.value;
      get("glove-condition").textContent = condition(draftGloves.wear);
    }
    status.textContent = "";
  };
  seed.oninput = () => {
    if (seed.validity.valid) draftGloves.seed = Number(seed.value);
    status.textContent = "";
  };
  get("glove-random-seed").onclick = () => {
    draftGloves.seed = Math.floor(Math.random() * 1001);
    seed.value = String(draftGloves.seed);
    status.textContent = "";
  };
  get("play-agent-animation").onclick = async () => {
    if (busy || game.active || !animationSelect.value) return;
    busy = true;
    detail();
    status.textContent = "Loading animation…";
    try {
      await game.homeScene.playAnimation(team, animationSelect.value);
      status.textContent = `Playing ${animationName(animations.find((animation) => animation.id === animationSelect.value)?.name ?? "animation")}.`;
    } catch (error) {
      status.textContent = message(error);
    } finally {
      busy = false;
      detail();
    }
  };
  get("stop-agent-animation").onclick = () => {
    if (!game.active) game.homeScene.stopAnimation(team);
    status.textContent = "Default idle restored.";
  };
  document.addEventListener(
    "keydown",
    (event) => {
      if (overlay.classList.contains("hidden")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if (event.key === "Tab") {
        event.stopPropagation();
        const controls = [
          ...overlay.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
          ),
        ].filter((element) => element.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (!overlay.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    },
    true,
  );
  document.addEventListener("cs2go-cosmetic-menu", (event) => {
    const next = (event as CustomEvent<unknown>).detail;
    if (next === "agents" || next === "gloves") void open(next);
  });
  return { open, close };
}
