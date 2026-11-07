import { assetUrl } from "./asset-url";
import { skinCatalog, skinChoices, setSkin } from "./skins";
import { matchSteamSkin, steamChoice, type SteamItem } from "./steam-inventory";
import { setPlayerProfile, type SteamProfile } from "./player-profile";
import "./steam-account.css";
import { importSteamInventory } from "../steam-inventory-data.mjs";

export function setupSteamAccount() {
  const overlay = document.createElement("section");
  overlay.id = "steam-account";
  overlay.setAttribute("aria-label", "Steam sync");
  overlay.innerHTML = `<p id="steam-status" role="status" aria-live="polite"></p><details id="steam-local-import" hidden><summary>IMPORT FROM THIS DEVICE</summary><p>Open your inventory on Steam, save the JSON page, then select the saved file here. Importing runs on your device.</p><a id="steam-local-open" class="secondary" target="_blank" rel="noopener noreferrer">OPEN STEAM INVENTORY</a><label class="secondary">IMPORT JSON<input id="steam-local-file" type="file" accept=".json,application/json" multiple></label><small>If Steam returns more_items, save every page using last_assetid as start_assetid, then import all pages together in order.</small></details>`;
  document.querySelector("#skin-menu .inventory-toolbar")!.after(overlay);
  const actions = document.createElement("div");
  actions.className = "steam-account-actions";
  actions.innerHTML = `<button id="steam-sync" type="button">SYNC WITH STEAM</button><button id="steam-logout" type="button" hidden>SIGN OUT</button>`;
  document.querySelector("#skin-menu .dialog-heading > div")!.prepend(actions);
  const steamGrid = document.createElement("div");
  steamGrid.id = "steam-items";
  steamGrid.setAttribute("aria-label", "Owned Steam items");
  document.getElementById("skin-grid")!.append(steamGrid);
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const status = el("steam-status");
  let profile: SteamProfile | null = null;
  let busy = false;
  let items: SteamItem[] = [];
  let reportedTotal = 0;
  let adding = false;
  let filter = "all";
  let renderVersion = 0;
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
    el("steam-logout").hidden = !profile;
    el<HTMLButtonElement>("steam-sync").disabled = busy || (!!profile && Date.now() < retryUntil);
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
        steamGrid.replaceChildren();
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
    const grid = steamGrid;
    const version = ++renderVersion;
    if (!items.length || adding) {
      grid.replaceChildren();
      el("inventory-count").textContent =
        `${el("skin-grid").querySelectorAll(":scope > button").length} items`;
      return;
    }
    const catalog = await skinCatalog().catch(() => []);
    if (version !== renderVersion) return;
    grid.replaceChildren();
    let supported = 0;
    const query = el<HTMLInputElement>("skin-search").value.trim().toLowerCase();
    const sort = el<HTMLSelectElement>("inventory-sort").value;
    const visible = items
      .filter(
        (item) =>
          (filter === "all" ||
            (filter === "knives"
              ? /knife|bayonet|karambit|daggers/i.test(item.weaponName)
              : matchSteamSkin(item, catalog)?.weapon === Number(filter))) &&
          `${item.name} ${item.type ?? ""}`.toLowerCase().includes(query),
      )
      .toSorted(
        (a, b) =>
          (sort === "weapon" ? a.weaponName.localeCompare(b.weaponName) : 0) ||
          a.name.localeCompare(b.name),
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
      row.title = `${item.name}\n${item.type ?? ""}${item.rarity ? ` - ${item.rarity}` : ""}`;
      const detail = document.createElement("small");
      detail.textContent = item.finish || item.type || item.rarity || "";
      row.title += choice
        ? `\nWear ${item.wear} - Pattern ${item.seed}`
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
    el("inventory-count").textContent =
      `${el("skin-grid").querySelectorAll(":scope > button").length + visible.length} items`;
    const empty = el("skin-grid").firstChild;
    if (visible.length && empty?.nodeType === Node.TEXT_NODE) empty.remove();
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "steam-inventory-empty";
      empty.textContent = "No items match your filters.";
      grid.append(empty);
    }
    status.textContent = `${profile?.name}: ${items.length} visible Steam items synced - ${supported} finishes ready to equip.${reportedTotal > items.length ? ` Steam reports ${reportedTotal} total items; the remaining items were not exposed by Steam.` : ""}`;
  }
  document.addEventListener("cs2go-inventory-render", (event) => {
    const state = (event as CustomEvent<{ adding: boolean; filter: string }>).detail;
    adding = state.adding;
    filter = state.filter;
    el("skin-grid").append(steamGrid);
    void renderItems();
  });
  async function sync() {
    if (busy || !profile || Date.now() < retryUntil) return;
    busy = true;
    controls();
    status.textContent = "Syncing your CS2 inventory...";
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
    if (el("skin-menu").classList.contains("hidden")) el("skins-button").click();
    el("steam-sync").focus();
  };
  el("steam-account-button").onclick = open;
  el("steam-sync").onclick = () => {
    if (profile) void sync();
    else signIn();
  };
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
      steamGrid.replaceChildren();
      status.textContent = "Signed out. Applied local finishes are saved.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Sign out failed.";
    } finally {
      busy = false;
      controls();
    }
  };
  let popup: Window | null = null;
  let popupTimer = 0;
  const finishSignIn = (result: string) => {
    window.clearInterval(popupTimer);
    popup?.close();
    popup = null;
    void refreshSession(result);
  };
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      !popup ||
      event.source !== popup ||
      event.data?.type !== "cs2go-steam-auth"
    )
      return;
    finishSignIn(event.data.result === "connected" ? "connected" : "failed");
  });
  const signIn = () => {
    if (popup && !popup.closed) {
      popup.focus();
      return;
    }
    popup = window.open(
      "/api/steam?action=login&popup=1",
      "cs2go-steam-login",
      `popup,width=720,height=800,left=${Math.round(window.screenX + (window.outerWidth - 720) / 2)},top=${Math.round(window.screenY + (window.outerHeight - 800) / 2)}`,
    );
    if (!popup) {
      status.textContent = "Allow popups for this site, then try signing in again.";
      return;
    }
    status.textContent = "Complete Steam sign-in in the popup window.";
    const deadline = Date.now() + 600000;
    popupTimer = window.setInterval(() => {
      let result: string | null = null;
      try {
        if (popup && popup.location.origin === location.origin)
          result = new URL(popup.location.href).searchParams.get("steam");
      } catch {
        // Steam's page is cross-origin; wait for its verified callback to return here.
      }
      if (!result && popup && !popup.closed && Date.now() < deadline) return;
      finishSignIn(result ?? "cancelled");
    }, 250);
  };
  async function refreshSession(result: string | null) {
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
          result === "failed" || result === "cancelled"
            ? "Steam sign-in was cancelled or could not be verified. Please try again."
            : "Sign in to sync your Steam name, avatar and public CS2 inventory.";
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Steam is unavailable. Local play is ready.";
    }
    if (result) open();
  }
  controls();
  const url = new URL(location.href);
  const result = url.searchParams.get("steam");
  if (result) {
    url.searchParams.delete("steam");
    history.replaceState(null, "", url);
  }
  void refreshSession(result);
}
