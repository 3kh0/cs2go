import { assetUrl } from "./asset-url";
import type { Game } from "./game";
import {
  defaultMusicKitId,
  loadMusicKits,
  musicEventLabels,
  musicEventDescriptions,
  type MusicKit,
} from "./music-kits";
import "./music-kit-menu.css";

/** Music is an optional inventory category, with one streamed preview at a time. */
export function setupMusicKitMenu(game: Game, closeCosmetics: () => void) {
  const overlay = document.getElementById("skin-menu")!;
  const dialog = document.createElement("section");
  dialog.className = "music-kit-dialog";
  dialog.setAttribute("aria-label", "Music kits");
  dialog.innerHTML = `<nav class="inventory-sections" aria-label="Inventory category">
    <button id="music-kit-weapons" type="button">EVERYTHING</button>
    <button id="music-kit-agents" type="button">AGENTS</button>
    <button id="music-kit-gloves" type="button">GLOVES</button>
    <button type="button" aria-current="page">MUSIC KITS</button>
    <button id="close-music-kits" class="close" type="button" aria-label="Close music kits">×</button>
  </nav>
  <div class="music-kit-content"><section class="music-kit-browser">
    <label class="music-kit-search">Find a music kit<input id="music-kit-search" type="search" placeholder="Search music kits…" autocomplete="off"></label>
    <div id="music-kit-items" role="group" aria-label="Available music kits"></div>
  </section><section class="music-kit-detail" aria-label="Selected music kit">
    <img id="music-kit-art" alt="" hidden><h2 id="music-kit-name"></h2><p id="music-kit-artist"></p>
    <p id="music-kit-description"></p><div class="music-kit-actions"><button id="equip-music-kit" type="button" disabled>EQUIP MUSIC KIT</button><button id="stop-music-kit" type="button" disabled>STOP PREVIEW</button></div>
    <div id="music-kit-tracks" role="group" aria-label="Music events and tracks"></div>
  </section></div><footer id="music-kit-status" role="status" aria-live="polite"></footer>`;
  overlay.append(dialog);
  const get = <E extends HTMLElement>(id: string) => dialog.querySelector<E>(`#${id}`)!;
  const player = game.soundscape.musicKits;
  const items = get("music-kit-items");
  const tracks = get("music-kit-tracks");
  const search = get<HTMLInputElement>("music-kit-search");
  const status = get("music-kit-status");
  const equip = get<HTMLButtonElement>("equip-music-kit");
  const stop = get<HTMLButtonElement>("stop-music-kit");
  let kits: MusicKit[] = [];
  let defaultId = "";
  let selected: MusicKit | undefined;
  let loading: Promise<void> | undefined;
  const equippedId = () => (player.kitId === defaultMusicKitId ? defaultId : player.kitId);
  const isOpen = () =>
    overlay.dataset.musicKits === "true" && !overlay.classList.contains("hidden");

  function state() {
    equip.disabled = !selected || selected.id === equippedId();
    equip.textContent = selected?.id === equippedId() ? "EQUIPPED" : "EQUIP MUSIC KIT";
    stop.disabled = !player.previewing;
    for (const card of items.querySelectorAll<HTMLButtonElement>("[data-music-kit]"))
      card.dataset.equipped = String(card.dataset.musicKit === equippedId());
    for (const button of tracks.querySelectorAll<HTMLButtonElement>("[data-music-event]")) {
      const playing = player.previewing;
      button.setAttribute(
        "aria-pressed",
        String(
          !!playing &&
            playing.kitId === selected?.id &&
            playing.event === button.dataset.musicEvent &&
            playing.track === Number(button.dataset.musicTrack),
        ),
      );
    }
  }
  function detail(kit: MusicKit) {
    selected = kit;
    get("music-kit-name").textContent = kit.name;
    get("music-kit-artist").textContent = kit.artist ?? "";
    get("music-kit-description").textContent = (kit.description ?? "")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/?(?:i|b|font)(?:\s[^>]*)?>/gi, "");
    const image = get<HTMLImageElement>("music-kit-art");
    image.src = assetUrl(kit.image);
    image.hidden = false;
    tracks.replaceChildren();
    const events = { ...kit.events };
    if (kit.extraTracks?.length) events.extra = { tracks: kit.extraTracks };
    for (const [event, cue] of Object.entries(events)) {
      if (!cue.tracks.length) continue;
      const group = document.createElement("section");
      const title = document.createElement("h3");
      title.textContent = musicEventLabels[event] ?? event.replaceAll("_", " ");
      group.append(title);
      const description = document.createElement("p");
      description.className = "music-event-description";
      description.textContent = musicEventDescriptions[event] ?? "";
      group.append(description);
      cue.tracks.forEach((_, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.musicEvent = event;
        button.dataset.musicTrack = String(index);
        button.textContent = `▶ ${title.textContent}${cue.tracks.length > 1 ? ` · ${index + 1}` : ""}`;
        button.onclick = () => {
          game.ensureAudio();
          player.preview(kit, event, index);
          status.textContent = `Previewing ${title.textContent}${cue.tracks.length > 1 ? `, variant ${index + 1}` : ""}.`;
        };
        group.append(button);
      });
      tracks.append(group);
    }
    for (const card of items.querySelectorAll<HTMLButtonElement>("[data-music-kit]"))
      card.setAttribute("aria-pressed", String(card.dataset.musicKit === kit.id));
    state();
  }
  function list() {
    const query = search.value.trim().toLocaleLowerCase();
    items.replaceChildren();
    for (const kit of kits) {
      if (!`${kit.name} ${kit.artist ?? ""}`.toLocaleLowerCase().includes(query)) continue;
      const card = document.createElement("button");
      card.type = "button";
      card.dataset.musicKit = kit.id;
      card.setAttribute("aria-label", kit.name);
      card.setAttribute("aria-pressed", String(selected?.id === kit.id));
      const image = document.createElement("img");
      image.src = assetUrl(kit.image);
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      const name = document.createElement("b");
      name.textContent = kit.name;
      const artist = document.createElement("span");
      artist.textContent = kit.artist ?? "";
      card.append(image, name, artist);
      card.onclick = () => {
        player.stopPreview();
        status.textContent = "";
        detail(kit);
      };
      items.append(card);
    }
    if (!items.childElementCount) items.textContent = "No matching music kits.";
    state();
  }
  function stopPreview() {
    player.stopPreview();
    status.textContent = "";
  }
  async function open() {
    closeCosmetics();
    overlay.dataset.musicKits = "true";
    delete overlay.dataset.inspect;
    overlay.classList.remove("hidden");
    search.focus();
    if (!kits.length) {
      status.textContent = "Loading music kits…";
      loading ??= loadMusicKits()
        .then((catalog) => {
          kits = catalog.kits;
          if (!kits.length) throw new Error("No music kits are available.");
          defaultId = catalog.defaultKitId;
          detail(kits.find((kit) => kit.id === equippedId()) ?? kits[0]);
          list();
          status.textContent = `${kits.length} music kits available.`;
        })
        .finally(() => {
          loading = undefined;
        });
      try {
        await loading;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Music kits could not load.";
      }
    } else list();
  }
  const returnTo = (id: string) => {
    stopPreview();
    delete overlay.dataset.musicKits;
    document.getElementById(id)?.click();
  };
  get("music-kit-weapons").onclick = () => returnTo("skins-button");
  get("music-kit-agents").onclick = () => returnTo("inventory-agents");
  get("music-kit-gloves").onclick = () => returnTo("inventory-gloves");
  get("close-music-kits").onclick = () => returnTo("close-skins");
  stop.onclick = stopPreview;
  search.oninput = list;
  equip.onclick = async () => {
    if (!selected) return;
    equip.disabled = true;
    try {
      await player.setKit(selected.id);
      status.textContent = `${selected.name} equipped.`;
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "This music kit could not load.";
    }
    state();
  };
  player.addEventListener("change", state);
  player.addEventListener("error", () => {
    if (isOpen() && player.previewing)
      status.textContent = "This track could not play. Please try again.";
  });
  new MutationObserver(() => {
    if (!isOpen()) player.stopPreview();
  }).observe(overlay, { attributes: true, attributeFilter: ["class", "data-music-kits"] });
  document.getElementById("inventory-music-kits")!.onclick = () => {
    void open();
  };
  document.getElementById("cosmetic-music-kits")!.onclick = () => {
    void open();
  };
}
