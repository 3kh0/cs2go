import { isMapId, PROTOCOL_VERSION, validRoom, type PublicLobby } from "@cs2go/protocol";
import { assetUrl } from "./asset-url";
import "./public-lobbies.css";

export function publicLobbiesMarkup() {
  return `<section class="public-lobbies" aria-labelledby="public-lobbies-title"><header><h3 id="public-lobbies-title">PUBLIC LOBBIES</h3><button id="refresh-lobbies" type="button" aria-label="Refresh public lobbies">↻</button></header><p id="public-lobby-status" role="status" aria-live="polite">Select ONLINE to browse.</p><div id="public-lobby-list" role="list" aria-label="Public lobbies"></div></section>`;
}

function validLobby(value: unknown): value is PublicLobby {
  if (!value || typeof value !== "object") return false;
  const lobby = value as PublicLobby;
  return (
    validRoom(lobby.room) &&
    typeof lobby.name === "string" &&
    lobby.name.length <= 64 &&
    isMapId(lobby.map) &&
    (lobby.mode === "casual" || lobby.mode === "competitive") &&
    Number.isInteger(lobby.players) &&
    Number.isInteger(lobby.capacity) &&
    lobby.players >= 0 &&
    lobby.capacity > 0 &&
    lobby.capacity <= 20 &&
    lobby.players <= lobby.capacity
  );
}

/** Refresh on explicit navigation/server changes; no background polling loops. */
export function setupPublicLobbies(server: HTMLSelectElement, join: (room: string) => void) {
  const list = document.getElementById("public-lobby-list")!;
  const status = document.getElementById("public-lobby-status")!;
  const refreshButton = document.getElementById("refresh-lobbies") as HTMLButtonElement;
  let request: AbortController | undefined;
  const cancel = () => {
    request?.abort();
    request = undefined;
    refreshButton.disabled = false;
  };
  const refresh = async () => {
    cancel();
    const controller = (request = new AbortController());
    refreshButton.disabled = true;
    list.replaceChildren();
    status.textContent = "Finding public lobbies…";
    try {
      const url = new URL(server.value);
      url.protocol = url.protocol === "wss:" ? "https:" : "http:";
      url.pathname = "/lobbies";
      url.search = url.hash = "";
      const response = await fetch(url, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
      });
      if (response.status === 404)
        throw new Error(
          "This server needs an update to show public lobbies. PIN joining is still available.",
        );
      if (!response.ok)
        throw new Error("Could not load public lobbies. Refresh or choose another server.");
      const body = (await response.json()) as { version?: number; lobbies?: unknown[] };
      if (
        body.version !== PROTOCOL_VERSION ||
        !Array.isArray(body.lobbies) ||
        body.lobbies.length > 128 ||
        !body.lobbies.every(validLobby)
      )
        throw new Error("Incompatible lobby browser. Refresh the game and try again.");
      if (request !== controller) return;
      status.textContent = body.lobbies.length
        ? `${body.lobbies.length} ${body.lobbies.length === 1 ? "lobby" : "lobbies"} on ${url.hostname}`
        : "No public lobbies on this server. Create one, or choose another server.";
      for (const lobby of body.lobbies) {
        const row = document.createElement("div");
        row.setAttribute("role", "listitem");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.publicRoom = lobby.room;
        button.disabled = lobby.players >= lobby.capacity;
        const badge = document.createElement("img");
        badge.src = assetUrl(`/ui/home/${lobby.map === "dust2" ? "dust2" : "mirage"}-emblem.svg`);
        badge.alt = "";
        const detail = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = lobby.name;
        const metadata = document.createElement("small");
        metadata.textContent = `${lobby.map === "dust2" ? "Dust II" : "Mirage"} · ${lobby.mode === "casual" ? "Casual" : "Competitive"}`;
        detail.append(name, metadata);
        const count = document.createElement("span");
        count.className = "public-lobby-count";
        count.textContent = button.disabled ? "FULL" : `${lobby.players}/${lobby.capacity}`;
        button.setAttribute(
          "aria-label",
          `Join ${lobby.name}, ${metadata.textContent}, ${lobby.players} of ${lobby.capacity} players${button.disabled ? ", full" : ""}`,
        );
        button.append(badge, detail, count);
        button.onclick = () => join(lobby.room);
        row.append(button);
        list.append(row);
      }
    } catch (error) {
      if (request !== controller || controller.signal.aborted) return;
      status.textContent =
        error instanceof TypeError || (error as Error).name === "TimeoutError"
          ? "Could not reach the server. Refresh or choose another server."
          : (error as Error).message;
    } finally {
      if (request === controller) {
        request = undefined;
        refreshButton.disabled = false;
      }
    }
  };
  refreshButton.onclick = () => {
    void refresh();
  };
  return { refresh, cancel };
}
