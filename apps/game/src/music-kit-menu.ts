import { assetUrl } from "./asset-url";
import type { Game } from "./game";
import { defaultMusicKitId, loadMusicKits, musicEventLabels, type MusicKit } from "./music-kits";
import "./music-kit-menu.css";

/** Inventory actions and the native-style, streamed music inspection view. */
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
  </nav>
  <section class="music-kit-browser">
    <label class="music-kit-search">Find a music kit<input id="music-kit-search" type="search" placeholder="Search music kits…" autocomplete="off"></label>
    <div id="music-kit-items" role="group" aria-label="Available music kits"></div>
    <p id="music-kit-status" role="status" aria-live="polite"></p>
  </section>
  <div id="music-kit-context" class="music-kit-popup" role="menu" aria-label="Music kit actions" hidden>
    <button id="inspect-music-kit" type="button" role="menuitem">Inspect</button>
    <button id="equip-music-kit" type="button" role="menuitem">Equip Music Kit</button>
  </div>
  <section id="music-kit-inspect" role="dialog" aria-modal="true" aria-labelledby="music-kit-name" hidden>
    <h2 id="music-kit-name"></h2>
    <div id="music-kit-stage" tabindex="0" role="img" aria-label="3D music kit. Drag to rotate; arrow keys rotate; Home resets."><span id="music-kit-model-status" role="status"></span></div>
    <div class="music-kit-inspect-description"><p>This Music Kit will replace all of the music in the game.<br>It also includes an MVP Anthem that plays when you are MVP.</p><p>The Music Kit replaces the following music:<br>- Main Menu<br>- Round Start and End<br>- Map Objective<br>- Ten Second Warning<br>- Death Camera<br>- MVP Anthem</p><p id="music-kit-description"></p></div>
    <footer class="music-kit-inspect-footer">
      <div class="music-kit-audio-control"><button id="music-kit-audio" type="button" aria-label="Preview music tracks" aria-expanded="false" aria-controls="music-kit-tracks"><img src="${assetUrl("/models/music-kit/audio.svg")}" alt=""></button><div id="music-kit-tracks" class="music-kit-popup" role="menu" aria-label="Music events and tracks" hidden></div></div>
      <span id="music-kit-playing" role="status" aria-live="polite"></span>
      <button id="close-music-kit-inspect" type="button">CLOSE</button>
    </footer>
  </section>`;
  overlay.append(dialog);
  const get = <E extends HTMLElement>(id: string) => dialog.querySelector<E>(`#${id}`)!;
  const player = game.soundscape.musicKits;
  const items = get("music-kit-items");
  const tracks = get("music-kit-tracks");
  const search = get<HTMLInputElement>("music-kit-search");
  const status = get("music-kit-status");
  const playing = get("music-kit-playing");
  const context = get("music-kit-context");
  const inspect = get("music-kit-inspect");
  const audioButton = get<HTMLButtonElement>("music-kit-audio");
  const title = get("music-kit-name");
  const equip = get<HTMLButtonElement>("equip-music-kit");
  let kits: MusicKit[] = [];
  let defaultId = "";
  let selected: MusicKit | undefined;
  let loading: Promise<void> | undefined;
  let previewLoad: Promise<void> | undefined;
  let generation = 0;
  const equippedId = () => (player.kitId === defaultMusicKitId ? defaultId : player.kitId);
  const isOpen = () =>
    overlay.dataset.musicKits === "true" && !overlay.classList.contains("hidden");
  function fitTitle() {
    if (inspect.hidden || !isOpen()) return;
    title.style.fontSize = "";
    const size = Number.parseFloat(getComputedStyle(title).fontSize);
    if (title.clientWidth > 0 && title.scrollWidth > title.clientWidth)
      title.style.fontSize = `${(size * title.clientWidth) / title.scrollWidth}px`;
  }
  new ResizeObserver(fitTitle).observe(overlay);
  function closeTracks() {
    tracks.hidden = true;
    audioButton.setAttribute("aria-expanded", "false");
  }
  function state() {
    equip.disabled = !selected || selected.id === equippedId();
    equip.textContent = selected?.id === equippedId() ? "Equipped" : "Equip Music Kit";
    for (const card of items.querySelectorAll<HTMLButtonElement>("[data-music-kit]"))
      card.dataset.equipped = String(card.dataset.musicKit === equippedId());
    for (const button of tracks.querySelectorAll<HTMLButtonElement>("[data-music-event]")) {
      const active = player.previewing;
      button.setAttribute(
        "aria-pressed",
        String(
          !!active &&
            active.kitId === selected?.id &&
            active.event === button.dataset.musicEvent &&
            active.track === Number(button.dataset.musicTrack),
        ),
      );
    }
  }
  function play(kit: MusicKit, event: string, index = 0) {
    game.ensureAudio();
    player.preview(kit, event, index);
    const count = kit.events[event]?.tracks.length ?? kit.extraTracks?.length ?? 1;
    playing.textContent = `${musicEventLabels[event] ?? event}${count > 1 ? ` · ${index + 1}` : ""}`;
    state();
  }
  function closeInspect(focus = true) {
    generation++;
    inspect.hidden = true;
    delete overlay.dataset.musicInspect;
    closeTracks();
    player.stopPreview();
    game.musicKitPreview?.hide();
    playing.textContent = "";
    if (focus && selected)
      items.querySelector<HTMLButtonElement>(`[data-music-kit="${selected.id}"]`)?.focus();
  }
  async function inspectSelected() {
    if (!selected) return;
    const kit = selected;
    const token = ++generation;
    context.hidden = true;
    inspect.hidden = false;
    overlay.dataset.musicInspect = "true";
    title.textContent = `Music Kit | ${kit.name}`;
    fitTitle();
    get("music-kit-description").textContent = (kit.description ?? "")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/?(?:i|b|font)(?:\s[^>]*)?>/gi, "");
    tracks.replaceChildren();
    const events = { ...kit.events };
    if (kit.extraTracks?.length) events.extra = { tracks: kit.extraTracks };
    for (const [event, cue] of Object.entries(events)) {
      cue.tracks.forEach((_, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "menuitem");
        button.dataset.musicEvent = event;
        button.dataset.musicTrack = String(index);
        button.textContent = `${musicEventLabels[event] ?? event}${cue.tracks.length > 1 ? ` · ${index + 1}` : ""}`;
        button.onclick = () => {
          play(kit, event, index);
          closeTracks();
          audioButton.focus();
        };
        tracks.append(button);
      });
    }
    play(kit, "menu");
    get("music-kit-stage").focus();
    get("music-kit-model-status").textContent = "Loading music kit…";
    try {
      previewLoad ??= import("./music-kit-preview")
        .then(({ MusicKitPreview }) => {
          game.musicKitPreview = new MusicKitPreview(get("music-kit-stage"));
        })
        .catch((error: unknown) => {
          previewLoad = undefined;
          throw error;
        });
      await previewLoad;
      if (token !== generation || !isOpen()) return;
      await game.musicKitPreview!.show(kit.id);
      if (token === generation) get("music-kit-model-status").textContent = "";
    } catch {
      if (token === generation)
        get("music-kit-model-status").textContent =
          "The 3D music kit could not load. Close and inspect again to retry.";
    }
  }
  function choose(kit: MusicKit, card: HTMLButtonElement, event?: MouseEvent) {
    selected = kit;
    state();
    context.hidden = false;
    const rect = overlay.getBoundingClientRect();
    const bounds = card.getBoundingClientRect();
    const scaleX = rect.width / overlay.clientWidth;
    const scaleY = rect.height / overlay.clientHeight;
    context.style.left = `${Math.max(0, Math.min((event?.clientX ?? bounds.left) - rect.left, rect.width - context.offsetWidth * scaleX)) / scaleX}px`;
    context.style.top = `${Math.max(0, Math.min((event?.clientY ?? bounds.bottom) - rect.top, rect.height - context.offsetHeight * scaleY)) / scaleY}px`;
    get("inspect-music-kit").focus();
  }
  function list() {
    context.hidden = true;
    const query = search.value.trim().toLocaleLowerCase();
    items.replaceChildren();
    for (const kit of kits) {
      if (!`${kit.name} ${kit.artist ?? ""}`.toLocaleLowerCase().includes(query)) continue;
      const card = document.createElement("button");
      card.type = "button";
      card.dataset.musicKit = kit.id;
      card.setAttribute("aria-label", kit.name);
      card.setAttribute("aria-haspopup", "menu");
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
      card.onclick = (event) => choose(kit, card, event.detail ? event : undefined);
      card.oncontextmenu = (event) => {
        event.preventDefault();
        choose(kit, card, event);
      };
      items.append(card);
    }
    if (!items.childElementCount) items.textContent = "No matching music kits.";
    state();
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
          list();
          status.textContent = "";
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
    closeInspect(false);
    context.hidden = true;
    delete overlay.dataset.musicKits;
    document.getElementById(id)?.click();
  };
  get("music-kit-weapons").onclick = () => returnTo("skins-button");
  get("music-kit-agents").onclick = () => returnTo("inventory-agents");
  get("music-kit-gloves").onclick = () => returnTo("inventory-gloves");
  get("inspect-music-kit").onclick = () => {
    void inspectSelected();
  };
  get("close-music-kit-inspect").onclick = () => closeInspect();
  audioButton.onclick = () => {
    const opening = tracks.hidden;
    closeTracks();
    tracks.hidden = !opening;
    audioButton.setAttribute("aria-expanded", String(opening));
    if (opening) tracks.querySelector<HTMLButtonElement>("[aria-pressed=true]")?.focus();
  };
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
    context.hidden = true;
    state();
  };
  // Capture Escape before the shared Inventory handler so nested menus close first.
  dialog.addEventListener(
    "keydown",
    (event) => {
      const popup = !tracks.hidden ? tracks : !context.hidden ? context : undefined;
      if (popup && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        const buttons = [...popup.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== "Escape") return;
      if (!tracks.hidden) {
        closeTracks();
        audioButton.focus();
      } else if (!context.hidden) {
        context.hidden = true;
        if (selected)
          items.querySelector<HTMLButtonElement>(`[data-music-kit="${selected.id}"]`)?.focus();
      } else if (!inspect.hidden) closeInspect();
      else return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node;
    if (!context.contains(target)) context.hidden = true;
    if (!get("music-kit-audio").parentElement!.contains(target)) closeTracks();
  });
  player.addEventListener("change", state);
  player.addEventListener("error", () => {
    if (isOpen() && player.previewing)
      playing.textContent = "This track could not play. Please try another.";
  });
  new MutationObserver(() => {
    if (!isOpen()) {
      context.hidden = true;
      closeInspect(false);
    }
  }).observe(overlay, { attributes: true, attributeFilter: ["class", "data-music-kits"] });
  for (const id of ["inventory-music-kits", "cosmetic-music-kits"])
    document.getElementById(id)!.onclick = () => {
      void open();
    };
}
