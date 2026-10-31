import { assetUrl } from "./asset-url";
import { skinCatalog, skinChoices, setSkin } from "./skins";
import { matchSteamSkin, steamChoice, type SteamItem } from "./steam-inventory";
import { setPlayerProfile, type SteamProfile } from "./player-profile";
import "./steam-account.css";
import { importSteamInventory } from "../steam-inventory-data.mjs";

export function setupSteamAccount() {
  const overlay = document.createElement("section");
  overlay.id = "steam-account";
  overlay.className = "overlay hidden";
  overlay.setAttribute("role", "region");
  overlay.setAttribute("aria-labelledby", "steam-account-title");
  overlay.innerHTML = `<div class="steam-account-page"><div class="dialog-heading"><div><div class="eyebrow">STEAM ACCOUNT</div><h2 id="steam-account-title">INVENTORY</h2></div><button id="steam-account-close" class="close" aria-label="Close Steam account">×</button></div><div class="steam-account-actions"><a class="secondary" id="steam-login" href="/api/steam?action=login">SIGN IN THROUGH STEAM</a><button id="steam-sync" class="secondary" hidden>SYNC INVENTORY</button><button id="steam-logout" class="secondary" hidden>SIGN OUT</button></div><p id="steam-status" role="status" aria-live="polite"></p><details id="steam-local-import" hidden><summary>IMPORT FROM THIS DEVICE</summary><p>Open your inventory on Steam, save the JSON page, then select the saved file here. Importing runs on your device.</p><a id="steam-local-open" class="secondary" target="_blank" rel="noopener noreferrer">OPEN STEAM INVENTORY</a><label class="secondary">IMPORT JSON<input id="steam-local-file" type="file" accept=".json,application/json" multiple></label><small>If Steam returns more_items, save every page using last_assetid as start_assetid, then import all pages together in order.</small></details><div class="steam-inventory-toolbar"><input id="steam-item-search" type="search" aria-label="Search inventory" placeholder="Search inventory…"><nav id="steam-item-filters" aria-label="Inventory categories"><button data-item-filter="Everything" aria-pressed="true">EVERYTHING</button><button data-item-filter="Equipment">EQUIPMENT</button><button data-item-filter="Graphic Art">GRAPHIC ART</button><button data-item-filter="Containers">CONTAINERS</button><button data-item-filter="Display">DISPLAY</button></nav><label>Sort <select id="steam-item-sort"><option value="newest">Newest</option><option value="name">Name</option><option value="type">Type</option></select></label></div><div id="steam-items" aria-label="Owned Steam items"></div><p class="steam-inventory-footer">Your Steam inventory · Equipping applies the exact available wear and pattern locally.</p></div>`;
  document.body.append(overlay);
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const status = el("steam-status");
  let profile: SteamProfile | null = null;
  let busy = false;
  let items: SteamItem[] = [];
  let reportedTotal = 0;
  let filter = "Everything";
  let renderVersion = 0;
  let returnFocus: HTMLElement | null = null;
  let retryUntil = 0;
  let retryTimer = 0;
  try {
    const saved = Number(sessionStorage.getItem("cs2go-steam-sync-retry"));
    if (Number.isFinite(saved) && saved > Date.now() && saved < Date.now() + 86400000) {
      retryUntil = saved;
      retryTimer = window.setTimeout(controls, saved - Date.now() + 50);
    }
  } catch {}
  const cacheKey = "cs2go-steam-inventory";
  function saveSnapshot(data: { items: SteamItem[]; reportedTotal: number; syncedAt: number }) {
    try {
      const value = JSON.stringify({ steamId: profile!.steamId, ...data });
      if (value.length < 4000000) localStorage.setItem(cacheKey, value);
    } catch {
      /* Storage may be unavailable or full; the in-memory view remains usable. */
    }
  }
  function restoreSnapshot() {
    try {
      const data = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (
        data?.steamId !== profile?.steamId ||
        !Array.isArray(data.items) ||
        data.items.length > 100000 ||
        !Number.isFinite(data.syncedAt) ||
        !data.items.every(
          (item: SteamItem) =>
            typeof item.assetId === "string" &&
            typeof item.name === "string" &&
            typeof item.weaponName === "string" &&
            typeof item.finish === "string",
        )
      )
        return null;
      return data;
    } catch {
      return null;
    }
  }
  function cooldown(seconds: number) {
    retryUntil = Date.now() + seconds * 1000;
    try {
      sessionStorage.setItem("cs2go-steam-sync-retry", String(retryUntil));
    } catch {}
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(controls, seconds * 1000 + 50);
  }
  function controls() {
    el("steam-login").hidden = !!profile;
    el("steam-sync").hidden = el("steam-logout").hidden = !profile;
    el<HTMLButtonElement>("steam-sync").disabled = busy || Date.now() < retryUntil;
    el("steam-local-import").hidden = !profile;
    el<HTMLInputElement>("steam-local-file").disabled = busy;
    if (profile)
      el<HTMLAnchorElement>("steam-local-open").href =
        `https://steamcommunity.com/inventory/${profile.steamId}/730/2?l=english&count=2000`;
    el<HTMLButtonElement>("steam-logout").disabled = busy;
  }
  async function api(action: string, method = "GET") {
    const response = await fetch(`/api/steam?action=${action}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
    });
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json"))
      throw new Error(
        "Steam login needs a server endpoint. Run bun run dev or configure the deployed Steam endpoint.",
      );
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429 && action === "sync") {
        const seconds = Number(response.headers.get("Retry-After") || data.retryAfter || 120);
        cooldown(Number.isFinite(seconds) ? Math.max(1, Math.min(86400, seconds)) : 120);
      }
      if (response.status === 401) {
        profile = null;
        setPlayerProfile(null);
        items = [];
        el("steam-items").replaceChildren();
      }
      throw new Error(
        (data.error || "Steam could not be reached.") +
          (response.status === 429 && action === "sync"
            ? ` Retry in ${Math.ceil((retryUntil - Date.now()) / 1000)} seconds.`
            : ""),
      );
    }
    return data;
  }
  async function renderItems() {
    const grid = el("steam-items");
    const version = ++renderVersion;
    if (!items.length) {
      grid.replaceChildren();
      return;
    }
    const catalog = await skinCatalog().catch(() => []);
    if (version !== renderVersion) return;
    grid.replaceChildren();
    let supported = 0;
    const query = el<HTMLInputElement>("steam-item-search").value.trim().toLowerCase();
    const sort = el<HTMLSelectElement>("steam-item-sort").value;
    const category = (item: SteamItem) =>
      /container|case|capsule|package/i.test(item.type ?? "")
        ? "Containers"
        : /sticker|graffiti|patch|music/i.test(item.type ?? "")
          ? "Graphic Art"
          : /medal|coin|pin|collectible|trophy/i.test(item.type ?? "")
            ? "Display"
            : "Equipment";
    const visible = items
      .filter(
        (item) =>
          (filter === "Everything" || category(item) === filter) &&
          `${item.name} ${item.type ?? ""}`.toLowerCase().includes(query),
      )
      .toSorted((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "type"
            ? (a.type ?? "").localeCompare(b.type ?? "") || a.name.localeCompare(b.name)
            : a.assetId.length === b.assetId.length
              ? b.assetId.localeCompare(a.assetId)
              : b.assetId.length - a.assetId.length,
      );
    for (const item of visible) {
      const skin = matchSteamSkin(item, catalog);
      // Cases, stickers, unsupported weapons and missing finishes remain visible as names.
      const choice = skin && steamChoice(item, skin);
      const row = document.createElement("div");
      row.className = "steam-item";
      row.style.setProperty(
        "--item-rarity",
        /^#[0-9a-f]{6}$/i.test(item.color ?? "") ? item.color! : "#b0c3d9",
      );
      if (item.image || skin) {
        const image = document.createElement("img");
        image.src = item.image || assetUrl(skin!.image);
        image.loading = "lazy";
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        row.append(image);
      }
      const description = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = item.weaponName ? item.name.split(" | ")[0] : item.name;
      row.title = `${item.name}\n${item.type ?? ""}${item.rarity ? ` · ${item.rarity}` : ""}`;
      const detail = document.createElement("small");
      detail.textContent = item.finish || item.type || item.rarity || "";
      row.title += choice
        ? `\nWear ${item.wear} · Pattern ${item.seed}`
        : skin
          ? "\nSteam did not return exact wear and pattern for this item."
          : "";
      description.append(name, detail);
      row.append(description);
      if (skin && choice) {
        supported++;
        const equip = document.createElement("button");
        equip.className = "secondary";
        const equipped = () =>
          skinChoices[skin.weapon].id === choice.id &&
          skinChoices[skin.weapon].wear === choice.wear &&
          skinChoices[skin.weapon].seed === choice.seed;
        equip.textContent = equipped() ? "EQUIPPED" : "EQUIP";
        equip.setAttribute("aria-pressed", String(equipped()));
        equip.dataset.steamAsset = item.assetId;
        equip.dataset.steamWeapon = String(skin.weapon);
        equip.onclick = async () => {
          if (busy) return;
          busy = true;
          controls();
          grid.querySelectorAll("button").forEach((button) => {
            button.disabled = true;
          });
          try {
            await setSkin(skin.weapon, choice);
            status.textContent = `Equipped ${item.name} with its Steam wear and pattern.`;
            grid.querySelectorAll(`[data-steam-weapon="${skin.weapon}"]`).forEach((button) => {
              button.setAttribute("aria-pressed", "false");
              button.textContent = "EQUIP";
            });
            equip.textContent = "EQUIPPED";
            equip.setAttribute("aria-pressed", "true");
          } catch (error) {
            status.textContent =
              error instanceof Error ? error.message : "This finish could not load.";
          } finally {
            busy = false;
            controls();
            grid.querySelectorAll("button").forEach((button) => {
              button.disabled = false;
            });
          }
        };
        row.append(equip);
      }
      grid.append(row);
    }
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "steam-inventory-empty";
      empty.textContent = "No items match your filters.";
      grid.append(empty);
    }
    status.textContent = `${profile?.name}: ${items.length} visible Steam items synced · ${supported} finishes ready to equip.${reportedTotal > items.length ? ` Steam reports ${reportedTotal} total items; the remaining items were not exposed by Steam.` : ""}`;
  }
  el("steam-item-search").oninput = () => void renderItems();
  el("steam-item-sort").onchange = () => void renderItems();
  el("steam-item-filters").onclick = (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-item-filter]");
    if (!button) return;
    filter = button.dataset.itemFilter!;
    el("steam-item-filters")
      .querySelectorAll("button")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    void renderItems();
  };
  async function sync() {
    if (busy || !profile || Date.now() < retryUntil) return;
    busy = true;
    controls();
    status.textContent = "Syncing your CS2 inventory…";
    try {
      const data = await api("sync", "POST");
      items = data.items;
      reportedTotal = data.reportedTotal;
      saveSnapshot(data);
      await renderItems();
      if (!items.length) status.textContent = "Your public CS2 inventory is empty.";
    } catch (error) {
      status.textContent =
        (error instanceof Error ? error.message : "Steam sync failed. Try again later.") +
        (items.length ? " Showing your last successful inventory." : "");
      el<HTMLDetailsElement>("steam-local-import").open = true;
    } finally {
      busy = false;
      controls();
    }
  }
  el<HTMLInputElement>("steam-local-file").onchange = async (event) => {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files || [])];
    if (busy || !profile || !files.length) return;
    busy = true;
    controls();
    try {
      if (files.length > 50 || files.reduce((sum, file) => sum + file.size, 0) > 25000000)
        throw new Error("Choose up to 50 JSON pages, totaling no more than 25 MB.");
      const pages = await Promise.all(files.map(async (file) => JSON.parse(await file.text())));
      const data = importSteamInventory(
        pages.flatMap((page) => (Array.isArray(page) ? page : [page])),
      );
      items = data.items;
      reportedTotal = data.reportedTotal;
      saveSnapshot(data);
      await renderItems();
      status.textContent = `Imported ${items.length} visible Steam items on this device. No inventory data was uploaded.`;
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Inventory JSON could not be imported.";
    } finally {
      input.value = "";
      busy = false;
      controls();
    }
  };
  const open = () => {
    returnFocus = document.activeElement as HTMLElement;
    overlay.classList.remove("hidden");
    el("steam-account-close").focus();
  };
  const close = () => {
    overlay.classList.add("hidden");
    (returnFocus?.getClientRects().length ? returnFocus : el("steam-account-button")).focus();
  };
  el("steam-account-button").onclick = open;
  el("steam-account-close").onclick = close;
  document.addEventListener("steam-account-open", open);
  document.addEventListener(
    "keydown",
    (event) => {
      if (overlay.classList.contains("hidden")) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    },
    true,
  );
  el("steam-sync").onclick = sync;
  el("steam-logout").onclick = async () => {
    if (busy) return;
    busy = true;
    controls();
    try {
      await api("logout", "POST");
      profile = null;
      try {
        localStorage.removeItem(cacheKey);
      } catch {}
      setPlayerProfile(null);
      items = [];
      el("steam-items").replaceChildren();
      status.textContent = "Signed out. Applied local finishes are saved.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Sign out failed.";
    } finally {
      busy = false;
      controls();
    }
  };
  controls();
  void (async () => {
    const url = new URL(location.href);
    const result = url.searchParams.get("steam");
    if (result) {
      url.searchParams.delete("steam");
      history.replaceState(null, "", url);
    }
    try {
      profile = (await api("session")).profile;
      setPlayerProfile(profile);
      controls();
      if (profile) {
        const saved = restoreSnapshot();
        if (saved) {
          items = saved.items;
          reportedTotal = saved.reportedTotal;
          await renderItems();
        }
        if (!saved || Date.now() - saved.syncedAt > 600000) await sync();
      } else
        status.textContent =
          result === "failed"
            ? "Steam sign-in was cancelled or could not be verified. Please try again."
            : "Sign in to sync your Steam name, avatar and public CS2 inventory.";
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Steam is unavailable. Local play is ready.";
    }
    if (result) open();
  })();
}
