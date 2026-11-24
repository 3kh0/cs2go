const STORAGE_KEY = "cs2go-custom-servers";
const CUSTOM = "custom";

/** Accepts `host`, `host:port`, `http(s)://host` or `ws(s)://host/path` and
 * returns the WebSocket endpoint, or an error message for the player. */
export function normalizeServer(
  input: string,
  secure = location.protocol === "https:",
): { url: string } | { error: string } {
  let text = input.trim();
  if (!text) return { error: "Enter a server address." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const local = /^(localhost|127\.|\[::1\])/i.test(text);
    text = `${local ? "ws" : "wss"}://${text}`;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { error: "That is not a valid server address." };
  }
  if (url.protocol === "https:") url.protocol = "wss:";
  else if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol !== "wss:" && url.protocol !== "ws:")
    return { error: "Server addresses must use ws://, wss://, http:// or https://." };
  if (url.username || url.password) return { error: "Server addresses cannot include a login." };
  if (secure && url.protocol === "ws:" && !/^(localhost|127\.|\[::1\])/.test(url.hostname))
    return { error: "This page needs a secure server. Use a wss:// or https:// address." };
  if (url.pathname === "/" || !url.pathname) url.pathname = "/ws";
  url.search = url.hash = "";
  return { url: url.toString() };
}

function readSaved(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string").slice(0, 16)
      : [];
  } catch {
    return [];
  }
}
function writeSaved(servers: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
  } catch {
    /* The server stays selected for this session. */
  }
}

/** Adds saved custom servers to the server picker and wires the add/remove row.
 * The `change` event fires whenever the selected endpoint changes. */
export function setupCustomServers(select: HTMLSelectElement) {
  const row = document.getElementById("custom-server")!;
  const input = document.getElementById("custom-server-url") as HTMLInputElement;
  const add = document.getElementById("custom-server-add") as HTMLButtonElement;
  const remove = document.getElementById("custom-server-remove") as HTMLButtonElement;
  const status = document.getElementById("match-status")!;
  const builtIn = new Set([...select.options].map((option) => option.value));
  const customOption = new Option("Custom server…", CUSTOM);
  select.add(customOption);
  let previous = select.value;
  const option = (url: string) => {
    const existing = [...select.options].find((entry) => entry.value === url);
    if (existing) return existing;
    const created = new Option(new URL(url).host, url);
    created.dataset.custom = "true";
    select.insertBefore(created, customOption);
    return created;
  };
  for (const url of readSaved()) if (!("error" in normalizeServer(url, false))) option(url);
  const sync = () => {
    const custom = select.value === CUSTOM;
    row.hidden = !custom && !select.selectedOptions[0]?.dataset.custom;
    input.hidden = add.hidden = !custom;
    remove.hidden = custom;
  };
  /** Select (and remember) an endpoint; returns false for an invalid address. */
  const choose = (address: string, announce = true) => {
    const result = normalizeServer(address);
    if ("error" in result) {
      if (announce) status.textContent = result.error;
      return false;
    }
    if (!builtIn.has(result.url)) {
      option(result.url);
      const saved = readSaved().filter((url) => url !== result.url);
      writeSaved([result.url, ...saved]);
    }
    select.value = previous = result.url;
    sync();
    if (announce) status.textContent = "";
    select.dispatchEvent(new Event("change"));
    return true;
  };
  select.addEventListener("change", () => {
    if (select.value === CUSTOM) {
      sync();
      input.focus();
      return;
    }
    previous = select.value;
    sync();
  });
  add.onclick = () => {
    if (choose(input.value)) input.value = "";
    else input.focus();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      add.click();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      select.value = previous;
      sync();
    }
  });
  remove.onclick = () => {
    const selected = select.selectedOptions[0];
    if (!selected?.dataset.custom) return;
    writeSaved(readSaved().filter((url) => url !== selected.value));
    selected.remove();
    select.selectedIndex = 0;
    previous = select.value;
    sync();
    select.dispatchEvent(new Event("change"));
  };
  sync();
  return {
    choose,
    /** The active endpoint; never the "Custom server…" placeholder. */
    get value() {
      return select.value === CUSTOM ? previous : select.value;
    },
  };
}
